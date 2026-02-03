// netlify/functions/kpis.js
// Endpoint de compatibilidad para evitar 404 y TypeError en el dashboard.
// Devuelve KPIs mínimos con valores por defecto (0) mientras se conecta a tu lógica real.

exports.handler = async (event) => {
  const path = event.path || '';
  const method = event.httpMethod || 'GET';

  const payload = {
    equipos: { total: 0 },
    cumplimiento: 0,
    pendientes: 0,
    mtbf: 0,
    mttr: 0,
    costo: 0
  };

  if (method === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'GET,OPTIONS'
      },
      body: JSON.stringify({ ok: true })
    };
  }

  // Soporta /kpis/dashboard
  if (method === 'GET' && path.includes('/kpis/dashboard')) {
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify(payload)
    };
  }

  // Soporta /kpis (si tu UI lo usa)
  if (method === 'GET' && (path.endsWith('/kpis') || path.includes('/kpis?'))) {
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify(payload)
    };
  }

  return { statusCode: 404, body: 'Not found' };
};
