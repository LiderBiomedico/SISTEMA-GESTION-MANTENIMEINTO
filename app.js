// ============================================================================
// SISTEMA DE GESTIÓN DE MANTENIMIENTO HOSPITALARIO
// Frontend Logic - app.js (patched for Netlify static hosting)
// ============================================================================

// ----------------------------------------------------------------------------
// CONFIG (NO usa process.env en navegador)
// ----------------------------------------------------------------------------
const __isLocal = ['localhost', '127.0.0.1'].includes(window.location.hostname);

// Permite override si en index.html defines window.__ENV__ = { API_BASE_URL: "..." }
const API_BASE_URL = (window.__ENV__ && window.__ENV__.API_BASE_URL)
  ? window.__ENV__.API_BASE_URL
  : (__isLocal ? 'http://localhost:9000/.netlify/functions' : '/.netlify/functions');

// ⚠️ Por seguridad NO se debe acceder a Airtable directo desde el navegador.
// Este bloque se deja “inofensivo” para no romper partes viejas del código.
const AIRTABLE_CONFIG = {
  apiKey: '',
  baseId: '',
  tables: {
    equipos: 'Equipos',
    mantenimientos: 'Mantenimientos',
    planificacion: 'Planificacion',
    repuestos: 'Repuestos',
    kpis: 'KPIs',
    auditoria: 'Auditoria'
  }
};

// ============================================================================
// MÓDULO DE NAVEGACIÓN
// ============================================================================

function switchModule(moduleName) {
  document.querySelectorAll('.module').forEach(m => m.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

  document.getElementById(moduleName).classList.add('active');
  event.target.closest('.nav-item').classList.add('active');

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

  loadModuleData(moduleName);
}

function loadModuleData(moduleName) {
  console.log(`Cargando datos del módulo: ${moduleName}`);

  switch (moduleName) {
    case 'dashboard':
      initializeDashboard();
      break;
    case 'equipos':
      loadEquipos();
      break;
    case 'mantenimientos':
      loadMantenimientos();
      break;
    case 'kpis':
      loadKPIs();
      break;
    case 'inventario':
      // Si tu inventario está implementado en otro archivo, igual no rompe.
      if (typeof loadInventario === 'function') loadInventario();
      break;
  }
}

// ============================================================================
// DASHBOARD EJECUTIVO
// ============================================================================

function initializeDashboard() {
  const alert = document.getElementById('dashboardAlert');
  if (alert) {
    alert.style.display = 'block';
    setTimeout(() => alert.style.display = 'none', 5000);
  }

  initMTBFChart();
  initComplianceChart();
  initMaintenanceTypeChart();

  fetchDashboardData();
}

function initMTBFChart() {
  const ctx = document.getElementById('mtbfChart');
  if (!ctx || typeof Chart === 'undefined') return;

  new Chart(ctx, {
    type: 'line',
    data: {
      labels: ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'],
      datasets: [
        { label: 'MTBF (Horas)', data: [2400,2500,2450,2600,2700,2750,2800,2850,2900,2920,2870,2847], borderColor: '#0d47a1', backgroundColor: 'rgba(13,71,161,0.05)', tension: 0.4, fill: true },
        { label: 'MTTR (Horas)', data: [5.2,5.1,5.0,4.9,4.8,4.7,4.6,4.5,4.4,4.3,4.2,4.2], borderColor: '#ff6f00', backgroundColor: 'rgba(255,111,0,0.05)', tension: 0.4, fill: true }
      ]
    },
    options: { responsive: true }
  });
}

function initComplianceChart() {
  const ctx = document.getElementById('complianceChart');
  if (!ctx || typeof Chart === 'undefined') return;

  new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Cumplido','Pendiente'],
      datasets: [{ data: [92,8], backgroundColor: ['#2e7d32','#c62828'] }]
    },
    options: { responsive: true, plugins: { legend: { position: 'bottom' } } }
  });
}

function initMaintenanceTypeChart() {
  const ctx = document.getElementById('maintenanceTypeChart');
  if (!ctx || typeof Chart === 'undefined') return;

  new Chart(ctx, {
    type: 'pie',
    data: {
      labels: ['Preventivo','Correctivo','Calibración'],
      datasets: [{ data: [55,35,10], backgroundColor: ['#1565c0','#ff6f00','#2e7d32'] }]
    },
    options: { responsive: true, plugins: { legend: { position: 'right' } } }
  });
}

