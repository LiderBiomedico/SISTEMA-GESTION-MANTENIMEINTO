// =============================================================================
// netlify/functions/inventario.js  (FIX 422)
// - Ignores invalid offset values like "true"/"false"
// - Normalizes field types for Airtable (numbers, booleans, dates)
// - Maps UI field names -> Airtable columns
// - Retries on unknown fields
// =============================================================================
const axios = require('axios');

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY || process.env.AIRTABLE_TOKEN || '';
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID || '';
const TABLE_NAME = process.env.AIRTABLE_INVENTARIO_TABLE || 'Inventario';
const AIRTABLE_API = 'https://api.airtable.com/v0';

function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,OPTIONS',
    },
    body: JSON.stringify(body),
  };
}

function isUrl(s) {
  return typeof s === 'string' && /^https?:\/\/\S+/i.test(s.trim());
}

function looksLikeISODate(s) {
  return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}/.test(s.trim());
}

function toNumber(v) {
  if (typeof v === 'number') return v;
  if (typeof v !== 'string') return v;
  const s = v.trim();
  if (!s) return v;
  // Remove currency symbols and spaces, keep digits, dot, comma, minus
  const cleaned = s.replace(/[^\d.,-]/g, '');
  if (!cleaned) return v;
  // If contains both '.' and ',', assume thousand separators; keep last as decimal
  let norm = cleaned;
  const hasDot = cleaned.includes('.');
  const hasComma = cleaned.includes(',');
  if (hasDot && hasComma) {
    // remove thousand separators (the one that appears earlier)
    // convert comma to decimal if last separator is comma
    const lastDot = cleaned.lastIndexOf('.');
    const lastComma = cleaned.lastIndexOf(',');
    if (lastComma > lastDot) {
      norm = cleaned.replace(/\./g,'').replace(',', '.');
    } else {
      norm = cleaned.replace(/,/g,'');
    }
  } else if (hasComma && !hasDot) {
    // treat comma as decimal or thousands; if >1 commas, remove all
    const parts = cleaned.split(',');
    if (parts.length > 2) norm = parts.join('');
    else norm = parts[0] + '.' + parts[1];
  } else {
    norm = cleaned.replace(/,/g,'');
  }
  const n = Number(norm);
  return Number.isFinite(n) ? n : v;
}

function toBoolean(v) {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') return v !== 0;
  if (typeof v !== 'string') return v;
  const s = v.trim().toLowerCase();
  if (['true','1','si','sí','yes','y','on','x'].includes(s)) return true;
  if (['false','0','no','off','n'].includes(s)) return false;
  return v;
}

