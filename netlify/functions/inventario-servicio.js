// =============================================================================
// netlify/functions/inventario-servicio.js
// GET ?action=servicios  → lista de servicios únicos del inventario
// GET ?action=equipos&servicio=XXX → equipos de ese servicio (Equipo, Marca, Modelo, Serie, Sede)
// =============================================================================

const AIRTABLE_API_KEY  = process.env.AIRTABLE_API_KEY  || process.env.AIRTABLE_TOKEN || '';
const AIRTABLE_BASE_ID  = process.env.AIRTABLE_BASE_ID  || '';
const TABLE_NAME        = process.env.AIRTABLE_INVENTARIO_TABLE || 'Inventario';
const AIRTABLE_API      = 'https://api.airtable.com/v0';

function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Methods': 'GET,OPTIONS',
    },
    body: JSON.stringify(body),
  };
}

async function airtableFetch(path, opts = {}) {
  const url = `${AIRTABLE_API}/${AIRTABLE_BASE_ID}/${encodeURIComponent(TABLE_NAME)}${path}`;
  const res = await fetch(url, {
    ...opts,
    headers: {
      Authorization: `Bearer ${AIRTABLE_API_KEY}`,
      'Content-Type': 'application/json',
      ...(opts.headers || {}),
    },
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Airtable ${res.status}: ${err}`);
  }
  return res.json();
}

// Trae TODOS los registros paginando (para obtener servicios únicos)
async function fetchAllRecords(fields, formula) {
  const fieldsParam = fields.map(f => `fields[]=${encodeURIComponent(f)}`).join('&');
  const formulaParam = formula ? `&filterByFormula=${encodeURIComponent(formula)}` : '';
  let records = [];
  let offset = '';
  do {
    const offsetParam = offset ? `&offset=${offset}` : '';
    const path = `?pageSize=100&${fieldsParam}${formulaParam}${offsetParam}`;
    const data = await airtableFetch(path, { method: 'GET' });
    records = records.concat(data.records || []);
    offset = data.offset || '';
  } while (offset);
  return records;
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return json(200, {});

  const params = event.queryStringParameters || {};
  const action = params.action || '';

  try {
    // ── GET ?action=servicios ─────────────────────────────────────────────────
    if (action === 'servicios') {
      const records = await fetchAllRecords(['Servicio', 'Sede'], '');
      const serviciosSet = new Set();
      records.forEach(r => {
        const s = (r.fields['Servicio'] || '').trim();
        if (s) serviciosSet.add(s);
      });
      const servicios = Array.from(serviciosSet).sort((a, b) => a.localeCompare(b, 'es'));
      return json(200, { servicios });
    }

    // ── GET ?action=equipos&servicio=XXX ──────────────────────────────────────
    if (action === 'equipos') {
      const servicio = (params.servicio || '').trim();
      if (!servicio) return json(400, { error: 'Falta parámetro servicio' });

      const formula = `{Servicio}="${servicio.replace(/"/g, '\\"')}"`;
      const records = await fetchAllRecords(
        ['Equipo', 'Marca', 'Modelo', 'Serie', 'Sede', 'Servicio', 'Item', 'Numero de Placa'],
        formula
      );

      const equipos = records.map(r => ({
        id: r.id,
        item: r.fields['Item'] || '',
        equipo: r.fields['Equipo'] || '',
        marca: r.fields['Marca'] || '',
        modelo: r.fields['Modelo'] || '',
        serie: r.fields['Serie'] || '',
        sede: r.fields['Sede'] || '',
        servicio: r.fields['Servicio'] || '',
        placa: r.fields['Numero de Placa'] || '',
      }));

      // Ordenar por Item numérico
      equipos.sort((a, b) => Number(a.item) - Number(b.item));

      return json(200, { servicio, total: equipos.length, equipos });
    }

    return json(400, { error: 'Acción no reconocida. Use ?action=servicios o ?action=equipos&servicio=XXX' });

  } catch (err) {
    console.error('[inventario-servicio]', err.message);
    return json(500, { error: err.message });
  }
};
