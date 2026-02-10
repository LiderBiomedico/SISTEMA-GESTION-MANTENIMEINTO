// =============================================================================
// netlify/functions/inventario.js - VERSIÓN COMPLETA CON CRUD
// Soporta: GET (list), POST (create), PUT (update), DELETE (delete)
// Gestiona errores 422 de Airtable removiendo campos desconocidos (sin filtrar por muestreo de registros)
// =============================================================================
const axios = require('axios');

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY || process.env.AIRTABLE_TOKEN || '';
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID || '';
const TABLE_NAME = process.env.AIRTABLE_INVENTARIO_TABLE || 'Inventario';
const AIRTABLE_API = 'https://api.airtable.com/v0';

// ----- Normalización para empatar nombres de campos (Airtable es estricto) -----
function normKey(s) {
  return String(s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // quita tildes
    .replace(/[\u200B-\u200D\uFEFF]/g, '') // quita zero-width
    .replace(/\u00A0/g, ' ') // NBSP
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ') // colapsa separadores
    .trim();
}

// Aliases típicos del formulario -> nombres esperados en Airtable (normalizados)
const NORM_ALIASES = {
  // Foto
  'foto del equipo': 'foto equipo',
  'fotodelequipo': 'foto equipo',
  // Registro
  'registro invima': 'registro sanitario',
  // Otros frecuentes
  'codigo ecri': 'ecri',
  'placa': 'numero de placa',
  'valor en pesos': 'costo del equipo',
  'vida util': 'vida util en anos',
  'no de contrato': 'n de contrato',
  'no. de contrato': 'n de contrato',
  'n de contrato': 'n de contrato',
  'n° de contrato': 'n de contrato',
};

// Cache por invocación
let _schemaCache = null;

async function loadTableSchema() {
  if (_schemaCache) return _schemaCache;
  if (!AIRTABLE_API_KEY || !AIRTABLE_BASE_ID) {
    _schemaCache = { fieldsByNorm: {}, fieldTypesByName: {}, tableId: null };
    return _schemaCache;
  }

  const url = `${AIRTABLE_API}/meta/bases/${AIRTABLE_BASE_ID}/tables`;
  const resp = await axios.get(url, {
    headers: { Authorization: `Bearer ${AIRTABLE_API_KEY}` },
    timeout: 20000,
  });

  const tables = resp.data?.tables || [];
  const table = tables.find(t => t.name === TABLE_NAME) || tables[0];
  const fieldsByNorm = {};
  const fieldTypesByName = {};
  if (table && Array.isArray(table.fields)) {
    for (const f of table.fields) {
      const nk = normKey(f.name);
      fieldsByNorm[nk] = f.name; // exact name
      fieldTypesByName[f.name] = f.type || null;
    }
  }
  _schemaCache = { fieldsByNorm, fieldTypesByName, tableId: table?.id || null };
  return _schemaCache;
}

function coerceAttachmentIfNeeded(fieldName, value, fieldTypesByName) {
  const t = fieldTypesByName[fieldName];
  if (t !== 'multipleAttachments') return value;
  if (value == null || value === '') return value;

  // Si ya viene en formato attachment válido, se deja
  if (Array.isArray(value) && value.length && typeof value[0] === 'object') return value;

  // Si viene como URL string, convertir
  if (typeof value === 'string' && /^https?:\/\/\S+/i.test(value.trim())) {
    return [{ url: value.trim() }];
  }

  // Si no es URL válida, descartar para evitar 422 por tipo de dato
  return null;
}


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

// Mapeo de campos del formulario a columnas de Airtable
// Soporta: Title Case (del equipoModal), UPPERCASE (del newInventario form), y variantes con tildes
const FIELD_MAP = {
  // Identificación
  'ITEM': 'Item',
  'EQUIPO': 'Equipo',
  'MARCA': 'Marca',
  'MODELO': 'Modelo',
  'SERIE': 'Serie',
  'PLACA': 'Numero de Placa',
  'NUMERO DE PLACA': 'Numero de Placa',
  'NÚMERO DE PLACA': 'Numero de Placa',

  // Ubicación / clasificación
  'SERVICIO': 'Servicio',
  'UBICACION': 'Ubicacion',
  'UBICACIÓN': 'Ubicacion',
  'VIDA UTIL': 'Vida Util en años',
  'VIDA ÚTIL': 'Vida Util en años',

  // Campos en Airtable (según tu base)
  'CODIGO ECRI': 'ECRI',
  'ECRI': 'ECRI',
  'REGISTRO INVIMA': 'Registro Sanitario',
  'REGISTRO SANITARIO': 'Registro Sanitario',
  // soporte alterno
  'REGISTRO INVIMA ALT': 'Registro Invima',

  // Adquisición
  'TIPO DE ADQUISICION': 'Tipo de adquisicion',
  'TIPO DE ADQUISICIÓN': 'Tipo de adquisicion',
  'NO. DE CONTRATO': 'N° de Contrato',
  'N° DE CONTRATO': 'N° de Contrato',
  'Nº DE CONTRATO': 'N° de Contrato',
  'VALOR EN PESOS': 'Costo del equipo',
  'COSTO DEL EQUIPO': 'Costo del equipo',
  'FECHA DE COMPRA': 'Fecha de compra',
  'FECHA DE COMRPA': 'Fecha de compra',
  'FECHA DE INSTALACION': 'Fecha de instalacion',
  'FECHA DE INSTALACIÓN': 'Fecha de instalacion',

  // Mantenimiento
  'TIPO DE MTTO': 'Tipo de MTTO',
  'COSTO DE MANTENIMIENTO': 'Costo de Mantenimiento',
  'CALIBRABLE': 'Calibrable',
  'N. CERTIFICADO': 'N. Certificado',
  'FRECUENCIA DE MTTO PREVENTIVO': 'Frecuencia de MTTO Preventivo',
  'FECHA PROGRAMADA DE MANTENIMINETO': 'Fecha Programada de Mantenimiento',
  'FRECUENCIA DE MANTENIMIENTO': 'Frecuencia de Mantenimiento',
  'PROGRAMACION DE MANTENIMIENTO ANUAL': 'Programacion de Mantenimiento Anual',

  // Responsable / proveedor
  'RESPONSABLE': 'Responsable',
  'NOMBRE': 'Nombre',
  'DIRECCION': 'Direccion',
  'TELEFONO': 'Telefono',
  'CIUDAD': 'Ciudad',
};

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


async function mapAndNormalizeFields(inputFields) {
  const { fieldsByNorm, fieldTypesByName } = await loadTableSchema();

  // Si no hay esquema, se comporta como antes (pero con aliases normalizados)
  const hasSchema = fieldsByNorm && Object.keys(fieldsByNorm).length > 0;

  const out = {};
  for (const [k, v] of Object.entries(inputFields || {})) {
    const rawKey = String(k || '').trim();

    // 1) map explícito (por compatibilidad con versiones anteriores)
    const mappedName = FIELD_MAP[rawKey] || rawKey;

    // 2) normaliza y aplica alias (ej: "Foto del equipo" -> "Foto equipo")
    let nk = normKey(mappedName);
    if (NORM_ALIASES[nk]) nk = normKey(NORM_ALIASES[nk]);

    // 3) resuelve al nombre EXACTO en Airtable usando esquema (tildes/espacios)
    let finalName = mappedName;
    if (hasSchema) {
      const exact = fieldsByNorm[nk];
      if (!exact) {
        // No existe en Airtable: se descarta silenciosamente
        continue;
      }
      finalName = exact;
    }

    // 4) normaliza valor y aplica coerción por tipo (attachments, etc.)
    let normVal = normalizeValue(finalName, v);
    normVal = coerceAttachmentIfNeeded(finalName, normVal, fieldTypesByName);

    // Si coerción devolvió null (por no ser URL válida en attachment), no enviar el campo
    if (normVal === null) continue;

    out[finalName] = normVal;
  }

  console.log('[inventario] Mapped fields:', JSON.stringify(out));
  return out;
}

function removeUnknownFields(fields, errData) {
(fields, errData) {
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
      continue;
    }
    // Intento robusto: comparar por clave normalizada (tildes/espacios invisibles)
    const nu = normKey(u);
    const hit = Object.keys(cleaned).find(k => normKey(k) === nu);
    if (hit) {
      delete cleaned[hit];
      removed.push(hit);
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
      let mapped = await mapAndNormalizeFields(body.fields || {});
      let allRemoved = [];
      
      // Intentar hasta 3 veces, removiendo campos desconocidos en cada intento
      let lastError = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const resp = await airtableRequest('POST', baseUrl, { fields: mapped });
          const result = { ok: true, success: true, record: resp.data };
          if (allRemoved.length > 0) {
            result.warning = { removedUnknownFields: allRemoved };
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
        error: lastError?.data?.error || 'Airtable error', 
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
      
      const mapped = await mapAndNormalizeFields(body.fields || {});
      const url = `${baseUrl}/${encodeURIComponent(id)}`;
      
      try {
        const resp = await airtableRequest('PATCH', url, { fields: mapped });
        return json(200, { ok: true, record: resp.data });
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