// Map UI field labels (uppercase / accents / typos) -> Airtable column names
const FIELD_MAP = {
  'ITEM': 'Item',
  'EQUIPO': 'Equipo',
  'MARCA': 'Marca',
  'MODELO': 'Modelo',
  'SERIE': 'Serie',
  'PLACA': 'Numero de Placa',
  'NÚMERO DE PLACA': 'Numero de Placa',
  'NUMERO DE PLACA': 'Numero de Placa',
  'UBICACIÓN': 'Ubicación',
  'UBICACION': 'Ubicación',
  'SERVICIO': 'Servicio',
  'VIDA UTIL': 'Vida Util',
  'VIDA ÚTIL': 'Vida Util',

  'FECHA FABRICA': 'Fecha Fabrica',
  'CERTIFICADO 2025': 'Certificado 2025',
  'CODIGO ECRI': 'Codigo ECRI',
  'REGISTRO INVIMA': 'Registro INVIMA',
  'TIPO DE ADQUISICION': 'Tipo de Adquisicion',
  'NO. DE CONTRATO': 'No. de Contrato',

  'FECHA DE COMRPA': 'Fecha de Compra',
  'FECHA DE COMPRA': 'Fecha de Compra',
  'VALOR EN PESOS': 'Valor en Pesos',
  'FECHA DE RECEPCIÓN': 'Fecha de Recepción',
  'FECHA DE RECEPCION': 'Fecha de Recepción',
  'FECHA DE INSTALACIÓN': 'Fecha de Instalación',
  'FECHA DE INSTALACION': 'Fecha de Instalación',
  'INICIO DE GARANTIA': 'Inicio de Garantia',
  'TERMINO DE GARANTIA': 'Termino de Garantia',

  'CLASIFICACION BIOMEDICA': 'Clasificacion Biomedica',
  'CLASIFICACION DE LA TECNOLOGIA': 'Clasificacion de la Tecnologia',
  'CLASIFICACION DEL RIESGO': 'Clasificacion del Riesgo',

  'MANUAL': 'Manual',
  'TIPO DE MTTO': 'Tipo de MTTO',
  'COSTO DE MANTENIMIENTO': 'Costo de Mantenimiento',

  'CALIBRABLE': 'Calibrable',
  'N. CERTIFICADO': 'N. Certificado',
  'FRECUENCIA DE MTTO PREVENTIVO': 'Frecuencia de MTTO Preventivo',
  'FECHA PROGRAMADA DE MANTENIMINETO': 'Fecha Programada de Mantenimiento',
  'FRECUENCIA DE MANTENIMIENTO': 'Frecuencia de Mantenimiento',
  'PROGRAMACION DE MANTENIMIENTO ANUAL': 'Programacion de Mantenimiento Anual',
  'RESPONSABLE': 'Responsable',
  'NOMBRE': 'Nombre',
  'DIRECCION': 'Direccion',
  'TELEFONO': 'Telefono',
  'CIUDAD': 'Ciudad',
};

// Fields we should normalize
const NUMBER_FIELDS = new Set([
  'Valor en Pesos',
  'Costo de Mantenimiento',
  'Vida Util'
]);

const BOOL_FIELDS = new Set([
  'Calibrable'
]);

const DATE_FIELDS = new Set([
  'Fecha Fabrica',
  'Fecha de Compra',
  'Fecha de Recepción',
  'Fecha de Instalación',
  'Inicio de Garantia',
  'Termino de Garantia',
  'Fecha Programada de Mantenimiento'
]);

function normalizeValue(fieldName, value) {
  if (value === null || typeof value === 'undefined') return value;
  if (NUMBER_FIELDS.has(fieldName)) return toNumber(value);
  if (BOOL_FIELDS.has(fieldName)) return toBoolean(value);

  if (DATE_FIELDS.has(fieldName)) {
    if (value instanceof Date) return value.toISOString().slice(0,10);
    if (looksLikeISODate(value)) return String(value).trim().slice(0,10);
    return value; // let Airtable validate
  }

  return value;
}

function mapAndNormalizeFields(inputFields) {
  const out = {};
  for (const [k, v] of Object.entries(inputFields || {})) {
    const key = String(k || '').trim();
    const mapped = FIELD_MAP[key] || key;

    if (mapped === 'Manual' && isUrl(v)) {
      out[mapped] = [{ url: String(v).trim() }];
      continue;
    }
    out[mapped] = normalizeValue(mapped, v);
  }
  return out;
}

