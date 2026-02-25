// ============================================================================
// HSLV - Frontend app.js (browser-safe, consolidated)
// Corregido: sin conflictos de módulos, compatible con inventario-module.js
// ============================================================================

var API_BASE_URL = '/.netlify/functions';

// Token para autenticación con Netlify Functions
function getAuthHeader() {
  const token =
    localStorage.getItem('HSLV_AUTH_TOKEN') ||
    localStorage.getItem('AIRTABLE_TOKEN') ||
    'ok';
  return { Authorization: `Bearer ${token}` };
}

// ============================================================================
// NAVEGACIÓN ENTRE MÓDULOS
// ============================================================================

function switchModule(moduleName, evt) {
  const e = evt || window.event;

  // Ocultar todos los módulos
  document.querySelectorAll('.module').forEach(m => m.classList.remove('active'));

  // Activar módulo seleccionado
  const mod = document.getElementById(moduleName);
  if (mod) mod.classList.add('active');

  // Nav activo
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const nav = Array.from(document.querySelectorAll('.nav-item'))
    .find(n => {
      const onclick = n.getAttribute('onclick') || '';
      return onclick.includes(`'${moduleName}'`) || onclick.includes(`"${moduleName}"`);
    });
  if (nav) nav.classList.add('active');
  else if (e && e.target) {
    const closest = e.target.closest ? e.target.closest('.nav-item') : null;
    if (closest) closest.classList.add('active');
  }

  // Título
  const titles = {
    dashboard: '📊 Dashboard Ejecutivo',
    inventario: '🗂️ Inventario Maestro',
    equipos: '🔧 Gestión de Equipos',
    mantenimientos: '📋 Historial de Intervenciones',
    planificacion: '📅 Planificación y Programación',
    repuestos: '📦 Gestión de Repuestos',
    documentos: '📄 Gestión Documental',
    kpis: '📈 Indicadores de Desempeño',
    reportes: '📝 Reportes e Informes',
    auditoria: '🔍 Auditoría y Trazabilidad'
  };
  const t = document.getElementById('moduleTitle');
  if (t) t.textContent = titles[moduleName] || moduleName;

  // Cargar datos del módulo
  loadModuleData(moduleName);
}

function loadModuleData(moduleName) {
  console.log(`Cargando datos del módulo: ${moduleName}`);
  switch (moduleName) {
    case 'dashboard':
      if (typeof initializeDashboard === 'function') initializeDashboard();
      else initDashboard();
      break;
    case 'inventario':
      if (typeof loadInventario === 'function') loadInventario();
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
  }
}

// ============================================================================
// MODALES
// ============================================================================

function openModal(modalId) {
  const el = document.getElementById(modalId);
  if (!el) return;
  // Soporta ambos estilos de modal (display y class)
  el.style.display = 'block';
  el.classList.add('active');
}

function closeModal(modalId) {
  // Si se llama sin argumento (desde inventario-module.js), cierra equipoModal
  if (!modalId) {
    const equipoModal = document.getElementById('equipoModal');
    if (equipoModal) {
      equipoModal.classList.remove('active');
      equipoModal.style.display = 'none';
    }
    document.body.style.overflow = 'auto';
    return;
  }
  const el = document.getElementById(modalId);
  if (!el) return;
  el.style.display = 'none';
  el.classList.remove('active');
  document.body.style.overflow = 'auto';
}

// Cerrar modal al hacer clic fuera
window.addEventListener('click', (event) => {
  document.querySelectorAll('.modal, .inventario-modal').forEach(m => {
    if (event.target === m) {
      m.style.display = 'none';
      m.classList.remove('active');
      document.body.style.overflow = 'auto';
    }
  });
});

// ============================================================================
// DASHBOARD
// ============================================================================

