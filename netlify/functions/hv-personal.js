// =============================================================================
// netlify/functions/hv-personal.js - CRUD Hojas de Vida del Personal
// Tabla Airtable: "HV personal"
// Campos: Name, Nombre, Numero de cedula, Hoja de vida (attachment), Servicio
// =============================================================================

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY || process.env.AIRTABLE_TOKEN || '';
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID || '';
const TABLE_NAME       = 'HV personal';
const AIRTABLE_API     = 'https://api.airtable.com/v0';

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

// Extrae un string legible del error de Airtable (puede ser string u objeto)
function extractError(err) {
  if (!err) return 'Error desconocido de Airtable';
  if (typeof err === 'string') return err;
  if (typeof err === 'object') return err.message || err.type || JSON.stringify(err);
  return String(err);
}

// ── GET: listar registros o traer uno por id ──
async function handleGet(params) {
  // GET ?id=recXXX → un solo registro
  if (params.id) {
    const url = `${AIRTABLE_API}/${AIRTABLE_BASE_ID}/${encodeURIComponent(TABLE_NAME)}/${params.id}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${AIRTABLE_API_KEY}` } });
    const data = await res.json();
    if (!res.ok) return json(res.status, { ok: false, error: extractError(data.error) });
    return json(200, { ok: true, record: data });
  }

  // GET → listar con paginación
  const pageSize = Math.min(parseInt(params.pageSize) || 50, 100);
  const qs = new URLSearchParams({ pageSize: String(pageSize) });
  if (params.offset) qs.set('offset', params.offset);

  // Construir fórmula de filtro
  let formulas = [];

  // Búsqueda de texto
  const q = (params.q || '').trim();
  if (q) {
    const safe = q.replace(/"/g, '\\"');
    formulas.push(`OR(SEARCH(LOWER("${safe}"),LOWER({Nombre}&"")),SEARCH(LOWER("${safe}"),LOWER({Servicio}&"")),SEARCH("${safe}",{Numero de cedula}&""))`);
  }

  // Filtro por servicio
  if (params.servicio) {
    const srv = params.servicio.replace(/"/g, '\\"');
    formulas.push(`{Servicio}="${srv}"`);
  }

  // Combinar fórmulas
  if (formulas.length === 1) {
    qs.set('filterByFormula', formulas[0]);
  } else if (formulas.length > 1) {
    qs.set('filterByFormula', `AND(${formulas.join(',')})`);
  }

  // Ordenar por Nombre
  qs.set('sort[0][field]', 'Nombre');
  qs.set('sort[0][direction]', 'asc');

  const url = `${AIRTABLE_API}/${AIRTABLE_BASE_ID}/${encodeURIComponent(TABLE_NAME)}?${qs}`;
  console.log('[hv-personal] GET url:', url);
  const res = await fetch(url, { headers: { Authorization: `Bearer ${AIRTABLE_API_KEY}` } });
  const data = await res.json();
  if (!res.ok) {
    console.error('[hv-personal] Airtable GET error:', JSON.stringify(data));
    return json(res.status, { ok: false, error: extractError(data.error) });
  }

  return json(200, {
    ok: true,
    records: data.records || [],
    offset: data.offset || null,
    count: (data.records || []).length,
  });
}

// ── POST: crear registro ──
async function handlePost(body) {
  const fields = body.fields || {};
  if (!fields.Nombre) return json(400, { ok: false, error: 'El campo Nombre es obligatorio.' });

  // Validar que Servicio sea uno de los permitidos
  const VALID_SERVICIO = ['BIOMEDICA', 'INFRAESTRUCTURA', 'MECANICOS'];
  if (fields.Servicio && !VALID_SERVICIO.includes(fields.Servicio)) {
    return json(400, { ok: false, error: 'Servicio invalido. Opciones: ' + VALID_SERVICIO.join(', ') });
  }

  // Numero de cedula: si viene como string numerico, convertir a number
  // (Airtable lo tiene como campo # Number)
  if (fields['Numero de cedula']) {
    const numVal = Number(fields['Numero de cedula']);
    if (!isNaN(numVal)) {
      fields['Numero de cedula'] = numVal;
    }
  }

  const url = `${AIRTABLE_API}/${AIRTABLE_BASE_ID}/${encodeURIComponent(TABLE_NAME)}`;
  console.log('[hv-personal] POST fields:', JSON.stringify(fields));
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${AIRTABLE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ fields }),
  });

  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch (e) { data = { raw: text }; }

  if (!res.ok) {
    console.error('[hv-personal] POST error:', res.status, text.slice(0, 500));
    return json(res.status, { ok: false, error: extractError(data.error) });
  }

  return json(200, { ok: true, record: data, recordId: data.id });
}

// ── PUT: actualizar registro ──
async function handlePut(body) {
  const id = body.id;
  const fields = body.fields || {};
  if (!id) return json(400, { ok: false, error: 'Falta id del registro.' });

  // Numero de cedula: convertir a numero si aplica
  if (fields['Numero de cedula']) {
    const numVal = Number(fields['Numero de cedula']);
    if (!isNaN(numVal)) {
      fields['Numero de cedula'] = numVal;
    }
  }

  const url = `${AIRTABLE_API}/${AIRTABLE_BASE_ID}/${encodeURIComponent(TABLE_NAME)}/${id}`;
  const res = await fetch(url, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${AIRTABLE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ fields }),
  });

  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch (e) { data = { raw: text }; }

  if (!res.ok) {
    console.error('[hv-personal] PUT error:', res.status, text.slice(0, 500));
    return json(res.status, { ok: false, error: extractError(data.error) });
  }

  return json(200, { ok: true, record: data });
}

// ── DELETE: eliminar registro ──
async function handleDelete(params) {
  const id = params.id;
  if (!id) return json(400, { ok: false, error: 'Falta id del registro.' });

  const url = `${AIRTABLE_API}/${AIRTABLE_BASE_ID}/${encodeURIComponent(TABLE_NAME)}/${id}`;
  const res = await fetch(url, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${AIRTABLE_API_KEY}` },
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    return json(res.status, { ok: false, error: extractError(data.error) });
  }

  return json(200, { ok: true, deleted: id });
}

// ── Handler principal ──
exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return json(200, {});

  if (!AIRTABLE_API_KEY || !AIRTABLE_BASE_ID) {
    return json(500, { ok: false, error: 'Variables AIRTABLE_API_KEY / AIRTABLE_BASE_ID no configuradas.' });
  }

  const params = event.queryStringParameters || {};

  try {
    switch (event.httpMethod) {
      case 'GET':
        return await handleGet(params);

      case 'POST': {
        let rawBody = event.body || '{}';
        if (event.isBase64Encoded) rawBody = Buffer.from(rawBody, 'base64').toString('utf8');
        const body = JSON.parse(rawBody);
        return await handlePost(body);
      }

      case 'PUT':
      case 'PATCH': {
        let rawBody = event.body || '{}';
        if (event.isBase64Encoded) rawBody = Buffer.from(rawBody, 'base64').toString('utf8');
        const body = JSON.parse(rawBody);
        return await handlePut(body);
      }

      case 'DELETE':
        return await handleDelete(params);

      default:
        return json(405, { ok: false, error: 'Metodo no permitido' });
    }
  } catch (e) {
    console.error('[hv-personal] Error:', e.message, e.stack);
    return json(500, { ok: false, error: e.message });
  }
};