async function fetchDashboardData() {
  try {
    const response = await axios.get(`${API_BASE_URL}/kpis/dashboard`);
    const data = response.data || {};

    // valores seguros (evita "Cannot read properties of undefined (reading 'total')")
    const equiposTotal = (data.equipos && typeof data.equipos.total !== 'undefined') ? data.equipos.total : (data.equiposTotal ?? 0);
    const cumplimiento = (typeof data.cumplimiento !== 'undefined') ? data.cumplimiento : 0;
    const pendientes = (typeof data.pendientes !== 'undefined') ? data.pendientes : 0;
    const mtbf = (typeof data.mtbf !== 'undefined') ? data.mtbf : 0;
    const mttr = (typeof data.mttr !== 'undefined') ? data.mttr : 0;
    const costo = (typeof data.costo !== 'undefined') ? data.costo : 0;

    const setText = (id, value) => { const el = document.getElementById(id); if (el) el.textContent = value; };

    setText('kpiEquipos', equiposTotal);
    setText('kpiCumplimiento', `${cumplimiento}%`);
    setText('kpiPendientes', pendientes);
    setText('kpiMTBF', `${Math.round(mtbf)}h`);
    setText('kpiMTTR', `${Number(mttr).toFixed(1)}h`);
    setText('kpiCosto', `$${(Number(costo) / 1000).toFixed(0)}K`);
  } catch (error) {
    console.error('Error cargando dashboard:', error);
    // no rompe la app si falla dashboard
  }
}

// ============================================================================
// GESTIÓN DE EQUIPOS / MANTENIMIENTOS / KPIs
// ============================================================================

async function loadEquipos() {
  try {
    const response = await axios.get(`${API_BASE_URL}/equipos`);
    console.log('Equipos cargados:', response.data);
  } catch (error) {
    console.error('Error cargando equipos:', error);
  }
}

async function loadMantenimientos() {
  try {
    const response = await axios.get(`${API_BASE_URL}/mantenimientos`);
    console.log('Mantenimientos cargados:', response.data);
  } catch (error) {
    console.error('Error cargando mantenimientos:', error);
  }
}

async function loadKPIs() {
  try {
    await axios.get(`${API_BASE_URL}/kpis`);
    const ctx = document.getElementById('kpiDetailChart');
    if (!ctx || typeof Chart === 'undefined') return;

    new Chart(ctx, {
      type: 'radar',
      data: {
        labels: ['MTBF','MTTR','Cumplimiento','Disponibilidad','Eficiencia','Confiabilidad'],
        datasets: [{ label: 'Desempeño Actual', data: [85,90,94,92,88,86], borderColor: '#0d47a1', backgroundColor: 'rgba(13,71,161,0.1)', borderWidth: 2 }]
      },
      options: { responsive: true, scales: { r: { beginAtZero: true, max: 100 } } }
    });
  } catch (error) {
    console.error('Error cargando KPIs:', error);
  }
}

// ============================================================================
// MODALES
// ============================================================================

function openModal(modalId) {
  const el = document.getElementById(modalId);
  if (el) el.classList.add('active');
}

function closeModal(modalId) {
  const el = document.getElementById(modalId);
  if (el) el.classList.remove('active');
}

document.addEventListener('click', (e) => {
  if (e.target.classList && e.target.classList.contains('modal')) {
    e.target.classList.remove('active');
  }
});

// ============================================================================
// CLASE AirtableAPI (deshabilitada por seguridad)
// ============================================================================

class AirtableAPI {
  constructor(apiKey, baseId) {
    this.apiKey = apiKey;
    this.baseId = baseId;
    this.baseUrl = baseId ? `https://api.airtable.com/v0/${baseId}` : '';
  }

  async getRecords(tableName, params = {}) {
    throw new Error('Airtable direct access is disabled. Use Netlify Functions instead.');
  }
  async createRecord(tableName, fields) { throw new Error('Disabled'); }
  async updateRecord(tableName, recordId, fields) { throw new Error('Disabled'); }
  async deleteRecord(tableName, recordId) { throw new Error('Disabled'); }
}

// ============================================================================
// INICIALIZACIÓN
// ============================================================================

document.addEventListener('DOMContentLoaded', () => {
  console.log('Sistema de Gestión de Mantenimiento Hospitalario iniciado');
  // Si existe el dashboard en tu HTML, inicializa; si no, no rompe.
  if (document.getElementById('dashboard')) {
    initializeDashboard();
  }

  setInterval(() => {
    const active = document.querySelector('.module.active');
    const activeModule = active ? active.id : '';
    if (activeModule === 'dashboard') fetchDashboardData();
  }, 300000);
});