function initDashboard() {
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

  // Destruir chart previo si existe
  if (ctx._chartInstance) ctx._chartInstance.destroy();
  const chart = new Chart(ctx, {
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
  ctx._chartInstance = chart;
}

function initComplianceChart() {
  const ctx = document.getElementById('complianceChart');
  if (!ctx || typeof Chart === 'undefined') return;

  if (ctx._chartInstance) ctx._chartInstance.destroy();
  const chart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Cumplido','Pendiente'],
      datasets: [{ data: [92,8], backgroundColor: ['#2e7d32','#c62828'] }]
    },
    options: { responsive: true, plugins: { legend: { position: 'bottom' } } }
  });
  ctx._chartInstance = chart;
}

function initMaintenanceTypeChart() {
  const ctx = document.getElementById('maintenanceTypeChart');
  if (!ctx || typeof Chart === 'undefined') return;

  if (ctx._chartInstance) ctx._chartInstance.destroy();
  const chart = new Chart(ctx, {
    type: 'pie',
    data: {
      labels: ['Preventivo','Correctivo','Calibración'],
      datasets: [{ data: [55,35,10], backgroundColor: ['#1565c0','#ff6f00','#2e7d32'] }]
    },
    options: { responsive: true, plugins: { legend: { position: 'right' } } }
  });
  ctx._chartInstance = chart;
}

async function fetchDashboardData() {
  try {
    const response = await axios.get(`${API_BASE_URL}/kpis`, { headers: getAuthHeader() });
    const data = response.data || {};

    const equiposTotal = data.equipos?.total ?? data.equiposTotal ?? 0;
    const cumplimiento = data.cumplimiento ?? 0;
    const pendientes = data.pendientes ?? 0;
    const mtbf = data.mtbf ?? 0;
    const mttr = data.mttr ?? 0;
    const costo = data.costo ?? 0;

    const setText = (id, value) => { const el = document.getElementById(id); if (el) el.textContent = value; };

    setText('kpiEquipos', equiposTotal);
    setText('kpiCumplimiento', `${cumplimiento}%`);
    setText('kpiPendientes', pendientes);
    setText('kpiMTBF', `${Math.round(mtbf)}h`);
    setText('kpiMTTR', `${Number(mttr).toFixed(1)}h`);
    setText('kpiCosto', `$${(Number(costo) / 1000).toFixed(0)}K`);
  } catch (error) {
    console.error('Error cargando dashboard:', error);
  }
}

// ============================================================================
// EQUIPOS / MANTENIMIENTOS / KPIs
// ============================================================================

async function loadEquipos() {
  try {
    const response = await axios.get(`${API_BASE_URL}/equipos`, { headers: getAuthHeader() });
    console.log('Equipos cargados:', response.data);
  } catch (error) {
    console.error('Error cargando equipos:', error);
  }
}

async function loadMantenimientos() {
  try {
    const response = await axios.get(`${API_BASE_URL}/mantenimientos`, { headers: getAuthHeader() });
    console.log('Mantenimientos cargados:', response.data);
  } catch (error) {
    console.error('Error cargando mantenimientos:', error);
  }
}

async function loadKPIs() {
  try {
    await axios.get(`${API_BASE_URL}/kpis`, { headers: getAuthHeader() });
    const ctx = document.getElementById('kpiDetailChart');
    if (!ctx || typeof Chart === 'undefined') return;

    if (ctx._chartInstance) ctx._chartInstance.destroy();
    const chart = new Chart(ctx, {
      type: 'radar',
      data: {
        labels: ['MTBF','MTTR','Cumplimiento','Disponibilidad','Eficiencia','Confiabilidad'],
        datasets: [{ label: 'Desempeño Actual', data: [85,90,94,92,88,86], borderColor: '#0d47a1', backgroundColor: 'rgba(13,71,161,0.1)', borderWidth: 2 }]
      },
      options: { responsive: true, scales: { r: { beginAtZero: true, max: 100 } } }
    });
    ctx._chartInstance = chart;
  } catch (error) {
    console.error('Error cargando KPIs:', error);
  }
}

