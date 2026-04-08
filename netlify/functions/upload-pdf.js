// netlify/functions/upload-pdf.js
// Sube un archivo HTML/PDF a Airtable como adjunto.
// Estrategia: sube el archivo a múltiples servicios de hosting temporal
// como fallback, y si todos fallan, intenta con Airtable Simple Upload API.
//
// Recibe: { recordId, fieldName, filename, contentType, base64, tableName? }

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY || process.env.AIRTABLE_TOKEN || '';
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID || '';
const AIRTABLE_TABLE   = process.env.AIRTABLE_INVENTARIO_TABLE || 'Inventario';
const AIRTABLE_API     = 'https://api.airtable.com/v0';

function resolveTable(body) {
  return body.tableName || AIRTABLE_TABLE;
}

function jsonResp(status, body) {
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

// ── Función auxiliar para fetch con timeout ──────────────────────────
async function fetchWithTimeout(url, options, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs || 15000);
  try {
    const resp = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(timer);
    return resp;
  } catch (e) {
    clearTimeout(timer);
    throw e;
  }
}

// ── Servicios de hosting temporal ───────────────────────────────────
async function uploadToTempHost(buffer, filename, contentType) {
  const ct = contentType || 'text/html';
  const fn = filename || 'reporte.html';
  const errors = [];

  // Servicio 1: tmpfiles.org
  try {
    console.log('[upload-pdf] → tmpfiles.org ...');
    const form = new FormData();
    form.append('file', new Blob([buffer], { type: ct }), fn);
    const r = await fetchWithTimeout('https://tmpfiles.org/api/v1/upload', { method: 'POST', body: form }, 20000);
    if (r.ok) {
      const d = await r.json();
      const pageUrl = d && d.data && d.data.url;
      if (pageUrl) {
        const dlUrl = pageUrl.replace('tmpfiles.org/', 'tmpfiles.org/dl/');
        console.log('[upload-pdf] ✅ tmpfiles OK:', dlUrl);
        return dlUrl;
      }
    }
    errors.push('tmpfiles: status ' + r.status);
  } catch (e) { errors.push('tmpfiles: ' + e.message); }

  // Servicio 2: 0x0.st
  try {
    console.log('[upload-pdf] → 0x0.st ...');
    const form = new FormData();
    form.append('file', new Blob([buffer], { type: ct }), fn);
    const r = await fetchWithTimeout('https://0x0.st', { method: 'POST', body: form }, 20000);
    if (r.ok) {
      const url = (await r.text()).trim();
      if (url && url.startsWith('http')) {
        console.log('[upload-pdf] ✅ 0x0.st OK:', url);
        return url;
      }
    }
    errors.push('0x0.st: status ' + r.status);
  } catch (e) { errors.push('0x0.st: ' + e.message); }

  // Servicio 3: file.io
  try {
    console.log('[upload-pdf] → file.io ...');
    const form = new FormData();
    form.append('file', new Blob([buffer], { type: ct }), fn);
    const r = await fetchWithTimeout('https://file.io', { method: 'POST', body: form }, 20000);
    if (r.ok) {
      const d = await r.json();
      if (d && d.success && d.link) {
        console.log('[upload-pdf] ✅ file.io OK:', d.link);
        return d.link;
      }
    }
    errors.push('file.io: status ' + r.status);
  } catch (e) { errors.push('file.io: ' + e.message); }

  // Servicio 4: transfer.sh
  try {
    console.log('[upload-pdf] → transfer.sh ...');
    const r = await fetchWithTimeout('https://transfer.sh/' + encodeURIComponent(fn), {
      method: 'PUT', headers: { 'Content-Type': ct }, body: buffer
    }, 20000);
    if (r.ok) {
      const url = (await r.text()).trim();
      if (url && url.startsWith('http')) {
        console.log('[upload-pdf] ✅ transfer.sh OK:', url);
        return url;
      }
    }
    errors.push('transfer.sh: status ' + r.status);
  } catch (e) { errors.push('transfer.sh: ' + e.message); }

  // Servicio 5: free.keep.sh
  try {
    console.log('[upload-pdf] → free.keep.sh ...');
    const r = await fetchWithTimeout('https://free.keep.sh/' + encodeURIComponent(fn), {
      method: 'PUT', headers: { 'Content-Type': ct }, body: buffer
    }, 20000);
    if (r.ok) {
      const url = (await r.text()).trim();
      if (url && url.startsWith('http')) {
        console.log('[upload-pdf] ✅ free.keep.sh OK:', url);
        return url;
      }
    }
    errors.push('keep.sh: status ' + r.status);
  } catch (e) { errors.push('keep.sh: ' + e.message); }

  // Servicio 6: litterbox.catbox.moe (archivos temporales 72h)
  try {
    console.log('[upload-pdf] → litterbox.catbox.moe ...');
    const form = new FormData();
    form.append('reqtype', 'fileupload');
    form.append('time', '72h');
    form.append('fileToUpload', new Blob([buffer], { type: ct }), fn);
    const r = await fetchWithTimeout('https://litterbox.catbox.moe/resources/internals/api.php', {
      method: 'POST', body: form
    }, 20000);
    if (r.ok) {
      const url = (await r.text()).trim();
      if (url && url.startsWith('http')) {
        console.log('[upload-pdf] ✅ litterbox OK:', url);
        return url;
      }
    }
    errors.push('litterbox: status ' + r.status);
  } catch (e) { errors.push('litterbox: ' + e.message); }

  // Servicio 7: catbox.moe (permanente)
  try {
    console.log('[upload-pdf] → catbox.moe ...');
    const form = new FormData();
    form.append('reqtype', 'fileupload');
    form.append('fileToUpload', new Blob([buffer], { type: ct }), fn);
    const r = await fetchWithTimeout('https://catbox.moe/user/api.php', {
      method: 'POST', body: form
    }, 20000);
    if (r.ok) {
      const url = (await r.text()).trim();
      if (url && url.startsWith('http')) {
        console.log('[upload-pdf] ✅ catbox OK:', url);
        return url;
      }
    }
    errors.push('catbox: status ' + r.status);
  } catch (e) { errors.push('catbox: ' + e.message); }

  console.error('[upload-pdf] ❌ Todos los servicios fallaron:', errors.join(' | '));
  return null;
}

