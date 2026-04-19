// netlify/functions/update-aprobacion.js
// Actualiza el campo "Estado de aprobación" de un registro de Mantenimiento
// Soporta tablas: "Mantenimientos Preventivos" y "Mantenimientos Correctivos"

const axios = require('axios');

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;

const ALLOWED_TABLES = ['Mantenimientos Preventivos', 'Mantenimientos Correctivos'];
const ALLOWED_ESTADOS = ['Aprobado', 'Rechazado', 'Pendiente'];

exports.handler = async (event) => {
  if (event.httpMethod !== 'PATCH') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'JSON inválido' }) };
  }

  const { recordId, tableName, estado, observacion = '' } = body;

  if (!recordId || !tableName || !estado) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Faltan parámetros requeridos: recordId, tableName, estado' }) };
  }
  if (!ALLOWED_TABLES.includes(tableName)) {
    return { statusCode: 400, body: JSON.stringify({ error: `tableName no permitido: ${tableName}` }) };
  }
  if (!ALLOWED_ESTADOS.includes(estado)) {
    return { statusCode: 400, body: JSON.stringify({ error: `estado no permitido: ${estado}` }) };
  }

  const fields = { 'Estado de aprobación': estado };
  if (observacion) fields['Observaciones aprobación'] = observacion;

  const encodedTable = encodeURIComponent(tableName);
  const url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodedTable}/${recordId}`;

  try {
    const res = await axios.patch(url,
      { fields },
      { headers: { Authorization: `Bearer ${AIRTABLE_API_KEY}`, 'Content-Type': 'application/json' } }
    );
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true, record: res.data }),
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
