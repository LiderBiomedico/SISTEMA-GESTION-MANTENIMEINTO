// =============================================================================
// netlify/functions/mantenimientos.js - HSLV
// Proxy entre el frontend y Airtable para leer/escribir los registros de
// mantenimientos preventivos y correctivos (adjuntos PDF en tabla Inventario).
// =============================================================================

const AIRTABLE_API_KEY  = process.env.AIRTABLE_API_KEY || process.env.AIRTABLE_TOKEN || '';
const AIRTABLE_BASE_ID  = process.env.AIRTABLE_BASE_ID || '';
const TABLE_NAME        = process.env.AIRTABLE_INVENTARIO_TABLE || 'Inventario';
const AIRTABLE_API      = 'https://api.airtable.com/v0';

function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
    },
    body: JSON.stringify(body),
  };
}

// ── Helpers ────────────────────────────────────────────────────────────────

async function airtableFetch(path, options = {}) {
  const url = `${AIRTABLE_API}/${AIRTABLE_BASE_ID}/${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${AIRTABLE_API_KEY}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch (_) { data = { error: text }; }
  if (!res.ok) throw Object.assign(new Error(data?.error?.message || res.statusText), { status: res.status, data });
  return data;
}

// Pagina todos los registros de Inventario (máx 100 por página)
async function getAllInventario(fields) {
  let records = [], offset = null;
  const fieldParam = fields ? `&fields[]=${fields.map(encodeURIComponent).join('&fields[]=')}` : '';
  do {
    const off = offset ? `&offset=${offset}` : '';
    const data = await airtableFetch(`${encodeURIComponent(TABLE_NAME)}?pageSize=100${fieldParam}${off}`);
    records = records.concat(data.records || []);
    offset = data.offset || null;
  } while (offset);
  return records;
}

// ── Handler ────────────────────────────────────────────────────────────────

exports.handler = async (event) => {
  // CORS preflight
  if (event.httpMethod === 'OPTIONS') return json(200, {});

  if (!AIRTABLE_API_KEY || !AIRTABLE_BASE_ID) {
    return json(500, { error: 'Configuración de Airtable incompleta (variables de entorno).' });
  }

  try {
    // ── GET /.netlify/functions/mantenimientos
    // Devuelve todos los registros de inventario con sus adjuntos de mantenimiento
    if (event.httpMethod === 'GET') {
      const records = await getAllInventario([
        'ITEM', 'EQUIPO', 'MARCA', 'MODELO', 'SERIE', 'PLACA', 'SERVICIO',
        'Mantenimientos preventivo', 'Mantenimientos correctivos',
        'FRECUENCIA DE MTTO PREVENTIVO', 'PROGRAMACION DE MANTENIMIENTO ANUAL',
      ]);

      // Aplanar adjuntos para facilitar consumo en el frontend
      const result = records.map(r => {
        const f = r.fields || {};
        const prev = (f['Mantenimientos preventivo'] || []).map(a => ({
          tipo: 'preventivo',
          id: a.id,
          filename: a.filename,
          url: a.url,
          size: a.size,
        }));
        const corr = (f['Mantenimientos correctivos'] || []).map(a => ({
          tipo: 'correctivo',
          id: a.id,
          filename: a.filename,
          url: a.url,
          size: a.size,
        }));
        return {
          recordId: r.id,
          item: f['ITEM'] || '',
          equipo: f['EQUIPO'] || '',
          marca: f['MARCA'] || '',
          serie: f['SERIE'] || '',
          placa: f['PLACA'] || '',
          servicio: f['SERVICIO'] || '',
          frecuencia: f['FRECUENCIA DE MTTO PREVENTIVO'] || '',
          programacion: f['PROGRAMACION DE MANTENIMIENTO ANUAL'] || '',
          adjuntos: [...prev, ...corr],
        };
      });

      return json(200, { records: result, total: result.length });
    }

    // ── POST /.netlify/functions/mantenimientos
    // Actualiza (PATCH) el campo adjunto del registro correspondiente en Airtable
    if (event.httpMethod === 'POST') {
      const body = JSON.parse(event.body || '{}');
      const { recordId, tipo, attachments } = body;

      if (!recordId) return json(400, { error: 'Falta el campo recordId.' });
      if (!tipo || !['preventivo', 'correctivo'].includes(tipo))
        return json(400, { error: 'El campo tipo debe ser "preventivo" o "correctivo".' });
      if (!Array.isArray(attachments) || attachments.length === 0)
        return json(400, { error: 'Debes enviar al menos un adjunto en attachments.' });

      const field = tipo === 'preventivo' ? 'Mantenimientos preventivo' : 'Mantenimientos correctivos';

      // Obtener adjuntos actuales para no sobreescribir los existentes
      const current = await airtableFetch(
        `${encodeURIComponent(TABLE_NAME)}/${recordId}?fields[]=${encodeURIComponent(field)}`
      );
      const existing = (current.fields?.[field] || []).map(a => ({ id: a.id }));

      // Airtable necesita {url} o {id} para cada adjunto
      const newAttachments = attachments.map(a => ({ url: a.url, filename: a.filename }));

      const patched = await airtableFetch(
        `${encodeURIComponent(TABLE_NAME)}/${recordId}`,
        {
          method: 'PATCH',
          body: JSON.stringify({
            fields: { [field]: [...existing, ...newAttachments] },
          }),
        }
      );

      return json(200, { success: true, record: patched });
    }

    return json(405, { error: `Método ${event.httpMethod} no soportado.` });

  } catch (err) {
    console.error('[mantenimientos]', err);
    return json(err.status || 500, { error: err.message || 'Error interno del servidor.' });
  }
};
