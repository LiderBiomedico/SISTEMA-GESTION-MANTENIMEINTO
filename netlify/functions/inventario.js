// =============================================================================
// netlify/functions/inventario.js - CRUD Inventario (HSLV) - FIX SELECTS v2
// Cambios vs versión anterior:
//   - Nuevo endpoint GET ?getSchema=1: devuelve las opciones reales de Airtable
//     para que el frontend pueda poblar los <select> dinámicamente.
//   - fuzzyMatchSelect(): compara el valor enviado contra las opciones reales
//     de Airtable (normalizado: sin tildes, minúsculas, sin espacios extra).
//     Si encuentra coincidencia, sustituye el valor por el exacto de Airtable.
//   - Ya no depende de que el HTML tenga los valores escritos exactamente igual.
// =============================================================================

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY || process.env.AIRTABLE_TOKEN || '';
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID || '';
const TABLE_NAME = process.env.AIRTABLE_INVENTARIO_TABLE || 'Inventario';
const AIRTABLE_CAL_CERT_FIELD = process.env.AIRTABLE_CAL_CERT_FIELD || 'Certificados de Calibracion';

const AIRTABLE_API = 'https://api.airtable.com/v0';
const AIRTABLE_META_API = 'https://api.airtable.com/v0/meta/bases';
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

// Campos numéricos (Airtable Number / Integer)
const NUMBER_FIELDS = new Set([
  'Item',
  'Vida Util',
  'Valor en Pesos',
  'Costo de Mantenimiento',
]);

// Campos fecha (Airtable Date)
const DATE_FIELDS = new Set([
  'Fecha Fabrica',
  'Fecha de Compra',
  'Fecha de Recepcion',
  'Fecha de Instalacion',
  'Inicio de Garantia',
  'Termino de Garantia',
]);

// Campos booleanos
const BOOL_FIELDS = new Set([]);

// Campos single select - se intentará fuzzy match contra Airtable
const SINGLE_SELECT_FIELDS = new Set([
  'Servicio',
  'Clasificacion Biomedica',
  'Clasificacion de la Tecnologia',
  'Clasificacion del Riesgo',
  'Tipo de Adquisicion',
  'Calibrable',
  'Frecuencia de MTTO Preventivo',
  'Tipo de MTTO',
]);

// Mapeo de nombres del formulario → nombres exactos de Airtable
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
  'SERVICIO': 'Servicio',
  'UBICACIÓN': 'Ubicacion',
  'UBICACION': 'Ubicacion',
  'CLASIFICACION BIOMEDICA': 'Clasificacion Biomedica',
  'CLASIFICACIÓN BIOMÉDICA': 'Clasificacion Biomedica',
  'CLASIFICACION DE LA TECNOLOGIA': 'Clasificacion de la Tecnologia',
  'CLASIFICACIÓN DE LA TECNOLOGÍA': 'Clasificacion de la Tecnologia',
  'CLASIFICACION DEL RIESGO': 'Clasificacion del Riesgo',
  'CLASIFICACIÓN DEL RIESGO': 'Clasificacion del Riesgo',
  'VIDA UTIL': 'Vida Util',
  'VIDA ÚTIL': 'Vida Util',
  'FECHA FABRICA': 'Fecha Fabrica',
  'FECHA DE COMPRA': 'Fecha de Compra',
  'FECHA DE COMRPA': 'Fecha de Compra',
  'FECHA DE RECEPCION': 'Fecha de Recepcion',
  'FECHA DE RECEPCIÓN': 'Fecha de Recepcion',
  'FECHA DE INSTALACIÓN': 'Fecha de Instalacion',
  'INICIO DE GARANTIA': 'Inicio de Garantia',
  'TERMINO DE GARANTIA': 'Termino de Garantia',
  'VALOR EN PESOS': 'Valor en Pesos',
  'TIPO DE ADQUISICION': 'Tipo de Adquisicion',
  'NO. DE CONTRATO': 'No. de Contrato',
  'CALIBRABLE': 'Calibrable',
  'CALIBRABLE_IDENT': 'Calibrable',
  'MANUAL': 'Manual',
  'TIPO DE MTTO': 'Tipo de MTTO',
  'COSTO DE MANTENIMIENTO': 'Costo de Mantenimiento',
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

// ============================================================================
// UTILIDADES
// ============================================================================

function normalizeKey(k) {
  return String(k || '').trim();
}

