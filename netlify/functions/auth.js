// =============================================================================
// netlify/functions/auth.js - Autenticación usuario + contraseña contra Airtable
// Tabla: "contraseña", Campos: "Usuarios", "Contraseña", "nivel"
// Node 18+ fetch nativo — robusto para nombres de tabla con caracteres especiales
// =============================================================================

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY || process.env.AIRTABLE_TOKEN || '';
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID || '';

// Nombre real de la tabla en Airtable (con ñ) — se codifica correctamente abajo
const AUTH_TABLE = 'contraseña';
const AIRTABLE_API = 'https://api.airtable.com/v0';

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

  // Verificar variables de entorno
  if (!AIRTABLE_API_KEY) {
    console.error('FATAL: AIRTABLE_API_KEY no configurada');
    return jsonResp(500, { success: false, error: 'Configuración del servidor incompleta' });
  }
  if (!AIRTABLE_BASE_ID) {
    console.error('FATAL: AIRTABLE_BASE_ID no configurada');
    return jsonResp(500, { success: false, error: 'Configuración del servidor incompleta' });
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
    // Construir URL — encodeURIComponent maneja la ñ correctamente en Node 18
    const tableEncoded = encodeURIComponent(AUTH_TABLE);
    const url = `${AIRTABLE_API}/${AIRTABLE_BASE_ID}/${tableEncoded}` +
      `?fields%5B%5D=Usuarios&fields%5B%5D=Contrase%C3%B1a&fields%5B%5D=nivel`;

    console.log('Auth request URL base:', `${AIRTABLE_API}/${AIRTABLE_BASE_ID}/${tableEncoded}`);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
    });

    const responseText = await response.text();
    console.log('Airtable status:', response.status);
    console.log('Airtable response (first 300 chars):', responseText.slice(0, 300));

    if (!response.ok) {
      return jsonResp(500, {
        success: false,
        error: 'Error consultando la base de datos',
        detail: responseText.slice(0, 200)
      });
    }

    let data;
    try {
      data = JSON.parse(responseText);
    } catch (e) {
      console.error('JSON parse error:', e.message);
      return jsonResp(500, { success: false, error: 'Respuesta inválida de la base de datos' });
    }

    const records = data.records || [];
    console.log('Registros encontrados:', records.length);

    // Buscar registro que coincida usuario Y contraseña
    const match = records.find(r => {
      const storedUser = String(r.fields['Usuarios'] || '').trim().toLowerCase();
      const storedPass = String(r.fields['Contraseña'] || '').trim();
      const inputUser  = username.trim().toLowerCase();
      const inputPass  = password.trim();
      console.log(`Comparando: "${storedUser}" == "${inputUser}" && pass match: ${storedPass === inputPass}`);
      return storedUser === inputUser && storedPass === inputPass;
    });

    if (match) {
      const nivel = String(match.fields['nivel'] || 'inventario maestro').trim().toLowerCase();
      const usuario = String(match.fields['Usuarios'] || '').trim();
      console.log('Login exitoso:', usuario, '| nivel:', nivel);
      return jsonResp(200, { success: true, usuario, nivel });
    } else {
      console.log('Login fallido: credenciales no coinciden');
      return jsonResp(401, { success: false, error: 'Usuario o contraseña incorrectos' });
    }

  } catch (err) {
    console.error('Auth exception:', err.name, err.message, err.stack);
    return jsonResp(500, {
      success: false,
      error: 'Error interno del servidor',
      detail: err.message
    });
  }
};
