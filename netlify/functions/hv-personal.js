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

// ── GET: listar registros o traer uno por id ──
async function handleGet(params) {
  // GET ?id=recXXX → un solo registro
  if (params.id) {
    const url = `${AIRTABLE_API}/${AIRTABLE_BASE_ID}/${encodeURIComponent(TABLE_NAME)}/${params.id}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${AIRTABLE_API_KEY}` } });
    const data = await res.json();
    if (!res.ok) return json(res.status, { ok: false, error: data.error || 'Error Airtable' });
    return json(200, { ok: true, record: data });
  }

  // GET → listar con paginación y búsqueda
  const pageSize = Math.min(parseInt(params.pageSize) || 50, 100);
  const qs = new URLSearchParams({ pageSize: String(pageSize) });
  if (params.offset) qs.set('offset', params.offset);

  // Búsqueda
  const q = (params.q || '').trim();
  if (q) {
    const safe = q.replace(/"/g, '\\"');
    const formula = `OR(
      SEARCH(LOWER("${safe}"), LOWER(ARRAYJOIN({Name},""))) > 0,
      SEARCH(LOWER("${safe}"), LOWER({Nombre}&"")) > 0,
      SEARCH(LOWER("${safe}"), LOWER({Numero de cedula}&"")) > 0,
      SEARCH(LOWER("${safe}"), LOWER({Servicio}&"")) > 0
    )`.replace(/\n\s*/g, '');
    qs.set('filterByFormula', formula);
  }

  // Filtro por servicio
  if (params.servicio) {
    const srv = params.servicio.replace(/"/g, '\\"');
    const srvFormula = `{Servicio} = "${srv}"`;
    if (q) {
      // Combinar con búsqueda
      qs.set('filterByFormula', `AND(${qs.get('filterByFormula')}, ${srvFormula})`);
    } else {
      qs.set('filterByFormula', srvFormula);
    }
  }

  // Ordenar por Nombre
  qs.set('sort[0][field]', 'Nombre');
  qs.set('sort[0][direction]', 'asc');

  const url = `${AIRTABLE_API}/${AIRTABLE_BASE_ID}/${encodeURIComponent(TABLE_NAME)}?${qs}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${AIRTABLE_API_KEY}` } });
  const data = await res.json();
  if (!res.ok) return json(res.status, { ok: false, error: data.error || 'Error Airtable' });

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
    return json(400, { ok: false, error: `Servicio inválido. Opciones: ${VALID_SERVICIO.join(', ')}` });
  }

  const url = `${AIRTABLE_API}/${AIRTABLE_BASE_ID}/${encodeURIComponent(TABLE_NAME)}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${AIRTABLE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ fields }),
  });

  const data = await res.json();
  if (!res.ok) return json(res.status, { ok: false, error: data.error || 'Error al crear registro' });

  return json(200, { ok: true, record: data, recordId: data.id });
}

// ── PUT: actualizar registro ──
async function handlePut(body) {
  const id = body.id;
  const fields = body.fields || {};
  if (!id) return json(400, { ok: false, error: 'Falta id del registro.' });

  const url = `${AIRTABLE_API}/${AIRTABLE_BASE_ID}/${encodeURIComponent(TABLE_NAME)}/${id}`;
  const res = await fetch(url, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${AIRTABLE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ fields }),
  });

  const data = await res.json();
  if (!res.ok) return json(res.status, { ok: false, error: data.error || 'Error al actualizar' });

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
    return json(res.status, { ok: false, error: data.error || 'Error al eliminar' });
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
        return json(405, { ok: false, error: 'Método no permitido' });
    }
  } catch (e) {
    console.error('[hv-personal] Error:', e.message, e.stack);
    return json(500, { ok: false, error: e.message });
  }
};
