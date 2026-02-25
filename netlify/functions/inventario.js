// =============================================================================
// netlify/functions/inventario.js - v7 DEFINITIVO
// Fix crítico: distingue 422 por campo desconocido vs 422 por tipo de dato inválido
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
var FIELD_MAP = {
  'ITEM': 'Item', 'EQUIPO': 'Equipo', 'MARCA': 'Marca', 'MODELO': 'Modelo',
  'SERIE': 'Serie', 'PLACA': 'Numero de Placa', 'NUMERO DE PLACA': 'Numero de Placa',
  'REGISTRO INVIMA': 'Registro INVIMA', 'TIPO DE ADQUISICION': 'Tipo de Adquisicion',
  'NO. DE CONTRATO': 'No. de Contrato', 'SERVICIO': 'Servicio',
  'UBICACION': 'Ubicacion', 'UBICACIÓN': 'Ubicacion',
  'VIDA UTIL': 'Vida Util',
  'FECHA DE COMRPA': 'Fecha de Compra', 'FECHA DE COMPRA': 'Fecha de Compra',
  'VALOR EN PESOS': 'Valor en Pesos',
  'FECHA DE RECEPCIÓN': 'Fecha de Recepcion', 'FECHA DE RECEPCION': 'Fecha de Recepcion',
  'FECHA DE INSTALACIÓN': 'Fecha de Instalacion', 'FECHA DE INSTALACION': 'Fecha de Instalacion',
  'INICIO DE GARANTIA': 'Inicio de Garantia', 'TERMINO DE GARANTIA': 'Termino de Garantia',
  'CLASIFICACION BIOMEDICA': 'Clasificacion Biomedica',
  'CLASIFICACION DE LA TECNOLOGIA': 'Clasificacion de la Tecnologia',
  'CLASIFICACION DEL RIESGO': 'Clasificacion del Riesgo',
  'MANUAL': 'Manual', 'TIPO DE MTTO': 'Tipo de MTTO',
  'COSTO DE MANTENIMIENTO': 'Costo de Mantenimiento',
  'CALIBRABLE': 'Calibrable',
  'N. CERTIFICADO': 'N. Certificado',
  'FRECUENCIA DE MTTO PREVENTIVO': 'Frecuencia de MTTO Preventivo',
  'FECHA PROGRAMADA DE MANTENIMINETO': 'Fecha Programada de Mantenimiento',
  'FRECUENCIA DE MANTENIMIENTO': 'Frecuencia de Mantenimiento',
  'PROGRAMACION DE MANTENIMIENTO ANUAL': 'Programacion de Mantenimiento Anual',
  'RESPONSABLE': 'Responsable', 'NOMBRE': 'Nombre', 'DIRECCION': 'Direccion',
  'TELEFONO': 'Telefono', 'CIUDAD': 'Ciudad',
  // Title Case
  'Item': 'Item', 'Equipo': 'Equipo', 'Marca': 'Marca', 'Modelo': 'Modelo',
  'Serie': 'Serie', 'Numero de Placa': 'Numero de Placa',
  'Registro INVIMA': 'Registro INVIMA', 'Tipo de Adquisicion': 'Tipo de Adquisicion',
  'No. de Contrato': 'No. de Contrato', 'Servicio': 'Servicio',
  'Ubicacion': 'Ubicacion', 'Ubicación': 'Ubicacion', 'Vida Util': 'Vida Util',
  'Fecha de Compra': 'Fecha de Compra', 'Valor en Pesos': 'Valor en Pesos',
  'Fecha de Recepcion': 'Fecha de Recepcion', 'Fecha de Instalacion': 'Fecha de Instalacion',
  'Inicio de Garantia': 'Inicio de Garantia', 'Termino de Garantia': 'Termino de Garantia',
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

// Campos con tipo estricto en Airtable
var NUMBER_FIELDS = { 'Valor en Pesos': 1, 'Costo de Mantenimiento': 1 };
// Vida Util se trata como texto libre (puede ser "10 años", "5 años") a menos que sea número puro
var BOOL_FIELDS   = { 'Calibrable': 1 };
var DATE_FIELDS   = {
  'Fecha de Compra': 1, 'Fecha de Instalacion': 1, 'Inicio de Garantia': 1,
  'Termino de Garantia': 1, 'Fecha Programada de Mantenimiento': 1, 'Fecha de Recepcion': 1
};

function isUrl(s) { return typeof s === 'string' && /^https?:\/\/\S+/i.test(s.trim()); }
function isISODate(s) { return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}/.test(s.trim()); }

