// =============================================================================
// netlify/functions/inventario.js - VERSIÓN COMPLETA CON CRUD
// Soporta: GET (list), POST (create), PUT (update), DELETE (delete)
// Gestiona errores 422 de Airtable removiendo campos desconocidos (sin filtrar por muestreo de registros)
// =============================================================================
const axios = require('axios');

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY || process.env.AIRTABLE_TOKEN || '';
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID || '';
const TABLE_NAME = process.env.AIRTABLE_INVENTARIO_TABLE || 'Inventario';
// Campo (Attachment) donde se guardarán los PDFs de certificados
// Puede ser nombre o fieldId (recomendado). Si no se define, usa el nombre por defecto.
const AIRTABLE_CAL_CERT_FIELD = process.env.AIRTABLE_CAL_CERT_FIELD || 'Certificados de Calibracion';
const AIRTABLE_API = 'https://api.airtable.com/v0';
const AIRTABLE_CONTENT_API = 'https://content.airtable.com/v0';
const AIRTABLE_META_API = 'https://api.airtable.com/v0/meta';


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

// ============================================================================
// OPCIONES PARA CAMPOS SELECT (Servicio / Clasificaciones / Riesgo)
// - Primero intenta leer schema (Meta API)
// - Si falla (permisos), infiere de los registros existentes
// - Si aún queda vacío, usa fallback con opciones conocidas (según configuración mostrada)
// ============================================================================

const SELECT_FIELDS = [
  'Servicio',
  'Clasificacion Biomedica',
  'Clasificacion de la Tecnologia',
  'Clasificacion del Riesgo'
];

const FALLBACK_SELECT_OPTIONS = {
  'Servicio': [
    'Cirugia Adulto',
    'Consulta Externa',
    'Urgencias Adulto',
    'Urgencias Pediatria',
    'Laboratorio Clinico',
    'Imagenes Diagnosticas',
    'Uci Adultos'
  ],
  'Clasificacion Biomedica': [
    'Diagnostico',
    'Terapéuticos/Tratamiento',
    'Soporte Vital',
    'Laboratorio/Análisis',
    'NO APLICA'
  ],
  'Clasificacion de la Tecnologia': [
    'Equipo Biomedico',
    'Equipo Industrial',
    'Equipo de apoyo',
    'Equipo Electrico'
  ],
  'Clasificacion del Riesgo': [
    'Clase I (Riesgo Bajo)',
    'Clase IIa (Riesgo Moderado)',
    'Clase IIb (Riesgo Alto)',
    'Clase III (Riesgo muy alto)'
  ]
};

function uniqClean(arr) {
  const out = [];
  const seen = new Set();
  (arr || []).forEach(v => {
    const s = String(v || '').trim();
    if (!s) return;
    const key = s.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push(s);
  });
  return out;
}

async function readOptionsFromMeta() {
  if (!AIRTABLE_API_KEY || !AIRTABLE_BASE_ID) return null;
  const url = `${AIRTABLE_META_API}/bases/${AIRTABLE_BASE_ID}/tables`;
  const headers = { Authorization: `Bearer ${AIRTABLE_API_KEY}` };
  const resp = await axios.get(url, { headers });
  const tables = resp.data && resp.data.tables ? resp.data.tables : [];
  const table = tables.find(t => (t && t.name) === TABLE_NAME) || tables[0];
  if (!table || !Array.isArray(table.fields)) return null;

  const options = {};
  for (const fname of SELECT_FIELDS) {
    const f = table.fields.find(x => x && x.name === fname);
    const choices = f && f.options && Array.isArray(f.options.choices) ? f.options.choices : null;
    if (choices) {
      options[fname] = uniqClean(choices.map(c => c && (c.name || c.label || c.value)).filter(Boolean));
    }
  }
  return options;
}

async function inferOptionsFromRecords(baseUrl) {
  const params = new URLSearchParams();
  params.set('pageSize', '100');
  // pedir solo los campos relevantes
  SELECT_FIELDS.forEach(f => params.append('fields[]', f));
  const url = `${baseUrl}?${params.toString()}`;
  const resp = await airtableRequest('GET', url);
  const records = resp.data && Array.isArray(resp.data.records) ? resp.data.records : [];

  const options = {};
  for (const f of SELECT_FIELDS) options[f] = [];
  records.forEach(r => {
    const fields = (r && r.fields) || {};
    for (const f of SELECT_FIELDS) {
      const v = fields[f];
      if (Array.isArray(v)) v.forEach(x => options[f].push(x));
      else options[f].push(v);
    }
  });
  for (const f of SELECT_FIELDS) options[f] = uniqClean(options[f]);
  return options;
}

