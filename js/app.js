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

  // Certificados de calibración (PDF) - se envían aparte, no dentro de fields
  const certificates = [];
  try {
    const rows = form.querySelectorAll('#calCertList .cal-cert-row');
    rows.forEach((row) => {
      const yearEl = row.querySelector('input[name="CAL_CERT_YEAR"]');
      const fileEl = row.querySelector('input[name="CAL_CERT_FILE"]');
      const year = yearEl ? String(yearEl.value || '').trim() : '';
      const file = fileEl && fileEl.files ? fileEl.files[0] : null;
      if (!year && !file) return;
      if (!year || !/^[0-9]{4}$/.test(year)) {
        throw new Error('El año de calibración debe ser un número de 4 dígitos (ej: 2025).');
      }
      if (!file) {
        throw new Error(`Falta adjuntar el PDF del certificado para el año ${year}.`);
      }
      if (file.size > 5 * 1024 * 1024) {
        throw new Error(`El PDF de ${year} supera 5MB. Airtable solo permite carga directa hasta 5MB por archivo.`);
      }
      if (file.type && file.type !== 'application/pdf') {
        throw new Error(`El archivo de ${year} debe ser PDF.`);
      }
      certificates.push({ year, file });
    });
  } catch (e) {
    alert(e.message || String(e));
    return;
  }

  for (const [k, v] of fd.entries()) {
    // Ignorar inputs de certificados (se manejan arriba)
    if (k === 'CAL_CERT_YEAR' || k === 'CAL_CERT_FILE') continue;

    // Ignorar archivos/adjuntos genéricos en este flujo (solo soportamos PDFs por el componente de certificados)
    if (v instanceof File) continue;

    const val = String(v).trim();
    if (val === '') continue;
    if (k === 'CALIBRABLE' || k === 'Calibrable') {
      rawFields[k] = (val === 'true' || val === 'Sí' || val === 'si');
    } else {
      rawFields[k] = val;
    }
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
    // Certificados de calibración se guardan por API (adjuntos) y años en campo texto
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

  // Convertir campos del formulario a nombres de Airtable
  const fields = {};
  for (const [k, v] of Object.entries(rawFields)) {
    const mapped = FIELD_MAP[k] || k;
    fields[mapped] = v;
  }

  // Guardar años de calibración (texto) si hay certificados
  if (certificates.length > 0) {
    const years = Array.from(new Set(certificates.map(c => c.year))).sort();
    fields['Años de Calibracion'] = years.join(', ');
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
    // Convertir PDFs a base64 para el endpoint backend (uploadAttachment)
    const certPayload = [];
    for (const c of certificates) {
      const b64 = await fileToBase64(c.file);
      certPayload.push({
        year: c.year,
        filename: c.file.name,
        contentType: c.file.type || 'application/pdf',
        fileBase64: b64
      });
    }

    const resp = await axios.post(url, { fields, certificates: certPayload }, {
      headers: { ...getAuthHeader(), 'Content-Type': 'application/json' }
    });

    if (resp.data && (resp.data.ok || resp.data.record)) {
      // Validación extra: si Airtable creó el registro pero sin campos visibles, avisar (suele pasar por filtros de campos)
      const sentCount = Object.keys(fields || {}).length;
      const recFields = resp.data.record && resp.data.record.fields ? resp.data.record.fields : {};
      const recCount = Object.keys(recFields || {}).length;
      if (sentCount > 0 && recCount === 0) {
        console.warn('⚠️ Registro creado pero sin campos. Revisa nombres de columnas en Airtable.', { sent: fields, record: resp.data.record });
        alert('⚠️ Se creó el registro pero quedó vacío en Airtable. Esto suele ocurrir por nombres de columnas diferentes. Te recomiendo revisar el nombre exacto de las columnas en Airtable.');
      }
      closeModal('newInventario');
      form.reset();

      // Reset visual de certificados: dejar 1 fila vacía
      try {
        const list = document.getElementById('calCertList');
        if (list) {
          list.innerHTML = '';
          addCalCertRow();
        }
      } catch (e) {}

      if (typeof loadInventario === 'function') loadInventario();
      alert('✅ Registro guardado correctamente');
    } else {
      throw new Error('Respuesta inesperada del servidor');
    }
  } catch (err) {
    console.error('Error guardando inventario:', err?.response?.data || err.message);
    let msg = err?.response?.data?.error || err?.response?.data?.details?.error?.message || err.message;
    if (msg && typeof msg === 'object') {
      msg = msg.message || msg.type || JSON.stringify(msg);
    }
    const more = err?.response?.data?.details?.error?.type || err?.response?.data?.details?.error?.message;
    if (more && typeof more === 'string' && !String(msg).includes(more)) {
      msg = `${msg} (${more})`;
    }
    alert('Error guardando inventario: ' + msg);
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = originalText;
    }
  }
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
// CERTIFICADOS DE CALIBRACIÓN (UI + Base64)
// ============================================================================

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('No se pudo leer el archivo.'));
    reader.onload = () => {
      const res = String(reader.result || '');
      // reader.result = data:application/pdf;base64,AAAA...
      const comma = res.indexOf(',');
      resolve(comma >= 0 ? res.slice(comma + 1) : res);
    };
    reader.readAsDataURL(file);
  });
}