function removeUnknownFields(fields, errData) {
  const msg = (errData && (errData.message || errData.error)) ? (errData.message || errData.error) : JSON.stringify(errData || {});
  const matches = String(msg).match(/"([^"]+)"/g) || [];
  const unknown = new Set(matches.map(m => m.replace(/"/g,'').trim()).filter(Boolean));
  if (unknown.size === 0) return { cleaned: fields, removed: [] };
  const cleaned = { ...fields };
  const removed = [];
  for (const u of unknown) {
    if (u in cleaned) { delete cleaned[u]; removed.push(u); }
  }
  return { cleaned, removed };
}

async function airtableRequest(method, url, data) {
  if (!AIRTABLE_API_KEY || !AIRTABLE_BASE_ID) {
    throw { status: 500, data: { error: 'Missing AIRTABLE_API_KEY/TOKEN or AIRTABLE_BASE_ID' } };
  }
  const headers = { Authorization: `Bearer ${AIRTABLE_API_KEY}` };
  return axios({ method, url, headers, data });
}

exports.handler = async (event) => {
  try {
    if (event.httpMethod === 'OPTIONS') return json(204, { ok: true });

    const qs = event.queryStringParameters || {};
    const debug = !!qs.debug;

    if (debug && event.httpMethod === 'GET') {
      return json(200, { ok: true, table: TABLE_NAME, hasApiKey: !!AIRTABLE_API_KEY, hasBaseId: !!AIRTABLE_BASE_ID });
    }

    const baseUrl = `${AIRTABLE_API}/${AIRTABLE_BASE_ID}/${encodeURIComponent(TABLE_NAME)}`;

    // GET list
    if (event.httpMethod === 'GET') {
      const pageSize = Math.min(parseInt(qs.pageSize || '20', 10) || 20, 100);
      let offset = qs.offset ? String(qs.offset) : null;

      // FIX: ignore invalid boolean offsets coming from frontend
      if (offset && (offset === 'true' || offset === 'false' || offset === '0')) offset = null;

      const params = new URLSearchParams();
      params.set('pageSize', String(pageSize));
      if (offset) params.set('offset', offset);

      const url = `${baseUrl}?${params.toString()}`;
      const resp = await airtableRequest('GET', url);
      const records = resp.data.records || [];
      return json(200, { ok: true, data: records, count: records.length, offset: resp.data.offset || null });
    }

    // body
    let body = {};
    try { body = JSON.parse(event.body || '{}'); } catch { body = {}; }

    // POST create
    if (event.httpMethod === 'POST') {
      const mapped = mapAndNormalizeFields(body.fields || {});
      try {
        const resp = await airtableRequest('POST', baseUrl, { fields: mapped });
        return json(200, { ok: true, record: resp.data });
      } catch (e) {
        const status = e.response?.status || 500;
        const data = e.response?.data || { error: 'Airtable error' };

        // Retry on unknown fields
        if (status === 422) {
          const { cleaned, removed } = removeUnknownFields(mapped, data);
          if (removed.length > 0) {
            try {
              const resp2 = await airtableRequest('POST', baseUrl, { fields: cleaned });
              return json(200, { ok: true, record: resp2.data, warning: { removedUnknownFields: removed } });
            } catch (e2) {
              const status2 = e2.response?.status || 500;
              const data2 = e2.response?.data || { error: 'Airtable error after retry' };
              return json(status2, { ok: false, error: data2.error || 'Airtable error', details: data2, mappedSent: mapped });
            }
          }
        }
        return json(status, { ok: false, error: data.error || 'Airtable error', details: data, mappedSent: mapped });
      }
    }

    // PUT update
    if (event.httpMethod === 'PUT') {
      const id = body.id;
      if (!id) return json(400, { ok: false, error: 'Missing record id' });
      const mapped = mapAndNormalizeFields(body.fields || {});
      const url = `${baseUrl}/${encodeURIComponent(id)}`;
      try {
        const resp = await airtableRequest('PATCH', url, { fields: mapped });
        return json(200, { ok: true, record: resp.data });
      } catch (e) {
        const status = e.response?.status || 500;
        const data = e.response?.data || { error: 'Airtable error' };
        return json(status, { ok: false, error: data.error || 'Airtable error', details: data });
      }
    }

    return json(405, { ok: false, error: 'Method not allowed' });

  } catch (err) {
    const status = err.status || err.response?.status || 500;
    const data = err.data || err.response?.data || { error: err.message || 'Server error' };
    return json(status, { ok: false, error: data.error || 'Server error', details: data });
  }
};
