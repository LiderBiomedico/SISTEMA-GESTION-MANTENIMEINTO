/* ═══════════════════════════════════════════════════════════════
   DASHBOARD — KPIs de Aprobaciones
   
   Agregar esta función al script del dashboard (o al final del
   script inline en index.html, justo antes del cierre </script>
   del bloque del dashboard).
   
   También agregar la llamada  loadDashboardAprobar()  dentro de
   la función que carga el dashboard (switchModule o initDashboard).
   ═══════════════════════════════════════════════════════════════ */

async function loadDashboardAprobar() {
  // Si el módulo ya tiene datos cargados, los reutiliza
  if (typeof getAprobarStats === 'function') {
    const stats = getAprobarStats();
    // Solo actualiza si ya se cargaron datos (totalPrev > 0 o totalCorr > 0 indica que se cargó)
    const totalPend = stats.pendPrev + stats.pendCorr;
    const totalAprob = stats.aprobPrev + stats.aprobCorr;

    const setEl = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };

    setEl('dashKpiAprobPendVal', totalPend);
    setEl('dashKpiAprobPendDetalle', `⏳ ${stats.pendPrev} prev · ${stats.pendCorr} corr`);
    setEl('dashKpiAprobOkVal', totalAprob);
    setEl('dashKpiAprobOkDetalle', `✅ ${stats.aprobPrev} prev · ${stats.aprobCorr} corr`);
    return;
  }

  // Si el módulo no ha cargado aún, hacer una llamada rápida al backend
  try {
    const res = await axios.get('/.netlify/functions/get-aprobaciones');
    const prev = res.data.preventivos || [];
    const corr = res.data.correctivos || [];

    const countEst = (arr, e) => arr.filter(r => (r.fields['Estado de aprobación'] || 'Pendiente') === e).length;

    const pendPrev = countEst(prev, 'Pendiente');
    const pendCorr = countEst(corr, 'Pendiente');
    const aprobPrev = countEst(prev, 'Aprobado');
    const aprobCorr = countEst(corr, 'Aprobado');

    const setEl = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };

    setEl('dashKpiAprobPendVal', pendPrev + pendCorr);
    setEl('dashKpiAprobPendDetalle', `⏳ ${pendPrev} prev · ${pendCorr} corr`);
    setEl('dashKpiAprobOkVal', aprobPrev + aprobCorr);
    setEl('dashKpiAprobOkDetalle', `✅ ${aprobPrev} prev · ${aprobCorr} corr`);
  } catch (err) {
    console.warn('No se pudo cargar KPI aprobaciones:', err.message);
  }
}

// ── Llamar loadDashboardAprobar() al cargar el dashboard ─────
// Buscar la función donde se inicializa el dashboard y agregar:
//   loadDashboardAprobar();
//
// Ejemplo, si existe switchModule:
//   const _origSwitchModule = window.switchModule;
//   window.switchModule = function(mod) {
//     _origSwitchModule(mod);
//     if (mod === 'dashboard') loadDashboardAprobar();
//   };
//
// O agregar directamente al final del splash/init:
//   window.addEventListener('load', () => { loadDashboardAprobar(); });
