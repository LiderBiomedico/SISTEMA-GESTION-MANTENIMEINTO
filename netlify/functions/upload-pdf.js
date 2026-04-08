// netlify/functions/upload-pdf.js
// Sube un archivo (HTML/PDF) a Airtable usando hosting temporal
// Flujo: base64 → Buffer → POST a servicio temporal → URL publica → PATCH Airtable
//
// Recibe: { recordId, fieldName, filename, contentType, base64, tableName? }

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY || process.env.AIRTABLE_TOKEN || '';
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID || '';
const AIRTABLE_TABLE   = process.env.AIRTABLE_INVENTARIO_TABLE || 'Inventario';
const AIRTABLE_API     = 'https://api.airtable.com/v0';

function resolveTable(body) {
  return body.tableName || AIRTABLE_TABLE;
}

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

// ── Servicios de hosting temporal (intenta varios en orden) ──────────
async function uploadToTempHost(buffer, filename, contentType) {
  const ct = contentType || 'text/html';
  const fn = filename || 'reporte.html';

  // Intento 1: tmpfiles.org
  try {
    console.log('[upload-pdf] Intentando tmpfiles.org...');
    const form = new FormData();
    const blob = new Blob([buffer], { type: ct });
    form.append('file', blob, fn);
    const r = await fetch('https://tmpfiles.org/api/v1/upload', {
      method: 'POST',
      body: form,
      signal: AbortSignal.timeout(15000),
    });
    if (r.ok) {
      const d = await r.json();
      const pageUrl = d && d.data && d.data.url;
      if (pageUrl) {
        const dlUrl = pageUrl.replace('tmpfiles.org/', 'tmpfiles.org/dl/');
        console.log('[upload-pdf] tmpfiles OK:', dlUrl);
        return dlUrl;
      }
    }
    console.warn('[upload-pdf] tmpfiles resp no ok:', r.status);
  } catch (e) {
    console.warn('[upload-pdf] tmpfiles fallido:', e.message);
  }

  // Intento 2: 0x0.st
  try {
    console.log('[upload-pdf] Intentando 0x0.st...');
    const form2 = new FormData();
    const blob2 = new Blob([buffer], { type: ct });
    form2.append('file', blob2, fn);
    const r2 = await fetch('https://0x0.st', {
      method: 'POST',
      body: form2,
      signal: AbortSignal.timeout(15000),
    });
    if (r2.ok) {
      const url2 = (await r2.text()).trim();
      if (url2 && url2.startsWith('http')) {
        console.log('[upload-pdf] 0x0.st OK:', url2);
        return url2;
      }
    }
    console.warn('[upload-pdf] 0x0.st resp no ok:', r2.status);
  } catch (e) {
    console.warn('[upload-pdf] 0x0.st fallido:', e.message);
  }

  // Intento 3: file.io
  try {
    console.log('[upload-pdf] Intentando file.io...');
    const form3 = new FormData();
    const blob3 = new Blob([buffer], { type: ct });
    form3.append('file', blob3, fn);
    const r3 = await fetch('https://file.io', {
      method: 'POST',
      body: form3,
      signal: AbortSignal.timeout(15000),
    });
    if (r3.ok) {
      const d3 = await r3.json();
      if (d3 && d3.success && d3.link) {
        console.log('[upload-pdf] file.io OK:', d3.link);
        return d3.link;
      }
    }
    console.warn('[upload-pdf] file.io resp no ok:', r3.status);
  } catch (e) {
    console.warn('[upload-pdf] file.io fallido:', e.message);
  }

  // Intento 4: transfer.sh compatible (free.keep.sh)
  try {
    console.log('[upload-pdf] Intentando keep.sh...');
    const r4 = await fetch('https://free.keep.sh/' + encodeURIComponent(fn), {
      method: 'PUT',
      headers: { 'Content-Type': ct },
      body: buffer,
      signal: AbortSignal.timeout(15000),
    });
    if (r4.ok) {
      const url4 = (await r4.text()).trim();
      if (url4 && url4.startsWith('http')) {
        console.log('[upload-pdf] keep.sh OK:', url4);
        return url4;
      }
    }
    console.warn('[upload-pdf] keep.sh resp no ok:', r4.status);
  } catch (e) {
    console.warn('[upload-pdf] keep.sh fallido:', e.message);
  }

  // Intento 5: transfer.sh
  try {
    console.log('[upload-pdf] Intentando transfer.sh...');
    const r5 = await fetch('https://transfer.sh/' + encodeURIComponent(fn), {
      method: 'PUT',
      headers: { 'Content-Type': ct },
      body: buffer,
      signal: AbortSignal.timeout(15000),
    });
    if (r5.ok) {
      const url5 = (await r5.text()).trim();
      if (url5 && url5.startsWith('http')) {
        console.log('[upload-pdf] transfer.sh OK:', url5);
        return url5;
      }
    }
    console.warn('[upload-pdf] transfer.sh resp no ok:', r5.status);
  } catch (e) {
    console.warn('[upload-pdf] transfer.sh fallido:', e.message);
  }

  return null;
}

