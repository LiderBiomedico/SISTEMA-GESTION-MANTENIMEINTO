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
const SINGLE_SELECT_MAP = {
  'Calibrable': {
    'SI': 'SI', 'si': 'SI', 'yes': 'SI', 'true': 'SI',
    'NO': 'NO', 'no': 'NO', 'false': 'NO',
  },
  'Servicio': {
    'Cirugia Adulto':           'Cirugia Adulto',
    'Cirugía Adulto':           'Cirugia Adulto',
    'Consulta Externa':         'Consulta Externa',
    'Urgencias Adulto':         'Urgencias Adulto',
    'Urgencias Pediatria':      'Urgencias Pediatria',
    'Urgencias Pediatría':      'Urgencias Pediatria',
    'Laboratorio Clinico':      'Laboratorio Clinico',
    'Laboratorio Clínico':      'Laboratorio Clinico',
    'Imagenes Diagnosticas':    'Imagenes Diagnosticas',
    'Imágenes Diagnósticas':    'Imagenes Diagnosticas',
    'Uci Adultos':              'Uci Adultos',
    'UCI Adultos':              'Uci Adultos',
    'Hospitalizacion Pediatria': 'Hospitalizacion Pediatria',
    'Hospitalización Pediatria': 'Hospitalizacion Pediatria',
    'Hospitalización Pediatría': 'Hospitalizacion Pediatria',
  },
  'Clasificacion Biomedica': {
    'Diagnostico':               'Diagnostico',
    'Diagnóstico':               'Diagnostico',
    'Terapeuticos/Tratamiento':  'Terapeuticos/Tratamiento',
    'Terapéuticos/Tratamiento':  'Terapeuticos/Tratamiento',
    'Soporte Vital':             'Soporte Vital',
    'Laboratorio/Analisis':      'Laboratorio/Analisis',
    'Laboratorio/Análisis':      'Laboratorio/Analisis',
    'NO APLICA':                 'NO APLICA',
    'No Aplica':                 'NO APLICA',
  },
  'Clasificacion de la Tecnologia': {
    'Equipo Biomedico':   'Equipo Biomedico',
    'Equipo Biomédico':   'Equipo Biomedico',
    'Equipo Industrial':  'Equipo Industrial',
    'Equipo de apoyo':    'Equipo de apoyo',
    'Equipo Electrico':   'Equipo Electrico',
    'Equipo Eléctrico':   'Equipo Electrico',
  },
  'Clasificacion del Riesgo': {
    'Clase I (Riesgo Bajo)':         'Clase I (Riesgo Bajo)',
    'Clase IIa (Riesgo Moderado)':   'Clase IIa (Riesgo Moderado)',
    'Clase IIb (Riesgo Alto)':       'Clase IIb (Riesgo Alto)',
    'Clase III (Riesgo muy alto)':   'Clase III (Riesgo muy alto)',
    'Clase III (Riesgo Muy Alto)':   'Clase III (Riesgo muy alto)',
  },
  'Tipo de Adquisicion': {
    'Compra':         'Compra',
    'Donacion':       'Donacion',
    'Donación':       'Donacion',
    'Comodato':       'Comodato',
    'Arrendamiento':  'Arrendamiento',
    'Leasing':        'Leasing',
  },
  'Tipo de MTTO': {
    'Preventivo':  'Preventivo',
    'Correctivo':  'Correctivo',
    'Predictivo':  'Predictivo',
    'Mixto':       'Mixto',
  },
  'Frecuencia de MTTO Preventivo': {
    'Mensual': 'Mensual', 'Bimestral': 'Bimestral', 'Trimestral': 'Trimestral',
    'Cuatrimestral': 'Cuatrimestral', 'Semestral': 'Semestral', 'Anual': 'Anual',
  },
  'Frecuencia de Mantenimiento': {
    'Mensual': 'Mensual', 'Bimestral': 'Bimestral', 'Trimestral': 'Trimestral',
    'Cuatrimestral': 'Cuatrimestral', 'Semestral': 'Semestral', 'Anual': 'Anual',
  },
};


