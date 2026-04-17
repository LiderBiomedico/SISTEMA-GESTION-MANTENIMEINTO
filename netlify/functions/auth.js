// =============================================================================
// netlify/functions/auth.js - Autenticación usuario + contraseña contra Airtable
// Tabla: "contraseña", Campos: "Usuarios", "Contraseña", "nivel"
// =============================================================================

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY || process.env.AIRTABLE_TOKEN || '';
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID || '';
const AUTH_TABLE = 'contraseña';
const AIRTABLE_API = 'https://api.airtable.com/v0';

function json(statusCode, body) {
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
  if (event.httpMethod === 'OPTIONS') return json(204, {});
  if (event.httpMethod !== 'POST') return json(405, { error: 'Método no permitido' });

  try {
    const { username, password } = JSON.parse(event.body || '{}');
    if (!username) return json(400, { success: false, error: 'Usuario requerido' });
    if (!password) return json(400, { success: false, error: 'Contraseña requerida' });

    // Obtener todos los registros de la tabla contraseña con los campos necesarios
    const fields = ['Usuarios', 'Contraseña', 'nivel'];
    const params = fields.map(f => `fields[]=${encodeURIComponent(f)}`).join('&');
    const url = `${AIRTABLE_API}/${AIRTABLE_BASE_ID}/${encodeURIComponent(AUTH_TABLE)}?${params}`;

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${AIRTABLE_API_KEY}` },
    });

    if (!response.ok) {
      console.error('Airtable error:', response.status);
      return json(500, { success: false, error: 'Error de conexión' });
    }

    const data = await response.json();
    const records = data.records || [];

    // Buscar registro que coincida usuario Y contraseña (case-insensitive para usuario)
    const match = records.find(r => {
      const storedUser = (r.fields['Usuarios'] || '').trim().toLowerCase();
      const storedPass = (r.fields['Contraseña'] || '').trim();
      return storedUser === username.trim().toLowerCase() && storedPass === password.trim();
    });

    if (match) {
      const nivel = (match.fields['nivel'] || 'inventario maestro').trim().toLowerCase();
      return json(200, {
        success: true,
        usuario: (match.fields['Usuarios'] || '').trim(),
        nivel: nivel
      });
    } else {
      return json(401, { success: false, error: 'Usuario o contraseña incorrectos' });
    }
  } catch (err) {
    console.error('Auth error:', err);
    return json(500, { success: false, error: 'Error interno' });
  }
};