// Normaliza un string para comparación fuzzy:
// minúsculas, sin tildes/acentos, sin espacios extra
function normalizeForFuzzy(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // quita diacríticos
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanSelectValue(v) {
  if (v == null) return v;
  let s = String(v);
  s = s.replace(/^"+|"+$/g, '');
  s = s.replace(/^'+|'+$/g, '');
  s = s.replace(/""+/g, '"');
  s = s.replace(/\u200B|\u200C|\u200D|\uFEFF/g, '');
  s = s.trim().replace(/\s+/g, ' ');
  return s;
}

function parseNumberLike(v) {
  if (v == null) return v;
  if (typeof v === 'number') return v;
  const s = String(v).trim();
  const m = s.match(/-?\d+(?:[.,]\d+)?/);
  if (!m) return null;
  return Number(m[0].replace(',', '.'));
}

function parseDateLike(v) {
  if (!v) return null;
  if (typeof v === 'string') {
    const s = v.trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
    const t = Date.parse(s);
    if (!Number.isNaN(t)) return new Date(t).toISOString().slice(0, 10);
    return null;
  }
  return null;
}

// ============================================================================
// SCHEMA CACHE - Evita consultar Airtable meta en cada request
// (en serverless el cache vive mientras el proceso esté caliente, ~segundos/min)
// ============================================================================
let _schemaCache = null;
let _schemaCacheAt = 0;
const SCHEMA_CACHE_TTL = 5 * 60 * 1000; // 5 minutos

async function getTableSchema() {
  const now = Date.now();
  if (_schemaCache && (now - _schemaCacheAt) < SCHEMA_CACHE_TTL) {
    return _schemaCache;
  }

  try {
    const url = `${AIRTABLE_META_API}/${AIRTABLE_BASE_ID}/tables`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${AIRTABLE_API_KEY}` },
    });
    if (!res.ok) return null;
    const data = await res.json();
    const tables = data.tables || [];
    const table = tables.find(t => t.name === TABLE_NAME) || tables[0];
    if (!table) return null;

    // Construir mapa: fieldName → array de opciones (para singleSelect)
    const selectOptions = {};
    for (const field of (table.fields || [])) {
      if (field.type === 'singleSelect' && field.options && Array.isArray(field.options.choices)) {
        selectOptions[field.name] = field.options.choices.map(c => c.name);
      }
    }

    _schemaCache = selectOptions;
    _schemaCacheAt = now;
    return selectOptions;
  } catch (e) {
    console.error('Error consultando schema Airtable:', e);
    return null;
  }
}

// Dado un valor enviado por el frontend y el nombre del campo, devuelve
// el valor exacto que Airtable espera (usando fuzzy match) o el valor limpio.
async function resolveSelectValue(fieldName, rawValue) {
  const cleaned = cleanSelectValue(rawValue);
  if (!cleaned) return cleaned;

  const schema = await getTableSchema();
  if (!schema || !schema[fieldName]) return cleaned;

  const choices = schema[fieldName];
  const normalizedInput = normalizeForFuzzy(cleaned);

  // 1. Coincidencia exacta primero
  const exact = choices.find(c => c === cleaned);
  if (exact) return exact;

  // 2. Fuzzy match (sin tildes, minúsculas)
  const fuzzy = choices.find(c => normalizeForFuzzy(c) === normalizedInput);
  if (fuzzy) return fuzzy;

  // 3. Coincidencia parcial (el input está contenido en la opción o viceversa)
  const partial = choices.find(c =>
    normalizeForFuzzy(c).includes(normalizedInput) ||
    normalizedInput.includes(normalizeForFuzzy(c))
  );
  if (partial) return partial;

  // No se encontró → devolver limpio y dejar que Airtable lo rechace (o no)
  return cleaned;
}

// ============================================================================
// AIRTABLE FETCH
// ============================================================================

async function airtableFetch(path, opts = {}) {
  const url = `${AIRTABLE_API}/${AIRTABLE_BASE_ID}/${encodeURIComponent(TABLE_NAME)}${path || ''}`;
  const res = await fetch(url, {
    ...opts,
    headers: {
      Authorization: `Bearer ${AIRTABLE_API_KEY}`,
      'Content-Type': 'application/json',
      ...(opts.headers || {}),
    },
  });
  const text = await res.text();
  let data;
  try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }
  return { ok: res.ok, status: res.status, data };
}

// getFieldId: obtiene fieldId (fldXXX) desde schema de Airtable
async function getFieldId(fieldName) {
  try {
    const r = await fetch(AIRTABLE_META_API + '/' + AIRTABLE_BASE_ID + '/tables', {
      headers: { Authorization: 'Bearer ' + AIRTABLE_API_KEY }
    });
    if (!r.ok) return null;
    const d = await r.json();
    const table = (d.tables||[]).find(function(t){ return t.name===TABLE_NAME||t.id===TABLE_NAME; });
    if (!table) return null;
    const norm = function(s){ return s.toLowerCase().replace(/[áàäéèëíìïóòöúùü]/g,function(c){return{á:'a',à:'a',ä:'a',é:'e',è:'e',ë:'e',í:'i',ì:'i',ï:'i',ó:'o',ò:'o',ö:'o',ú:'u',ù:'u',ü:'u'}[c]||c;}).trim(); };
    const field = (table.fields||[]).find(function(f){ return norm(f.name)===norm(fieldName); });
    if (!field) { console.warn('[UPLOAD] campo no encontrado:',fieldName); return null; }
    console.log('[UPLOAD] fieldId='+field.id+' para "'+fieldName+'"');
    return field.id;
  } catch(e) { console.warn('[UPLOAD] error:',e.message); return null; }
}

// uploadFileToField: sube un PDF via Content API de Airtable
async function uploadFileToField(recordId, fieldName, file) {
  const fieldId = await getFieldId(fieldName);
  if (!fieldId) return { ok:false, error:'fieldId no encontrado para "'+fieldName+'"' };
  let b64 = String(file.base64||''); const c=b64.indexOf(','); if(c!==-1) b64=b64.slice(c+1);
  const fname = file.filename||file.name||'archivo.pdf';
  const ctype = file.contentType||file.type||'application/pdf';
  console.log('[UPLOAD] subiendo "'+fname+'" b64len='+b64.length);
  const url = AIRTABLE_CONTENT_API+'/'+AIRTABLE_BASE_ID+'/'+recordId+'/'+fieldId+'/uploadAttachment';
  const res = await fetch(url,{method:'POST',
    headers:{Authorization:'Bearer '+AIRTABLE_API_KEY,'Content-Type':'application/json'},
    body:JSON.stringify({contentType:ctype,filename:fname,file:b64})});
  const txt = await res.text();
  console.log('[UPLOAD] status='+res.status+' resp='+txt.slice(0,150));
  if (!res.ok) return {ok:false,status:res.status,error:txt};
  return {ok:true,filename:fname};
}

// uploadCertificates: sube N PDFs al campo de calibración
async function uploadCertificates(recordId, fieldName, files) {
  const valid=(files||[]).filter(function(f){return f&&f.base64;});
  if (!valid.length) return {ok:true,uploaded:[],errors:[]};
  const uploaded=[],errors=[];
  for (let i=0;i<valid.length;i++){
    const r=await uploadFileToField(recordId,fieldName,valid[i]);
    if(r.ok) uploaded.push({filename:r.filename});
    else errors.push({filename:valid[i].filename||valid[i].name,error:r.error});
  }
  return {ok:errors.length===0,uploaded,errors};
}

// ============================================================================
// NORMALIZACIÓN DE CAMPOS (ahora async para poder llamar resolveSelectValue)
// ============================================================================

async function mapAndNormalizeFields(inputFields) {
  const out = {};
  const removed = [];
  const resolved = {}; // para debug: muestra qué valores fueron resueltos

  for (const k of Object.keys(inputFields || {})) {
    const rawKey = normalizeKey(k);
    const mappedKey = FIELD_MAP[rawKey.toUpperCase()] || rawKey;
    let v = inputFields[k];

    if (v == null || v === '') continue;

    if (NUMBER_FIELDS.has(mappedKey)) {
      const num = parseNumberLike(v);
      if (num == null || Number.isNaN(num)) { removed.push(mappedKey); continue; }
      out[mappedKey] = num;
      continue;
    }

    if (DATE_FIELDS.has(mappedKey)) {
      const d = parseDateLike(v);
      if (!d) { removed.push(mappedKey); continue; }
      out[mappedKey] = d;
      continue;
    }

    if (BOOL_FIELDS.has(mappedKey)) {
      if (typeof v === 'boolean') out[mappedKey] = v;
      else {
        const s = String(v).trim().toLowerCase();
        out[mappedKey] = (s === 'si' || s === 'sí' || s === 'true' || s === '1');
      }
      continue;
    }

    if (SINGLE_SELECT_FIELDS.has(mappedKey)) {
      // *** FUZZY MATCH contra opciones reales de Airtable ***
      const resolvedVal = await resolveSelectValue(mappedKey, v);
      if (!resolvedVal) { removed.push(mappedKey); continue; }
      if (resolvedVal !== cleanSelectValue(v)) {
        resolved[mappedKey] = { sent: v, resolved: resolvedVal };
      }
      out[mappedKey] = resolvedVal;
      continue;
    }

    if (typeof v === 'string') {
      out[mappedKey] = v.trim();
    } else {
      out[mappedKey] = v;
    }
  }

  return { fields: out, removedFields: removed, resolvedFields: resolved };
}

async function createRecord(fields) {
  return airtableFetch('', { method: 'POST', body: JSON.stringify({ fields }) });
}

async function updateRecord(id, fields) {
  return airtableFetch(`/${id}`, { method: 'PATCH', body: JSON.stringify({ fields }) });
}

async function deleteRecord(id) {
  return airtableFetch(`/${id}`, { method: 'DELETE' });
}

// ============================================================================
// HANDLER PRINCIPAL
// ============================================================================

exports.handler = async (event) => {
  try {
    if (event.httpMethod === 'OPTIONS') return json(200, { ok: true });

    if (!AIRTABLE_API_KEY || !AIRTABLE_BASE_ID) {
      return json(500, { ok: false, error: 'Faltan variables de entorno AIRTABLE_API_KEY/AIRTABLE_BASE_ID en Netlify.' });
    }

    if (event.httpMethod === 'GET') {
      const params = event.queryStringParameters || {};

      // -----------------------------------------------------------------------
      // GET ?getSchema=1 → devuelve opciones reales de campos select de Airtable
      // El frontend puede usarlo para poblar los <select> dinámicamente.
      // -----------------------------------------------------------------------
      if (String(params.getSchema || '') === '1') {
        const schema = await getTableSchema();
        if (!schema) return json(500, { ok: false, error: 'No se pudo obtener el schema de Airtable. Verifica que el token tenga permiso schema:read.' });
        return json(200, { ok: true, selectOptions: schema });
      }

      // -----------------------------------------------------------------------
      // GET ?nextItem=1 → siguiente número de Item (Autonumber)
      // -----------------------------------------------------------------------
      if (String(params.nextItem || '') === '1') {
        const path = `?pageSize=1&sort%5B0%5D%5Bfield%5D=Item&sort%5B0%5D%5Bdirection%5D=desc`;
        const r = await airtableFetch(path, { method: 'GET' });
        if (!r.ok) return json(r.status, { ok: false, error: r.data?.error || r.data });
        const rec0 = r.data && r.data.records && r.data.records[0] ? r.data.records[0] : null;
        const last = rec0 && rec0.fields && (rec0.fields.Item ?? rec0.fields['ITEM']);
        const next = (typeof last === 'number' && Number.isFinite(last)) ? (last + 1) : null;
        return json(200, { ok: true, nextItem: next, nextItemDisplay: next != null ? String(next) : '' });
      }

      // -----------------------------------------------------------------------
      // GET → listar registros
      // -----------------------------------------------------------------------
      const pageSize = Math.min(Number(params.pageSize || 50) || 50, 100);
      const offset = params.offset ? `&offset=${encodeURIComponent(params.offset)}` : '';
      const sort = '&sort%5B0%5D%5Bfield%5D=Item&sort%5B0%5D%5Bdirection%5D=asc';
      const q = (params.q || '').trim();
      const formula = q
        ? `&filterByFormula=${encodeURIComponent(`FIND(LOWER("${q}"), LOWER({Equipo}&" "&{Marca}&" "&{Modelo}&" "&{Serie}&" "&{Numero de Placa}&" "&{Servicio}))`)}`
        : '';

      const path = `?pageSize=${pageSize}${offset}${sort}${formula}`;
      const r = await airtableFetch(path, { method: 'GET' });
      if (!r.ok) return json(r.status, { ok: false, error: r.data?.error || r.data, details: r.data });
      return json(200, { ok: true, ...r.data });
    }

    // =========================================================================
    // POST (crear)
    // =========================================================================
    if (event.httpMethod === 'POST') {
      const body = event.body ? JSON.parse(event.body) : {};
      const rawFields = body.fields || {};
      const certificates = Array.isArray(body.certificates) ? body.certificates : [];

      const { fields, removedFields, resolvedFields } = await mapAndNormalizeFields(rawFields);

      // Item es Autonumber → nunca enviarlo
      delete fields['Item'];

      let created = await createRecord(fields);

      // Si aún falla por select inválido (valor que no existe en Airtable ni fuzzy matchea)
      if (!created.ok && created.status === 422) {
        const errType =
          (created.data?.error?.type) ||
          (created.data?.error?.error?.type) ||
          '';
        if (errType === 'INVALID_MULTIPLE_CHOICE_OPTIONS') {
          // Remover todos los selects y reintentar para no bloquear el guardado
          const safeFields = { ...fields };
          const removedSelects = [];
          Object.keys(safeFields).forEach((k) => {
            if (SINGLE_SELECT_FIELDS.has(k)) { removedSelects.push(k); delete safeFields[k]; }
          });
          const retry = await createRecord(safeFields);
          if (retry.ok) {
            created = retry;
            created.data.__removedSelects = removedSelects;
          } else {
            return json(created.status, {
              ok: false,
              error: created.data?.error || created.data,
              details: created.data,
              removedFields,
              resolvedFields,
              mappedSent: fields,
            });
          }
        } else {
          return json(created.status, {
            ok: false,
            error: created.data?.error || created.data,
            details: created.data,
            removedFields,
            resolvedFields,
            mappedSent: fields,
          });
        }
      } else if (!created.ok) {
        return json(created.status, {
          ok: false,
          error: created.data?.error || created.data,
          details: created.data,
          removedFields,
          resolvedFields,
          mappedSent: fields,
        });
      }

      const recordId = created.data?.id || created.data?.records?.[0]?.id;
      if (!recordId) {
        return json(500, { ok: false, error: 'Registro creado pero no se obtuvo ID.', details: created.data });
      }

      // Certificados PDF
      let certRes={ok:true,uploaded:[],errors:[]};
      if(certificates.length>0) certRes=await uploadCertificates(recordId,AIRTABLE_CAL_CERT_FIELD,certificates);
      // Manual PDF
      const manualData=body.manual;
      let manualResult=null;
      if(manualData&&manualData.base64){
        manualResult=await uploadFileToField(recordId,AIRTABLE_MANUAL_FIELD||'Manual',manualData);
        if(!manualResult.ok) console.error('[POST] error manual:',manualResult.error);
      }
      const uploaded=certRes.uploaded;
      const uploadErrors=certRes.errors;
      if(manualResult&&!manualResult.ok) uploadErrors.push({field:'Manual',error:manualResult.error});

      return json(200, {
        ok: true,
        record: created.data,
        data: created.data,
        uploaded,
        uploadErrors,
        manualUploaded: manualResult ? manualResult.ok : false,
        removedFields,
        resolvedFields,
        mappedSent: fields,
      });
    }

    // =========================================================================
    // PUT/PATCH (actualizar)
    // =========================================================================
    if (event.httpMethod === 'PUT' || event.httpMethod === 'PATCH') {
      const body = event.body ? JSON.parse(event.body) : {};
      const id = body.id;
      if (!id) return json(400, { ok: false, error: 'Falta id para actualizar.' });

      const { fields, removedFields, resolvedFields } = await mapAndNormalizeFields(body.fields || {});
      delete fields['Item'];

      const r = await updateRecord(id, fields);
      if (!r.ok) return json(r.status, { ok: false, error: r.data?.error || r.data, details: r.data, removedFields, resolvedFields, mappedSent: fields });

      return json(200, { ok: true, record: r.data, data: r.data, removedFields, resolvedFields, mappedSent: fields });
    }

    // =========================================================================
    // DELETE (eliminar)
    // =========================================================================
    if (event.httpMethod === 'DELETE') {
      const params = event.queryStringParameters || {};
      const id = params.id;
      if (!id) return json(400, { ok: false, error: 'Falta id para eliminar.' });

      const r = await deleteRecord(id);
      if (!r.ok) return json(r.status, { ok: false, error: r.data?.error || r.data, details: r.data });

      return json(200, { ok: true, data: r.data });
    }

    return json(405, { ok: false, error: `Método no soportado: ${event.httpMethod}` });
  } catch (e) {
    return json(500, { ok: false, error: String(e && e.message ? e.message : e), details: e && e.stack ? e.stack : null });
  }
};
