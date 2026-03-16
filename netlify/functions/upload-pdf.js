// netlify/functions/upload-pdf.js
// Sube un PDF a un campo de Airtable usando la REST API estandar (api.airtable.com)
// NO usa content.airtableapi.com (bloqueado por Cloudflare desde IPs de Netlify/AWS)
//
// Estrategia: convierte el base64 en data URL y lo envia como attachment {url, filename}
// via PATCH. Airtable acepta data URLs directamente en campos de adjunto.
//
// Recibe: { recordId, fieldName, filename, contentType, base64 }

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY || process.env.AIRTABLE_TOKEN || '';
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID || '';
const AIRTABLE_TABLE   = process.env.AIRTABLE_INVENTARIO_TABLE || 'Inventario';
const AIRTABLE_API     = 'https://api.airtable.com/v0';

function json(status, body) {
  return {
    statusCode: status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
    body: JSON.stringify(body)
  };
}

// Normalización fuzzy: sin tildes, minúsculas, sin espacios extra
function norm(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Obtiene los adjuntos actuales del campo para no sobreescribirlos
async function getCurrentAttachments(recordId, fieldName) {
  try {
    const url = `${AIRTABLE_API}/${AIRTABLE_BASE_ID}/${encodeURIComponent(AIRTABLE_TABLE)}/${recordId}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${AIRTABLE_API_KEY}` }
    });
    if (!res.ok) return [];
    const data = await res.json();
    const atts = (data.fields || {})[fieldName];
    if (!Array.isArray(atts)) return [];
    // Solo conservar id (Airtable necesita id para mantener los existentes)
    return atts.map(a => ({ id: a.id }));
  } catch (e) {
    console.error('[upload-pdf] getCurrentAttachments error:', e.message);
    return [];
  }
}

// Sube el archivo via PATCH usando data URL
async function uploadViaDataUrl(recordId, fieldName, filename, contentType, b64) {
  // Obtener adjuntos actuales para no borrarlos
  const existing = await getCurrentAttachments(recordId, fieldName);

  // Construir data URL
  const ctype = contentType || 'application/pdf';
  const dataUrl = `data:${ctype};base64,${b64}`;

  const newAttachment = { url: dataUrl, filename: filename || 'archivo.pdf' };
  const allAttachments = [...existing, newAttachment];

  const patchUrl = `${AIRTABLE_API}/${AIRTABLE_BASE_ID}/${encodeURIComponent(AIRTABLE_TABLE)}/${recordId}`;
  const res = await fetch(patchUrl, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${AIRTABLE_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      fields: { [fieldName]: allAttachments }
    })
  });

  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch (e) { data = { raw: text }; }

  if (!res.ok) {
    console.error('[upload-pdf] PATCH error:', res.status, text.slice(0, 300));
    return { ok: false, status: res.status, error: data.error || text.slice(0, 200) };
  }

  console.log('[upload-pdf] PATCH OK:', filename, '->', fieldName);
  return { ok: true, filename };
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return json(200, {});
  if (event.httpMethod !== 'POST') return json(405, { ok: false, error: 'Method not allowed' });

  try {
    let rawBody = event.body || '';
    if (event.isBase64Encoded) rawBody = Buffer.from(rawBody, 'base64').toString('utf8');
    const body = rawBody ? JSON.parse(rawBody) : {};
    const { recordId, fieldName, filename, contentType, base64 } = body;

    console.log('[upload-pdf] recordId:', recordId, '| fieldName:', fieldName,
      '| b64len:', base64 ? base64.length : 0);

    if (!recordId || !fieldName || !base64) {
      return json(400, { ok: false, error: 'Faltan parametros',
        detail: 'recordId='+recordId+' fieldName='+fieldName+' base64='+!!base64 });
    }

    if (!AIRTABLE_API_KEY || !AIRTABLE_BASE_ID) {
      return json(500, { ok: false, error: 'Variables AIRTABLE_API_KEY/AIRTABLE_BASE_ID no configuradas.' });
    }

    // Limpiar prefijo data URL si viene incluido
    let b64 = String(base64);
    const comma = b64.indexOf(',');
    if (comma !== -1) b64 = b64.slice(comma + 1);

    const result = await uploadViaDataUrl(recordId, fieldName, filename, contentType, b64);
    return json(200, result);

  } catch (e) {
    console.error('[upload-pdf] excepcion:', e.message);
    return json(500, { ok: false, error: e.message });
  }
};
