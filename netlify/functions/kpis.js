// netlify/functions/kpis.js - minimal KPI endpoint to avoid frontend errors
exports.handler = async () => {
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' },
    body: JSON.stringify({
      equipos: { total: 0 },
      cumplimiento: 0,
      pendientes: 0,
      mtbf: 0,
      mttr: 0,
      costo: 0
    })
  };
};
