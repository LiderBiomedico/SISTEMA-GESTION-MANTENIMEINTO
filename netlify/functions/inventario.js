// =============================================================================
// netlify/functions/inventario.js - CRUD Inventario (HSLV) - FIX FINAL
// - Sin axios (usa fetch nativo de Node 18+)
// - Define NUMBER_FIELDS / BOOL_FIELDS / DATE_FIELDS / SINGLE_SELECT_FIELDS
// - Limpia comillas dobles y espacios invisibles en selects ("\"\"Consulta Externa\"\"" -> "Consulta Externa")
// - Convierte "Vida Util" tipo texto ("10 años") a número (10)
// - Soporta adjuntos (Certificados de Calibracion) vía Airtable Content API (base64)
// =============================================================================

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

// Campos numéricos (Airtable Number / Integer)
const NUMBER_FIELDS = new Set([
  'Item',
  'Vida Util',
  'Valor en Pesos',
]);

// Campos fecha (Airtable Date)
const DATE_FIELDS = new Set([
  'Fecha Fabrica',
  'Fecha de Compra',
  'Fecha de Recepcion',
]);

// Campos booleanos (si tu base los tiene como checkbox; si no, no afecta)
const BOOL_FIELDS = new Set([
  // 'Activo'
]);

// Campos single select típicos (para limpiar texto)
const SINGLE_SELECT_FIELDS = new Set([
  'Servicio',
  'Clasificacion Biomedica',
  'Clasificacion de la Tecnologia',
  'Clasificacion del Riesgo',
  'Tipo de Adquisicion',
  'Calibrable',
]);

// Mapeo opcional (por si el frontend envía nombres diferentes)
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
  'FECHA DE RECEPCION': 'Fecha de Recepcion',
  'VALOR EN PESOS': 'Valor en Pesos',
  'TIPO DE ADQUISICION': 'Tipo de Adquisicion',
  'NO. DE CONTRATO': 'No. de Contrato',
  'CALIBRABLE': 'Calibrable',
  'CALIBRABLE_IDENT': 'Calibrable',
};

function normalizeKey(k) {
  return String(k || '').trim();
}

function cleanSelectValue(v) {
  if (v == null) return v;
  let s = String(v);
  // elimina comillas dobles repetidas ""valor""
  s = s.replace(/^"+|"+$/g, '');
  s = s.replace(/^'+|'+$/g, '');
  // quita comillas dobles internas duplicadas
  s = s.replace(/""+/g, '"');
  // quita caracteres invisibles
  s = s.replace(/\u200B|\u200C|\u200D|\uFEFF/g, '');
  // trim y normaliza espacios
  s = s.trim().replace(/\s+/g, ' ');
  return s;
}

function parseNumberLike(v) {
  if (v == null) return v;
  if (typeof v === 'number') return v;
  const s = String(v).trim();
  // captura primer número (con coma o punto)
  const m = s.match(/-?\d+(?:[.,]\d+)?/);
  if (!m) return null;
  return Number(m[0].replace(',', '.'));
}

function parseDateLike(v) {
  if (!v) return null;
  if (typeof v === 'string') {
    const s = v.trim();
    // si ya viene yyyy-mm-dd
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
    // intenta Date.parse
    const t = Date.parse(s);
    if (!Number.isNaN(t)) return new Date(t).toISOString().slice(0, 10);
    return null;
  }
  return null;
}

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