// ============================================================================
// INVENTARIO - Formulario del modal "newInventario"
// (El formulario con campos UPPERCASE que usa <details>)
// ============================================================================

async function submitInventarioForm(e) {
  e.preventDefault();
  const form = e.target;
  const fd = new FormData(form);
  const rawFields = {};

  for (const [k, v] of fd.entries()) {
    const val = String(v).trim();
    if (val === '') continue; // ignorar campos vacíos
    rawFields[k] = val;
  }

  if (!rawFields['ITEM'] && !rawFields['Item']) {
    alert('El campo ITEM es obligatorio');
    return;
  }
  if (!rawFields['EQUIPO'] && !rawFields['Equipo']) {
    alert('El campo EQUIPO es obligatorio');
    return;
  }

  // Mapeo UPPERCASE → nombres exactos de columnas Airtable
  const FIELD_MAP = {
    'ITEM': 'Item',
    'EQUIPO': 'Equipo',
    'MARCA': 'Marca',
    'MODELO': 'Modelo',
    'SERIE': 'Serie',
    'PLACA': 'Numero de Placa',
    'NUMERO DE PLACA': 'Numero de Placa',
    'CODIGO ECRI': 'Codigo ECRI',
    'REGISTRO INVIMA': 'Registro INVIMA',
    'TIPO DE ADQUISICION': 'Tipo de Adquisicion',
    'NO. DE CONTRATO': 'No. de Contrato',
    'SERVICIO': 'Servicio',
    'UBICACIÓN': 'Ubicacion',
    'UBICACION': 'Ubicacion',
    'VIDA UTIL': 'Vida Util',
    'FECHA FABRICA': 'Fecha Fabrica',
    'CERTIFICADO 2025': 'Certificado 2025',
    'FECHA DE COMRPA': 'Fecha de Compra',
    'FECHA DE COMPRA': 'Fecha de Compra',
    'VALOR EN PESOS': 'Valor en Pesos',
    'FECHA DE RECEPCIÓN': 'Fecha de Recepcion',
    'FECHA DE INSTALACIÓN': 'Fecha de Instalacion',
    'INICIO DE GARANTIA': 'Inicio de Garantia',
    'TERMINO DE GARANTIA': 'Termino de Garantia',
    'CLASIFICACION BIOMEDICA': 'Clasificacion Biomedica',
    'CLASIFICACION DE LA TECNOLOGIA': 'Clasificacion de la Tecnologia',
    'CLASIFICACION DEL RIESGO': 'Clasificacion del Riesgo',
    'MANUAL': 'Manual',
    'TIPO DE MTTO': 'Tipo de MTTO',
    'COSTO DE MANTENIMIENTO': 'Costo de Mantenimiento',
    'CALIBRABLE': 'Calibrable',
    'N. CERTIFICADO': 'N. Certificado',
    'FRECUENCIA DE MTTO PREVENTIVO': 'Frecuencia de MTTO Preventivo',
    'FECHA PROGRAMADA DE MANTENIMINETO': 'Fecha Programada de Mantenimiento',
    'FRECUENCIA DE MANTENIMIENTO': 'Frecuencia de Mantenimiento',
    'PROGRAMACION DE MANTENIMIENTO ANUAL': 'Programacion de Mantenimiento Anual',
    'RESPONSABLE': 'Responsable',
    'NOMBRE': 'Nombre',
    'DIRECCION': 'Direccion',
    'TELEFONO': 'Telefono',
    'CIUDAD': 'Ciudad',
  };

  // Campos que Airtable trata como booleanos (checkbox)
  const BOOL_FIELDS = new Set(['Calibrable', 'CALIBRABLE']);
  // Campos que Airtable trata como número
  const NUMBER_FIELDS = new Set(['Valor en Pesos', 'VALOR EN PESOS', 'Costo de Mantenimiento', 'COSTO DE MANTENIMIENTO', 'Vida Util', 'VIDA UTIL']);

  const fields = {};
  for (const [k, v] of Object.entries(rawFields)) {
    const mapped = FIELD_MAP[k] || k;
    
    if (BOOL_FIELDS.has(k) || BOOL_FIELDS.has(mapped)) {
      // Convertir a boolean real — nunca enviar string a campo checkbox
      const s = v.toLowerCase();
      fields[mapped] = ['true', '1', 'si', 'sí', 'yes'].includes(s);
    } else if (NUMBER_FIELDS.has(k) || NUMBER_FIELDS.has(mapped)) {
      // Convertir a número — nunca enviar string a campo numérico
      const n = parseFloat(String(v).replace(/[^0-9.]/g, ''));
      if (!isNaN(n)) fields[mapped] = n;
    } else {
      fields[mapped] = v;
    }
  }

  console.log('📤 Enviando campos mapeados:', fields);

  const submitBtn = form.querySelector('button[type="submit"]');
  const originalText = submitBtn ? submitBtn.textContent : '';
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = '⏳ Guardando...';
  }

  try {
    const url = `${API_BASE_URL}/inventario`;
    const resp = await axios.post(url, { fields }, {
      headers: { ...getAuthHeader(), 'Content-Type': 'application/json' }
    });

    const d = resp.data || {};

    if (d.ok || d.success || d.record) {
      if (d.warning && d.warning.removedUnknownFields && d.warning.removedUnknownFields.length > 0) {
        console.warn('⚠️ Campos no reconocidos por Airtable (se guardó sin ellos):', d.warning.removedUnknownFields);
      }
      closeModal('newInventario');
      form.reset();
      if (typeof loadInventario === 'function') loadInventario();
      alert('✅ Registro guardado correctamente');
    } else {
      const msg = d.hint || d.error || 'Respuesta inesperada del servidor';
      throw new Error(msg);
    }
  } catch (err) {
    // Extraer el mensaje de error del body de la respuesta HTTP (status 4xx/5xx)
    let msg = err.message || 'Error desconocido';
    let hint = '';

    if (err.response && err.response.data) {
      const d = err.response.data;
      msg = d.error || msg;
      hint = d.hint || '';
      if (d.removedFields && d.removedFields.length > 0) {
        hint = hint || `Campos no reconocidos por Airtable: ${d.removedFields.join(', ')}`;
      }
      console.error('❌ Error respuesta Airtable:', d);
    } else {
      console.error('❌ Error guardando:', err.message);
    }

    alert('❌ Error guardando en Inventario:\n\n' + msg + (hint ? '\n\n💡 ' + hint : ''));
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = originalText;
    }
  }
}

