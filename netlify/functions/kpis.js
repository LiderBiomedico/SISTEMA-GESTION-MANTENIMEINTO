// netlify/functions/kpis.js
// Endpoint mínimo para evitar errores del dashboard: /kpis/dashboard y /kpis

exports.handler = async (event) => {
  const path = event.path || '';
  const method = event.httpMethod || 'GET';

  if (method === 'OPTIONS') {
    return { statusCode: 200, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET,OPTIONS' } };
  }

  // /kpis/dashboard
  if (method === 'GET' && path.includes('/kpis/dashboard')) {
    const data = {
      equipos: { total: 0 },
      cumplimiento: 0,
      pendientes: 0,
      mtbf: 0,
      mttr: 0,
      costo: 0
    };

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify(data)
    };
  }

  // /kpis (opcional)
  if (method === 'GET' && path.endsWith('/kpis')) {
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ ok: true })
    };
  }

  return { statusCode: 404, body: 'Not found' };
};
