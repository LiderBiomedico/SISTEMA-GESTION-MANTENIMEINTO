// netlify/functions/upload-pdf.js
// Sube un PDF a Airtable usando transfer.sh como hosting temporal
// Flujo: base64 → Buffer → POST a transfer.sh → URL publica → PATCH Airtable
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

// Intenta subir el buffer a un servicio de hosting temporal
// Devuelve una URL publica o null si falla
async function uploadToTempHost(buffer, filename, contentType) {
  const fname = encodeURIComponent(filename || 'archivo.pdf');

  // Intento 1: tmpfiles.org
  try {
    const form = new FormData();
    const blob = new Blob([buffer], { type: contentType || 'application/pdf' });
    form.append('file', blob, filename || 'archivo.pdf');
    const r = await fetch('https://tmpfiles.org/api/v1/upload', {
      method: 'POST',
      body: form
    });
    if (r.ok) {
      const d = await r.json();
      // tmpfiles devuelve { status:'success', data:{ url:'https://tmpfiles.org/XXXX/file.pdf' } }
      // La URL de descarga directa es: https://tmpfiles.org/dl/XXXX/file.pdf
      const pageUrl = d && d.data && d.data.url;
      if (pageUrl) {
        const dlUrl = pageUrl.replace('tmpfiles.org/', 'tmpfiles.org/dl/');
        console.log('[upload-pdf] tmpfiles OK:', dlUrl);
        return dlUrl;
      }
    }
  } catch (e) {
    console.warn('[upload-pdf] tmpfiles fallido:', e.message);
  }

  // Intento 2: 0x0.st
  try {
    const form2 = new FormData();
    const blob2 = new Blob([buffer], { type: contentType || 'application/pdf' });
    form2.append('file', blob2, filename || 'archivo.pdf');
    const r2 = await fetch('https://0x0.st', { method: 'POST', body: form2 });
    if (r2.ok) {
      const url2 = (await r2.text()).trim();
      if (url2 && url2.startsWith('http')) {
        console.log('[upload-pdf] 0x0.st OK:', url2);
        return url2;
      }
    }
  } catch (e) {
    console.warn('[upload-pdf] 0x0.st fallido:', e.message);
  }

  return null;
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
    return atts.map(a => ({ id: a.id }));
  } catch (e) {
    console.error('[upload-pdf] getCurrentAttachments error:', e.message);
    return [];
  }
}

// PATCH el campo de Airtable con la URL publica del archivo
async function patchAirtableAttachment(recordId, fieldName, fileUrl, filename) {
  const existing = await getCurrentAttachments(recordId, fieldName);
  const allAtts = [...existing, { url: fileUrl, filename: filename || 'archivo.pdf' }];

  const patchUrl = `${AIRTABLE_API}/${AIRTABLE_BASE_ID}/${encodeURIComponent(AIRTABLE_TABLE)}/${recordId}`;
  const res = await fetch(patchUrl, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${AIRTABLE_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ fields: { [fieldName]: allAtts } })
  });

  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch (e) { data = { raw: text }; }

  if (!res.ok) {
    console.error('[upload-pdf] PATCH Airtable error:', res.status, text.slice(0, 400));
    return { ok: false, status: res.status, error: data.error || text.slice(0, 300) };
  }

  console.log('[upload-pdf] PATCH Airtable OK:', filename, '->', fieldName);
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
      return json(400, { ok: false, error: 'Faltan parametros: recordId=' + recordId + ' fieldName=' + fieldName + ' base64=' + !!base64 });
    }
    if (!AIRTABLE_API_KEY || !AIRTABLE_BASE_ID) {
      return json(500, { ok: false, error: 'Variables AIRTABLE_API_KEY/AIRTABLE_BASE_ID no configuradas.' });
    }

    // Limpiar prefijo data URL si viene incluido
    let b64 = String(base64);
    const comma = b64.indexOf(',');
    if (comma !== -1) b64 = b64.slice(comma + 1);

    // Convertir base64 a Buffer
    const buffer = Buffer.from(b64, 'base64');
    console.log('[upload-pdf] buffer size:', buffer.length, 'bytes');

    // Subir a hosting temporal para obtener URL publica
    const publicUrl = await uploadToTempHost(buffer, filename, contentType);
    if (!publicUrl) {
      return json(502, { ok: false, error: 'No se pudo obtener una URL publica para el archivo. tmpfiles.org y 0x0.st no respondieron.' });
    }

    // Parchear Airtable con la URL publica
    const result = await patchAirtableAttachment(recordId, fieldName, publicUrl, filename);
    return json(200, result);

  } catch (e) {
    console.error('[upload-pdf] excepcion:', e.message, e.stack);
    return json(500, { ok: false, error: e.message });
  }
};