// ── Obtener adjuntos actuales para no sobreescribirlos ───────────────
async function getCurrentAttachments(recordId, fieldName, tableName) {
  try {
    const url = `${AIRTABLE_API}/${AIRTABLE_BASE_ID}/${encodeURIComponent(tableName)}/${recordId}`;
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

// ── PATCH Airtable con la URL publica ────────────────────────────────
async function patchAirtableAttachment(recordId, fieldName, fileUrl, filename, tableName) {
  const existing = await getCurrentAttachments(recordId, fieldName, tableName);
  const allAtts = [...existing, { url: fileUrl, filename: filename || 'archivo.pdf' }];

  const patchUrl = `${AIRTABLE_API}/${AIRTABLE_BASE_ID}/${encodeURIComponent(tableName)}/${recordId}`;
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
    const errMsg = data.error
      ? (typeof data.error === 'object' ? (data.error.message || data.error.type || JSON.stringify(data.error)) : data.error)
      : text.slice(0, 300);
    return { ok: false, status: res.status, error: errMsg };
  }

  console.log('[upload-pdf] PATCH Airtable OK:', filename, '->', fieldName);
  return { ok: true, filename };
}

// ── Handler principal ────────────────────────────────────────────────
exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return json(200, {});
  if (event.httpMethod !== 'POST') return json(405, { ok: false, error: 'Method not allowed' });

  try {
    let rawBody = event.body || '';
    if (event.isBase64Encoded) rawBody = Buffer.from(rawBody, 'base64').toString('utf8');
    const body = rawBody ? JSON.parse(rawBody) : {};
    const { recordId, fieldName, filename, contentType, base64 } = body;
    const tableName = resolveTable(body);

    console.log('[upload-pdf] recordId:', recordId, '| fieldName:', fieldName,
      '| table:', tableName, '| b64len:', base64 ? base64.length : 0);

    if (!recordId || !fieldName || !base64) {
      return json(400, { ok: false, error: 'Faltan parametros: recordId=' + recordId + ' fieldName=' + fieldName + ' base64=' + !!base64 });
    }
    if (!AIRTABLE_API_KEY || !AIRTABLE_BASE_ID) {
      return json(500, { ok: false, error: 'Variables AIRTABLE_API_KEY/AIRTABLE_BASE_ID no configuradas.' });
    }

    // Limpiar prefijo data URL si viene
    let b64 = String(base64);
    const comma = b64.indexOf(',');
    if (comma !== -1 && comma < 100) b64 = b64.slice(comma + 1);

    const buffer = Buffer.from(b64, 'base64');
    console.log('[upload-pdf] buffer size:', buffer.length, 'bytes (',
      (buffer.length / 1024).toFixed(1), 'KB)');

    // Subir a hosting temporal
    const publicUrl = await uploadToTempHost(buffer, filename, contentType);
    if (!publicUrl) {
      return json(502, {
        ok: false,
        error: 'No se pudo subir el archivo a ningún servicio temporal. Tamaño: ' +
          (buffer.length / 1024).toFixed(1) + 'KB. Intente de nuevo en unos minutos.'
      });
    }

    // Parchear Airtable
    const result = await patchAirtableAttachment(recordId, fieldName, publicUrl, filename, tableName);
    return json(200, result);

  } catch (e) {
    console.error('[upload-pdf] excepcion:', e.message, e.stack);
    return json(500, { ok: false, error: e.message });
  }
};
