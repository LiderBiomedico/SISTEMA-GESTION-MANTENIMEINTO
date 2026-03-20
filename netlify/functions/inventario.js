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
const AIRTABLE_MANUAL_FIELD = process.env.AIRTABLE_MANUAL_FIELD || 'Manual';
const AIRTABLE_INVIMA_FIELD = process.env.AIRTABLE_INVIMA_FIELD || 'Registro Invima pdf';
const AIRTABLE_IMPORTACION_FIELD = process.env.AIRTABLE_IMPORTACION_FIELD || 'Registro de importacion';

const AIRTABLE_API = 'https://api.airtable.com/v0';
const AIRTABLE_META_API = 'https://api.airtable.com/v0/meta/bases';
// AIRTABLE_CONTENT_API eliminada: bloqueada por Cloudflare desde IPs de Netlify/AWS

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
  // Seccion 6: instalacion
  'Voltaje Max',
  'Voltaje Min',
  'Corriente Max',
  'Corriente Min',
  'Potencia',
  'Frecuencia Instalacion',
  'Peso Instalacion',
  // Seccion 7: funcionamiento
  'Frecuencia Funcionamiento',
  'Peso Funcionamiento',
]);

// Campos fecha (Airtable Date)
const DATE_FIELDS = new Set([
  'Fecha Fabrica',
  'Fecha de Compra',
  'Fecha de Recepcion',
  'Fecha de Instalacion',
  'Inicio de Garantia',
  'Termino de Garantia',
  'Fecha de calibracion',
  'Fecha Proxima Calibracion',
]);

// Campos booleanos
const BOOL_FIELDS = new Set([]);