// ============================================================================
// GENERADOR DE PROGRAMACIÓN ANUAL DE MANTENIMIENTO
// ============================================================================

function generateAnnualSchedule() {
  const startDateEl = document.getElementById('invStartDate');
  const freqEl      = document.getElementById('invFreqSelect');
  const scheduleEl  = document.getElementById('invScheduleAnnual');

  if (!startDateEl || !freqEl || !scheduleEl) {
    alert('No se encontraron los campos de fecha o frecuencia en el formulario.');
    return;
  }
  if (!startDateEl.value) {
    alert('Ingresa primero la "Fecha Programada de Mantenimiento" como punto de inicio.');
    startDateEl.focus();
    return;
  }

  const freq = (freqEl.value || '').toLowerCase();
  let monthInterval = 12; // default: anual
  if (freq.includes('mensual'))           monthInterval = 1;
  else if (freq.includes('bimestral'))    monthInterval = 2;
  else if (freq.includes('trimestral'))   monthInterval = 3;
  else if (freq.includes('cuatrimestral'))monthInterval = 4;
  else if (freq.includes('semestral'))    monthInterval = 6;
  else if (freq.includes('anual'))        monthInterval = 12;

  const start   = new Date(startDateEl.value + 'T00:00:00');
  const endDate = new Date(start);
  endDate.setFullYear(endDate.getFullYear() + 1);

  const dates = [];
  let current = new Date(start);
  while (current <= endDate) {
    dates.push(current.toISOString().slice(0, 10));
    current = new Date(current);
    current.setMonth(current.getMonth() + monthInterval);
  }

  scheduleEl.value = dates.join(', ');
  console.log('📅 Programación anual generada:', dates);
}

