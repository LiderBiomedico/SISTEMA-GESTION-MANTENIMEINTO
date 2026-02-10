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
  'CERTIFICADO 2025': 'Certificado 2025',
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

// Reverse map (Title Case -> UPPERCASE) to soportar tablas en Airtable con columnas en mayúsculas
const REVERSE_FIELD_MAP = (() => {
  const rev = {};
  for (const [k, v] of Object.entries(FIELD_MAP)) {
    // Preferimos claves UPPERCASE como destino
    if (/^[A-Z0-9 .ÁÉÍÓÚÜÑ-]+$/.test(k) && !rev[v]) rev[v] = k;
  }
  // Fallbacks comunes (si la tabla está en UPPERCASE)
  const fallbacks = {
    'Item': 'ITEM',
    'Equipo': 'EQUIPO',
    'Marca': 'MARCA',
    'Modelo': 'MODELO',
    'Serie': 'SERIE',
    'Numero de Placa': 'PLACA',
    'Codigo ECRI': 'CODIGO ECRI',
    'Registro INVIMA': 'REGISTRO INVIMA',
    'Servicio': 'SERVICIO',
    'Ubicacion': 'UBICACIÓN',
    'Vida Util': 'VIDA UTIL',
    'Fecha Programada de Mantenimiento': 'PROX_MTTO'
  };
  for (const [k,v] of Object.entries(fallbacks)) if (!rev[k]) rev[k] = v;
  return rev;
})();


function airtableErrorSummary(errData) {
  const e = errData?.error || errData || {};
  const type = (typeof e === 'object' && e.type) ? String(e.type) : (typeof errData?.error === 'string' ? String(errData.error) : '');
  const message = (typeof e === 'object' && e.message) ? String(e.message) : (typeof errData?.message === 'string' ? String(errData.message) : '');
  return { type: type || null, message: message || null };
}

function isUnknownFieldError(errData) {
  const e = errData?.error || errData || {};
  const type = (typeof e === 'object' && e.type) ? String(e.type) : String(errData?.error || '');
  const msg = (typeof e === 'object' && e.message) ? String(e.message) : String(errData?.message || '');
  return (type.includes('UNKNOWN_FIELD_NAME') || msg.includes('Unknown field name'));
}

function remapFieldsToUppercase(fields) {
  const out = {};
  for (const [k, v] of Object.entries(fields || {})) {
    const alt = REVERSE_FIELD_MAP[k] || k;
    out[alt] = v;
  }
  return out;
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
      let allRemoved = [];
      let triedUppercase = false;
      
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

          // Si la tabla en Airtable tiene columnas en UPPERCASE, reintenta una vez remapeando
          if (!triedUppercase && isUnknownFieldError(data)) {
            triedUppercase = true;
            mapped = remapFieldsToUppercase(mapped);
            continue;
          }

          const { cleaned, removed } = removeUnknownFields(mapped, data);
          if (removed.length === 0) break;

          allRemoved.push(...removed);
          mapped = cleaned;
          
          if (Object.keys(mapped).length === 0) break;
        }
      }
      
      const sum = airtableErrorSummary(lastError?.data);
      return json(lastError?.status || 422, { 
        ok: false, 
        error: (sum.message || (typeof lastError?.data?.error === 'string' ? lastError.data.error : null) || 'Airtable error'),
        airtableErrorType: sum.type,
        airtableMessage: sum.message,
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
      
      const mapped = mapAndNormalizeFields(body.fields || {});
      const url = `${baseUrl}/${encodeURIComponent(id)}`;
      
      try {
        const resp = await airtableRequest('PATCH', url, { fields: mapped });
        return json(200, { ok: true, record: resp.data });
      } catch (e) {
        const status = e.response?.status || 500;
        const data = e.response?.data || { error: 'Airtable error' };
        
        // Retry on unknown fields
        if (status === 422) {
          // Reintento si la tabla usa UPPERCASE
          if (isUnknownFieldError(data)) {
            try {
              const alt = remapFieldsToUppercase(mapped);
              const resp2 = await airtableRequest('PATCH', url, { fields: alt });
              return json(200, { ok: true, record: resp2.data, warning: { remappedToUppercase: true } });
            } catch (e2) {
              // continua con limpieza/remoción de campos
            }
          }
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
          error: (typeof data.error === 'object' && data.error && data.error.message) ? data.error.message : (data.error || 'Airtable error'), 
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
          error: (typeof data.error === 'object' && data.error && data.error.message) ? data.error.message : (data.error || 'Error deleting record'), 
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
      error: (typeof data.error === 'object' && data.error && data.error.message) ? data.error.message : (data.error || 'Server error'), 
      details: data 
    });
  }
};