function normalizeValue(field, value) {
  if (value === null || value === undefined) return null;
  var str = String(value).trim();
  if (str === '') return null;

  if (NUMBER_FIELDS[field]) {
    var n = parseFloat(str.replace(/[^0-9.]/g, ''));
    return isFinite(n) ? n : null;  // si no es número válido, no enviar
  }

  if (BOOL_FIELDS[field]) {
    var s = str.toLowerCase();
    return ['true','1','si','sí','yes','y','on','x'].indexOf(s) !== -1;
  }

  if (DATE_FIELDS[field]) {
    if (isISODate(str)) return str.slice(0, 10);
    return null;  // fecha inválida → no enviar (evita error de tipo)
  }

  // Vida Util: si es número puro enviar como number, si tiene texto enviar como string
  if (field === 'Vida Util') {
    var numOnly = parseFloat(str.replace(/[^0-9.]/g, ''));
    if (isFinite(numOnly) && String(numOnly) === str.replace(/[^0-9.]/g, '')) return numOnly;
    return str;  // texto como "10 años" → string
  }

  return str;
}

function mapFields(inputFields) {
  var out  = {};
  var keys = Object.keys(inputFields || {});
  for (var i = 0; i < keys.length; i++) {
    var k      = String(keys[i]).trim();
    var v      = inputFields[keys[i]];
    var mapped = FIELD_MAP[k] || k;
    if (mapped === 'Manual' && isUrl(v)) {
      out[mapped] = [{ url: String(v).trim() }];
      continue;
    }
    var norm = normalizeValue(mapped, v);
    if (norm !== null && norm !== undefined) out[mapped] = norm;
  }
  console.log('[inventario] mapFields:', JSON.stringify(out));
  return out;
}

// ─── PARSE ERROR DE AIRTABLE ─────────────────────────────────────────────────
// Retorna { type, fieldName, message }
// type: 'UNKNOWN_FIELD' | 'INVALID_VALUE' | 'OTHER'
function parseAirtableError(errData) {
  var raw = '';
  if (!errData) return { type: 'OTHER', fieldName: null, message: 'Error desconocido' };

  // Obtener el string de error
  if (typeof errData === 'string') {
    raw = errData;
  } else {
    // Airtable puede retornar { error: { type, message } } o { error: "string" } o { message: "string" }
    var errObj = errData.error || errData;
    if (typeof errObj === 'object') {
      raw = errObj.message || errObj.type || JSON.stringify(errObj);
    } else {
      raw = String(errObj);
    }
    if (!raw && errData.message) raw = errData.message;
  }

  var rawLower = raw.toLowerCase();

  // Caso 1: campo desconocido — SOLO matchear el patrón exacto de Airtable
  // Formato: 'Unknown field name: "NombreCampo"'
  if (rawLower.indexOf('unknown field') !== -1) {
    var m = raw.match(/unknown field name[:\s]*"([^"]+)"/i);
    if (m) return { type: 'UNKNOWN_FIELD', fieldName: m[1], message: raw };
    // Sin nombre identificable → reportar como error genérico
    return { type: 'UNKNOWN_FIELD', fieldName: null, message: raw };
  }

  // Caso 2: tipo de dato inválido
  if (rawLower.indexOf('invalid') !== -1 || rawLower.indexOf('cannot') !== -1 || rawLower.indexOf('expected') !== -1) {
    return { type: 'INVALID_VALUE', fieldName: null, message: raw };
  }

  return { type: 'OTHER', fieldName: null, message: raw };
}

