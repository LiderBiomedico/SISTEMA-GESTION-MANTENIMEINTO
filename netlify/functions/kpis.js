// =============================================================================
// netlify/functions/kpis.js - KPIs reales desde Airtable (versión simplificada)
// =============================================================================

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY || process.env.AIRTABLE_TOKEN || '';
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID || '';
const AIRTABLE_API     = 'https://api.airtable.com/v0';

function jsonResp(statusCode, body) {
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

// Usa EXACTAMENTE el mismo patrón que inventario.js (que ya funciona)
async function fetchInventario() {
  const records = [];
  let offset = null;

  do {
    // Pedir 100 registros por página con los campos necesarios
    let url = `${AIRTABLE_API}/${AIRTABLE_BASE_ID}/Inventario?pageSize=100`;
    url += `&fields[]=Equipo&fields[]=Servicio`;
    url += `&fields[]=Mantenimientos%20preventivo`;
    url += `&fields[]=Mantenimientos%20correctivos`;
    url += `&fields[]=Fecha%20Programada%20de%20Mantenimiento`;
    url += `&fields[]=Frecuencia%20de%20MTTO%20Preventivo`;
    if (offset) url += `&offset=${encodeURIComponent(offset)}`;

    console.log('[KPI] Fetching:', url.split('?')[0]);

    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
    });

    const text = await res.text();
    console.log('[KPI] HTTP', res.status, '| body length:', text.length);

    if (!res.ok) {
      console.error('[KPI] Airtable error:', text.slice(0, 300));
      break;
    }

    let data;
    try { data = JSON.parse(text); } catch(e) { console.error('[KPI] JSON parse error'); break; }

    const batch = data.records || [];
    console.log('[KPI] Batch size:', batch.length, '| offset:', data.offset || 'none');
    batch.forEach(r => records.push(r));
    offset = data.offset || null;

  } while (offset);

  return records;
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return jsonResp(204, {});

  if (!AIRTABLE_API_KEY) return jsonResp(500, { ok: false, error: 'API KEY faltante' });
  if (!AIRTABLE_BASE_ID) return jsonResp(500, { ok: false, error: 'BASE ID faltante' });

  try {
    const inventario = await fetchInventario();
    console.log('[KPI] Total registros obtenidos:', inventario.length);

    const totalEquipos = inventario.length;
    let totalPreventivos = 0, totalCorrectivos = 0, totalTerceros = 0;
    const equiposConManto = new Set();
    const hoy = new Date(); hoy.setHours(0,0,0,0);
    const en7d  = new Date(hoy); en7d.setDate(hoy.getDate() + 7);
    const en30d = new Date(hoy); en30d.setDate(hoy.getDate() + 30);
    let vencidos = 0, pendientes7d = 0, pendientes30d = 0;
    const porServicio = {};
    const mesesMap = {};

    // Preparar mapa de últimos 6 meses
    for (let i = 5; i >= 0; i--) {
      const d = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
      mesesMap[key] = {
        label: d.toLocaleDateString('es-CO', { month: 'short', year: '2-digit' }),
        prev: 0, corr: 0
      };
    }

    inventario.forEach(rec => {
      const f = rec.fields || {};
      const serv = f['Servicio'] || 'Sin servicio';
      const prev = Array.isArray(f['Mantenimientos preventivo'])  ? f['Mantenimientos preventivo']  : [];
      const corr = Array.isArray(f['Mantenimientos correctivos']) ? f['Mantenimientos correctivos'] : [];

      const prevTerceros = prev.filter(a => String(a.filename||'').toUpperCase().startsWith('TERC_'));
      const prevPropios  = prev.filter(a => !String(a.filename||'').toUpperCase().startsWith('TERC_'));

      totalPreventivos += prevPropios.length;
      totalCorrectivos += corr.length;
      totalTerceros    += prevTerceros.length;

      if (prev.length + corr.length > 0) equiposConManto.add(rec.id);

      if (!porServicio[serv]) porServicio[serv] = { equip: 0, prev: 0, corr: 0 };
      porServicio[serv].equip++;
      porServicio[serv].prev += prevPropios.length;
      porServicio[serv].corr += corr.length;

      // Fecha programada
      const fStr = f['Fecha Programada de Mantenimiento'];
      if (fStr) {
        try {
          const fd = new Date(fStr); fd.setHours(0,0,0,0);
          if (fd < hoy)      vencidos++;
          else if (fd <= en7d)  pendientes7d++;
          else if (fd <= en30d) pendientes30d++;
        } catch(e) {}
      }

      // Tendencia mensual
      [...prev, ...corr].forEach(att => {
        const fn = String(att.filename || '');
        const m = fn.match(/(\d{4}-\d{2})-\d{2}/);
        if (m && mesesMap[m[1]]) {
          if (corr.includes(att)) mesesMap[m[1]].corr++;
          else mesesMap[m[1]].prev++;
        }
      });
    });

    const equiposConPlan = inventario.filter(r => r.fields && r.fields['Frecuencia de MTTO Preventivo']).length;
    const cumplimiento   = equiposConPlan > 0 ? Math.round((equiposConManto.size / equiposConPlan) * 100) : 0;
    const totalReportes  = totalPreventivos + totalCorrectivos + totalTerceros;

    const topServicios = Object.entries(porServicio)
      .sort((a,b) => b[1].equip - a[1].equip)
      .slice(0, 10)
      .map(([nombre, datos]) => ({ nombre, ...datos }));

    console.log('[KPI] RESULTADO — equipos:', totalEquipos, '| prev:', totalPreventivos, '| corr:', totalCorrectivos, '| terc:', totalTerceros, '| cumplimiento:', cumplimiento+'%');

    return jsonResp(200, {
      ok: true,
      equipos: { total: totalEquipos },
      equiposTotal: totalEquipos,
      cumplimiento,
      pendientes: pendientes7d + vencidos,
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
      topServicios,
      distribucion: { preventivo: totalPreventivos, correctivo: totalCorrectivos, terceros: totalTerceros },
      tendencia: Object.values(mesesMap),
    });

  } catch (err) {
    console.error('[KPI] Excepcion:', err.message, err.stack);
    return jsonResp(500, { ok: false, error: 'Error: ' + err.message });
  }
};
