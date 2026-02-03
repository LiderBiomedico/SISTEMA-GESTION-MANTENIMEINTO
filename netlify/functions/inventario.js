// =============================================================================
// netlify/functions/inventario.js
// Airtable proxy (GET list + POST create + PUT update) with field mapping + retry
// Env:
//   AIRTABLE_API_KEY (or AIRTABLE_TOKEN) : PAT (pat...)
//   AIRTABLE_BASE_ID : app...
//   AIRTABLE_INVENTARIO_TABLE (optional) default "Inventario"
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
  // Si en Airtable los tienes igual, se guardan; si no existen, se omiten en retry:
  'FECHA FABRICA': 'Fecha Fabrica',
  'CERTIFICADO 2025': 'Certificado 2025',
  'CODIGO ECRI': 'Codigo ECRI',
  'REGISTRO INVIMA': 'Registro INVIMA',
  'TIPO DE ADQUISICION': 'Tipo de Adquisicion',
  'NO. DE CONTRATO': 'No. de Contrato',
  'FECHA DE COMRPA': 'Fecha de Compra', // (typo del formulario)
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

function mapFields(inputFields) {
  const out = {};
  for (const [k, v] of Object.entries(inputFields || {})) {
    const key = String(k || '').trim();
    const mapped = FIELD_MAP[key] || key; // if same name exists in Airtable, works
    if (mapped === 'Manual' && isUrl(v)) {
      // If Airtable field is Attachment, it accepts [{url:...}]
      out[mapped] = [{ url: String(v).trim() }];
    } else {
      out[mapped] = v;
    }
  }
  return out;
}

function removeUnknownFields(fields, errorText) {
  // Airtable error can include unknown field names; try to remove them and retry.
  // We remove any field that appears between quotes in the message.
  const unknown = new Set();
  const msg = (errorText && (errorText.message || errorText.error || errorText)) || '';
  const s = typeof msg === 'string' ? msg : JSON.stringify(msg);
  const matches = s.match(/"([^"]+)"/g) || [];
  for (const m of matches) {
    const name = m.replace(/"/g,'').trim();
    if (name) unknown.add(name);
  }
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

    const debug = (event.queryStringParameters && event.queryStringParameters.debug) ? true : false;

    if (debug && event.httpMethod === 'GET') {
      return json(200, {
        ok: true,
        table: TABLE_NAME,
        hasApiKey: !!AIRTABLE_API_KEY,
        hasBaseId: !!AIRTABLE_BASE_ID,
      });
    }

    const baseUrl = `${AIRTABLE_API}/${AIRTABLE_BASE_ID}/${encodeURIComponent(TABLE_NAME)}`;

    // ---------------- GET list ----------------
    if (event.httpMethod === 'GET') {
      const qs = event.queryStringParameters || {};
      const pageSize = Math.min(parseInt(qs.pageSize || '20', 10) || 20, 100);
      const offset = qs.offset ? String(qs.offset) : null;

      const params = new URLSearchParams();
      params.set('pageSize', String(pageSize));
      if (offset) params.set('offset', offset);

      const url = `${baseUrl}?${params.toString()}`;
      const resp = await airtableRequest('GET', url);
      const records = resp.data.records || [];
      return json(200, {
        ok: true,
        data: records,
        count: records.length,
        offset: resp.data.offset || null,
      });
    }

    // parse body
    let body = {};
    try { body = JSON.parse(event.body || '{}'); } catch { body = {}; }

    // ---------------- POST create ----------------
    if (event.httpMethod === 'POST') {
      const mapped = mapFields(body.fields || {});
      try {
        const resp = await airtableRequest('POST', baseUrl, { fields: mapped });
        return json(200, { ok: true, record: resp.data });
      } catch (e) {
        // Retry removing unknown fields
        const status = e.response?.status || 500;
        const data = e.response?.data || e.data || { error: 'Unknown error' };

        if (status === 422) {
          const { cleaned, removed } = removeUnknownFields(mapped, data);
          if (removed.length > 0) {
            const resp2 = await airtableRequest('POST', baseUrl, { fields: cleaned });
            return json(200, { ok: true, record: resp2.data, warning: { removedUnknownFields: removed } });
          }
        }
        return json(status, { ok: false, error: data.error || 'Airtable error', details: data });
      }
    }

    // ---------------- PUT update ----------------
    if (event.httpMethod === 'PUT') {
      const id = body.id;
      if (!id) return json(400, { ok: false, error: 'Missing record id' });
      const mapped = mapFields(body.fields || {});
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