function airtableReq(method, url, data) {
  if (!AIRTABLE_API_KEY || !AIRTABLE_BASE_ID) {
    var err = new Error('Faltan AIRTABLE_API_KEY y AIRTABLE_BASE_ID en las variables de entorno de Netlify');
    err.status = 500;
    return Promise.reject(err);
  }
  return axios({ method: method, url: url, headers: { Authorization: 'Bearer ' + AIRTABLE_API_KEY }, data: data });
}

// POST con retry: solo remueve campos si el error es UNKNOWN_FIELD con nombre identificado
async function postWithRetry(baseUrl, inputFields) {
  var mapped  = mapFields(inputFields);
  var removed = [];

  if (Object.keys(mapped).length === 0) {
    return { ok: false, status: 400, error: 'No hay campos válidos para guardar (todos estaban vacíos o con tipo inválido)' };
  }

  for (var attempt = 1; attempt <= 6; attempt++) {
    if (Object.keys(mapped).length === 0) break;

    console.log('[inventario] POST intento ' + attempt + ', campos: ' + Object.keys(mapped).join(', '));

    try {
      var resp = await airtableReq('POST', baseUrl, { fields: mapped });
      console.log('[inventario] POST exitoso en intento ' + attempt + (removed.length ? ' | Removidos: ' + removed.join(', ') : ''));
      return { ok: true, record: resp.data, removedFields: removed };
    } catch (e) {
      var status  = (e.response && e.response.status) ? e.response.status : 500;
      var errData = (e.response && e.response.data)   ? e.response.data   : {};

      console.error('[inventario] Intento ' + attempt + ' ERROR ' + status + ':', JSON.stringify(errData));

      // Error no recuperable
      if (status !== 422) {
        return { ok: false, status: status, error: (errData.error ? String(errData.error) : 'Error de Airtable (' + status + ')'), details: errData };
      }

      var parsed = parseAirtableError(errData);
      console.log('[inventario] Error parseado:', JSON.stringify(parsed));

      if (parsed.type === 'UNKNOWN_FIELD' && parsed.fieldName) {
        // Campo desconocido identificado → remover y reintentar
        console.warn('[inventario] Removiendo campo desconocido: "' + parsed.fieldName + '"');
        removed.push(parsed.fieldName);
        delete mapped[parsed.fieldName];
        continue;
      }

      // INVALID_VALUE u otro 422 → NO reintentar, reportar directamente
      var errMsg = parsed.message || 'Airtable rechazó la petición (422)';
      if (parsed.type === 'INVALID_VALUE') {
        errMsg = 'Error de tipo de dato: ' + errMsg + '. Verifica que los campos numéricos y de fecha tengan el formato correcto.';
      }
      return { ok: false, status: 422, error: errMsg, details: errData, removedFields: removed };
    }
  }

  // Agotados los reintentos
  if (Object.keys(mapped).length === 0) {
    return {
      ok: false, status: 422,
      error: 'Ningún campo del formulario existe en la tabla "' + TABLE_NAME + '" de Airtable.',
      hint:  'Revisa que los nombres de columnas en Airtable coincidan exactamente. Campos rechazados: ' + removed.join(', '),
      removedFields: removed
    };
  }

  return {
    ok: false, status: 422,
    error: 'No se pudo guardar después de ' + (attempt - 1) + ' intentos.',
    removedFields: removed
  };
}

