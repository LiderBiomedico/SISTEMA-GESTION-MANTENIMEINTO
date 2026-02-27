// =============================================================================
// netlify/functions/inventario.js - VERSIÓN COMPLETA CON CRUD
// Soporta: GET (list), POST (create), PUT (update), DELETE (delete)
// FIX: Campos Single Select normalizados al valor exacto de Airtable
// =============================================================================
const axios = require('axios');

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY || process.env.AIRTABLE_TOKEN || '';
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID || '';
const TABLE_NAME = process.env.AIRTABLE_INVENTARIO_TABLE || 'Inventario';
const AIRTABLE_CAL_CERT_FIELD = process.env.AIRTABLE_CAL_CERT_FIELD || 'Certificados de Calibracion';
const AIRTABLE_API = 'https://api.airtable.com/v0';
const AIRTABLE_CONTENT_API = 'https://content.airtable.com/v0';

function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
    },
    body: JSON.stringify(body),
  };
}

const FIELD_MAP = {
  'ITEM': 'Item',
  'EQUIPO': 'Equipo',
  'MARCA': 'Marca',
  'MODELO': 'Modelo',
  'SERIE': 'Serie',
  'PLACA': 'Numero de Placa',
  'NÚMERO DE PLACA': 'Numero de Placa',
  'NUMERO DE PLACA': 'Numero de Placa',
  'CODIGO ECRI': 'Codigo ECRI',
  'REGISTRO INVIMA': 'Registro INVIMA',
  'TIPO DE ADQUISICION': 'Tipo de Adquisicion',
  'NO. DE CONTRATO': 'No. de Contrato',
  'SERVICIO': 'Servicio',
  'UBICACIÓN': 'Ubicacion',
  'UBICACION': 'Ubicacion',
  'VIDA UTIL': 'Vida Util',
  'VIDA ÚTIL': 'Vida Util',
  'FECHA FABRICA': 'Fecha Fabrica',
  'FECHA DE COMRPA': 'Fecha de Compra',
  'FECHA DE COMPRA': 'Fecha de Compra',
  'VALOR EN PESOS': 'Valor en Pesos',
  'FECHA DE RECEPCIÓN': 'Fecha de Recepcion',
  'FECHA DE RECEPCION': 'Fecha de Recepcion',
  'FECHA DE INSTALACIÓN': 'Fecha de Instalacion',
  'FECHA DE INSTALACION': 'Fecha de Instalacion',
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
  'Item': 'Item',
  'Equipo': 'Equipo',
  'Marca': 'Marca',
  'Modelo': 'Modelo',
  'Serie': 'Serie',
  'Numero de Placa': 'Numero de Placa',
  'Codigo ECRI': 'Codigo ECRI',
  'Registro INVIMA': 'Registro INVIMA',
  'Tipo de Adquisicion': 'Tipo de Adquisicion',
  'No. de Contrato': 'No. de Contrato',
  'Servicio': 'Servicio',
  'Ubicacion': 'Ubicacion',
  'Ubicación': 'Ubicacion',
  'Vida Util': 'Vida Util',
  'Fecha de Compra': 'Fecha de Compra',
  'Valor en Pesos': 'Valor en Pesos',
  'Fecha de Instalacion': 'Fecha de Instalacion',
  'Fecha de Instalación': 'Fecha de Instalacion',
  'Inicio de Garantia': 'Inicio de Garantia',
  'Termino de Garantia': 'Termino de Garantia',
  'Clasificacion Biomedica': 'Clasificacion Biomedica',
  'Clasificacion de la Tecnologia': 'Clasificacion de la Tecnologia',
  'Clasificacion del Riesgo': 'Clasificacion del Riesgo',
  'Manual': 'Manual',
  'Tipo de MTTO': 'Tipo de MTTO',
  'Costo de Mantenimiento': 'Costo de Mantenimiento',
  'Calibrable': 'Calibrable',
  'N. Certificado': 'N. Certificado',
  'Frecuencia de MTTO Preventivo': 'Frecuencia de MTTO Preventivo',
  'Frecuencia de Mantenimiento': 'Frecuencia de Mantenimiento',
  'Fecha Programada de Mantenimiento': 'Fecha Programada de Mantenimiento',
  'Programacion de Mantenimiento Anual': 'Programacion de Mantenimiento Anual',
  'Responsable': 'Responsable',
  'Nombre': 'Nombre',
  'Direccion': 'Direccion',
  'Telefono': 'Telefono',
  'Ciudad': 'Ciudad',
};