// Mapeo de campos del formulario a columnas de Airtable
// Soporta: Title Case (del equipoModal), UPPERCASE (del newInventario form), y variantes con tildes
const FIELD_MAP = {
  // --- UPPERCASE (formulario principal newInventario) ---
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
  // Certificados de calibración se manejan como adjuntos vía Upload Attachment API
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
  // --- Title Case (formulario equipoModal / inventario-module.js) ---
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
  const data = {
    filename,
    contentType: contentType || 'application/pdf',
    file: fileBase64
  };
  return axios.post(url, data, { headers });
}

const NUMBER_FIELDS = new Set([
  'Valor en Pesos',
  'Costo de Mantenimiento',
  'Vida Util'
]);

const BOOL_FIELDS = new Set(['Calibrable']);

const DATE_FIELDS = new Set([
  'Fecha de Compra',
  'Fecha de Instalacion',
  'Inicio de Garantia',
  'Termino de Garantia',
  'Fecha Programada de Mantenimiento',
  'Fecha Fabrica',
  'Fecha de Recepcion'
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
    if (lastComma > lastDot) {
      norm = cleaned.replace(/\./g,'').replace(',', '.');
    } else {
      norm = cleaned.replace(/,/g,'');
    }
  } else if (hasComma && !hasDot) {
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

function normalizeValue(fieldName, value) {
  if (value === null || typeof value === 'undefined') return value;
  
  if (NUMBER_FIELDS.has(fieldName)) return toNumber(value);
  if (BOOL_FIELDS.has(fieldName)) return toBoolean(value);
  
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
    const key = String(k || '').trim();
    const mapped = FIELD_MAP[key] || key;

    // Omitir vacíos (Airtable suele responder 422 si se envían "" a Number/Select/Date)
    if (v === '' || v === null || typeof v === 'undefined') continue;
    if (typeof v === 'string' && v.trim() === '') continue;
    
    // Campo Manual como attachment si es URL
    if (mapped === 'Manual' && isUrl(v)) {
      out[mapped] = [{ url: String(v).trim() }];
      continue;
    }
    
    out[mapped] = normalizeValue(mapped, v);
  }
  console.log('[inventario] Mapped fields:', JSON.stringify(out));
  return out;
}

// Para campos Select: intenta hacer match exacto con opciones conocidas (case-insensitive)
async function normalizeSelectFields(mappedFields, baseUrl) {
  const out = { ...mappedFields };
  // Obtener opciones (meta -> records -> fallback)
  let options = null;
  try { options = await readOptionsFromMeta(); } catch (e) { options = null; }
  if (!options || Object.keys(options).length === 0) {
    try { options = await inferOptionsFromRecords(baseUrl); } catch (e) { options = null; }
  }
  const merged = {};
  for (const f of SELECT_FIELDS) {
    const fromApi = options && Array.isArray(options[f]) ? options[f] : [];
    const fb = FALLBACK_SELECT_OPTIONS[f] || [];
    merged[f] = uniqClean([ ...fromApi, ...fb ]);
  }

  for (const f of SELECT_FIELDS) {
    if (!(f in out)) continue;
    const val = out[f];
    if (val === null || typeof val === 'undefined') continue;
    const s = String(val).trim();
    if (!s) { delete out[f]; continue; }
    // Si ya existe exacto, ok
    if (merged[f].includes(s)) { out[f] = s; continue; }
    // Buscar match case-insensitive
    const hit = merged[f].find(opt => String(opt).trim().toLowerCase() === s.toLowerCase());
    if (hit) { out[f] = hit; continue; }
    // Si no hay match, no lo enviamos para evitar INVALID_MULTIPLE_CHOICE_OPTIONS
    delete out[f];
  }
  return out;
}

function removeUnknownFields(fields, errData) {
  // Airtable devuelve errores como: { error: { type: 'UNKNOWN_FIELD_NAME', message: 'Unknown field name: "Xyz"' } }
  // o { error: 'UNKNOWN_FIELD_NAME', message: 'Unknown field name: "Xyz"' }
  const errObj = errData?.error || errData || {};
  const msg = typeof errObj === 'string' 
    ? errObj 
    : (errObj.message || errData?.message || JSON.stringify(errData || {}));
  
  // Buscar nombres entre comillas
  const matches = String(msg).match(/"([^"]+)"/g) || [];
  const unknown = new Set(matches.map(m => m.replace(/"/g,'').trim()).filter(Boolean));
  
  // También buscar después de "Unknown field name:" sin comillas
  const plainMatch = String(msg).match(/Unknown field name:\s*(\S+)/gi) || [];
  plainMatch.forEach(m => {
    const name = m.replace(/Unknown field name:\s*/i, '').replace(/"/g,'').trim();
    if (name) unknown.add(name);
  });
  
  if (unknown.size === 0) return { cleaned: fields, removed: [] };
  
  const cleaned = { ...fields };
  const removed = [];
  for (const u of unknown) {
    if (u in cleaned) { 
      delete cleaned[u]; 
      removed.push(u); 
    }
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
    // CORS preflight
    if (event.httpMethod === 'OPTIONS') {
      return json(204, { ok: true });
    }

    const qs = event.queryStringParameters || {};
    const debug = !!qs.debug;

    // Debug mode
    if (debug && event.httpMethod === 'GET') {
      return json(200, { 
        ok: true, 
        table: TABLE_NAME, 
        hasApiKey: !!AIRTABLE_API_KEY, 
        hasBaseId: !!AIRTABLE_BASE_ID 
      });
    }

    const baseUrl = `${AIRTABLE_API}/${AIRTABLE_BASE_ID}/${encodeURIComponent(TABLE_NAME)}`;

    // =========================================================================
    // GET - Listar registros
    // =========================================================================
    if (event.httpMethod === 'GET') {
      // Opciones para selects (Servicio / Clasificaciones / Riesgo)
      if (String(qs.options || '') === '1') {
        let options = null;
        // 1) Meta API (si hay permisos)
        try {
          options = await readOptionsFromMeta();
        } catch (e) {
          options = null;
        }
        // 2) Inferir desde registros
        if (!options || Object.keys(options).length === 0) {
          try {
            options = await inferOptionsFromRecords(baseUrl);
          } catch (e) {
            options = null;
          }
        }
        // 3) Fallback fijo
        const merged = {};
        for (const f of SELECT_FIELDS) {
          const fromApi = options && Array.isArray(options[f]) ? options[f] : [];
          const fb = FALLBACK_SELECT_OPTIONS[f] || [];
          merged[f] = uniqClean([ ...fromApi, ...fb ]);
        }
        return json(200, { ok: true, options: merged });
      }

      const pageSize = Math.min(parseInt(qs.pageSize || '50', 10) || 50, 100);
      let offset = qs.offset ? String(qs.offset) : null;

      // Fix: ignorar offsets inválidos
      if (offset && (offset === 'true' || offset === 'false' || offset === '0')) {
        offset = null;
      }

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
        offset: resp.data.offset || null 
      });
    }

    // Parse body para POST/PUT/DELETE
    let body = {};
    try { 
      body = JSON.parse(event.body || '{}'); 
    } catch { 
      body = {}; 
    }

    // =========================================================================
    // POST - Crear registro
    // =========================================================================
    if (event.httpMethod === 'POST') {
      let mapped = mapAndNormalizeFields(body.fields || {});
      // Normalizar selects para que coincidan con las opciones existentes (evita 422 INVALID_MULTIPLE_CHOICE_OPTIONS)
      mapped = await normalizeSelectFields(mapped, baseUrl);
      const certificates = Array.isArray(body.certificates) ? body.certificates : [];
      let allRemoved = [];
      
      // Intentar hasta 3 veces, removiendo campos desconocidos en cada intento
      let lastError = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const resp = await airtableRequest('POST', baseUrl, { fields: mapped });
          const record = resp.data;
          const result = { ok: true, success: true, record };

          // Subir PDFs de certificados (si vienen en payload)
          if (certificates.length > 0 && record && record.id) {
            const warnings = [];
            for (const c of certificates) {
              try {
                const year = String(c.year || '').trim();
                const originalName = String(c.filename || 'certificado.pdf');
                const safeName = originalName.replace(/[^a-zA-Z0-9._-]/g, '_');
                const finalName = year ? `Calibracion_${year}_${safeName}` : `Calibracion_${safeName}`;
                await uploadAttachment({
                  recordId: record.id,
                  field: AIRTABLE_CAL_CERT_FIELD,
                  filename: finalName,
                  contentType: c.contentType || 'application/pdf',
                  fileBase64: c.fileBase64
                });
              } catch (upErr) {
                const d = upErr.response?.data || upErr.data || { error: upErr.message || 'upload error' };
                warnings.push({ type: 'CERT_UPLOAD_FAILED', details: d });
              }
            }
            if (warnings.length > 0) {
              result.warning = { ...(result.warning || {}), certificateUploads: warnings };
            }
          }

          if (allRemoved.length > 0) {
            result.warning = { ...(result.warning || {}), removedUnknownFields: allRemoved };
          }
          return json(200, result);
        } catch (e) {
          const status = e.response?.status || 500;
          const data = e.response?.data || { error: 'Airtable error' };
          lastError = { status, data };
          console.log(`[inventario] POST attempt ${attempt+1} failed:`, JSON.stringify(data));

          if (status !== 422) break;

          const { cleaned, removed } = removeUnknownFields(mapped, data);
          if (removed.length === 0) break;

          allRemoved.push(...removed);
          mapped = cleaned;
          
          if (Object.keys(mapped).length === 0) break;
        }
      }
      
      return json(lastError?.status || 422, { 
        ok: false, 
        error: (typeof lastError?.data?.error === 'object' ? (lastError?.data?.error?.message || lastError?.data?.error?.type) : lastError?.data?.error) || 'Airtable error', 
        details: lastError?.data,
        removedFields: allRemoved,
        mappedSent: mapped 
      });
    }

    // =========================================================================
    // PUT - Actualizar registro
    // =========================================================================
    if (event.httpMethod === 'PUT') {
      const id = body.id;
      if (!id) {
        return json(400, { ok: false, error: 'Missing record id' });
      }

      const certificates = Array.isArray(body.certificates) ? body.certificates : [];
      
      let mapped = mapAndNormalizeFields(body.fields || {});
      mapped = await normalizeSelectFields(mapped, baseUrl);
      const url = `${baseUrl}/${encodeURIComponent(id)}`;
      
      try {
        const resp = await airtableRequest('PATCH', url, { fields: mapped });
        const out = { ok: true, record: resp.data };

        // Subir certificados adicionales si vienen
        if (certificates.length > 0) {
          const warnings = [];
          for (const c of certificates) {
            try {
              const year = String(c.year || '').trim();
              const originalName = String(c.filename || 'certificado.pdf');
              const safeName = originalName.replace(/[^a-zA-Z0-9._-]/g, '_');
              const finalName = year ? `Calibracion_${year}_${safeName}` : `Calibracion_${safeName}`;
              await uploadAttachment({
                recordId: id,
                field: AIRTABLE_CAL_CERT_FIELD,
                filename: finalName,
                contentType: c.contentType || 'application/pdf',
                fileBase64: c.fileBase64
              });
            } catch (upErr) {
              const d = upErr.response?.data || upErr.data || { error: upErr.message || 'upload error' };
              warnings.push({ type: 'CERT_UPLOAD_FAILED', details: d });
            }
          }
          if (warnings.length > 0) out.warning = { ...(out.warning || {}), certificateUploads: warnings };
        }

        return json(200, out);
      } catch (e) {
        const status = e.response?.status || 500;
        const data = e.response?.data || { error: 'Airtable error' };
        
        // Retry on unknown fields
        if (status === 422) {
          const { cleaned, removed } = removeUnknownFields(mapped, data);
          if (removed.length > 0) {
            try {
              const resp2 = await airtableRequest('PATCH', url, { fields: cleaned });
              return json(200, { 
                ok: true, 
                record: resp2.data, 
                warning: { removedUnknownFields: removed } 
              });
            } catch (e2) {
              const status2 = e2.response?.status || 500;
              const data2 = e2.response?.data || { error: 'Airtable error after retry' };
              return json(status2, { 
                ok: false, 
                error: data2.error || 'Airtable error', 
                details: data2 
              });
            }
          }
        }
        
        return json(status, { 
          ok: false, 
          error: data.error || 'Airtable error', 
          details: data 
        });
      }
    }

    // =========================================================================
    // DELETE - Eliminar registro
    // =========================================================================
    if (event.httpMethod === 'DELETE') {
      // El ID viene en el path: /inventario/recXXX
      const pathParts = event.path.split('/');
      const id = pathParts[pathParts.length - 1];
      
      if (!id || id === 'inventario') {
        return json(400, { ok: false, error: 'Missing record id in path' });
      }
      
      const url = `${baseUrl}/${encodeURIComponent(id)}`;
      
      try {
        await airtableRequest('DELETE', url);
        return json(200, { ok: true, deleted: true, id });
      } catch (e) {
        const status = e.response?.status || 500;
        const data = e.response?.data || { error: 'Airtable error' };
        return json(status, { 
          ok: false, 
          error: data.error || 'Error deleting record', 
          details: data 
        });
      }
    }

    return json(405, { ok: false, error: 'Method not allowed' });

  } catch (err) {
    const status = err.status || err.response?.status || 500;
    const data = err.data || err.response?.data || { error: err.message || 'Server error' };
    return json(status, { 
      ok: false, 
      error: data.error || 'Server error', 
      details: data 
    });
  }
};