// ─── HANDLER ─────────────────────────────────────────────────────────────────
exports.handler = async function(event) {
  try {
    if (event.httpMethod === 'OPTIONS') return json(204, { ok: true });

    var qs      = event.queryStringParameters || {};
    var baseUrl = AIRTABLE_API + '/' + AIRTABLE_BASE_ID + '/' + encodeURIComponent(TABLE_NAME);

    // ── GET ──────────────────────────────────────────────────────────────────
    if (event.httpMethod === 'GET') {
      if (qs.debug) return json(200, { ok: true, table: TABLE_NAME, hasKey: !!AIRTABLE_API_KEY, hasBase: !!AIRTABLE_BASE_ID });

      var pageSize = Math.min(parseInt(qs.pageSize || '50', 10) || 50, 100);
      var offset   = (qs.offset && qs.offset !== 'true' && qs.offset !== 'false') ? qs.offset : null;
      var params   = 'pageSize=' + pageSize + (offset ? '&offset=' + encodeURIComponent(offset) : '');
      if (qs.q) {
        var safe = qs.q.replace(/"/g, '').replace(/'/g, '').slice(0, 100);
        params += '&filterByFormula=SEARCH("' + safe + '",CONCATENATE(Item,Equipo,Marca,Serie))';
      }

      var gr = await airtableReq('GET', baseUrl + '?' + params);
      return json(200, {
        ok: true, data: gr.data.records || [],
        count: (gr.data.records || []).length,
        offset: gr.data.offset || null
      });
    }

    var body = {};
    try { body = JSON.parse(event.body || '{}'); } catch(e) { body = {}; }

    // ── POST ─────────────────────────────────────────────────────────────────
    if (event.httpMethod === 'POST') {
      var result = await postWithRetry(baseUrl, body.fields || {});
      if (result.ok) {
        var res = { ok: true, success: true, record: result.record };
        if (result.removedFields && result.removedFields.length > 0) {
          res.warning = {
            removedUnknownFields: result.removedFields,
            message: 'Guardado correctamente. Campos ignorados (no existen en Airtable): ' + result.removedFields.join(', ')
          };
        }
        return json(200, res);
      }
      return json(result.status || 422, {
        ok: false,
        error: result.error || 'Error desconocido',
        hint:  result.hint  || '',
        details: result.details || null,
        removedFields: result.removedFields || []
      });
    }

    // ── PUT ──────────────────────────────────────────────────────────────────
    if (event.httpMethod === 'PUT') {
      if (!body.id) return json(400, { ok: false, error: 'Falta el ID del registro' });
      var putMapped = mapFields(body.fields || {});
      var putUrl    = baseUrl + '/' + encodeURIComponent(body.id);
      try {
        var pr = await airtableReq('PATCH', putUrl, { fields: putMapped });
        return json(200, { ok: true, record: pr.data });
      } catch (pe) {
        var ps  = (pe.response && pe.response.status) ? pe.response.status : 500;
        var pd  = (pe.response && pe.response.data)   ? pe.response.data   : {};
        if (ps === 422) {
          var pp = parseAirtableError(pd);
          if (pp.type === 'UNKNOWN_FIELD' && pp.fieldName) {
            delete putMapped[pp.fieldName];
            try {
              var pr2 = await airtableReq('PATCH', putUrl, { fields: putMapped });
              return json(200, { ok: true, record: pr2.data, warning: { removedUnknownFields: [pp.fieldName] } });
            } catch (pe2) {
              var ps2 = (pe2.response && pe2.response.status) ? pe2.response.status : 500;
              var pd2 = (pe2.response && pe2.response.data)   ? pe2.response.data   : {};
              return json(ps2, { ok: false, error: String(pd2.error || 'Error actualizando') });
            }
          }
        }
        return json(ps, { ok: false, error: String(pd.error || 'Error actualizando'), details: pd });
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
        return json(ds, { ok: false, error: String(dd.error || 'Error eliminando') });
      }
    }

    return json(405, { ok: false, error: 'Método no permitido' });

  } catch (err) {
    var es = (err.response && err.response.status) ? err.response.status : (err.status || 500);
    var ed = (err.response && err.response.data)   ? err.response.data   : {};
    console.error('[inventario] Error global:', err.message);
    return json(es, { ok: false, error: err.message || 'Error interno del servidor', details: ed });
  }
};