// ── Obtener adjuntos actuales ────────────────────────────────────────
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

// ── PATCH Airtable ───────────────────────────────────────────────────
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

  console.log('[upload-pdf] ✅ PATCH Airtable OK:', filename, '->', fieldName);
  return { ok: true, filename };
}

// ── Handler ──────────────────────────────────────────────────────────
exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return jsonResp(200, {});
  if (event.httpMethod !== 'POST') return jsonResp(405, { ok: false, error: 'Method not allowed' });

  try {
    let rawBody = event.body || '';
    if (event.isBase64Encoded) rawBody = Buffer.from(rawBody, 'base64').toString('utf8');
    const body = rawBody ? JSON.parse(rawBody) : {};
    const { recordId, fieldName, filename, contentType, base64 } = body;
    const tableName = resolveTable(body);

    console.log('[upload-pdf] Inicio | recordId:', recordId, '| field:', fieldName,
      '| table:', tableName, '| b64len:', base64 ? base64.length : 0);

    if (!recordId || !fieldName || !base64) {
      return jsonResp(400, { ok: false, error: 'Faltan parametros: recordId=' + recordId + ' fieldName=' + fieldName + ' base64=' + !!base64 });
    }
    if (!AIRTABLE_API_KEY || !AIRTABLE_BASE_ID) {
      return jsonResp(500, { ok: false, error: 'Variables AIRTABLE_API_KEY/AIRTABLE_BASE_ID no configuradas.' });
    }

    let b64 = String(base64);
    const comma = b64.indexOf(',');
    if (comma !== -1 && comma < 100) b64 = b64.slice(comma + 1);

    const buffer = Buffer.from(b64, 'base64');
    const sizeKB = (buffer.length / 1024).toFixed(1);
    console.log('[upload-pdf] Buffer:', sizeKB, 'KB');

    // Subir a servicio temporal
    const publicUrl = await uploadToTempHost(buffer, filename, contentType);
    if (!publicUrl) {
      return jsonResp(502, {
        ok: false,
        error: 'No se pudo subir el archivo (' + sizeKB + ' KB) a ningún servicio de hosting. Revise los logs de Netlify Functions para más detalles.'
      });
    }

    // Parchear Airtable
    const result = await patchAirtableAttachment(recordId, fieldName, publicUrl, filename, tableName);
    return jsonResp(200, result);

  } catch (e) {
    console.error('[upload-pdf] Excepción:', e.message, e.stack);
    return jsonResp(500, { ok: false, error: e.message });
  }
};
