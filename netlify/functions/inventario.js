// netlify/functions/inventario.js
// CRUD para tabla "Inventario" en Airtable (GET lista/búsqueda, POST crear, PUT actualizar)
// Versión robusta: evita 500 en UI (devuelve 200 con warning) y agrega modo debug.

const axios = require('axios');

const AIRTABLE_API_KEY =
  process.env.AIRTABLE_API_KEY ||
  process.env.AIRTABLE_TOKEN ||
  process.env.AIRTABLE_PAT ||
  process.env.AIRTABLE_PERSONAL_ACCESS_TOKEN ||
  '';

const AIRTABLE_BASE_ID =
  process.env.AIRTABLE_BASE_ID ||
  process.env.AIRTABLE_BASE ||
  process.env.AIRTABLE_APP_ID ||
  '';

const INVENTARIO_TABLE = process.env.AIRTABLE_INVENTARIO_TABLE || 'Inventario';

const AIRTABLE_API = AIRTABLE_BASE_ID ? `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}` : '';

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

function escapeForFormula(str) {
  return String(str).replaceAll('\\', '\\\\').replaceAll("'", "\\'");
}

function maybeAttachmentFromUrl(value) {
  if (!value) return value;
  const s = String(value).trim();
  if (/^https?:\/\//i.test(s)) return [{ url: s }];
  return value;
}

function isUnknownFieldError(err) {
  const msg = err?.response?.data?.error?.message || err?.response?.data?.message || '';
  return /Unknown field name/i.test(msg) || /UNKNOWN_FIELD_NAME/i.test(err?.response?.data?.error?.type || '');
}

function getUnknownFieldName(err) {
  const msg = err?.response?.data?.error?.message || '';
  const m = msg.match(/Unknown field name: (.+)$/i);
  return m ? m[1].trim() : null;
}

async function airtableGet(params) {
  const headers = { Authorization: `Bearer ${AIRTABLE_API_KEY}` };
  return axios.get(`${AIRTABLE_API}/${encodeURIComponent(INVENTARIO_TABLE)}`, { headers, params });
}

exports.handler = async (event) => {
  // Preflight
  if (event.httpMethod === 'OPTIONS') return json(200, { ok: true });

  const qs = event.queryStringParameters || {};
  if (qs.debug === '1') {
    return json(200, {
      ok: true,
      config: {
        hasApiKey: !!AIRTABLE_API_KEY,
        hasBaseId: !!AIRTABLE_BASE_ID,
        table: INVENTARIO_TABLE,
        baseIdPrefix: AIRTABLE_BASE_ID ? AIRTABLE_BASE_ID.slice(0, 5) + '...' : null
      }
    });
  }

  // Si faltan variables, NO devolvemos 500 para no romper el frontend: devolvemos 200 con warning.
  if (!AIRTABLE_API_KEY || !AIRTABLE_BASE_ID) {
    return json(200, {
      success: true,
      count: 0,
      nextOffset: null,
      data: [],
      warning: 'Faltan variables de entorno en Netlify: AIRTABLE_API_KEY (o AIRTABLE_TOKEN) y/o AIRTABLE_BASE_ID.'
    });
  }

  try {
    // -------------------------
    // GET: listar / buscar
    // -------------------------
    if (event.httpMethod === 'GET') {
      const pageSize = Math.min(Number(qs.pageSize || 20) || 20, 100);
      const offset = qs.offset || undefined;
      const q = (qs.q || '').trim();

      // Intentos de filtro (con y sin tilde) para evitar fallos por nombres de campos distintos.
      let filterByFormula = undefined;
      let formulaCandidates = [undefined];

      if (q) {
        const qq = escapeForFormula(q.toLowerCase());
        const baseFormula = (ubicField) => `OR(
          FIND('${qq}', LOWER({ITEM}&'')),
          FIND('${qq}', LOWER({EQUIPO}&'')),
          FIND('${qq}', LOWER({SERIE}&'')),
          FIND('${qq}', LOWER({PLACA}&'')),
          FIND('${qq}', LOWER({SERVICIO}&'')),
          FIND('${qq}', LOWER({${ubicField}}&''))
        )`;

        formulaCandidates = [
          baseFormula('UBICACIÓN'), // con tilde
          baseFormula('UBICACION'), // sin tilde
          // fallback sin ubicación
          `OR(
            FIND('${qq}', LOWER({ITEM}&'')),
            FIND('${qq}', LOWER({EQUIPO}&'')),
            FIND('${qq}', LOWER({SERIE}&'')),
            FIND('${qq}', LOWER({PLACA}&'')),
            FIND('${qq}', LOWER({SERVICIO}&''))
          )`,
          undefined
        ];
      }

      const sortCandidates = [
        [{ field: 'ITEM', direction: 'asc' }],
        undefined
      ];

      let resp = null;
      let lastErr = null;

      for (const sort of sortCandidates) {
        for (const f of formulaCandidates) {
          try {
            const params = { pageSize, offset };
            if (sort) params.sort = sort;
            if (f) params.filterByFormula = f;

            resp = await airtableGet(params);
            filterByFormula = f;
            lastErr = null;
            break;
          } catch (err) {
            lastErr = err;
            // Si es unknown field, probamos el siguiente candidato
            if (isUnknownFieldError(err)) continue;
            // Otros errores (401/403/404/422), detenemos y reportamos
            break;
          }
        }
        if (resp) break;
        if (lastErr && !isUnknownFieldError(lastErr)) break;
      }

      if (!resp) {
        const detail = lastErr?.response?.data || { message: lastErr?.message || 'Unknown error' };
        return json(200, {
          success: true,
          count: 0,
          nextOffset: null,
          data: [],
          warning: 'No se pudo consultar Airtable (revisa permisos del token, Base ID, o nombres de campos).',
          detail
        });
      }

      const records = (resp.data.records || []).map(r => ({ id: r.id, fields: r.fields || {} }));

      return json(200, {
        success: true,
        count: records.length,
        nextOffset: resp.data.offset || null,
        data: records,
        usedFilter: filterByFormula || null
      });
    }

    // -------------------------
    // POST: crear
    // -------------------------
    if (event.httpMethod === 'POST') {
      const body = JSON.parse(event.body || '{}');
      const fields = body.fields || {};

      if (fields['MANUAL']) fields['MANUAL'] = maybeAttachmentFromUrl(fields['MANUAL']);

      const headers = { Authorization: `Bearer ${AIRTABLE_API_KEY}` };
      const resp = await axios.post(
        `${AIRTABLE_API}/${encodeURIComponent(INVENTARIO_TABLE)}`,
        { fields },
        { headers }
      );

      return json(200, { success: true, data: { id: resp.data.id, fields: resp.data.fields || {} } });
    }

    // -------------------------
    // PUT: actualizar
    // -------------------------
    if (event.httpMethod === 'PUT') {
      const body = JSON.parse(event.body || '{}');
      const recordId = body.id;
      const fields = body.fields || {};

      if (!recordId) return json(200, { success: false, error: 'Missing record id' });

      if (fields['MANUAL']) fields['MANUAL'] = maybeAttachmentFromUrl(fields['MANUAL']);

      const headers = { Authorization: `Bearer ${AIRTABLE_API_KEY}` };
      const resp = await axios.patch(
        `${AIRTABLE_API}/${encodeURIComponent(INVENTARIO_TABLE)}/${recordId}`,
        { fields },
        { headers }
      );

      return json(200, { success: true, data: { id: resp.data.id, fields: resp.data.fields || {} } });
    }

    return json(200, { success: false, error: 'Method not allowed' });
  } catch (err) {
    console.error('inventario function error:', err?.response?.data || err.message);
    const detail = err?.response?.data || { message: err.message };

    // Devolvemos 200 para evitar AxiosError en el frontend, pero con warning y detalle.
    return json(200, {
      success: true,
      count: 0,
      nextOffset: null,
      data: [],
      warning: 'Error en la función Inventario. Revisa token/base/permisos en Netlify.',
      detail
    });
  }
};
