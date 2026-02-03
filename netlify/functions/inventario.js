// netlify/functions/inventario.js
// Inventario - Airtable CRUD (GET/POST/PUT) con:
// - Sin Authorization desde el navegador
// - debug=1 para validar ENV
// - Mapeo de nombres de campos (ITEM -> Item, PLACA -> Numero de Placa, UBICACIÓN -> Ubicación, etc.)
// - Reintento automático si Airtable responde 422 por campos desconocidos (guarda lo que sí existe)

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

const AIRTABLE_API = AIRTABLE_BASE_ID ? `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}` : '';

function json(statusCode, bodyObj) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type',
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
  if (Array.isArray(value) && value[0] && value[0].url) return value;
  const s = String(value).trim();
  if (/^https?:\/\//i.test(s)) return [{ url: s }];
  return value;
}

// Mapeo: tu Airtable tiene "Item", "Equipo", "Marca", "Modelo", "Serie", "Numero de Placa".
// En el formulario web suelen enviarse como ITEM/EQUIPO/MARCA/MODELO/SERIE/PLACA.
// Aquí normalizamos.
const FIELD_ALIASES = {
  'ITEM': 'Item',
  'Item': 'Item',
  'EQUIPO': 'Equipo',
  'Equipo': 'Equipo',
  'MARCA': 'Marca',
  'Marca': 'Marca',
  'MODELO': 'Modelo',
  'Modelo': 'Modelo',
  'SERIE': 'Serie',
  'Serie': 'Serie',

  'PLACA': 'Numero de Placa',
  'PLACA / NUMERO': 'Numero de Placa',
  'NÚMERO DE PLACA': 'Numero de Placa',
  'NUMERO DE PLACA': 'Numero de Placa',
  'Numero de Placa': 'Numero de Placa',

  'SERVICIO': 'Servicio',
  'Servicio': 'Servicio',

  'UBICACIÓN': 'Ubicación',
  'UBICACION': 'Ubicación',
  'Ubicación': 'Ubicación',

  // Si luego creas estos campos en Airtable con el mismo nombre, quedarán bien:
  'VIDA UTIL': 'Vida Util',
  'VIDA ÚTIL': 'Vida Util',
  'Vida Util': 'Vida Util',
};

function normalizeFields(fields) {
  const out = {};
  for (const [k, v] of Object.entries(fields || {})) {
    const key = FIELD_ALIASES[k] || k; // si no está mapeado, lo deja tal cual
    // NO enviar campos vacíos
    if (v === null || typeof v === 'undefined' || (typeof v === 'string' && v.trim() === '')) continue;
    out[key] = v;
  }
  if (out['MANUAL']) out['MANUAL'] = maybeAttachmentFromUrl(out['MANUAL']);
  return out;
}

