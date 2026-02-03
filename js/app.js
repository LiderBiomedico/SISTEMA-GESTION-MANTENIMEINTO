// ============================================================================
// app.js (Netlify static) - FIX: define switchModule/loadModuleData + Inventario
// - Evita: "switchModule is not defined"
// - Mantiene helpers para Inventario (loadInventario/crear/actualizar)
// ============================================================================

(() => {
  const __isLocal = ['localhost','127.0.0.1'].includes(window.location.hostname);
  const API_BASE_URL = (window.__ENV__ && window.__ENV__.API_BASE_URL)
    ? window.__ENV__.API_BASE_URL
    : (__isLocal ? 'http://localhost:9000/.netlify/functions' : '/.netlify/functions');

  // ------------------------------
  // Navegación: switchModule
  // ------------------------------
  window.switchModule = function switchModule(moduleName) {
    try {
      // 1) Activar módulo
      document.querySelectorAll('.module').forEach(m => m.classList.remove('active'));
      const moduleEl = document.getElementById(moduleName);
      if (moduleEl) moduleEl.classList.add('active');

      // 2) Activar item del menú (si existe)
      document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
      let navEl = null;
      // Inline onclick suele exponer "event" global; pero no siempre.
      if (typeof event !== 'undefined' && event && event.target && event.target.closest) {
        navEl = event.target.closest('.nav-item');
      }
      if (navEl) navEl.classList.add('active');

      // 3) Título del módulo
      const titles = {
        dashboard: '📊 Dashboard Ejecutivo',
        equipos: '🔧 Gestión de Equipos',
        mantenimientos: '📋 Historial de Intervenciones',
        planificacion: '📅 Planificación y Programación',
        repuestos: '📦 Gestión de Repuestos',
        documentos: '📄 Gestión Documental',
        kpis: '📈 Indicadores de Desempeño',
        reportes: '📑 Reportes e Informes',
        auditoria: '🔍 Auditoría y Trazabilidad',
        inventario: '🗂️ Inventario Maestro'
      };
      const titleEl = document.getElementById('moduleTitle');
      if (titleEl) titleEl.textContent = titles[moduleName] || moduleName;

      // 4) Cargar datos del módulo
      window.loadModuleData(moduleName);
    } catch (e) {
      console.error('switchModule error:', e);
    }
  };

  window.loadModuleData = function loadModuleData(moduleName) {
    console.log(`Cargando datos del módulo: ${moduleName}`);
    try {
      switch (moduleName) {
        case 'dashboard':
          if (typeof window.initializeDashboard === 'function') window.initializeDashboard();
          break;
        case 'inventario':
          if (typeof window.loadInventario === 'function') window.loadInventario();
          break;
        case 'equipos':
          if (typeof window.loadEquipos === 'function') window.loadEquipos();
          break;
        case 'mantenimientos':
          if (typeof window.loadMantenimientos === 'function') window.loadMantenimientos();
          break;
        case 'kpis':
          if (typeof window.loadKPIs === 'function') window.loadKPIs();
          break;
      }
    } catch (e) {
      console.error('loadModuleData error:', e);
    }
  };

  // ------------------------------
  // Dashboard: evitar roturas si falta endpoint
  // ------------------------------
  window.fetchDashboardData = async function fetchDashboardData() {
    try {
      const resp = await axios.get(`${API_BASE_URL}/kpis/dashboard`);
      const data = resp.data || {};
      const equiposTotal = (data.equipos && typeof data.equipos.total !== 'undefined') ? data.equipos.total : (data.equiposTotal ?? 0);

      const setText = (id, value) => { const el = document.getElementById(id); if (el) el.textContent = value; };
      setText('kpiEquipos', equiposTotal);
      setText('kpiCumplimiento', `${data.cumplimiento ?? 0}%`);
      setText('kpiPendientes', data.pendientes ?? 0);
      setText('kpiMTBF', `${Math.round(data.mtbf ?? 0)}h`);
      setText('kpiMTTR', `${Number(data.mttr ?? 0).toFixed(1)}h`);
      setText('kpiCosto', `$${(Number(data.costo ?? 0) / 1000).toFixed(0)}K`);
    } catch (e) {
      console.warn('Dashboard sin datos (ok):', e?.message || e);
    }
  };

  // ------------------------------
  // Inventario: loader + CRUD
  // ------------------------------
  window.loadInventario = async function loadInventario() {
    try {
      console.log('Cargando inventario...');
      const resp = await axios.get(`${API_BASE_URL}/inventario?pageSize=50`);
      const payload = resp.data || {};
      const rows = payload.data || [];

      // contador si existe
      const countEl = document.getElementById('inventarioCount');
      if (countEl) countEl.textContent = String(payload.count ?? rows.length ?? 0);

      // tbody
      const tbody = document.getElementById('inventarioTbody') || document.getElementById('inventarioBody');
      if (!tbody) return;

      tbody.innerHTML = '';
      for (const r of rows) {
        const f = r.fields || {};
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${f.Item ?? f.ITEM ?? ''}</td>
          <td>${f.Equipo ?? f.EQUIPO ?? ''}</td>
          <td>${f.Marca ?? f.MARCA ?? ''}</td>
          <td>${f.Modelo ?? f.MODELO ?? ''}</td>
          <td>${f.Serie ?? f.SERIE ?? ''}</td>
          <td>${f['Numero de Placa'] ?? f.PLACA ?? ''}</td>
          <td>${f.Servicio ?? f.SERVICIO ?? ''}</td>
          <td>${f['Ubicación'] ?? f['UBICACIÓN'] ?? f.UBICACION ?? ''}</td>
          <td>${f['Vida Util'] ?? f['VIDA UTIL'] ?? f['VIDA ÚTIL'] ?? ''}</td>
          <td>${f['Próx. MTTO'] ?? f['PROX. MTTO'] ?? ''}</td>
          <td></td>
        `;
        tbody.appendChild(tr);
      }
    } catch (e) {
      console.error('Error cargando inventario:', e);
      const msg = document.getElementById('inventarioStatus');
      if (msg) msg.textContent = 'Error cargando inventario. Revisa configuración de Airtable en Netlify.';
    }
  };

  window.crearInventario = async function crearInventario(fields) {
    const resp = await axios.post(`${API_BASE_URL}/inventario`, { fields });
    return resp.data;
  };

  window.actualizarInventario = async function actualizarInventario(id, fields) {
    const resp = await axios.put(`${API_BASE_URL}/inventario`, { id, fields });
    return resp.data;
  };

  // ------------------------------
  // Init
  // ------------------------------
  document.addEventListener('DOMContentLoaded', () => {
    console.log('Sistema de Gestión de Mantenimiento Hospitalario iniciado');
    // Si hay dashboard en DOM, intenta cargar (no rompe si falla)
    if (document.getElementById('dashboard')) {
      window.fetchDashboardData();
    }
  });
})();
