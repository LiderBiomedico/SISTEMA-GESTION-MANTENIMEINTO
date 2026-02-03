// netlify/functions/inventario.js
// CRUD para tabla "Inventario" en Airtable (GET/POST/PUT) — sin auth desde el navegador

const axios = require('axios');

const AIRTABLE_API_KEY =
  process.env.AIRTABLE_API_KEY ||
  process.env.AIRTABLE_TOKEN ||
  process.env.AIRTABLE_PAT ||
  '';

const AIRTABLE_BASE_ID =
  process.env.AIRTABLE_BASE_ID ||
  process.env.AIRTABLE_BASE ||
  '';

const INVENTARIO_TABLE = process.env.AIRTABLE_INVENTARIO_TABLE || 'Inventario';

const AIRTABLE_API = (AIRTABLE_BASE_ID) ? `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}` : '';

function json(statusCode, bodyObj) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,OPTIONS'
    },
    body: JSON.stringify(bodyObj)
  };
}

function escapeForFormula(str) {
  return String(str).replaceAll('\\', '\\\\').replaceAll("'", "\\'");
}

function maybeAttachmentFromUrl(value) {
  if (!value) return value;
  // Si ya viene como attachment array, no tocar
  if (Array.isArray(value) && value[0] && value[0].url) return value;
  const s = String(value).trim();
  if (/^https?:\/\//i.test(s)) return [{ url: s }];
  return value;
}

async function airtableGet(url, headers, params) {
  try {
    return await axios.get(url, { headers, params });
  } catch (err) {
    // Re-lanzar para que el handler haga fallback
    throw err;
  }
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return json(200, { ok: true });

  // Debug rápido: /.netlify/functions/inventario?debug=1
  const qs0 = event.queryStringParameters || {};
  if (qs0.debug === '1') {
    return json(200, {
      ok: true,
      config: {
        hasApiKey: !!AIRTABLE_API_KEY,
        hasBaseId: !!AIRTABLE_BASE_ID,
        table: INVENTARIO_TABLE
      }
    });
  }

  try {
    if (!AIRTABLE_API_KEY || !AIRTABLE_BASE_ID) {
      return json(500, {
        success: false,
        error: 'Missing AIRTABLE_API_KEY (or AIRTABLE_TOKEN) / AIRTABLE_BASE_ID in Netlify environment variables.',
        hint: 'Netlify → Site settings → Environment variables (Production) → luego "Clear cache and deploy".'
      });
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

      // Fórmula robusta: soporta campo con tilde (UBICACIÓN) o sin tilde (UBICACION)
      let filterByFormula = undefined;
      if (q) {
        const qq = escapeForFormula(q.toLowerCase());
        filterByFormula = `OR(
          FIND('${qq}', LOWER(IFERROR({ITEM}&'', ''))),
          FIND('${qq}', LOWER(IFERROR({EQUIPO}&'', ''))),
          FIND('${qq}', LOWER(IFERROR({SERIE}&'', ''))),
          FIND('${qq}', LOWER(IFERROR({PLACA}&'', ''))),
          FIND('${qq}', LOWER(IFERROR({SERVICIO}&'', ''))),
          FIND('${qq}', LOWER(IFERROR({UBICACIÓN}&'', ''))),
          FIND('${qq}', LOWER(IFERROR({UBICACION}&'', '')))
        )`;
      }

      const url = `${AIRTABLE_API}/${encodeURIComponent(INVENTARIO_TABLE)}`;

      // Intento 1: con sort por ITEM (si existe)
      try {
        const resp = await airtableGet(url, headers, {
          pageSize,
          offset,
          sort: [{ field: 'ITEM', direction: 'asc' }],
          filterByFormula
        });

        const records = (resp.data.records || []).map(r => ({ id: r.id, fields: r.fields || {} }));
        return json(200, { success: true, count: records.length, nextOffset: resp.data.offset || null, data: records });
      } catch (err1) {
        const detail1 = err1?.response?.data;
        const status1 = err1?.response?.status;

        // Fallback: si falló por campo/sort/fórmula, reintenta SIN sort y SIN filter
        if (status1 === 422) {
          try {
            const resp2 = await airtableGet(url, headers, { pageSize, offset });
            const records2 = (resp2.data.records || []).map(r => ({ id: r.id, fields: r.fields || {} }));
            return json(200, {
              success: true,
              count: records2.length,
              nextOffset: resp2.data.offset || null,
              data: records2,
              warning: 'Se cargó sin filtro/orden (Airtable 422 en fórmula o sort). Verifica nombres de campos.'
            });
          } catch (err2) {
            const detail2 = err2?.response?.data || { message: err2.message };
            return json(500, { success: false, error: 'Airtable request failed', detail: detail2 });
          }
        }

        return json(500, { success: false, error: 'Airtable request failed', detail: detail1 || { message: err1.message } });
      }
    }

    // -------------------------
    // POST: crear
    // -------------------------
    if (event.httpMethod === 'POST') {
      const body = JSON.parse(event.body || '{}');
      const fields = body.fields || {};

      if (fields['MANUAL']) fields['MANUAL'] = maybeAttachmentFromUrl(fields['MANUAL']);

      const url = `${AIRTABLE_API}/${encodeURIComponent(INVENTARIO_TABLE)}`;
      const resp = await axios.post(url, { fields }, { headers });

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

      if (fields['MANUAL']) fields['MANUAL'] = maybeAttachmentFromUrl(fields['MANUAL']);

      const url = `${AIRTABLE_API}/${encodeURIComponent(INVENTARIO_TABLE)}/${recordId}`;
      const resp = await axios.patch(url, { fields }, { headers });

      return json(200, { success: true, data: { id: resp.data.id, fields: resp.data.fields || {} } });
    }

    return json(405, { success: false, error: 'Method not allowed' });
  } catch (err) {
    console.error('inventario function error:', err?.response?.data || err.message);
    const detail = err?.response?.data || { message: err.message };
    const status = err?.response?.status;

    // Mensajes más útiles
    const hint =
      status === 401 || status === 403
        ? 'Tu token de Airtable no tiene permisos (data.records:read/write) o no tiene acceso a la base.'
        : status === 404
        ? 'Base ID o tabla no encontrada. Verifica AIRTABLE_BASE_ID y el nombre de la tabla Inventario.'
        : status === 422
        ? 'Error 422: normalmente por nombres de campos con tildes o fórmula inválida.'
        : 'Revisa Logs en Netlify → Functions → inventario.';

    return json(500, { success: false, error: 'Airtable request failed', detail, hint });
  }
};
