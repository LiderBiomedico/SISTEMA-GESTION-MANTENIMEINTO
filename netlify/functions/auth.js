// =============================================================================
// netlify/functions/auth.js - Autenticación usuario + contraseña contra Airtable
// Tabla: "contraseña" — guarda "Ultimo acceso" en Airtable al hacer login exitoso
// =============================================================================

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY || process.env.AIRTABLE_TOKEN || '';
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID || '';
const AIRTABLE_API     = 'https://api.airtable.com/v0';

// Nombre de la tabla codificado: "contraseña" → "contrase%C3%B1a"
const AUTH_TABLE_ENCODED = 'contrase%C3%B1a';

// Nombres EXACTOS de los campos en Airtable
const FIELD_CONTRASENA    = 'Contrase\u00F1a';  // Contraseña
const FIELD_USUARIOS      = 'Usuarios';
const FIELD_NIVEL         = 'nivel';
const FIELD_ULTIMO_ACCESO = 'Ultimo acceso';
const FIELD_NOMBRE        = 'nombre';
const FIELD_EMAIL         = 'email';

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

// Guarda la fecha/hora de acceso en el registro del usuario (fire-and-forget)
async function saveLastAccess(recordId) {
  try {
    const url = `${AIRTABLE_API}/${AIRTABLE_BASE_ID}/${AUTH_TABLE_ENCODED}/${recordId}`;
    // Airtable campo tipo fecha espera formato ISO 8601: "2026-04-17"
    // Si el campo incluye hora, usar: "2026-04-17T14:35:00.000Z"
    const now = new Date();
    const fechaISO = now.toISOString(); // "2026-04-17T19:35:00.000Z"

    await fetch(url, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        fields: { [FIELD_ULTIMO_ACCESO]: fechaISO }
      }),
    });
    console.log('[AUTH] Ultimo acceso guardado:', fechaISO);
  } catch (err) {
    console.error('[AUTH] Error guardando ultimo acceso:', err.message);
  }
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return jsonResp(204, {});
  if (event.httpMethod !== 'POST') return jsonResp(405, { error: 'Método no permitido' });

  if (!AIRTABLE_API_KEY) return jsonResp(500, { success: false, error: 'Config incompleta (API KEY)' });
  if (!AIRTABLE_BASE_ID) return jsonResp(500, { success: false, error: 'Config incompleta (BASE ID)' });

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
    const url = `${AIRTABLE_API}/${AIRTABLE_BASE_ID}/${AUTH_TABLE_ENCODED}`;
    console.log('[AUTH] Consultando tabla...');

    const response = await fetch(url, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${AIRTABLE_API_KEY}` },
    });

    const responseText = await response.text();
    console.log('[AUTH] HTTP Status:', response.status);

    if (!response.ok) {
      console.error('[AUTH] Airtable error:', responseText.slice(0, 300));
      return jsonResp(500, { success: false, error: 'Error consultando la base de datos (HTTP ' + response.status + ')' });
    }

    let data;
    try { data = JSON.parse(responseText); }
    catch (e) { return jsonResp(500, { success: false, error: 'Respuesta JSON inválida de Airtable' }); }

    const records = data.records || [];
    console.log('[AUTH] Registros encontrados:', records.length);

    if (records.length > 0) {
      console.log('[AUTH] Campos disponibles:', JSON.stringify(Object.keys(records[0].fields)));
      // Log todos los registros para debug de nombre
      records.forEach(function(r, i) {
        console.log('[AUTH] Registro '+i+':', JSON.stringify(r.fields));
      });
    }

    const inputUser = username.toLowerCase();
    const inputPass = password;
    let matchRecord = null;

    for (const record of records) {
      const fields = record.fields;

      // Campo Usuarios
      let storedUser = '';
      if (fields[FIELD_USUARIOS] !== undefined) {
        storedUser = String(fields[FIELD_USUARIOS]).trim().toLowerCase();
      } else {
        for (const [k, v] of Object.entries(fields)) {
          if (k.toLowerCase().includes('usuario')) { storedUser = String(v || '').trim().toLowerCase(); break; }
        }
      }

      // Campo Contraseña
      let storedPass = '';
      if (fields[FIELD_CONTRASENA] !== undefined) {
        storedPass = String(fields[FIELD_CONTRASENA]).trim();
      } else {
        for (const [k, v] of Object.entries(fields)) {
          const kl = k.toLowerCase();
          if (kl.includes('contra') || kl.includes('pass')) { storedPass = String(v || '').trim(); break; }
        }
      }

      console.log(`[AUTH] Comparando: "${storedUser}" vs "${inputUser}" | pass_match=${storedPass === inputPass}`);

      if (storedUser === inputUser && storedPass === inputPass) {
        matchRecord = record;
        break;
      }
    }

    if (matchRecord) {
      const fields = matchRecord.fields;

      let nivel = 'inventario maestro';
      if (fields[FIELD_NIVEL] !== undefined) nivel = String(fields[FIELD_NIVEL]).trim().toLowerCase();

      let usuario = username;
      if (fields[FIELD_USUARIOS] !== undefined) usuario = String(fields[FIELD_USUARIOS]).trim();

      // Buscar campo nombre de forma robusta (minúscula, mayúscula, variantes)
      let nombre = usuario; // fallback al username si no hay nombre
      for (const [k, v] of Object.entries(fields)) {
        if (k.toLowerCase() === 'nombre' && v) {
          nombre = String(v).trim();
          console.log('[AUTH] Nombre encontrado en campo "'+k+'": '+nombre);
          break;
        }
      }

      // Buscar campo email de forma robusta
      let email = '';
      for (const [k, v] of Object.entries(fields)) {
        if (k.toLowerCase() === 'email' && v) {
          email = String(v).trim();
          break;
        }
      }

      // Guardar último acceso en Airtable (no bloquea la respuesta)
      await saveLastAccess(matchRecord.id);

      console.log('[AUTH] Login exitoso:', usuario, '| nivel:', nivel, '| nombre:', nombre);
      return jsonResp(200, { success: true, usuario, nivel, nombre, email });

    } else {
      console.log('[AUTH] Login fallido');
      return jsonResp(401, { success: false, error: 'Usuario o contraseña incorrectos' });
    }

  } catch (err) {
    console.error('[AUTH] Excepción:', err.name, err.message);
    return jsonResp(500, { success: false, error: 'Error interno: ' + err.message });
  }
};
