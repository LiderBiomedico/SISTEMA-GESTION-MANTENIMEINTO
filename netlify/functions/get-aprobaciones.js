// netlify/functions/get-aprobaciones.js
// Devuelve todos los registros de Mantenimientos Preventivos y Correctivos
// con sus estados de aprobación para el módulo "Aprobar Mantenimientos"

const axios = require('axios');

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;

const HEADERS = {
  Authorization: `Bearer ${AIRTABLE_API_KEY}`,
  'Content-Type': 'application/json',
};

async function fetchAllRecords(tableName, fields) {
  const records = [];
  let offset = null;
  const encodedTable = encodeURIComponent(tableName);

  do {
    const params = new URLSearchParams();
    if (fields && fields.length) {
      fields.forEach(f => params.append('fields[]', f));
    }
    if (offset) params.append('offset', offset);

    const url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodedTable}?${params.toString()}`;
    const res = await axios.get(url, { headers: HEADERS });
    records.push(...(res.data.records || []));
    offset = res.data.offset || null;
  } while (offset);

  return records;
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  const camposComunes = [
    'Equipo', 'EQUIPO', 'Placa', 'PLACA',
    'Técnico', 'TECNICO', 'Fecha', 'FECHA',
    'Servicio', 'SERVICIO', 'Tipo',
    'Estado de aprobación', 'Observaciones aprobación',
    'Estado', 'ESTADO',
  ];

  try {
    const [preventivos, correctivos] = await Promise.all([
      fetchAllRecords('Mantenimientos Preventivos', camposComunes),
      fetchAllRecords('Mantenimientos Correctivos', camposComunes),
    ]);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ preventivos, correctivos }),
    };
  } catch (err) {
    const status = err?.response?.status || 500;
    const message = err?.response?.data?.error?.message || err.message || 'Error interno';
    return {
      statusCode: status,
      body: JSON.stringify({ error: message }),
    };
  }
};
