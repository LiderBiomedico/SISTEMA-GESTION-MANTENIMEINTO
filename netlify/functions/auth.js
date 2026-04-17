// =============================================================================
// netlify/functions/auth.js - Autenticación usuario + contraseña contra Airtable
// Tabla: "contraseña" — busca campos por nombre directo sin normalización
// =============================================================================

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY || process.env.AIRTABLE_TOKEN || '';
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID || '';
const AIRTABLE_API     = 'https://api.airtable.com/v0';

// Nombre de la tabla codificado manualmente: "contraseña" → "contrase%C3%B1a"
const AUTH_TABLE_ENCODED = 'contrase%C3%B1a';

// Nombres EXACTOS de los campos en Airtable (tal como aparecen en la interfaz)
// Se definen como Buffer para evitar cualquier problema de encoding en el source
const FIELD_CONTRASENA = 'Contrase\u00F1a';  // Contraseña  (ñ = U+00F1)
const FIELD_USUARIOS   = 'Usuarios';
const FIELD_NIVEL      = 'nivel';

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
    return jsonResp(500, { success: false, error: 'Configuración del servidor incompleta (API KEY)' });
  }
  if (!AIRTABLE_BASE_ID) {
    return jsonResp(500, { success: false, error: 'Configuración del servidor incompleta (BASE ID)' });
  }

  let username, password;
  try {
    const body = JSON.parse(event.body || '{}');
    username = (body.username || '').trim();
    password = (body.password || '').trim();
  } catch (e) {
    return jsonResp(400, { success: false, error: 'Cuerpo de solicitud inválido' });
  }

  if (!username) return jsonResp(400, { success: false, error: 'Usuario requerido' });
  if (!password) return jsonResp(400, { success: false, error: 'Contraseña requerida' });

  try {
    // Pedir todos los campos sin filtrar (evita encoding de nombres con tildes en query params)
    const url = `${AIRTABLE_API}/${AIRTABLE_BASE_ID}/${AUTH_TABLE_ENCODED}`;
    console.log('[AUTH] URL:', url);

    const response = await fetch(url, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${AIRTABLE_API_KEY}` },
    });

    const responseText = await response.text();
    console.log('[AUTH] HTTP Status:', response.status);

    if (!response.ok) {
      console.error('[AUTH] Airtable error body:', responseText.slice(0, 500));
      return jsonResp(500, {
        success: false,
        error: 'Error consultando la base de datos (HTTP ' + response.status + ')',
      });
    }

    let data;
    try {
      data = JSON.parse(responseText);
    } catch (e) {
      return jsonResp(500, { success: false, error: 'Respuesta JSON inválida de Airtable' });
    }

    const records = data.records || [];
    console.log('[AUTH] Registros en tabla:', records.length);

    // Log de campos disponibles en el primer registro (para debug)
    if (records.length > 0) {
      const fieldNames = Object.keys(records[0].fields);
      console.log('[AUTH] Nombres de campos (raw):', JSON.stringify(fieldNames));
      // Log de códigos Unicode de cada nombre de campo
      fieldNames.forEach(f => {
        const codes = Array.from(f).map(c => 'U+' + c.charCodeAt(0).toString(16).toUpperCase().padStart(4,'0')).join(' ');
        console.log(`[AUTH] Campo "${f}" → ${codes}`);
      });
    }

    const inputUser = username.toLowerCase();
    const inputPass = password;

    let matchRecord = null;

    for (const record of records) {
      const fields = record.fields;

      // Obtener valor del campo Usuarios (buscar por nombre exacto primero, luego fallback)
      let storedUser = '';
      if (fields[FIELD_USUARIOS] !== undefined) {
        storedUser = String(fields[FIELD_USUARIOS]).trim().toLowerCase();
      } else {
        // Fallback: buscar cualquier campo cuyo nombre contenga "usuario"
        for (const [k, v] of Object.entries(fields)) {
          if (k.toLowerCase().includes('usuario')) {
            storedUser = String(v || '').trim().toLowerCase();
            break;
          }
        }
      }

      // Obtener valor del campo Contraseña (buscar por nombre exacto con U+00F1, luego fallback)
      let storedPass = '';
      if (fields[FIELD_CONTRASENA] !== undefined) {
        storedPass = String(fields[FIELD_CONTRASENA]).trim();
      } else {
        // Fallback: buscar cualquier campo cuyo nombre contenga "contra" o "pass"
        for (const [k, v] of Object.entries(fields)) {
          const kl = k.toLowerCase();
          if (kl.includes('contra') || kl.includes('pass')) {
            storedPass = String(v || '').trim();
            break;
          }
        }
      }

      console.log(`[AUTH] Registro: usuario="${storedUser}" pass_len=${storedPass.length} | input_usuario="${inputUser}" input_pass_len=${inputPass.length}`);
      console.log(`[AUTH] Pass coincide: ${storedPass === inputPass}`);

      if (storedUser === inputUser && storedPass === inputPass) {
        matchRecord = record;
        break;
      }
    }

    if (matchRecord) {
      const fields = matchRecord.fields;

      // Obtener nivel
      let nivel = 'inventario maestro';
      if (fields[FIELD_NIVEL] !== undefined) {
        nivel = String(fields[FIELD_NIVEL]).trim().toLowerCase();
      }

      // Obtener nombre real del usuario
      let usuario = username;
      if (fields[FIELD_USUARIOS] !== undefined) {
        usuario = String(fields[FIELD_USUARIOS]).trim();
      }

      console.log('[AUTH] Login exitoso:', usuario, '| nivel:', nivel);
      return jsonResp(200, { success: true, usuario, nivel });

    } else {
      console.log('[AUTH] Login fallido: sin coincidencia');
      return jsonResp(401, { success: false, error: 'Usuario o contraseña incorrectos' });
    }

  } catch (err) {
    console.error('[AUTH] Excepción:', err.name, err.message, err.stack);
    return jsonResp(500, { success: false, error: 'Error interno: ' + err.message });
  }
};
