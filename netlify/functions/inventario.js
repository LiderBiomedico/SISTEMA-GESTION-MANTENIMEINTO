// netlify/functions/inventario.js
// CRUD para tabla "Inventario" en Airtable (GET lista/búsqueda, POST crear, PUT actualizar)
//
// ✅ Cambios vs versión previa:
// - Soporta múltiples nombres de variables de entorno (AIRTABLE_API_KEY / AIRTABLE_TOKEN, etc.).
// - Ya NO exige Authorization desde el navegador (evita 401 innecesarios).
// - Respuestas de error más claras (sin exponer secretos).
// - Endpoint de diagnóstico: ?debug=1 (solo muestra si hay config, no muestra la key).

const axios = require('axios');

function pickEnv(...names) {
  for (const n of names) {
    const v = process.env[n];
    if (v && String(v).trim()) return String(v).trim();
  }
  return '';
}

const AIRTABLE_API_KEY = pickEnv('AIRTABLE_API_KEY', 'AIRTABLE_TOKEN', 'AIRTABLE_KEY', 'AIRTABLE_PAT');
const AIRTABLE_BASE_ID = pickEnv('AIRTABLE_BASE_ID', 'AIRTABLE_BASE', 'AIRTABLE_BASEID', 'AIRTABLE_BASE_ID_APP');
const INVENTARIO_TABLE = pickEnv('AIRTABLE_INVENTARIO_TABLE', 'AIRTABLE_TABLE_INVENTARIO', 'AIRTABLE_TABLE') || 'Inventario';

const AIRTABLE_API = AIRTABLE_BASE_ID ? `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}` : '';

function json(statusCode, bodyObj) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,OPTIONS',
    },
    body: JSON.stringify(bodyObj),
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

exports.handler = async (event) => {
  // Preflight
  if (event.httpMethod === 'OPTIONS') return json(200, { ok: true });

  const qs = event.queryStringParameters || {};

  // Debug (no expone secretos)
  if (event.httpMethod === 'GET' && qs.debug === '1') {
    return json(200, {
      ok: true,
      config: {
        hasApiKey: !!AIRTABLE_API_KEY,
        hasBaseId: !!AIRTABLE_BASE_ID,
        table: INVENTARIO_TABLE,
      },
      tip: 'Si hasApiKey/hasBaseId salen en false, revisa variables en Netlify (Production) y haz "Clear cache and deploy".',
    });
  }

  // Validación de configuración
  if (!AIRTABLE_API_KEY || !AIRTABLE_BASE_ID) {
    return json(500, {
      success: false,
      code: 'CONFIG_MISSING',
      error: 'Faltan variables de entorno de Airtable en Netlify.',
      required: ['AIRTABLE_API_KEY (o AIRTABLE_TOKEN)', 'AIRTABLE_BASE_ID'],
      hint: 'Netlify → Site settings → Environment variables (Production) → luego Deploys → Clear cache and deploy.',
    });
  }

  const headers = { Authorization: `Bearer ${AIRTABLE_API_KEY}` };

  try {
    // -------------------------
    // GET: listar / buscar
    // -------------------------
    if (event.httpMethod === 'GET') {
      const pageSize = Math.min(Number(qs.pageSize || 20) || 20, 100);
      const offset = qs.offset || undefined;
      const q = (qs.q || '').trim();

      let filterByFormula;
      if (q) {
        const qq = escapeForFormula(q.toLowerCase());
        // Busca en campos típicos; si alguno no existe, Airtable lo ignora? (no: dará error).
        // Por eso usamos IFERROR alrededor de cada campo para evitar fallos si un campo no existe aún.
        filterByFormula = `OR(
          FIND('${qq}', LOWER(IFERROR({ITEM}, ''))),
          FIND('${qq}', LOWER(IFERROR({EQUIPO}, ''))),
          FIND('${qq}', LOWER(IFERROR({SERIE}, ''))),
          FIND('${qq}', LOWER(IFERROR({PLACA}, ''))),
          FIND('${qq}', LOWER(IFERROR({SERVICIO}, ''))),
          FIND('${qq}', LOWER(IFERROR({UBICACIÓN}, '')))
        )`;
      }

      const params = {
        pageSize,
        ...(offset ? { offset } : {}),
        ...(filterByFormula ? { filterByFormula } : {}),
        sort: [{ field: 'ITEM', direction: 'asc' }],
      };

      const resp = await axios.get(`${AIRTABLE_API}/${encodeURIComponent(INVENTARIO_TABLE)}`, { headers, params });
      return json(200, { success: true, data: resp.data });
    }

    // -------------------------
    // POST: crear
    // -------------------------
    if (event.httpMethod === 'POST') {
      const body = JSON.parse(event.body || '{}');
      const fields = body.fields || {};

      if (fields['MANUAL']) fields['MANUAL'] = maybeAttachmentFromUrl(fields['MANUAL']);

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

      if (fields['MANUAL']) fields['MANUAL'] = maybeAttachmentFromUrl(fields['MANUAL']);

      const resp = await axios.patch(`${AIRTABLE_API}/${encodeURIComponent(INVENTARIO_TABLE)}/${recordId}`, { fields }, { headers });
      return json(200, { success: true, data: { id: resp.data.id, fields: resp.data.fields || {} } });
    }

    return json(405, { success: false, error: 'Method not allowed' });
  } catch (err) {
    const status = err?.response?.status || 500;
    const detail = err?.response?.data || { message: err.message };

    // Errores típicos de Airtable
    let hint = undefined;
    if (status === 401 || status === 403) {
      hint = 'Token sin permisos o sin acceso a la Base. Revisa scopes (data.records:read/write) y Access al Base en Airtable.';
    } else if (status === 404) {
      hint = `Tabla/base no encontrada. Confirma AIRTABLE_BASE_ID y que la tabla se llame exactamente "${INVENTARIO_TABLE}".`;
    } else if (status === 422) {
      hint = 'Campos inválidos. Confirma que los nombres de campos en Airtable coinciden exactamente (incluye tildes, p.ej. "UBICACIÓN").';
    }

    console.error('inventario function error:', detail);

    return json(500, {
      success: false,
      error: 'Airtable request failed',
      status,
      detail,
      ...(hint ? { hint } : {}),
    });
  }
};
