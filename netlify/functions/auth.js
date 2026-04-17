// =============================================================================
// netlify/functions/auth.js - Autenticación usuario + contraseña contra Airtable
// Tabla: "contraseña" — solicita TODOS los campos para evitar problemas de encoding
// =============================================================================

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY || process.env.AIRTABLE_TOKEN || '';
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID || '';
const AIRTABLE_API     = 'https://api.airtable.com/v0';

// Nombre de la tabla codificado manualmente para evitar doble-encoding
// "contraseña" → "contrase%C3%B1a"
const AUTH_TABLE_ENCODED = 'contrase%C3%B1a';

function jsonResp(statusCode, body) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
    },
    body: JSON.stringify(body),
  };
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return jsonResp(204, {});
  if (event.httpMethod !== 'POST') return jsonResp(405, { error: 'Método no permitido' });

  if (!AIRTABLE_API_KEY) {
    console.error('FATAL: AIRTABLE_API_KEY no configurada');
    return jsonResp(500, { success: false, error: 'Configuración del servidor incompleta (API KEY)' });
  }
  if (!AIRTABLE_BASE_ID) {
    console.error('FATAL: AIRTABLE_BASE_ID no configurada');
    return jsonResp(500, { success: false, error: 'Configuración del servidor incompleta (BASE ID)' });
  }

  let username, password;
  try {
    const body = JSON.parse(event.body || '{}');
    username = body.username;
    password = body.password;
  } catch (e) {
    return jsonResp(400, { success: false, error: 'Cuerpo de solicitud inválido' });
  }

  if (!username) return jsonResp(400, { success: false, error: 'Usuario requerido' });
  if (!password) return jsonResp(400, { success: false, error: 'Contraseña requerida' });

  try {
    // Pedir TODOS los campos — sin filtrar por nombre para evitar encoding de campos con tilde
    const url = `${AIRTABLE_API}/${AIRTABLE_BASE_ID}/${AUTH_TABLE_ENCODED}`;
    console.log('Consultando URL:', url);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
    });

    const responseText = await response.text();
    console.log('HTTP Status:', response.status);
    console.log('Respuesta Airtable (300 chars):', responseText.slice(0, 300));

    if (!response.ok) {
      return jsonResp(500, {
        success: false,
        error: 'Error consultando la base de datos',
        httpStatus: response.status,
        detail: responseText.slice(0, 300),
      });
    }

    let data;
    try {
      data = JSON.parse(responseText);
    } catch (e) {
      return jsonResp(500, { success: false, error: 'Respuesta JSON inválida de Airtable' });
    }

    const records = data.records || [];
    console.log('Total registros:', records.length);

    // Mostrar nombres de campos del primer registro para debug
    if (records.length > 0) {
      console.log('Campos disponibles:', Object.keys(records[0].fields).join(', '));
    }

    // Buscar en TODOS los campos posibles: el usuario puede estar en "Usuarios",
    // la contraseña en "Contraseña" o "Contrasena" o variante
    const inputUser = username.trim().toLowerCase();
    const inputPass = password.trim();

    const match = records.find(r => {
      const fields = r.fields;
      // Buscar campo de usuario (puede llamarse "Usuarios" o similar)
      let storedUser = '';
      let storedPass = '';

      for (const [key, val] of Object.entries(fields)) {
        const keyLow = key.toLowerCase().replace(/[áéíóúñ]/g, c =>
          ({á:'a',é:'e',í:'i',ó:'o',ú:'u',ñ:'n'}[c]));
        if (keyLow === 'usuarios' || keyLow === 'usuario') {
          storedUser = String(val || '').trim().toLowerCase();
        }
        if (keyLow === 'contrasena' || keyLow === 'password' || keyLow === 'contrase') {
          storedPass = String(val || '').trim();
        }
      }

      console.log(`Registro: user="${storedUser}" vs "${inputUser}" | pass_match=${storedPass === inputPass}`);
      return storedUser === inputUser && storedPass === inputPass;
    });

    if (match) {
      // Extraer nivel — buscar campo "nivel"
      let nivel = 'inventario maestro';
      for (const [key, val] of Object.entries(match.fields)) {
        if (key.toLowerCase() === 'nivel') {
          nivel = String(val || '').trim().toLowerCase();
          break;
        }
      }
      // Extraer nombre de usuario real
      let usuario = username;
      for (const [key, val] of Object.entries(match.fields)) {
        if (key.toLowerCase() === 'usuarios' || key.toLowerCase() === 'usuario') {
          usuario = String(val || '').trim();
          break;
        }
      }

      console.log('Login exitoso:', usuario, '| nivel:', nivel);
      return jsonResp(200, { success: true, usuario, nivel });
    } else {
      console.log('Credenciales no coinciden con ningún registro');
      return jsonResp(401, { success: false, error: 'Usuario o contraseña incorrectos' });
    }

  } catch (err) {
    console.error('Excepción no controlada:', err.name, err.message);
    return jsonResp(500, {
      success: false,
      error: 'Error interno del servidor: ' + err.message,
    });
  }
};