async function contentUploadAttachment(recordId, fieldName, file) {
  // file: { filename, contentType, base64 }
  const url = `${AIRTABLE_CONTENT_API}/${AIRTABLE_BASE_ID}/${encodeURIComponent(TABLE_NAME)}/${recordId}/${encodeURIComponent(fieldName)}`;
  const body = {
    // Airtable Content API espera { contentType, filename, file } donde file es base64 string
    contentType: file.contentType || file.type || 'application/octet-stream',
    filename: file.filename || file.name || 'archivo',
    file: file.base64,
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${AIRTABLE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let data;
  try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }
  return { ok: res.ok, status: res.status, data };
}

function mapAndNormalizeFields(inputFields) {
  const out = {};
  const removed = [];

  Object.keys(inputFields || {}).forEach((k) => {
    const rawKey = normalizeKey(k);
    const mappedKey = FIELD_MAP[rawKey.toUpperCase()] || rawKey;
    let v = inputFields[k];

    if (v == null || v === '') return;

    // normalización por tipo
    if (NUMBER_FIELDS.has(mappedKey)) {
      const num = parseNumberLike(v);
      if (num == null || Number.isNaN(num)) { removed.push(mappedKey); return; }
      out[mappedKey] = num;
      return;
    }

    if (DATE_FIELDS.has(mappedKey)) {
      const d = parseDateLike(v);
      if (!d) { removed.push(mappedKey); return; }
      out[mappedKey] = d;
      return;
    }

    if (BOOL_FIELDS.has(mappedKey)) {
      if (typeof v === 'boolean') out[mappedKey] = v;
      else {
        const s = String(v).trim().toLowerCase();
        out[mappedKey] = (s === 'si' || s === 'sí' || s === 'true' || s === '1');
      }
      return;
    }

    if (SINGLE_SELECT_FIELDS.has(mappedKey)) {
      const s = cleanSelectValue(v);
      if (!s) { removed.push(mappedKey); return; }
      out[mappedKey] = s;
      return;
    }

    // texto normal
    if (typeof v === 'string') {
      out[mappedKey] = v.trim();
    } else {
      out[mappedKey] = v;
    }
  });

  return { fields: out, removedFields: removed };
}

async function createRecord(fields) {
  return airtableFetch('', { method: 'POST', body: JSON.stringify({ fields }) });
}

async function updateRecord(id, fields) {
  const path = `/${id}`;
  return airtableFetch(path, { method: 'PATCH', body: JSON.stringify({ fields }) });
}

async function deleteRecord(id) {
  const path = `/${id}`;
  return airtableFetch(path, { method: 'DELETE' });
}

exports.handler = async (event) => {
  try {
    if (event.httpMethod === 'OPTIONS') return json(200, { ok: true });

    if (!AIRTABLE_API_KEY || !AIRTABLE_BASE_ID) {
      return json(500, { ok: false, error: 'Faltan variables de entorno AIRTABLE_API_KEY/AIRTABLE_BASE_ID en Netlify.' });
    }

    // ===========================
    // GET (listar)
    // ===========================
    if (event.httpMethod === 'GET') {
      const params = event.queryStringParameters || {};

      // ---------------------------
      // nextItem=1 -> calcula el próximo Autonumber (Item) solo para mostrar en UI.
      // NOTA: El campo Item NO se debe enviar en POST (Airtable lo asigna solo).
      // ---------------------------
      if (String(params.nextItem || '') === '1') {
        // Trae el último Item (desc) y suma 1.
        const path = `?pageSize=1&sort%5B0%5D%5Bfield%5D=Item&sort%5B0%5D%5Bdirection%5D=desc`;
        const r = await airtableFetch(path, { method: 'GET' });
        if (!r.ok) return json(r.status, { ok: false, error: r.data?.error || r.data, details: r.data });

        const rec0 = (r.data && r.data.records && r.data.records[0]) ? r.data.records[0] : null;
        const last = rec0 && rec0.fields && (rec0.fields.Item ?? rec0.fields['ITEM']);
        const next = (typeof last === 'number' && Number.isFinite(last)) ? (last + 1) : null;
        return json(200, { ok: true, nextItem: next, nextItemDisplay: next != null ? String(next) : '' });
      }

      const pageSize = Math.min(Number(params.pageSize || 50) || 50, 100);
      const offset = params.offset ? `&offset=${encodeURIComponent(params.offset)}` : '';
      const sort = '&sort%5B0%5D%5Bfield%5D=Item&sort%5B0%5D%5Bdirection%5D=asc';

      // Soporte simple de búsqueda (si el frontend envía q)
      const q = (params.q || '').trim();
      // Airtable REST no tiene "contains" universal sin fórmula; dejamos sin filtro para estabilidad
      const formula = q ? `&filterByFormula=${encodeURIComponent(`FIND(LOWER("${q}"), LOWER({Equipo}&" "&{Marca}&" "&{Modelo}&" "&{Serie}&" "&{Numero de Placa}&" "&{Servicio}))`)}` : '';

      const path = `?pageSize=${pageSize}${offset}${sort}${formula}`;
      const r = await airtableFetch(path, { method: 'GET' });
      if (!r.ok) return json(r.status, { ok: false, error: r.data?.error || r.data, details: r.data });

      return json(200, { ok: true, ...r.data });
    }

    // ===========================
    // POST (crear)
    // Body esperado:
    // { fields: {...}, certificates: [{filename, contentType, base64}, ...] }
    // ===========================
    if (event.httpMethod === 'POST') {
      const body = event.body ? JSON.parse(event.body) : {};
      const rawFields = body.fields || {};
      const certificates = Array.isArray(body.certificates) ? body.certificates : [];

      const { fields, removedFields } = mapAndNormalizeFields(rawFields);

      // Intento 1
      let created = await createRecord(fields);

      // Si falla por select inválido, intentamos “auto-recuperar” removiendo campos select uno a uno
      if (!created.ok && created.status === 422) {
        const errType = created.data?.error?.type || created.data?.error?.error?.type;
        if (errType === 'INVALID_MULTIPLE_CHOICE_OPTIONS') {
          // estrategia: remueve todos los campos select y reintenta (para no bloquear el guardado)
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
              mappedSent: fields,
            });
          }
        } else {
          return json(created.status, {
            ok: false,
            error: created.data?.error || created.data,
            details: created.data,
            removedFields,
            mappedSent: fields,
          });
        }
      } else if (!created.ok) {
        return json(created.status, {
          ok: false,
          error: created.data?.error || created.data,
          details: created.data,
          removedFields,
          mappedSent: fields,
        });
      }

      const recordId = created.data?.id || created.data?.records?.[0]?.id;
      if (!recordId) {
        return json(500, { ok: false, error: 'Registro creado pero no se obtuvo ID.', details: created.data });
      }

      // Adjuntos (opcional)
      const uploaded = [];
      for (const file of certificates) {
        if (!file || !file.base64) continue;
        const up = await contentUploadAttachment(recordId, AIRTABLE_CAL_CERT_FIELD, file);
        uploaded.push({ ok: up.ok, status: up.status, filename: file.filename || file.name, response: up.data });
      }

      // Compatibilidad: algunos frontends esperan "record".
      return json(200, { ok: true, record: created.data, data: created.data, uploaded, removedFields, mappedSent: fields });
    }

    // ===========================
    // PUT/PATCH (actualizar)
    // Body esperado: { id, fields }
    // ===========================
    if (event.httpMethod === 'PUT' || event.httpMethod === 'PATCH') {
      const body = event.body ? JSON.parse(event.body) : {};
      const id = body.id;
      if (!id) return json(400, { ok: false, error: 'Falta id para actualizar.' });

      const { fields, removedFields } = mapAndNormalizeFields(body.fields || {});
      const r = await updateRecord(id, fields);
      if (!r.ok) return json(r.status, { ok: false, error: r.data?.error || r.data, details: r.data, removedFields, mappedSent: fields });

      return json(200, { ok: true, record: r.data, data: r.data, removedFields, mappedSent: fields });
    }

    // ===========================
    // DELETE (eliminar)
    // ?id=recXXXX
    // ===========================
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
