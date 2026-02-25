// =============================================================================
// netlify/functions/inventario.js - v6 DEFINITIVO
// Fix 422: retry automático removiendo campos desconocidos, sin optional chaining
// =============================================================================
const axios = require('axios');

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY || process.env.AIRTABLE_TOKEN || '';
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID || '';
const TABLE_NAME       = process.env.AIRTABLE_INVENTARIO_TABLE || 'Inventario';
const AIRTABLE_API     = 'https://api.airtable.com/v0';

function json(code, body) {
  return {
    statusCode: code,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
    },
    body: JSON.stringify(body)
  };
}

// ─── FIELD MAP ───────────────────────────────────────────────────────────────
const FIELD_MAP = {
  // UPPERCASE (formulario newInventario)
  'ITEM': 'Item', 'EQUIPO': 'Equipo', 'MARCA': 'Marca', 'MODELO': 'Modelo',
  'SERIE': 'Serie', 'PLACA': 'Numero de Placa', 'NUMERO DE PLACA': 'Numero de Placa',
  'REGISTRO INVIMA': 'Registro INVIMA', 'TIPO DE ADQUISICION': 'Tipo de Adquisicion',
  'NO. DE CONTRATO': 'No. de Contrato', 'SERVICIO': 'Servicio',
  'UBICACION': 'Ubicacion', 'UBICACIÓN': 'Ubicacion',
  'VIDA UTIL': 'Vida Util', 'FECHA DE COMRPA': 'Fecha de Compra',
  'FECHA DE COMPRA': 'Fecha de Compra', 'VALOR EN PESOS': 'Valor en Pesos',
  'FECHA DE RECEPCIÓN': 'Fecha de Recepcion', 'FECHA DE RECEPCION': 'Fecha de Recepcion',
  'FECHA DE INSTALACIÓN': 'Fecha de Instalacion', 'FECHA DE INSTALACION': 'Fecha de Instalacion',
  'INICIO DE GARANTIA': 'Inicio de Garantia', 'TERMINO DE GARANTIA': 'Termino de Garantia',
  'CLASIFICACION BIOMEDICA': 'Clasificacion Biomedica',
  'CLASIFICACION DE LA TECNOLOGIA': 'Clasificacion de la Tecnologia',
  'CLASIFICACION DEL RIESGO': 'Clasificacion del Riesgo',
  'MANUAL': 'Manual', 'TIPO DE MTTO': 'Tipo de MTTO',
  'COSTO DE MANTENIMIENTO': 'Costo de Mantenimiento', 'CALIBRABLE': 'Calibrable',
  'N. CERTIFICADO': 'N. Certificado',
  'FRECUENCIA DE MTTO PREVENTIVO': 'Frecuencia de MTTO Preventivo',
  'FECHA PROGRAMADA DE MANTENIMINETO': 'Fecha Programada de Mantenimiento',
  'FRECUENCIA DE MANTENIMIENTO': 'Frecuencia de Mantenimiento',
  'PROGRAMACION DE MANTENIMIENTO ANUAL': 'Programacion de Mantenimiento Anual',
  'RESPONSABLE': 'Responsable', 'NOMBRE': 'Nombre', 'DIRECCION': 'Direccion',
  'TELEFONO': 'Telefono', 'CIUDAD': 'Ciudad',
  // Title Case (equipoModal / inventario-module.js)
  'Item': 'Item', 'Equipo': 'Equipo', 'Marca': 'Marca', 'Modelo': 'Modelo',
  'Serie': 'Serie', 'Numero de Placa': 'Numero de Placa',
  'Registro INVIMA': 'Registro INVIMA', 'Tipo de Adquisicion': 'Tipo de Adquisicion',
  'No. de Contrato': 'No. de Contrato', 'Servicio': 'Servicio',
  'Ubicacion': 'Ubicacion', 'Ubicación': 'Ubicacion',
  'Vida Util': 'Vida Util', 'Fecha de Compra': 'Fecha de Compra',
  'Valor en Pesos': 'Valor en Pesos', 'Fecha de Recepcion': 'Fecha de Recepcion',
  'Fecha de Instalacion': 'Fecha de Instalacion', 'Inicio de Garantia': 'Inicio de Garantia',
  'Termino de Garantia': 'Termino de Garantia',
  'Clasificacion Biomedica': 'Clasificacion Biomedica',
  'Clasificacion de la Tecnologia': 'Clasificacion de la Tecnologia',
  'Clasificacion del Riesgo': 'Clasificacion del Riesgo',
  'Manual': 'Manual', 'Tipo de MTTO': 'Tipo de MTTO',
  'Costo de Mantenimiento': 'Costo de Mantenimiento', 'Calibrable': 'Calibrable',
  'N. Certificado': 'N. Certificado',
  'Frecuencia de MTTO Preventivo': 'Frecuencia de MTTO Preventivo',
  'Fecha Programada de Mantenimiento': 'Fecha Programada de Mantenimiento',
  'Frecuencia de Mantenimiento': 'Frecuencia de Mantenimiento',
  'Programacion de Mantenimiento Anual': 'Programacion de Mantenimiento Anual',
  'Responsable': 'Responsable', 'Nombre': 'Nombre', 'Direccion': 'Direccion',
  'Telefono': 'Telefono', 'Ciudad': 'Ciudad'
};

