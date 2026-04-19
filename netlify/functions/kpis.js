// =============================================================================
// netlify/functions/kpis.js
// ESTRATEGIA: Llama al endpoint /inventario que YA FUNCIONA en producción
// en lugar de llamar directamente a Airtable (que falla silenciosamente)
// =============================================================================

function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
    },
    body: JSON.stringify(body),
  };
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return json(204, {});

  // ── Paso 1: Obtener inventario usando la función inventario.js que ya funciona ──
  // Llamamos al handler de inventario directamente (mismo proceso Node)
  let inventario = [];
  try {
    const inventarioHandler = require('./inventario');
    
    // Simular el evento GET con pageSize=200
    const fakeEvent = {
      httpMethod: 'GET',
      queryStringParameters: { pageSize: '100' },
      headers: event.headers || {},
      body: null,
    };

    // Primera página
    const resp1 = await inventarioHandler.handler(fakeEvent);
    const data1 = JSON.parse(resp1.body || '{}');
    console.log('[KPI] Página 1:', (data1.records||[]).length, 'registros | offset:', data1.offset||'none');
    inventario = [...(data1.records || [])];

    // Paginar si hay más
    if (data1.offset) {
      const fakeEvent2 = {
        httpMethod: 'GET',
        queryStringParameters: { pageSize: '100', offset: data1.offset },
        headers: event.headers || {},
        body: null,
      };
      const resp2 = await inventarioHandler.handler(fakeEvent2);
      const data2 = JSON.parse(resp2.body || '{}');
      console.log('[KPI] Página 2:', (data2.records||[]).length, 'registros');
      inventario = [...inventario, ...(data2.records || [])];
      
      // Página 3 si hay
      if (data2.offset) {
        const fakeEvent3 = {
          httpMethod: 'GET',
          queryStringParameters: { pageSize: '100', offset: data2.offset },
          headers: event.headers || {},
          body: null,
        };
        const resp3 = await inventarioHandler.handler(fakeEvent3);
        const data3 = JSON.parse(resp3.body || '{}');
        console.log('[KPI] Página 3:', (data3.records||[]).length, 'registros');
        inventario = [...inventario, ...(data3.records || [])];
      }
    }

    console.log('[KPI] Total equipos cargados:', inventario.length);

  } catch (err) {
    console.error('[KPI] Error cargando inventario:', err.message);
    return json(500, { ok: false, error: 'Error cargando inventario: ' + err.message, equiposTotal: 0 });
  }

  // ── Paso 2: Calcular métricas ─────────────────────────────────────────────
  const totalEquipos = inventario.length;
  let totalPreventivos = 0, totalCorrectivos = 0, totalTerceros = 0;
  const equiposConManto = new Set();

  const hoy   = new Date(); hoy.setHours(0,0,0,0);
  const en7d  = new Date(hoy); en7d.setDate(hoy.getDate() + 7);
  const en30d = new Date(hoy); en30d.setDate(hoy.getDate() + 30);
  let vencidos = 0, pendientes7d = 0, pendientes30d = 0;

  const porServicio = {};

  // Mapa últimos 6 meses
  const mesesMap = {};
  for (let i = 5; i >= 0; i--) {
    const d   = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    mesesMap[key] = {
      label: d.toLocaleDateString('es-CO', { month: 'short', year: '2-digit' }),
      prev: 0, corr: 0,
    };
  }

  // Contadores de aprobados/pendientes
  let prevAprobados = 0, corrAprobados = 0;

  // Helper: mapa de IDs aprobados a partir del campo de aprobación
  function buildAprobadosSet(list) {
    const s = new Set();
    (list || []).forEach(a => {
      const m = String(a.filename || '').match(/^APROBADO_([^_]+)_/);
      if (m) s.add(m[1]);
    });
    return s;
  }

  inventario.forEach(rec => {
    const f    = rec.fields || {};
    const prev = Array.isArray(f['Mantenimientos preventivo'])  ? f['Mantenimientos preventivo']  : [];
    const corr = Array.isArray(f['Mantenimientos correctivos']) ? f['Mantenimientos correctivos'] : [];

    const prevTerceros = prev.filter(a => String(a.filename||'').toUpperCase().startsWith('TERC_'));
    const prevPropios  = prev.filter(a => !String(a.filename||'').toUpperCase().startsWith('TERC_'));

    totalPreventivos += prevPropios.length;
    totalCorrectivos += corr.length;
    totalTerceros    += prevTerceros.length;
    if (prev.length + corr.length > 0) equiposConManto.add(rec.id);

    // Contar aprobados
    const aprPrevSet = buildAprobadosSet(f['Mantenimiento Aprobado']);
    const aprCorrSet = buildAprobadosSet(f['Mantenimiento Correctivo Aprobado']);
    prevPropios.forEach(a => { if (a.id && aprPrevSet.has(a.id)) prevAprobados++; });
    corr.forEach(a       => { if (a.id && aprCorrSet.has(a.id)) corrAprobados++; });

    const serv = f['Servicio'] || 'Sin servicio';
    if (!porServicio[serv]) porServicio[serv] = { equip: 0, prev: 0, corr: 0 };
    porServicio[serv].equip++;
    porServicio[serv].prev += prevPropios.length;
    porServicio[serv].corr += corr.length;

    const fStr = f['Fecha Programada de Mantenimiento'];
    if (fStr) {
      try {
        const fd = new Date(fStr); fd.setHours(0,0,0,0);
        if      (fd < hoy)      vencidos++;
        else if (fd <= en7d)    pendientes7d++;
        else if (fd <= en30d)   pendientes30d++;
      } catch(e) {}
    }

    [...prev, ...corr].forEach(att => {
      const fn = String(att.filename || '');
      const m  = fn.match(/(\d{4}-\d{2})-\d{2}/);
      if (m && mesesMap[m[1]]) {
        if (corr.includes(att)) mesesMap[m[1]].corr++;
        else                    mesesMap[m[1]].prev++;
      }
    });
  });

  const equiposConPlan = inventario.filter(r =>
    r.fields && (r.fields['Frecuencia de MTTO Preventivo'] || r.fields['Frecuencia de Mantenimiento'])
  ).length;

  const cumplimiento  = equiposConPlan > 0
    ? Math.round((equiposConManto.size / equiposConPlan) * 100)
    : 0;
  const totalReportes = totalPreventivos + totalCorrectivos + totalTerceros;

  const topServicios = Object.entries(porServicio)
    .sort((a, b) => b[1].equip - a[1].equip)
    .slice(0, 10)
    .map(([nombre, datos]) => ({ nombre, ...datos }));

  console.log(`[KPI] equipos:${totalEquipos} prev:${totalPreventivos} corr:${totalCorrectivos} terc:${totalTerceros} cumpl:${cumplimiento}%`);

  const prevPendientes = totalPreventivos - prevAprobados;
  const corrPendientes = totalCorrectivos - corrAprobados;

  return json(200, {
    ok: true,
    equipos: { total: totalEquipos },
    equiposTotal:    totalEquipos,
    cumplimiento,
    pendientes:      pendientes7d + vencidos,
    mtbf: 0, mttr: 0, costo: 0,
    totalReportes,
    totalPreventivos,
    totalCorrectivos,
    totalTerceros,
    equiposConManto: equiposConManto.size,
    equiposConPlan,
    vencidos,
    pendientes7d,
    pendientes30d,
    // KPIs de aprobación
    prevAprobados,
    prevPendientes,
    corrAprobados,
    corrPendientes,
    topServicios,
    distribucion: {
      preventivo: totalPreventivos,
      correctivo: totalCorrectivos,
      terceros:   totalTerceros,
    },
    tendencia: Object.values(mesesMap),
  });
};