function cleanSelectValue(value) {
  if (value === null || value === undefined) return '';
  // Convert to string safely
  var s = String(value);
  // Replace non‑breaking spaces and trim
  s = s.replace(/\u00A0/g, ' ').trim();

  // Unescape common JSON-escaped quotes (e.g. \"text\" or \'text\')
  // Do it a few times in case of double-stringify
  for (var i = 0; i < 3; i++) {
    s = s.replace(/\\\"/g, '"').replace(/\\\'/g, "'").trim();
  }

  // Remove wrapping quotes repeatedly: ""text"", "text", 'text'
  for (var j = 0; j < 5; j++) {
    var t = s.trim();
    if ((t.startsWith('""') && t.endsWith('""') && t.length >= 4)) {
      s = t.slice(2, -2).trim();
      continue;
    }
    if ((t.startsWith("''") && t.endsWith("''") && t.length >= 4)) {
      s = t.slice(2, -2).trim();
      continue;
    }
    if ((t.startsWith('"') && t.endsWith('"') && t.length >= 2)) {
      s = t.slice(1, -1).trim();
      continue;
    }
    if ((t.startsWith("'") && t.endsWith("'") && t.length >= 2)) {
      s = t.slice(1, -1).trim();
      continue;
    }
    break;
  }

  // If still has doubled quotes inside like ""Consulta Externa"" -> remove them
  s = s.replace(/(^"+|"+$)/g, '').trim();
  return s;
}

function toSingleSelect(fieldName, value) {
  if (value === null || value === undefined) return null;
  var s = cleanSelectValue(value);
  // Debug: detect quoted select values
  if (fieldName === 'Servicio' && (String(value).includes('"') || String(value).includes('\"'))) {
    console.log('[inventario] Servicio raw=', String(value), ' cleaned=', s);
  }
  if (!s) return null;
  var map = SINGLE_SELECT_MAP[fieldName];
  if (!map) return s;
  if (map[s] !== undefined) return map[s];
  var lower = s.toLowerCase();
  var keys = Object.keys(map);
  for (var i = 0; i < keys.length; i++) {
    if (keys[i].toLowerCase() === lower) return map[keys[i]];
  }
  console.warn('[inventario] valor no reconocido para "' + fieldName + '": "' + s + '" - campo omitido');
  return null;
}

async function uploadAttachment({ recordId, field, filename, contentType, fileBase64 }) {
  if (!AIRTABLE_API_KEY || !AIRTABLE_BASE_ID) {
    throw { status: 500, data: { error: 'Missing AIRTABLE_API_KEY/TOKEN or AIRTABLE_BASE_ID' } };
  }
  if (!recordId) throw { status: 400, data: { error: 'Missing recordId for uploadAttachment' } };
  if (!fileBase64) throw { status: 400, data: { error: 'Missing fileBase64 for uploadAttachment' } };

  const url = `${AIRTABLE_CONTENT_API}/${AIRTABLE_BASE_ID}/${encodeURIComponent(recordId)}/${encodeURIComponent(field)}/uploadAttachment`;
  const headers = {
    Authorization: `Bearer ${AIRTABLE_API_KEY}`,
    'Content-Type': 'application/json'
  };
  const data = { filename, contentType: contentType || 'application/pdf', file: fileBase64 };
  return axios.post(url, data, { headers });
}

const NUMBER_FIELDS = new Set(['Valor en Pesos', 'Costo de Mantenimiento', 'Vida Util']);
const BOOL_FIELDS   = new Set([]); // Calibrable es Single Select, NO checkbox
const DATE_FIELDS   = new Set([
  'Fecha de Compra', 'Fecha de Instalacion', 'Inicio de Garantia',
  'Termino de Garantia', 'Fecha Programada de Mantenimiento',
  'Fecha Fabrica', 'Fecha de Recepcion'
]);

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
  const cleaned = s.replace(/[^\d.,-]/g, '');
  if (!cleaned) return v;
  let norm = cleaned;
  const hasDot = cleaned.includes('.');
  const hasComma = cleaned.includes(',');
  if (hasDot && hasComma) {
    const lastDot = cleaned.lastIndexOf('.');
    const lastComma = cleaned.lastIndexOf(',');
    norm = lastComma > lastDot
      ? cleaned.replace(/\./g,'').replace(',', '.')
      : cleaned.replace(/,/g,'');
  } else if (hasComma && !hasDot) {
    const parts = cleaned.split(',');
    norm = parts.length > 2 ? parts.join('') : parts[0] + '.' + parts[1];
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