// =============================================================================
// SINGLE SELECT: valores exactos configurados en Airtable
// Si el valor no coincide -> se omite el campo (no se envía) para evitar 422
// =============================================================================
// =============================================================================
// SINGLE SELECT: opciones permitidas (exactas) configuradas en Airtable
// Objetivo: NUNCA intentar crear nuevas opciones (evita 422 por permisos).
// - Si el valor NO coincide con una opción existente, el campo se omite.
// - Comparación tolerante: ignora mayúsculas, acentos, espacios múltiples y NBSP.
// =============================================================================
function _stripAccents(str) {
  return String(str || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}
function _normKey(str) {
  return _stripAccents(str)
    .replace(/[ \s]+/g, ' ')
    .trim()
    .toLowerCase();
}
function _cleanValue(v) {
  if (v === null || v === undefined) return '';
  let s = String(v);
  // quita comillas envolventes (por si el <option value="\"x\"">)
  s = s.replace(/^[\s'"“”‘’]+/, '').replace(/[\s'"“”‘’]+$/, '');
  s = s.replace(/[ \s]+/g, ' ').trim();
  return s;
}

const RAW_SINGLE_SELECT_OPTIONS = {
  'Calibrable': ['SI','NO'],
  'Servicio': [
    'Cirugia Adulto',
    'Consulta Externa',
    'Urgencias Adulto',
    'Urgencias Pediatria',
    'Laboratorio Clinico',
    'Imagenes Diagnosticas',
    'Uci Adultos',
    'Hospitalizacion Pediatria',
  ],
  'Clasificacion Biomedica': [
    'Diagnostico',
    'Terapeuticos/Tratamiento',
    'Soporte Vital',
    'Laboratorio/Analisis',
    'NO APLICA',
  ],
  'Clasificacion de la Tecnologia': [
    'Equipo Biomedico',
    'Equipo Industrial',
    'Equipo de apoyo',
    'Equipo Electrico',
  ],
  'Clasificacion del Riesgo': [
    'Clase I (Riesgo Bajo)',
    'Clase IIa (Riesgo Moderado)',
    'Clase IIb (Riesgo Alto)',
    'Clase III (Riesgo muy alto)',
  ],
  'Tipo de Adquisicion': [
    'Compra','Donacion','Comodato','Arrendamiento','Leasing'
  ],
  'Tipo de MTTO': [
    'Preventivo','Correctivo','Predictivo','Mixto'
  ],
  'Frecuencia de MTTO Preventivo': [
    'Mensual','Bimestral','Trimestral','Semestral','Anual','No aplica'
  ],
};

// índice normalizado: fieldNameNorm -> { valueNorm: valueExact }
const SINGLE_SELECT_INDEX = Object.create(null);
Object.keys(RAW_SINGLE_SELECT_OPTIONS).forEach((fname) => {
  const fNorm = _normKey(fname);
  SINGLE_SELECT_INDEX[fNorm] = Object.create(null);
  RAW_SINGLE_SELECT_OPTIONS[fname].forEach((opt) => {
    SINGLE_SELECT_INDEX[fNorm][_normKey(opt)] = opt;
  });
});

function toSingleSelect(fieldName, value) {
  const s = _cleanValue(value);
  if (!s) return null;

  const fNorm = _normKey(fieldName);
  const idx = SINGLE_SELECT_INDEX[fNorm];
  if (!idx) return s; // no controlado: se envía tal cual

  const vNorm = _normKey(s);
  const match = idx[vNorm];
  if (match) return match;

  // No coincide con ninguna opción permitida -> omitir para evitar 422
  return null;
}

function normalizeValue(fieldName, value) {
  if (value === null || typeof value === 'undefined') return value;
  if (NUMBER_FIELDS.has(fieldName)) return toNumber(value);
  if (BOOL_FIELDS.has(fieldName))   return toBoolean(value);
  // Single Select: normalizar o devolver null (se omitirá)
  if (SINGLE_SELECT_MAP[fieldName] !== undefined) return toSingleSelect(fieldName, value);
  if (DATE_FIELDS.has(fieldName)) {
    if (value instanceof Date) return value.toISOString().slice(0,10);
    if (looksLikeISODate(value)) return String(value).trim().slice(0,10);
    return value;
  }
  return value;
}

function mapAndNormalizeFields(inputFields) {
  const out = {};
  for (const [k, v] of Object.entries(inputFields || {})) {
    const key    = String(k || '').trim();
    const mapped = FIELD_MAP[key] || key;

    if (mapped === 'Manual' && isUrl(v)) {
      out[mapped] = [{ url: String(v).trim() }];
      continue;
    }

    const normalized = normalizeValue(mapped, v);
    // null = valor no reconocido para Single Select -> NO enviar (evita 422)
    if (normalized !== null && normalized !== undefined) {
      out[mapped] = normalized;
    }
  }
  console.log('[inventario] Mapped fields:', JSON.stringify(out));
  return out;
}

function removeUnknownFields(fields, errData) {
  const errObj = errData && errData.error ? errData.error : errData || {};
  const msg = typeof errObj === 'string'
    ? errObj
    : (errObj.message || (errData && errData.message) || JSON.stringify(errData || {}));

  const matches = String(msg).match(/"([^"]+)"/g) || [];
  const unknown = new Set(matches.map(function(m){ return m.replace(/"/g,'').trim(); }).filter(Boolean));

  const plainMatch = String(msg).match(/Unknown field name:\s*(\S+)/gi) || [];
  plainMatch.forEach(function(m) {
    const name = m.replace(/Unknown field name:\s*/i, '').replace(/"/g,'').trim();
    if (name) unknown.add(name);
  });

  if (unknown.size === 0) return { cleaned: fields, removed: [] };

  const cleaned = Object.assign({}, fields);
  const removed = [];
  unknown.forEach(function(u) {
    if (u in cleaned) { delete cleaned[u]; removed.push(u); }
  });
  return { cleaned: cleaned, removed: removed };
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

    const qs    = event.queryStringParameters || {};
    const debug = !!qs.debug;

    if (debug && event.httpMethod === 'GET') {
      return json(200, { ok: true, table: TABLE_NAME, hasApiKey: !!AIRTABLE_API_KEY, hasBaseId: !!AIRTABLE_BASE_ID });
    }

    const baseUrl = `${AIRTABLE_API}/${AIRTABLE_BASE_ID}/${encodeURIComponent(TABLE_NAME)}`;

    // GET
    if (event.httpMethod === 'GET') {
      if (qs.nextItem && String(qs.nextItem) === '1') {
        const params = new URLSearchParams();
        params.set('pageSize', '1');
        params.set('sort[0][field]', 'Item');
        params.set('sort[0][direction]', 'desc');
        const resp = await airtableRequest('GET', `${baseUrl}?${params.toString()}`);
        const rec = (resp.data.records || [])[0];
        const last = rec && rec.fields ? (rec.fields['Item'] || rec.fields['ITEM'] || null) : null;
        const lastNum = Number(last || 0);
        const nextNum = Number.isFinite(lastNum) ? (lastNum + 1) : 1;
        const nextDisplay = String(nextNum).padStart(5, '0');
        return json(200, { ok: true, nextItem: nextNum, nextItemDisplay: nextDisplay });
      }

      const pageSize = Math.min(parseInt(qs.pageSize || '50', 10) || 50, 100);
      let offset = qs.offset ? String(qs.offset) : null;
      if (offset && (offset === 'true' || offset === 'false' || offset === '0')) offset = null;

      const params = new URLSearchParams();
      params.set('pageSize', String(pageSize));
      if (offset) params.set('offset', offset);

      const resp = await airtableRequest('GET', `${baseUrl}?${params.toString()}`);
      const records = resp.data.records || [];
      return json(200, { ok: true, data: records, count: records.length, offset: resp.data.offset || null });
    }

    let body = {};
    try { body = JSON.parse(event.body || '{}'); } catch (e) { body = {}; }

    // POST
    if (event.httpMethod === 'POST') {
      let mapped = mapAndNormalizeFields(body.fields || {});
      if ('Item' in mapped) delete mapped['Item'];

      const certificates = Array.isArray(body.certificates) ? body.certificates : [];
      let allRemoved = [];
      let lastError  = null;

      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const resp   = await airtableRequest('POST', baseUrl, { fields: mapped });
          const record = resp.data;
          const result = { ok: true, success: true, record };

          if (certificates.length > 0 && record && record.id) {
            const warnings = [];
            for (const c of certificates) {
              try {
                const year       = String(c.year || '').trim();
                const safeName   = String(c.filename || 'certificado.pdf').replace(/[^a-zA-Z0-9._-]/g, '_');
                const finalName  = year ? `Calibracion_${year}_${safeName}` : `Calibracion_${safeName}`;
                await uploadAttachment({ recordId: record.id, field: AIRTABLE_CAL_CERT_FIELD, filename: finalName, contentType: c.contentType || 'application/pdf', fileBase64: c.fileBase64 });
              } catch (upErr) {
                const d = (upErr.response && upErr.response.data) || upErr.data || { error: upErr.message || 'upload error' };
                warnings.push({ type: 'CERT_UPLOAD_FAILED', details: d });
              }
            }
            if (warnings.length > 0) result.warning = { certificateUploads: warnings };
          }

          if (allRemoved.length > 0) result.warning = Object.assign(result.warning || {}, { removedUnknownFields: allRemoved });
          return json(200, result);
        } catch (e) {
          const status = (e.response && e.response.status) || 500;
          const data   = (e.response && e.response.data)   || { error: 'Airtable error' };
          lastError = { status, data };
          console.log('[inventario] POST attempt ' + (attempt+1) + ' failed:', JSON.stringify(data));
          if (status !== 422) break;
          const r = removeUnknownFields(mapped, data);
          if (r.removed.length === 0) break;
          allRemoved = allRemoved.concat(r.removed);
          mapped = r.cleaned;
          if (Object.keys(mapped).length === 0) break;
        }
      }

      return json(lastError ? lastError.status : 422, {
        ok: false,
        error: (lastError && lastError.data && lastError.data.error) ? lastError.data.error : 'Airtable error',
        details: lastError ? lastError.data : null,
        removedFields: allRemoved,
        mappedSent: mapped
      });
    }

    // PUT
    if (event.httpMethod === 'PUT') {
      const id = body.id;
      if (!id) return json(400, { ok: false, error: 'Missing record id' });

      const certificates = Array.isArray(body.certificates) ? body.certificates : [];
      const mapped       = mapAndNormalizeFields(body.fields || {});
      if ('Item' in mapped) delete mapped['Item'];

      const url = `${baseUrl}/${encodeURIComponent(id)}`;

      try {
        const resp = await airtableRequest('PATCH', url, { fields: mapped });
        const out  = { ok: true, record: resp.data };

        if (certificates.length > 0) {
          const warnings = [];
          for (const c of certificates) {
            try {
              const year      = String(c.year || '').trim();
              const safeName  = String(c.filename || 'certificado.pdf').replace(/[^a-zA-Z0-9._-]/g, '_');
              const finalName = year ? `Calibracion_${year}_${safeName}` : `Calibracion_${safeName}`;
              await uploadAttachment({ recordId: id, field: AIRTABLE_CAL_CERT_FIELD, filename: finalName, contentType: c.contentType || 'application/pdf', fileBase64: c.fileBase64 });
            } catch (upErr) {
              const d = (upErr.response && upErr.response.data) || upErr.data || { error: upErr.message || 'upload error' };
              warnings.push({ type: 'CERT_UPLOAD_FAILED', details: d });
            }
          }
          if (warnings.length > 0) out.warning = { certificateUploads: warnings };
        }

        return json(200, out);
      } catch (e) {
        const status = (e.response && e.response.status) || 500;
        const data   = (e.response && e.response.data)   || { error: 'Airtable error' };

        if (status === 422) {
          const r = removeUnknownFields(mapped, data);
          if (r.removed.length > 0) {
            try {
              const resp2 = await airtableRequest('PATCH', url, { fields: r.cleaned });
              return json(200, { ok: true, record: resp2.data, warning: { removedUnknownFields: r.removed } });
            } catch (e2) {
              const s2 = (e2.response && e2.response.status) || 500;
              const d2 = (e2.response && e2.response.data)   || { error: 'Airtable error after retry' };
              return json(s2, { ok: false, error: d2.error || 'Airtable error', details: d2 });
            }
          }
        }
        return json(status, { ok: false, error: data.error || 'Airtable error', details: data });
      }
    }

    // DELETE
    if (event.httpMethod === 'DELETE') {
      const pathParts = event.path.split('/');
      const id        = pathParts[pathParts.length - 1];
      if (!id || id === 'inventario') return json(400, { ok: false, error: 'Missing record id in path' });

      const url = `${baseUrl}/${encodeURIComponent(id)}`;
      try {
        await airtableRequest('DELETE', url);
        return json(200, { ok: true, deleted: true, id });
      } catch (e) {
        const status = (e.response && e.response.status) || 500;
        const data   = (e.response && e.response.data)   || { error: 'Airtable error' };
        return json(status, { ok: false, error: data.error || 'Error deleting record', details: data });
      }
    }

    return json(405, { ok: false, error: 'Method not allowed' });

  } catch (err) {
    const status = err.status || (err.response && err.response.status) || 500;
    const data   = err.data   || (err.response && err.response.data)   || { error: err.message || 'Server error' };
    return json(status, { ok: false, error: data.error || 'Server error', details: data });
  }
};