const NUMBER_FIELDS = new Set(['Valor en Pesos', 'Costo de Mantenimiento', 'Vida Util']);
const BOOL_FIELDS   = new Set(['Calibrable']);
const DATE_FIELDS   = new Set([
  'Fecha de Compra', 'Fecha de Instalacion', 'Inicio de Garantia',
  'Termino de Garantia', 'Fecha Programada de Mantenimiento', 'Fecha de Recepcion'
]);

function isUrl(s) { return typeof s === 'string' && /^https?:\/\/\S+/i.test(s.trim()); }
function isISODate(s) { return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}/.test(s.trim()); }

function toNumber(v) {
  if (typeof v === 'number') return v;
  var n = parseFloat(String(v).replace(/[^0-9.]/g, ''));
  return isFinite(n) ? n : null;
}

function toBoolean(v) {
  if (typeof v === 'boolean') return v;
  var s = String(v).trim().toLowerCase();
  return ['true', '1', 'si', 'sí', 'yes', 'y', 'on', 'x'].indexOf(s) !== -1;
}

function normalizeValue(field, value) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string' && value.trim() === '') return null;
  if (NUMBER_FIELDS.has(field)) { var n = toNumber(value); return n !== null ? n : null; }
  if (BOOL_FIELDS.has(field))   return toBoolean(value);
  if (DATE_FIELDS.has(field)) {
    if (value instanceof Date) return value.toISOString().slice(0, 10);
    if (isISODate(value)) return String(value).trim().slice(0, 10);
    return null;
  }
  return String(value).trim();
}

function mapFields(inputFields) {
  var out = {};
  var keys = Object.keys(inputFields || {});
  for (var i = 0; i < keys.length; i++) {
    var k      = String(keys[i]).trim();
    var v      = inputFields[keys[i]];
    var mapped = FIELD_MAP[k] || k;
    if (mapped === 'Manual' && isUrl(v)) { out[mapped] = [{ url: String(v).trim() }]; continue; }
    var norm = normalizeValue(mapped, v);
    if (norm !== null && norm !== undefined) out[mapped] = norm;
  }
  console.log('[inventario] mapFields result:', JSON.stringify(out));
  return out;
}

