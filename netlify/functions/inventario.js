// netlify/functions/inventario.js
// CRUD básico para tabla "Inventario" en Airtable (GET lista/búsqueda, POST crear, PUT actualizar)

const axios = require('axios');

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
const INVENTARIO_TABLE = process.env.AIRTABLE_INVENTARIO_TABLE || 'Inventario';

const AIRTABLE_API = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}`;

function json(statusCode, bodyObj) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,OPTIONS'
    },
    body: JSON.stringify(bodyObj)
  };
}

function requireAuth(event) {
  const token = event.headers['authorization']?.replace('Bearer ', '') || event.headers['Authorization']?.replace('Bearer ', '');
  if (!token) return false;
  return true;
}

function escapeForFormula(str) {
  // Escape simple para usar dentro de comillas en fórmulas Airtable
  return String(str).replaceAll('\\', '\\\\').replaceAll("'", "\\'");
}

function maybeAttachmentFromUrl(value) {
  if (!value) return value;
  const s = String(value).trim();
  if (/^https?:\/\//i.test(s)) {
    return [{ url: s }];
  }
  return value;
}

exports.handler = async (event) => {
  // Preflight
  if (event.httpMethod === 'OPTIONS') {
    return json(200, { ok: true });
  }

  try {
    if (!AIRTABLE_API_KEY || !AIRTABLE_BASE_ID) {
      return json(500, { success: false, error: 'Missing AIRTABLE_API_KEY or AIRTABLE_BASE_ID in Netlify environment variables.' });
    }

    if (!requireAuth(event)) {
      return json(401, { success: false, error: 'No authorization token' });
    }

    const headers = { Authorization: `Bearer ${AIRTABLE_API_KEY}` };

    // -------------------------
    // GET: listar / buscar
    // -------------------------
    if (event.httpMethod === 'GET') {
      const qs = event.queryStringParameters || {};
      const pageSize = Math.min(Number(qs.pageSize || 20) || 20, 100);
      const offset = qs.offset || undefined;
      const q = (qs.q || '').trim();

      let filterByFormula = undefined;
      if (q) {
        const qq = escapeForFormula(q.toLowerCase());
        // Búsqueda simple en campos clave
        filterByFormula = `OR(
          FIND('${qq}', LOWER({ITEM}&'')),
          FIND('${qq}', LOWER({EQUIPO}&'')),
          FIND('${qq}', LOWER({SERIE}&'')),
          FIND('${qq}', LOWER({PLACA}&'')),
          FIND('${qq}', LOWER({SERVICIO}&'')),
          FIND('${qq}', LOWER({UBICACIÓN}&''))
        )`;
      }

      const resp = await axios.get(`${AIRTABLE_API}/${encodeURIComponent(INVENTARIO_TABLE)}`, {
        headers,
        params: {
          pageSize,
          offset,
          sort: [{ field: 'ITEM', direction: 'asc' }],
          filterByFormula
        }
      });

      const records = (resp.data.records || []).map(r => ({ id: r.id, fields: r.fields || {} }));

      return json(200, {
        success: true,
        count: records.length,
        nextOffset: resp.data.offset || null,
        data: records
      });
    }

    // -------------------------
    // POST: crear
    // -------------------------
    if (event.httpMethod === 'POST') {
      const body = JSON.parse(event.body || '{}');
      const fields = body.fields || {};

      // Opcional: convertir MANUAL a Attachment si es URL.
      if (fields['MANUAL']) {
        fields['MANUAL'] = maybeAttachmentFromUrl(fields['MANUAL']);
      }

      const resp = await axios.post(`${AIRTABLE_API}/${encodeURIComponent(INVENTARIO_TABLE)}`, { fields }, { headers });

      return json(200, { success: true, data: { id: resp.data.id, fields: resp.data.fields || {} } });
    }

    // -------------------------
    // PUT: actualizar
    // -------------------------
    if (event.httpMethod === 'PUT') {
      const body = JSON.parse(event.body || '{}');
      const recordId = body.id;
      const fields = body.fields || {};

      if (!recordId) return json(400, { success: false, error: 'Missing record id' });

      if (fields['MANUAL']) {
        fields['MANUAL'] = maybeAttachmentFromUrl(fields['MANUAL']);
      }

      const resp = await axios.patch(`${AIRTABLE_API}/${encodeURIComponent(INVENTARIO_TABLE)}/${recordId}`, { fields }, { headers });

      return json(200, { success: true, data: { id: resp.data.id, fields: resp.data.fields || {} } });
    }

    return json(405, { success: false, error: 'Method not allowed' });
  } catch (err) {
    console.error('inventario function error:', err?.response?.data || err.message);
    const detail = err?.response?.data || { message: err.message };
    return json(500, { success: false, error: 'Airtable request failed', detail });
  }
};
