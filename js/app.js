// ============================================================================
// js/app.js - HOTFIX: define openModal/closeModal (prevents "openModal is not defined")
// This file is SAFE to overwrite with your current js/app.js from previous patches,
// or you can COPY-PASTE the "MODAL FIX" block at the end of your existing js/app.js.
// ============================================================================

(() => {
  const __isLocal = ['localhost','127.0.0.1'].includes(window.location.hostname);
  const API_BASE_URL = (window.__ENV__ && window.__ENV__.API_BASE_URL)
    ? window.__ENV__.API_BASE_URL
    : (__isLocal ? 'http://localhost:9000/.netlify/functions' : '/.netlify/functions');

  // ------------------------------
  // Navegación: switchModule
  // ------------------------------
  if (typeof window.switchModule !== 'function') {
    window.switchModule = function switchModule(moduleName) {
      try {
        document.querySelectorAll('.module').forEach(m => m.classList.remove('active'));
        const moduleEl = document.getElementById(moduleName);
        if (moduleEl) moduleEl.classList.add('active');

        document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
        let navEl = null;
        if (typeof event !== 'undefined' && event && event.target && event.target.closest) {
          navEl = event.target.closest('.nav-item');
        }
        if (navEl) navEl.classList.add('active');

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

        window.loadModuleData(moduleName);
      } catch (e) {
        console.error('switchModule error:', e);
      }
    };
  }

  if (typeof window.loadModuleData !== 'function') {
    window.loadModuleData = function loadModuleData(moduleName) {
      console.log(`Cargando datos del módulo: ${moduleName}`);
      try {
        switch (moduleName) {
          case 'dashboard':
            if (typeof window.fetchDashboardData === 'function') window.fetchDashboardData();
            break;
          case 'inventario':
            if (typeof window.loadInventario === 'function') window.loadInventario();
            break;
        }
      } catch (e) {
        console.error('loadModuleData error:', e);
      }
    };
  }

  // ------------------------------
  // Dashboard: tolerante a fallos
  // ------------------------------
  if (typeof window.fetchDashboardData !== 'function') {
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
  }

  // ------------------------------
  // Inventario: loader simple
  // ------------------------------
  if (typeof window.loadInventario !== 'function') {
    window.loadInventario = async function loadInventario() {
      try {
        console.log('Cargando inventario...');
        const resp = await axios.get(`${API_BASE_URL}/inventario?pageSize=50`);
        const payload = resp.data || {};
        const rows = payload.data || [];

        const tbody = document.getElementById('inventarioTbody') || document.getElementById('inventarioBody');
        if (tbody) {
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
        }
      } catch (e) {
        console.error('Error cargando inventario:', e);
      }
    };
  }

  // ------------------------------
  // MODAL FIX: define openModal/closeModal
  // ------------------------------
  if (typeof window.openModal !== 'function') {
    window.openModal = function openModal(modalId) {
      const modal = document.getElementById(modalId);
      if (!modal) {
        console.warn(`openModal: no existe el elemento con id="${modalId}".`);
        return;
      }
      // Soporta dos estilos: class "active" o display
      modal.classList.add('active');
      if (getComputedStyle(modal).display === 'none') modal.style.display = 'flex';
      // Bloquea scroll
      document.body.style.overflow = 'hidden';
    };
  }

  if (typeof window.closeModal !== 'function') {
    window.closeModal = function closeModal(modalId) {
      const modal = document.getElementById(modalId);
      if (!modal) return;
      modal.classList.remove('active');
      // Si el modal usa display: none por defecto
      modal.style.display = 'none';
      document.body.style.overflow = '';
    };
  }

  // Cerrar al hacer click en fondo (si tu modal tiene clase "modal")
  document.addEventListener('click', (e) => {
    const target = e.target;
    if (target && target.classList && target.classList.contains('modal')) {
      target.classList.remove('active');
      target.style.display = 'none';
      document.body.style.overflow = '';
    }
  });

  document.addEventListener('DOMContentLoaded', () => {
    console.log('Sistema de Gestión de Mantenimiento Hospitalario iniciado');
  });
})();