// Si Airtable responde 422 por campos desconocidos, normalmente trae algo como:
// { "error": { "type": "UNKNOWN_FIELD_NAME", "message": "Unknown field names: \"FOO\", \"BAR\"" } }
// Quitamos esos campos y reintentamos.
function stripUnknownFields(fields, errData) {
  const msg = errData?.error?.message || '';
  const unknown = [];
  const m = msg.match(/Unknown field names:\s*(.*)$/i);
  if (m && m[1]) {
    // extrae comillas
    const parts = m[1].split(',').map(s => s.trim().replace(/^"|"$/g, '').replace(/^'|'$/g, ''));
    for (const p of parts) if (p) unknown.push(p);
  }
  if (!unknown.length) return fields;

  const cleaned = { ...fields };
  for (const f of unknown) delete cleaned[f];
  return cleaned;
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return json(200, { ok: true });

  const qs = event.queryStringParameters || {};
  if (qs.debug === '1') {
    return json(200, {
      ok: true,
      config: {
        hasApiKey: !!AIRTABLE_API_KEY,
        hasBaseId: !!AIRTABLE_BASE_ID,
        table: INVENTARIO_TABLE,
      },
    });
  }

  if (!AIRTABLE_API_KEY || !AIRTABLE_BASE_ID) {
    return json(500, {
      success: false,
      error: 'Faltan variables de entorno AIRTABLE_API_KEY/AIRTABLE_BASE_ID en Netlify.',
      hint: 'Netlify → Site settings → Environment variables (Production) → luego "Clear cache and deploy".',
    });
  }

  const headers = { Authorization: `Bearer ${AIRTABLE_API_KEY}` };
  const baseUrl = `${AIRTABLE_API}/${encodeURIComponent(INVENTARIO_TABLE)}`;

  try {
    // ---------------- GET ----------------
    if (event.httpMethod === 'GET') {
      const pageSize = Math.min(Number(qs.pageSize || 20) || 20, 100);
      const offset = qs.offset || undefined;
      const q = (qs.q || '').trim();

      let filterByFormula;
      if (q) {
        const qq = escapeForFormula(q.toLowerCase());
        // soporta Item/ITEM y Numero de Placa/PLACA
        filterByFormula = `OR(
          FIND('${qq}', LOWER(IFERROR({Item}&'', ''))),
          FIND('${qq}', LOWER(IFERROR({Equipo}&'', ''))),
          FIND('${qq}', LOWER(IFERROR({Serie}&'', ''))),
          FIND('${qq}', LOWER(IFERROR({Numero de Placa}&'', ''))),
          FIND('${qq}', LOWER(IFERROR({Servicio}&'', ''))),
          FIND('${qq}', LOWER(IFERROR({Ubicación}&'', ''))),
          FIND('${qq}', LOWER(IFERROR({Ubicacion}&'', '')))
        )`;
      }

      // Intento con sort por Item
      try {
        const resp = await axios.get(baseUrl, {
          headers,
          params: {
            pageSize,
            offset,
            sort: [{ field: 'Item', direction: 'asc' }],
            filterByFormula,
          },
        });

        const records = (resp.data.records || []).map((r) => ({ id: r.id, fields: r.fields || {} }));
        return json(200, { success: true, count: records.length, nextOffset: resp.data.offset || null, data: records });
      } catch (err1) {
        // Fallback: sin sort y sin filter
        const status1 = err1?.response?.status;
        if (status1 === 422) {
          const resp2 = await axios.get(baseUrl, { headers, params: { pageSize, offset } });
          const records2 = (resp2.data.records || []).map((r) => ({ id: r.id, fields: r.fields || {} }));
          return json(200, {
            success: true,
            count: records2.length,
            nextOffset: resp2.data.offset || null,
            data: records2,
            warning: 'Se cargó sin filtro/orden (Airtable 422 en fórmula o sort).',
          });
        }
        throw err1;
      }
    }

    // --------------- POST ----------------
    if (event.httpMethod === 'POST') {
      const body = JSON.parse(event.body || '{}');
      const fields0 = normalizeFields(body.fields || {});
      let payload = { fields: fields0 };

      try {
        const resp = await axios.post(baseUrl, payload, { headers });
        return json(200, { success: true, data: { id: resp.data.id, fields: resp.data.fields || {} } });
      } catch (err) {
        if (err?.response?.status === 422) {
          const cleaned = stripUnknownFields(fields0, err.response.data);
          const resp2 = await axios.post(baseUrl, { fields: cleaned }, { headers });
          return json(200, {
            success: true,
            data: { id: resp2.data.id, fields: resp2.data.fields || {} },
            warning: 'Se guardó sin algunos campos (Airtable marcó campos desconocidos). Revisa nombres de columnas en Airtable.',
            removedFields: Object.keys(fields0).filter(k => !(k in cleaned)),
          });
        }
        throw err;
      }
    }

    // --------------- PUT -----------------
    if (event.httpMethod === 'PUT') {
      const body = JSON.parse(event.body || '{}');
      const recordId = body.id;
      if (!recordId) return json(400, { success: false, error: 'Falta id del registro para actualizar.' });

      const fields0 = normalizeFields(body.fields || {});
      const url = `${baseUrl}/${recordId}`;

      try {
        const resp = await axios.patch(url, { fields: fields0 }, { headers });
        return json(200, { success: true, data: { id: resp.data.id, fields: resp.data.fields || {} } });
      } catch (err) {
        if (err?.response?.status === 422) {
          const cleaned = stripUnknownFields(fields0, err.response.data);
          const resp2 = await axios.patch(url, { fields: cleaned }, { headers });
          return json(200, {
            success: true,
            data: { id: resp2.data.id, fields: resp2.data.fields || {} },
            warning: 'Se actualizó sin algunos campos (Airtable marcó campos desconocidos).',
            removedFields: Object.keys(fields0).filter(k => !(k in cleaned)),
          });
        }
        throw err;
      }
    }

    return json(405, { success: false, error: 'Método no permitido' });
  } catch (err) {
    const status = err?.response?.status;
    const detail = err?.response?.data || { message: err.message };
    const hint =
      status === 401 || status === 403
        ? 'Tu token de Airtable no tiene permisos (data.records:read/write) o no tiene acceso a la base.'
        : status === 404
        ? 'Base ID o tabla no encontrada. Verifica AIRTABLE_BASE_ID y el nombre de la tabla.'
        : status === 422
        ? 'Error 422: nombres de campos no coinciden. Revisa que en Airtable existan columnas con esos nombres.'
        : 'Revisa Netlify → Functions → inventario → Logs';

    return json(500, { success: false, error: 'Error Airtable', status, detail, hint });
  }
};
