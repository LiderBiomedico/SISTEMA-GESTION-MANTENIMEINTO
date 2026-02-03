// netlify/functions/kpis.js
// Placeholder para evitar 404 en /kpis/dashboard mientras se implementa el dashboard real.
// Responde con un JSON vacío y ok=true.

exports.handler = async (event) => {
  const path = event.path || '';
  const method = event.httpMethod || 'GET';

  // Preflight
  if (method === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'GET,POST,PUT,OPTIONS',
      },
      body: '',
    };
  }

  if (method === 'GET' && path.includes('/kpis/dashboard')) {
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ ok: true, data: {} }),
    };
  }

  return { statusCode: 404, body: 'Not found' };
};