function clearAnnualSchedule() {
  const el = document.getElementById('invScheduleAnnual');
  if (el) el.value = '';
}

// ============================================================================
// BÚSQUEDA DE INVENTARIO (para el módulo principal, no inventario-module.js)
// ============================================================================

let inventarioOffset = null;
let inventarioSearchTimer = null;

function debouncedInventarioSearch() {
  clearTimeout(inventarioSearchTimer);
  inventarioSearchTimer = setTimeout(() => {
    const searchEl = document.getElementById('inventarioSearch');
    if (searchEl) {
      inventarioOffset = null;
      if (typeof loadInventario === 'function') loadInventario();
    }
  }, 300);
}

function inventarioNextPage() {
  if (!inventarioOffset) return;
  if (typeof loadInventario === 'function') loadInventario();
}

function inventarioPrevPage() {
  inventarioOffset = null;
  if (typeof loadInventario === 'function') loadInventario();
}

function exportInventarioCSV() {
  const rows = [];
  rows.push(['Item','Equipo','Marca','Modelo','Serie','Placa','Servicio','Ubicación','Vida Util','Prox Mtto'].join(','));

  const tbody = document.getElementById('inventarioTableBody') || document.getElementById('tableBody');
  if (!tbody) return;
  tbody.querySelectorAll('tr').forEach(tr => {
    const cols = Array.from(tr.querySelectorAll('td')).slice(0,10).map(td => `"${(td.textContent||'').replaceAll('"','""')}"`);
    if (cols.length) rows.push(cols.join(','));
  });

  const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `inventario_${new Date().toISOString().slice(0,10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

// ============================================================================
// UTILIDAD
// ============================================================================

function escapeHtml(str) {
  return String(str ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

// ============================================================================
// INICIALIZACIÓN
// ============================================================================

document.addEventListener('DOMContentLoaded', () => {
  console.log('✅ Sistema de Gestión de Mantenimiento Hospitalario iniciado');

  // Dashboard init
  if (document.getElementById('dashboard')) {
    initDashboard();
  }

  // Formulario inventario (modal newInventario con campos UPPERCASE)
  const inventarioForm = document.getElementById('inventarioForm');
  if (inventarioForm) {
    // Quitar "required" de inputs dentro de <details> para evitar error "not focusable"
    // La validación se hace en JS (submitInventarioForm)
    inventarioForm.querySelectorAll('details input[required], details select[required], details textarea[required]').forEach(el => {
      el.removeAttribute('required');
      el.dataset.jsRequired = 'true'; // marcamos para validar por JS
    });

    inventarioForm.addEventListener('submit', submitInventarioForm);
  }

  // Refresh dashboard cada 5 min
  setInterval(() => {
    const active = document.querySelector('.module.active');
    if (active && active.id === 'dashboard') fetchDashboardData();
  }, 300000);
});

// Exponer funciones al window para onclick=""
window.switchModule = switchModule;
window.openModal = openModal;
window.closeModal = closeModal;
window.generateAnnualSchedule = generateAnnualSchedule;
window.clearAnnualSchedule = clearAnnualSchedule;
window.debouncedInventarioSearch = debouncedInventarioSearch;
window.inventarioNextPage = inventarioNextPage;
window.inventarioPrevPage = inventarioPrevPage;
window.exportInventarioCSV = exportInventarioCSV;
