// =============================================================================
// netlify/functions/kpis.js - KPIs reales desde Airtable
// Calcula: total equipos, reportes preventivos/correctivos/terceros,
// cumplimiento del plan, mantenimientos por servicio y próximos vencimientos
// =============================================================================

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY || process.env.AIRTABLE_TOKEN || '';
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID || '';
const AIRTABLE_API     = 'https://api.airtable.com/v0';
const TABLE_INV        = 'Inventario';

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

async function fetchAllRecords(tableName, fields) {
  const records = [];
  let offset = null;
  const fieldParams = fields ? fields.map(f => `fields[]=${encodeURIComponent(f)}`).join('&') : '';

  do {
    let url = `${AIRTABLE_API}/${AIRTABLE_BASE_ID}/${encodeURIComponent(tableName)}?pageSize=100`;
    if (fieldParams) url += '&' + fieldParams;
    if (offset) url += '&offset=' + encodeURIComponent(offset);

    const res = await fetch(url, {
      headers: { 'Authorization': `Bearer ${AIRTABLE_API_KEY}` }
    });

    if (!res.ok) {
      console.error('[KPI] Error fetching', tableName, res.status);
      break;
    }

    const data = await res.json();
    (data.records || []).forEach(r => records.push(r));
    offset = data.offset || null;
  } while (offset);

  return records;
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return jsonResp(204, {});

  if (!AIRTABLE_API_KEY || !AIRTABLE_BASE_ID) {
    return jsonResp(500, { error: 'Configuración incompleta' });
  }

  try {
    // Obtener registros del inventario — pedimos solo los campos necesarios
    // Los adjuntos SÍ se incluyen al pedir el campo por nombre
    const invFields = [
      'Equipo','Servicio','Fecha Programada de Mantenimiento',
      'Mantenimientos preventivo','Mantenimientos correctivos',
      'Frecuencia de MTTO Preventivo'
    ];
    console.log('[KPI] Iniciando fetch inventario...');
    const inventario = await fetchAllRecords(TABLE_INV, invFields);
    console.log('[KPI] Total equipos inventario:', inventario.length);
    if (inventario.length > 0) {
      const sample = inventario[0].fields || {};
      console.log('[KPI] Campos del primer registro:', Object.keys(sample).join(', '));
      console.log('[KPI] Tiene preventivos?', Array.isArray(sample['Mantenimientos preventivo']), 'len:', (sample['Mantenimientos preventivo']||[]).length);
    }

    // ── Métricas básicas ────────────────────────────────────────────────
    const totalEquipos = inventario.length;

    // Contar reportes
    let totalPreventivos = 0;
    let totalCorrectivos = 0;
    let totalTerceros    = 0;
    let equiposConManto  = new Set();

    // Equipos con fecha programada vencida o próxima (pendientes)
    const hoy     = new Date();
    hoy.setHours(0,0,0,0);
    const en7dias = new Date(hoy); en7dias.setDate(hoy.getDate() + 7);
    const en30d   = new Date(hoy); en30d.setDate(hoy.getDate() + 30);

    let pendientes7d  = 0;
    let pendientes30d = 0;
    let vencidos      = 0;

    // Por servicio
    const porServicio = {};

    inventario.forEach(rec => {
      const f = rec.fields || {};

      // Reportes adjuntos
      // Buscar campos de adjuntos — nombre exacto primero, luego flexible
      let prev = Array.isArray(f['Mantenimientos preventivo']) ? f['Mantenimientos preventivo'] : [];
      let corr = Array.isArray(f['Mantenimientos correctivos']) ? f['Mantenimientos correctivos'] : [];
      // Fallback: búsqueda flexible
      if (!prev.length || !corr.length) {
        for (const [k, v] of Object.entries(f)) {
          if (Array.isArray(v) && v.length > 0) {
            const kl = k.toLowerCase();
            if (!prev.length && kl.includes('preventivo')) prev = v;
            else if (!corr.length && kl.includes('correctivo')) corr = v;
          }
        }
      }

      const prevTerceros = prev.filter(a => (a.filename||'').toUpperCase().startsWith('TERC_'));
      const prevPropios  = prev.filter(a => !(a.filename||'').toUpperCase().startsWith('TERC_'));

      totalPreventivos += prevPropios.length;
      totalCorrectivos += corr.length;
      totalTerceros    += prevTerceros.length;

      if (prev.length > 0 || corr.length > 0) equiposConManto.add(rec.id);

      // Servicio
      const serv = f['Servicio'] || 'Sin servicio';
      if (!porServicio[serv]) porServicio[serv] = { equip: 0, prev: 0, corr: 0 };
      porServicio[serv].equip++;
      porServicio[serv].prev += prevPropios.length;
      porServicio[serv].corr += corr.length;

      // Fecha programada
      const fechaStr = f['Fecha Programada de Mantenimiento'];
      if (fechaStr) {
        try {
          const fecha = new Date(fechaStr);
          fecha.setHours(0,0,0,0);
          if (fecha < hoy) {
            vencidos++;
          } else if (fecha <= en7dias) {
            pendientes7d++;
          } else if (fecha <= en30d) {
            pendientes30d++;
          }
        } catch(e) {}
      }
    });

    const totalReportes  = totalPreventivos + totalCorrectivos + totalTerceros;
    const equiposConPlan = inventario.filter(r => r.fields && r.fields['Frecuencia de MTTO Preventivo']).length;

    // Cumplimiento: equipos con al menos 1 reporte preventivo / equipos con plan
    const cumplimiento = equiposConPlan > 0
      ? Math.round((equiposConManto.size / equiposConPlan) * 100)
      : 0;

    // Top servicios con más equipos (para el dashboard)
    const topServicios = Object.entries(porServicio)
      .sort((a, b) => b[1].equip - a[1].equip)
      .slice(0, 8)
      .map(([nombre, datos]) => ({ nombre, ...datos }));

    // Distribución tipos de mantenimiento (para gráfica)
    const distribucion = {
      preventivo: totalPreventivos,
      correctivo: totalCorrectivos,
      terceros:   totalTerceros
    };

    // Tendencia mensual últimos 6 meses — contar reportes por mes
    const meses = {};
    for (let i = 5; i >= 0; i--) {
      const d = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
      meses[key] = { label: d.toLocaleDateString('es-CO', {month:'short', year:'2-digit'}), prev: 0, corr: 0 };
    }

    inventario.forEach(rec => {
      const f = rec.fields || {};
      let prev2 = Array.isArray(f['Mantenimientos preventivo']) ? f['Mantenimientos preventivo'] : [];
      let corr2 = Array.isArray(f['Mantenimientos correctivos']) ? f['Mantenimientos correctivos'] : [];
      if (!prev2.length || !corr2.length) {
        for (const [k, v] of Object.entries(f)) {
          if (Array.isArray(v) && v.length > 0) {
            const kl = k.toLowerCase();
            if (!prev2.length && kl.includes('preventivo')) prev2 = v;
            else if (!corr2.length && kl.includes('correctivo')) corr2 = v;
          }
        }
      }

      [...prev2, ...corr2].forEach(att => {
        const fn = att.filename || '';
        // Extraer fecha del nombre del archivo: *_2026-04-16_*
        const match = fn.match(/(\d{4}-\d{2})-\d{2}/);
        if (match && meses[match[1]]) {
          if (corr2.includes(att)) meses[match[1]].corr++;
          else meses[match[1]].prev++;
        }
      });
    });

    const tendencia = Object.values(meses);

    console.log('[KPI] totalEquipos:', totalEquipos, '| prev:', totalPreventivos, '| corr:', totalCorrectivos, '| terc:', totalTerceros, '| cumplimiento:', cumplimiento+'%');

    return jsonResp(200, {
      ok: true,
      // Compatibilidad con frontend existente
      equipos: { total: totalEquipos },
      equiposTotal: totalEquipos,
      cumplimiento,
      pendientes: pendientes7d + vencidos,
      mtbf: 0,
      mttr: 0,
      costo: 0,
      // Nuevos datos para dashboard enriquecido
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
      distribucion,
      tendencia,
    });

  } catch (err) {
    console.error('[KPI] Error:', err.message);
    return jsonResp(500, { error: 'Error calculando KPIs: ' + err.message });
  }
};