// Extrae el nombre del campo desconocido del mensaje de error de Airtable
function extractUnknownField(errData) {
  var msg = '';
  if (!errData) return null;
  if (typeof errData === 'string') { msg = errData; }
  else if (errData.error && typeof errData.error === 'object' && errData.error.message) { msg = errData.error.message; }
  else if (errData.error && typeof errData.error === 'string') { msg = errData.error; }
  else if (errData.message) { msg = errData.message; }
  else { msg = JSON.stringify(errData); }

  // Airtable: 'Unknown field name: "NombreCampo"'
  var match = msg.match(/Unknown field name[^"]*"([^"]+)"/i);
  if (match) return match[1];
  // Fallback: primer token entre comillas
  var q = msg.match(/"([^"]+)"/);
  if (q) return q[1];
  return null;
}

function airtableReq(method, url, data) {
  if (!AIRTABLE_API_KEY || !AIRTABLE_BASE_ID) {
    return Promise.reject({ status: 500, message: 'Faltan variables de entorno AIRTABLE_API_KEY y AIRTABLE_BASE_ID' });
  }
  return axios({ method: method, url: url, headers: { Authorization: 'Bearer ' + AIRTABLE_API_KEY }, data: data });
}

// POST con retry automático: remueve campos desconocidos y reintenta hasta 5 veces
async function postWithRetry(baseUrl, fields) {
  var mapped   = mapFields(fields);
  var removed  = [];

  for (var attempt = 1; attempt <= 5; attempt++) {
    if (Object.keys(mapped).length === 0) break;
    try {
      var resp = await airtableReq('POST', baseUrl, { fields: mapped });
      return { ok: true, record: resp.data, removedFields: removed };
    } catch (e) {
      var status = (e.response && e.response.status) ? e.response.status : 500;
      var data   = (e.response && e.response.data)   ? e.response.data   : {};
      console.error('[inventario] POST intento ' + attempt + ' falló (' + status + '):', JSON.stringify(data));

      if (status !== 422) return { ok: false, status: status, error: data.error || 'Error de Airtable', details: data };

      var badField = extractUnknownField(data);
      if (!badField) return { ok: false, status: 422, error: data.error || 'Campo inválido no identificado', details: data };

      console.warn('[inventario] Removiendo campo desconocido:', badField);
      removed.push(badField);
      delete mapped[badField];
    }
  }

  if (Object.keys(mapped).length === 0) {
    return {
      ok: false, status: 422,
      error: 'Ningún campo del formulario existe en Airtable (tabla: "' + TABLE_NAME + '")',
      hint:  'Campos rechazados: ' + removed.join(', ') + '. Verifica los nombres exactos en tu base de Airtable.',
      removedFields: removed
    };
  }
  return { ok: false, status: 422, error: 'Error persistente después de ' + removed.length + ' reintentos', removedFields: removed };
}

// ─── HANDLER ─────────────────────────────────────────────────────────────────
exports.handler = async function(event) {
  try {
    if (event.httpMethod === 'OPTIONS') return json(204, { ok: true });

    var qs       = event.queryStringParameters || {};
    var baseUrl  = AIRTABLE_API + '/' + AIRTABLE_BASE_ID + '/' + encodeURIComponent(TABLE_NAME);

    // ── GET ──────────────────────────────────────────────────────────────────
    if (event.httpMethod === 'GET') {
      if (qs.debug) return json(200, { ok: true, table: TABLE_NAME, hasKey: !!AIRTABLE_API_KEY, hasBase: !!AIRTABLE_BASE_ID });

      var pageSize = Math.min(parseInt(qs.pageSize || '50', 10) || 50, 100);
      var offset   = qs.offset && qs.offset !== 'true' && qs.offset !== 'false' ? qs.offset : null;
      var params   = 'pageSize=' + pageSize + (offset ? '&offset=' + offset : '');
      if (qs.q) params += '&filterByFormula=SEARCH("' + qs.q.replace(/"/g,'') + '",CONCATENATE(Item,Equipo,Marca,Serie))';

      var r = await airtableReq('GET', baseUrl + '?' + params);
      return json(200, { ok: true, data: r.data.records || [], count: (r.data.records || []).length, offset: r.data.offset || null });
    }

    var body = {};
    try { body = JSON.parse(event.body || '{}'); } catch(e) { body = {}; }

    // ── POST ─────────────────────────────────────────────────────────────────
    if (event.httpMethod === 'POST') {
      var result = await postWithRetry(baseUrl, body.fields || {});
      if (result.ok) {
        var res = { ok: true, success: true, record: result.record };
        if (result.removedFields && result.removedFields.length > 0) {
          res.warning = { removedUnknownFields: result.removedFields, message: 'Guardado sin los campos: ' + result.removedFields.join(', ') };
        }
        return json(200, res);
      }
      return json(result.status || 422, { ok: false, error: result.error, hint: result.hint || '', details: result.details, removedFields: result.removedFields || [] });
    }

    // ── PUT ──────────────────────────────────────────────────────────────────
    if (event.httpMethod === 'PUT') {
      if (!body.id) return json(400, { ok: false, error: 'Falta el ID del registro' });
      var mapped2 = mapFields(body.fields || {});
      var putUrl  = baseUrl + '/' + encodeURIComponent(body.id);
      try {
        var pr = await airtableReq('PATCH', putUrl, { fields: mapped2 });
        return json(200, { ok: true, record: pr.data });
      } catch (pe) {
        var ps = (pe.response && pe.response.status) ? pe.response.status : 500;
        var pd = (pe.response && pe.response.data)   ? pe.response.data   : {};
        if (ps === 422) {
          var badF = extractUnknownField(pd);
          if (badF) { delete mapped2[badF]; }
          try {
            var pr2 = await airtableReq('PATCH', putUrl, { fields: mapped2 });
            return json(200, { ok: true, record: pr2.data, warning: badF ? { removedUnknownFields: [badF] } : undefined });
          } catch (pe2) {
            var ps2 = (pe2.response && pe2.response.status) ? pe2.response.status : 500;
            var pd2 = (pe2.response && pe2.response.data)   ? pe2.response.data   : {};
            return json(ps2, { ok: false, error: pd2.error || 'Error actualizando', details: pd2 });
          }
        }
        return json(ps, { ok: false, error: pd.error || 'Error actualizando', details: pd });
      }
    }

    // ── DELETE ───────────────────────────────────────────────────────────────
    if (event.httpMethod === 'DELETE') {
      var parts = event.path.split('/');
      var recId = parts[parts.length - 1];
      if (!recId || recId === 'inventario') return json(400, { ok: false, error: 'Falta el ID en la URL' });
      try {
        await airtableReq('DELETE', baseUrl + '/' + encodeURIComponent(recId));
        return json(200, { ok: true, deleted: true, id: recId });
      } catch (de) {
        var ds = (de.response && de.response.status) ? de.response.status : 500;
        var dd = (de.response && de.response.data)   ? de.response.data   : {};
        return json(ds, { ok: false, error: dd.error || 'Error eliminando', details: dd });
      }
    }

    return json(405, { ok: false, error: 'Método no permitido' });

  } catch (err) {
    var es = (err.response && err.response.status) ? err.response.status : (err.status || 500);
    var ed = (err.response && err.response.data)   ? err.response.data   : { error: err.message || 'Error interno' };
    console.error('[inventario] Error global:', err.message || err);
    return json(es, { ok: false, error: ed.error || err.message || 'Error interno', details: ed });
  }
};
