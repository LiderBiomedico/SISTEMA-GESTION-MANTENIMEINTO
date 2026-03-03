// netlify/functions/upload-pdf.js
// Sube un PDF a un campo de Airtable via Content API
// Recibe: { recordId, fieldName, filename, contentType, base64 }
// Separado de inventario.js para evitar límite de 6MB de Netlify Functions

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY || process.env.AIRTABLE_TOKEN || '';
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID || '';
const AIRTABLE_TABLE = process.env.AIRTABLE_INVENTARIO_TABLE || 'Inventario';
const AIRTABLE_CONTENT_API = 'https://content.airtableapi.com/v0';
const AIRTABLE_API = 'https://api.airtable.com/v0';

function json(status, body) {
  return {
    statusCode: status,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    body: JSON.stringify(body)
  };
}

async function getFieldId(fieldName) {
  const url = `${AIRTABLE_API}/meta/bases/${AIRTABLE_BASE_ID}/tables`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${AIRTABLE_API_KEY}` } });
  if (!res.ok) return null;
  const data = await res.json();
  const table = (data.tables || []).find(t => t.name === AIRTABLE_TABLE);
  if (!table) return null;
  const field = (table.fields || []).find(f => f.name === fieldName);
  return field ? field.id : null;
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
      body: ''
    };
  }
  if (event.httpMethod !== 'POST') return json(405, { ok: false, error: 'Method not allowed' });

  try {
    let rawBody = event.body || '';
    if (event.isBase64Encoded) rawBody = Buffer.from(rawBody, 'base64').toString('utf8');
    const body = rawBody ? JSON.parse(rawBody) : {};
    const { recordId, fieldName, filename, contentType, base64 } = body;

    console.log('[upload-pdf] recordId:', recordId, '| fieldName:', fieldName, '| b64 length:', base64 ? base64.length : 0, '| bodySize:', rawBody.length);

    if (!recordId || !fieldName || !base64) {
      return json(400, { ok: false, error: 'Faltan parámetros: recordId=' + recordId + ' fieldName=' + fieldName + ' base64=' + !!base64 });
    }

    const fieldId = await getFieldId(fieldName);
    if (!fieldId) return json(400, { ok: false, error: `Campo "${fieldName}" no encontrado en Airtable` });

    let b64 = String(base64);
    const comma = b64.indexOf(',');
    if (comma !== -1) b64 = b64.slice(comma + 1);

    const url = `${AIRTABLE_CONTENT_API}/${AIRTABLE_BASE_ID}/${recordId}/${fieldId}/uploadAttachment`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${AIRTABLE_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ contentType: contentType || 'application/pdf', filename: filename || 'archivo.pdf', file: b64 })
    });

    if (!res.ok) {
      const err = await res.text();
      console.error('[upload-pdf] error:', res.status, err);
      return json(200, { ok: false, error: err, status: res.status });
    }

    console.log('[upload-pdf] OK:', filename, 'campo:', fieldName);
    return json(200, { ok: true, filename });

  } catch (e) {
    console.error('[upload-pdf] exception:', e.message);
    return json(500, { ok: false, error: e.message });
  }
};