// Campos single select - se intentará fuzzy match contra Airtable
const SINGLE_SELECT_FIELDS = new Set([
  'Sede',
  'Servicio',
  'Clasificacion Biomedica',
  'Clasificacion de la Tecnologia',
  'Clasificacion del Riesgo',
  'Calibrable',
  'Tipo de MTTO',
  // Tipo de Adquisicion y Frecuencia de MTTO Preventivo son texto en Airtable
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
  'SEDE': 'Sede',
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
  'FECHA DE CALIBRACION': 'Fecha de calibracion',
  'FECHA PROXIMA CALIBRACION': 'Fecha Proxima Calibracion',
  'FRECUENCIA DE MTTO PREVENTIVO': 'Frecuencia de MTTO Preventivo',
  'FECHA PROGRAMADA DE MANTENIMINETO': 'Fecha Programada de Mantenimiento',
  'FRECUENCIA DE MANTENIMIENTO': 'Frecuencia de Mantenimiento',
  'PROGRAMACION DE MANTENIMIENTO ANUAL': 'Programacion de Mantenimiento Anual',
  'AÑOS DE CALIBRACION': 'Años de Calibracion',
  'ANOS DE CALIBRACION': 'Años de Calibracion',
  'RESPONSABLE': 'Responsable',
  'NOMBRE': 'Nombre',
  'DIRECCION': 'Direccion',
  'TELEFONO': 'Telefono',
  'CIUDAD': 'Ciudad',
  // Sección 6: Registro técnico de instalación
  'FUENTE DE ALIMENTACION': 'Fuente de Alimentacion',
  'TEC PREDOMINANTE': 'Tec Predominante',
  'VOLTAJE MAX': 'Voltaje Max',
  'VOLTAJE MIN': 'Voltaje Min',
  'CORRIENTE MAX': 'Corriente Max',
  'CORRIENTE MIN': 'Corriente Min',
  'POTENCIA': 'Potencia',
  'FRECUENCIA INSTALACION': 'Frecuencia Instalacion',
  'PRESION INSTALACION': 'Presion Instalacion',
  'VELOCIDAD INSTALACION': 'Velocidad Instalacion',
  'PESO INSTALACION': 'Peso Instalacion',
  'TEMPERATURA INSTALACION': 'Temperatura Instalacion',
  'OTROS INSTALACION': 'Otros Instalacion',
  // Sección 7: Registro técnico de funcionamiento
  'RANGO DE VOLTAJE': 'Rango de Voltaje',
  'RANGO DE CORRIENTE': 'Rango de Corriente',
  'RANGO DE POTENCIA': 'Rango de Potencia',
  'FRECUENCIA FUNCIONAMIENTO': 'Frecuencia Funcionamiento',
  'RANGO DE PRESION': 'Rango de Presion',
  'RANGO DE VELOCIDAD': 'Rango de Velocidad',
  'RANGO DE TEMPERATURA': 'Rango de Temperatura',
  'PESO FUNCIONAMIENTO': 'Peso Funcionamiento',
  'RANGO DE HUMEDAD': 'Rango de Humedad',
  'OTRAS RECOMENDACIONES DEL FABRICANTE': 'Otras Recomendaciones del Fabricante',
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

async function getFieldId(fieldName) {
  try {
    const r=await fetch(AIRTABLE_META_API+'/'+AIRTABLE_BASE_ID+'/tables',{headers:{Authorization:'Bearer '+AIRTABLE_API_KEY}});
    if(!r.ok) return null;
    const d=await r.json();
    const table=(d.tables||[]).find(t=>t.name===TABLE_NAME||t.id===TABLE_NAME);
    if(!table) return null;
    const norm=s=>s.toLowerCase().replace(/[áàäéèëíìïóòöúùü]/g,c=>({á:'a',à:'a',ä:'a',é:'e',è:'e',ë:'e',í:'i',ì:'i',ï:'i',ó:'o',ò:'o',ö:'o',ú:'u',ù:'u',ü:'u'}[c]||c)).trim();
    const field=(table.fields||[]).find(f=>norm(f.name)===norm(fieldName));
    if(!field){console.warn('[UPLOAD] no encontrado:',fieldName);return null;}
    return field.id;
  } catch(e){return null;}
}
// Sube buffer a hosting temporal, devuelve URL publica
async function uploadToTempHost(buffer, filename, contentType) {
  const ctype = contentType || 'application/pdf';
  const fname = filename || 'archivo.pdf';
  // Intento 1: tmpfiles.org
  try {
    const form = new FormData();
    form.append('file', new Blob([buffer], { type: ctype }), fname);
    const r = await fetch('https://tmpfiles.org/api/v1/upload', { method:'POST', body:form });
    if (r.ok) {
      const d = await r.json();
      const pageUrl = d && d.data && d.data.url;
      if (pageUrl) { return pageUrl.replace('tmpfiles.org/', 'tmpfiles.org/dl/'); }
    }
  } catch(e) { console.warn('[UPLOAD] tmpfiles fallido:', e.message); }
  // Intento 2: 0x0.st
  try {
    const form2 = new FormData();
    form2.append('file', new Blob([buffer], { type: ctype }), fname);
    const r2 = await fetch('https://0x0.st', { method:'POST', body:form2 });
    if (r2.ok) { const u = (await r2.text()).trim(); if (u && u.startsWith('http')) return u; }
  } catch(e) { console.warn('[UPLOAD] 0x0.st fallido:', e.message); }
  return null;
}

async function uploadFileToField(recordId,fieldName,file){
  let b64=String(file.base64||'');const c=b64.indexOf(',');if(c!==-1)b64=b64.slice(c+1);
  const fname=file.filename||file.name||'archivo.pdf';
  const ctype=file.contentType||file.type||'application/pdf';
  const buffer=Buffer.from(b64,'base64');
  console.log('[UPLOAD] subiendo',fname,'campo=',fieldName,'size=',buffer.length);

  const publicUrl=await uploadToTempHost(buffer,fname,ctype);
  if(!publicUrl) return {ok:false,error:'No se obtuvo URL publica (tmpfiles.org y 0x0.st fallaron)'};

  let existing=[];
  try{
    const gr=await fetch(AIRTABLE_API+'/'+AIRTABLE_BASE_ID+'/'+encodeURIComponent(TABLE_NAME)+'/'+recordId,
      {headers:{Authorization:'Bearer '+AIRTABLE_API_KEY}});
    if(gr.ok){const gd=await gr.json();const atts=((gd.fields||{})[fieldName]);if(Array.isArray(atts))existing=atts.map(a=>({id:a.id}));}
  }catch(e){console.warn('[UPLOAD] no se pudo leer existentes:',e.message);}

  const allAtts=[...existing,{url:publicUrl,filename:fname}];
  const patchUrl=AIRTABLE_API+'/'+AIRTABLE_BASE_ID+'/'+encodeURIComponent(TABLE_NAME)+'/'+recordId;
  const res=await fetch(patchUrl,{method:'PATCH',headers:{Authorization:'Bearer '+AIRTABLE_API_KEY,'Content-Type':'application/json'},
    body:JSON.stringify({fields:{[fieldName]:allAtts}})});
  const txt=await res.text();
  console.log('[UPLOAD] PATCH status='+res.status+' field='+fieldName);
  if(!res.ok){let e=txt;try{e=JSON.parse(txt).error||txt;}catch(_){}return {ok:false,status:res.status,error:e};}
  return {ok:true,filename:fname};
}
async function uploadCertificates(recordId,fieldName,files){
  const valid=(files||[]).filter(f=>f&&f.base64);
  if(!valid.length) return {ok:true,uploaded:[],errors:[]};
  const uploaded=[],errors=[];
  for(const f of valid){const r=await uploadFileToField(recordId,fieldName,f);if(r.ok)uploaded.push({filename:r.filename});else errors.push({filename:f.filename||f.name,error:r.error});}
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

    // =========================================================================
    // ACTION: uploadPdf — sube un PDF a Airtable via Content API
    // POST /inventario?action=uploadPdf
    // Body: { recordId, fieldName, filename, contentType, base64 }
    // =========================================================================
    const _qs = event.queryStringParameters || {};
    if (_qs.action === 'uploadPdf' && event.httpMethod === 'POST') {
      let rawBody = event.body || '';
      if (event.isBase64Encoded) rawBody = Buffer.from(rawBody, 'base64').toString('utf8');
      const body = rawBody ? JSON.parse(rawBody) : {};
      const { recordId, fieldName, filename, contentType, base64 } = body;
      console.log('[uploadPdf] recordId:', recordId, '| field:', fieldName, '| b64len:', base64 ? base64.length : 0);
      if (!recordId || !fieldName || !base64) {
        return json(400, { ok: false, error: 'Faltan parametros: recordId=' + recordId + ' fieldName=' + fieldName + ' base64=' + !!base64 });
      }
      const result = await uploadFileToField(recordId, fieldName, { base64, filename, contentType });
      console.log('[uploadPdf] resultado:', result.ok, result.error || 'OK');
      return json(200, result);
    }

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
        ? `&filterByFormula=${encodeURIComponent(`FIND(LOWER("${q}"), LOWER({Equipo}&" "&{Marca}&" "&{Modelo}&" "&{Serie}&" "&{Numero de Placa}&" "&{Servicio}&" "&{Sede}))`)}`
        : '';

      const path = `?pageSize=${pageSize}${offset}${sort}${formula}`;
      const r = await airtableFetch(path, { method: 'GET' });
      if (!r.ok) return json(r.status, { ok: false, error: r.data?.error || r.data, details: r.data });

      // Normalizar el campo Item: si Airtable lo devuelve como 'ITEM' u otro nombre, 
      // asegurarse de que siempre llegue como 'Item' al frontend
      const records = (r.data.records || []).map(rec => {
        const f = rec.fields || {};
        if (f['Item'] == null && f['ITEM'] != null) { f['Item'] = f['ITEM']; }
        return { ...rec, fields: f };
      });
      return json(200, { ok: true, ...r.data, records });
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

      // Si falla 422 → reintentos inteligentes: quitar campo por campo hasta que funcione
      if (!created.ok && created.status === 422) {
        console.error('[422] Error Airtable:', JSON.stringify(created.data));

        // Campos que pueden no existir todavía en Airtable (se omiten silenciosamente)
        const SKIPPABLE_FIELDS = new Set([
          'Programacion de Mantenimiento Anual',
          'Años de Calibracion', 'N. Certificado',
          // Fecha de calibracion y Fecha Proxima Calibracion YA EXISTEN en Airtable - no omitir
          'Fuente de Alimentacion', 'Tec Predominante',
          'Voltaje Max', 'Voltaje Min', 'Corriente Max', 'Corriente Min',
          'Potencia', 'Frecuencia Instalacion', 'Presion Instalacion',
          'Velocidad Instalacion', 'Peso Instalacion', 'Temperatura Instalacion',
          'Otros Instalacion', 'Rango de Voltaje', 'Rango de Corriente',
          'Rango de Potencia', 'Frecuencia Funcionamiento', 'Rango de Presion',
          'Rango de Velocidad', 'Rango de Temperatura', 'Peso Funcionamiento',
          'Rango de Humedad', 'Otras Recomendaciones del Fabricante',
          'Manual de servicio',
          // Selects — si el valor no coincide con las opciones de Airtable, Airtable los rechaza
          'Sede', 'Servicio', 'Clasificacion Biomedica', 'Clasificacion de la Tecnologia',
          'Clasificacion del Riesgo', 'Calibrable', 'Tipo de MTTO',
        ]);

        const safeFields = { ...fields };
        const removedSelects = [];

        // Intentos: hasta 5 reintentos quitando el campo problemático identificado por Airtable
        let retryCreated = created;
        for (let attempt = 0; attempt < 6; attempt++) {
          const errMsg = retryCreated.data?.error?.message
            || (typeof retryCreated.data?.error === 'string' ? retryCreated.data.error : '')
            || JSON.stringify(retryCreated.data);

          // Identificar campo problemático en el mensaje de error
          const unknownMatch = errMsg.match(/Unknown field name[:\s]+"?([^"\n,]+)"?/i);
          const invalidMatch = errMsg.match(/Invalid select option[:\s]+"?([^"\n]+)"?\s+for field[:\s]+"?([^"\n,]+)"?/i);

          let badField = null;
          if (invalidMatch) badField = invalidMatch[2].trim();
          else if (unknownMatch) badField = unknownMatch[1].trim();

          if (!badField || !safeFields.hasOwnProperty(badField)) break;

          console.log(`[422] Intento ${attempt+1}: quitando campo problemático "${badField}"`);
          removedSelects.push(badField);
          delete safeFields[badField];

          retryCreated = await createRecord(safeFields);
          if (retryCreated.ok) break;
        }

        if (retryCreated.ok) {
          created = retryCreated;
          created.data.__removedSelects = removedSelects;
          console.log('[422] Guardado exitoso. Campos omitidos:', removedSelects);
        } else {
          // Último recurso: quitar todos los SKIPPABLE_FIELDS y reintentar
          Object.keys(safeFields).forEach(k => {
            if (SKIPPABLE_FIELDS.has(k)) { removedSelects.push(k); delete safeFields[k]; }
          });
          const lastRetry = await createRecord(safeFields);
          if (lastRetry.ok) {
            created = lastRetry;
            created.data.__removedSelects = removedSelects;
            console.log('[422] Guardado en último recurso. Campos omitidos:', removedSelects);
          } else {
            const finalErr = lastRetry.data?.error?.message || lastRetry.data?.error || JSON.stringify(lastRetry.data);
            return json(422, { ok: false, error: `Error guardando: ${finalErr}`, details: lastRetry.data, removedFields, resolvedFields });
          }
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
        manualResult=await uploadFileToField(recordId,AIRTABLE_MANUAL_FIELD,manualData);
        if(!manualResult.ok) console.error('[POST] error manual:',manualResult.error);
      }
      const uploaded=certRes.uploaded;
      const uploadErrors=certRes.errors;
      if(manualResult&&!manualResult.ok) uploadErrors.push({field:'Manual',error:manualResult.error});
      return json(200, {ok:true, record:created.data, data:created.data, recordId, uploaded, uploadErrors, manualUploaded:manualResult?manualResult.ok:false, removedFields, resolvedFields, mappedSent:fields});
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

      let r = await updateRecord(id, fields);

      // Si falla 422 → reintentos inteligentes campo por campo
      if (!r.ok && r.status === 422) {
        console.error('[PATCH 422]', JSON.stringify(r.data));
        const safeFields = { ...fields };
        const removedPatch = [];
        const SKIPPABLE_PATCH = new Set([
          'Programacion de Mantenimiento Anual',
          'Años de Calibracion', 'N. Certificado',
          // Fecha de calibracion y Fecha Proxima Calibracion YA EXISTEN en Airtable - no omitir
          'Fuente de Alimentacion', 'Tec Predominante',
          'Voltaje Max', 'Voltaje Min', 'Corriente Max', 'Corriente Min',
          'Potencia', 'Frecuencia Instalacion', 'Presion Instalacion',
          'Velocidad Instalacion', 'Peso Instalacion', 'Temperatura Instalacion',
          'Otros Instalacion', 'Rango de Voltaje', 'Rango de Corriente',
          'Rango de Potencia', 'Frecuencia Funcionamiento', 'Rango de Presion',
          'Rango de Velocidad', 'Rango de Temperatura', 'Peso Funcionamiento',
          'Rango de Humedad', 'Otras Recomendaciones del Fabricante',
          'Manual de servicio',
          'Sede', 'Servicio', 'Clasificacion Biomedica', 'Clasificacion de la Tecnologia',
          'Clasificacion del Riesgo', 'Calibrable', 'Tipo de MTTO',
        ]);
        let retryR = r;
        for (let attempt = 0; attempt < 6; attempt++) {
          const errMsg = retryR.data?.error?.message
            || (typeof retryR.data?.error === 'string' ? retryR.data.error : '')
            || JSON.stringify(retryR.data);
          const unknownMatch = errMsg.match(/Unknown field name[^"]*"?([^"\n,]+)"?/i);
          const invalidMatch = errMsg.match(/Invalid select option[^"]*"?([^"\n]+)"?\s+for field[^"]*"?([^"\n,]+)"?/i);
          let badField = null;
          if (invalidMatch) badField = invalidMatch[2].trim();
          else if (unknownMatch) badField = unknownMatch[1].trim();
          if (!badField || !safeFields.hasOwnProperty(badField)) break;
          removedPatch.push(badField);
          delete safeFields[badField];
          retryR = await updateRecord(id, safeFields);
          if (retryR.ok) break;
        }
        if (!retryR.ok) {
          // Último recurso: quitar todos los skippables
          Object.keys(safeFields).forEach(k => {
            if (SKIPPABLE_PATCH.has(k)) { removedPatch.push(k); delete safeFields[k]; }
          });
          retryR = await updateRecord(id, safeFields);
        }
        r = retryR;
        if (r.ok) console.log('[PATCH] Guardado. Campos omitidos:', removedPatch);
      }

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