function addCalCertRow() {
  const list = document.getElementById('calCertList');
  if (!list) return;
  const year = String(new Date().getFullYear());
  const row = document.createElement('div');
  row.className = 'cal-cert-row';
  row.innerHTML = `
    <input name="CAL_CERT_YEAR" type="number" min="2000" max="2100" step="1" placeholder="Año" value="${year}" style="max-width:140px;">
    <input name="CAL_CERT_FILE" type="file" accept="application/pdf" style="flex:1;">
    <button type="button" class="btn btn-secondary btn-small" onclick="removeCalCertRow(this)" title="Quitar">✕</button>
  `;
  list.appendChild(row);
}

function removeCalCertRow(btn) {
  try {
    const row = btn && btn.closest ? btn.closest('.cal-cert-row') : null;
    if (!row) return;
    const list = document.getElementById('calCertList');
    if (!list) return;
    // Mantener al menos una fila
    if (list.querySelectorAll('.cal-cert-row').length <= 1) {
      const yearEl = row.querySelector('input[name="CAL_CERT_YEAR"]');
      const fileEl = row.querySelector('input[name="CAL_CERT_FILE"]');
      if (yearEl) yearEl.value = String(new Date().getFullYear());
      if (fileEl) fileEl.value = '';
      return;
    }
    row.remove();
  } catch (e) {}
}

// ============================================================================
// OPCIONES DESPLEGABLES (Servicio / Clasificaciones / Riesgo)
// - Evita HTTP 422 por intentar crear nuevas opciones de selección en Airtable
// - Carga opciones desde backend (options=1) con fallback a valores predefinidos
// ============================================================================

function fillSelect(selectEl, options) {
  if (!selectEl) return;
  const keepFirst = selectEl.querySelector('option[value=""]');
  selectEl.innerHTML = '';
  // Placeholder
  const ph = document.createElement('option');
  ph.value = '';
  ph.textContent = 'Seleccione...';
  selectEl.appendChild(ph);
  (options || []).forEach(v => {
    const val = String(v || '').trim();
    if (!val) return;
    const opt = document.createElement('option');
    opt.value = val;
    opt.textContent = val;
    selectEl.appendChild(opt);
  });
}

async function loadInventarioSelectOptions() {
  const servicioSel = document.getElementById('invServicio');
  const clasBioSel = document.getElementById('invClasBio');
  const clasTecSel = document.getElementById('invClasTec');
  const riesgoSel = document.getElementById('invClasRiesgo');

  // Si el HTML aún no fue actualizado, no hacemos nada.
  if (!servicioSel && !clasBioSel && !clasTecSel && !riesgoSel) return;

  try {
    const url = `${API_BASE_URL}/inventario?options=1`;
    const resp = await axios.get(url, { headers: getAuthHeader() });
    const opt = (resp && resp.data && resp.data.options) ? resp.data.options : {};

    fillSelect(servicioSel, opt.Servicio);
    fillSelect(clasBioSel, opt['Clasificacion Biomedica']);
    fillSelect(clasTecSel, opt['Clasificacion de la Tecnologia']);
    fillSelect(riesgoSel, opt['Clasificacion del Riesgo']);
  } catch (e) {
    console.warn('⚠️ No se pudieron cargar opciones desplegables. Se usarán valores por defecto.', e);
    // Fallback local (coincide con tus opciones de Airtable según capturas)
    fillSelect(servicioSel, [
      'Cirugia Adulto','Consulta Externa','Urgencias Adulto','Urgencias Pediatria',
      'Laboratorio Clinico','Imagenes Diagnosticas','Uci Adultos'
    ]);
    fillSelect(clasBioSel, [
      'Diagnostico','Terapéuticos/Tratamiento','Soporte Vital','Laboratorio/Análisis','NO APLICA'
    ]);
    fillSelect(clasTecSel, [
      'Equipo Biomedico','Equipo Industrial','Equipo de apoyo','Equipo Electrico'
    ]);
    fillSelect(riesgoSel, [
      'Clase I (Riesgo Bajo)','Clase IIa (Riesgo Moderado)','Clase IIb (Riesgo Alto)','Clase III (Riesgo muy alto)'
    ]);
  }
}

// ============================================================================
// INICIALIZACIÓN
// ============================================================================

document.addEventListener('DOMContentLoaded', () => {
  console.log('✅ Sistema de Gestión de Mantenimiento Hospitalario iniciado');

  // Cargar listas desplegables del inventario (Servicio / Clasificaciones / Riesgo)
  loadInventarioSelectOptions();

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
window.debouncedInventarioSearch = debouncedInventarioSearch;
window.inventarioNextPage = inventarioNextPage;
window.inventarioPrevPage = inventarioPrevPage;
window.exportInventarioCSV = exportInventarioCSV;
window.addCalCertRow = addCalCertRow;
window.removeCalCertRow = removeCalCertRow;
