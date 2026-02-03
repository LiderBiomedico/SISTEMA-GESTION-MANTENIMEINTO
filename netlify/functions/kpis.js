// netlify/functions/kpis.js
// Endpoint mínimo para dashboard: evita errores si no existe KPI real

exports.handler = async (event) => {
  const path = event.path || '';
  const method = event.httpMethod || 'GET';

  if (method === 'OPTIONS') {
    return { statusCode: 200, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET,OPTIONS' } };
  }

  if (method === 'GET' && path.includes('/kpis/dashboard')) {
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({
        equipos: { total: 0 },
        cumplimiento: 0,
        pendientes: 0,
        mtbf: 0,
        mttr: 0,
        costo: 0
      })
    };
  }

  if (method === 'GET' && path.endsWith('/kpis')) {
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ ok: true })
    };
  }

  return { statusCode: 404, body: 'Not found' };
};
