// =============================================================================
// netlify/functions/auth.js - Validación de contraseña contra Airtable
// Tabla: "contraseña", Campo: "Contraseña"
// =============================================================================

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY || process.env.AIRTABLE_TOKEN || '';
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID || '';
const AUTH_TABLE = 'contraseña';
const AUTH_FIELD = 'Contraseña';
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
    const { password } = JSON.parse(event.body || '{}');
    if (!password) return json(400, { success: false, error: 'Contraseña requerida' });

    // Consultar todos los registros de la tabla contraseña
    const url = `${AIRTABLE_API}/${AIRTABLE_BASE_ID}/${encodeURIComponent(AUTH_TABLE)}?fields%5B%5D=${encodeURIComponent(AUTH_FIELD)}`;
    
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${AIRTABLE_API_KEY}` },
    });

    if (!response.ok) {
      console.error('Airtable error:', response.status);
      return json(500, { success: false, error: 'Error de conexión' });
    }

    const data = await response.json();
    const records = data.records || [];

    // Buscar si algún registro tiene la contraseña correcta
    const match = records.some(r => {
      const stored = (r.fields[AUTH_FIELD] || '').trim();
      return stored === password.trim();
    });

    if (match) {
      return json(200, { success: true });
    } else {
      return json(401, { success: false, error: 'Contraseña incorrecta' });
    }
  } catch (err) {
    console.error('Auth error:', err);
    return json(500, { success: false, error: 'Error interno' });
  }
};
