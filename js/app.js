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

  // Inventario: cargar el próximo ITEM (Airtable Autonumber) solo para visualizar
  if (modalId === 'newInventario') {
    loadNextInventarioItem().catch(() => {});
  }
}

// Carga el próximo ITEM (max + 1) desde Airtable para mostrarlo en el formulario.
async function loadNextInventarioItem() {
  const itemEl = document.getElementById('invItem');
  if (!itemEl) return;
  itemEl.value = '';
  itemEl.placeholder = 'Cargando...';

  const res = await fetch('/.netlify/functions/inventario?nextItem=1', { method: 'GET' });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data || !data.ok) {
    itemEl.placeholder = '—';
    return;
  }
  itemEl.value = String(data.nextItemDisplay || data.nextItem || '').trim() || '';
  if (!itemEl.value) itemEl.placeholder = '—';
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

  // PDF Registro INVIMA
  let invimaFile = null;
  const _invimaInput = form.querySelector('#invimaFileInput');
  if (_invimaInput && _invimaInput.files && _invimaInput.files[0]) {
    const _if = _invimaInput.files[0];
    if (_if.size > 5 * 1024 * 1024) { alert('El PDF del Registro INVIMA supera 5MB.'); return; }
    invimaFile = _if;
  }

  // PDF Registro de Importación
  let importacionFile = null;
  const _importInput = form.querySelector('#importacionFileInput');
  if (_importInput && _importInput.files && _importInput.files[0]) {
    const _impf = _importInput.files[0];
    if (_impf.size > 5 * 1024 * 1024) { alert('El PDF del Registro de Importación supera 5MB.'); return; }
    importacionFile = _impf;
  }

  const _calId = form.querySelector('#calibrableIdentSelect');
  const _calMn = form.querySelector('#calibrableMainSelect');
  const esCalibrableSI = (_calId && _calId.value === 'SI') || (_calMn && _calMn.value === 'SI');
  try {
    const rows = form.querySelectorAll('#calCertList .cal-cert-row');
    rows.forEach((row) => {
      const yearEl = row.querySelector('input[name="CAL_CERT_YEAR"]');
      const fileEl = row.querySelector('input[name="CAL_CERT_FILE"]');
      const year = yearEl ? String(yearEl.value || '').trim() : '';
      const file = fileEl && fileEl.files ? fileEl.files[0] : null;
      if (!year && !file) return;
      if (!esCalibrableSI) return;
      if (!year || !/^[0-9]{4}$/.test(year)) throw new Error('El año de calibración debe ser 4 dígitos.');
      if (!file) throw new Error('Falta adjuntar el PDF del certificado para el año ' + year + '.');
      if (file.size > 5 * 1024 * 1024) throw new Error('El PDF de ' + year + ' supera 5MB.');
      if (file.type && file.type !== 'application/pdf') throw new Error('El archivo de ' + year + ' debe ser PDF.');
      certificates.push({ year, file });
    });
  } catch (e) {
    alert(e.message || String(e));
    return;
  }

  for (const [k, v] of fd.entries()) {
    // Ignorar inputs de certificados (se manejan arriba)
    if (k === 'CAL_CERT_YEAR' || k === 'CAL_CERT_FILE' || k === 'CALIBRABLE_IDENT') continue;

    // Ignorar archivos/adjuntos genéricos en este flujo (solo soportamos PDFs por el componente de certificados)
    if (v instanceof File) continue;

    let val = String(v);
      val = val.replace(/[\u00A0\s]+/g, ' ').trim();
      val = val.replace(/^[\s'\"“”‘’]+/, '').replace(/[\s'\"“”‘’]+$/, '');
    if (val === '') continue;
    if (k === 'CALIBRABLE' || k === 'Calibrable') {
      if (val === 'SI' || val === 'si' || val === 'true') rawFields[k] = 'SI';
      else if (val === 'NO' || val === 'no' || val === 'false') rawFields[k] = 'NO';
    } else if (k === 'CALIBRABLE_IDENT') {
      // solo UI, ignorar
    } else {
      rawFields[k] = val;
    }
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

  // "Item" en Airtable es Autonumber (solo lectura). Se muestra en la UI,
  // pero NO se debe enviar al backend en POST/PUT porque provoca error 422.
  if ('Item' in fields) delete fields['Item'];

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
      certPayload.push({ year: c.year, filename: c.file.name, contentType: c.file.type || 'application/pdf', base64: b64 });
    }
    const resp = await axios.post(url, { fields, certificates: certPayload }, {
      headers: { ...getAuthHeader(), 'Content-Type': 'application/json' }
    });

    if (resp.data && (resp.data.ok || resp.data.record || resp.data.data)) {
      // Compatibilidad: el backend puede devolver {record} o {data}
      const record = resp.data.record || resp.data.data || null;
      const newRecordId = resp.data.recordId || (record && (record.id || (record.records && record.records[0] && record.records[0].id)));

      // Subir PDFs INVIMA e Importacion por separado (evitar límite 6MB de Netlify)
      const uploadUrl = `${API_BASE_URL}/upload-pdf`;
      if (invimaFile && newRecordId) {
        try {
          const ib64 = await fileToBase64(invimaFile);
          console.log('📄 subiendo invima:', invimaFile.name);
          await axios.post(uploadUrl, {
            recordId: newRecordId,
            fieldName: 'Registro Invima pdf',
            filename: invimaFile.name,
            contentType: invimaFile.type || 'application/pdf',
            base64: ib64
          }, { headers: { ...getAuthHeader(), 'Content-Type': 'application/json' } });
        } catch(e) { console.warn('⚠️ Error subiendo INVIMA PDF:', e.message); }
      }
      if (importacionFile && newRecordId) {
        try {
          const imp64 = await fileToBase64(importacionFile);
          console.log('📦 subiendo importacion:', importacionFile.name);
          await axios.post(uploadUrl, {
            recordId: newRecordId,
            fieldName: 'Registro de importacion',
            filename: importacionFile.name,
            contentType: importacionFile.type || 'application/pdf',
            base64: imp64
          }, { headers: { ...getAuthHeader(), 'Content-Type': 'application/json' } });
        } catch(e) { console.warn('⚠️ Error subiendo Importacion PDF:', e.message); }
      }

      // Si el backend tuvo que remover selects por valores no válidos, avisar exactamente cuáles
      const removedSelects = (resp.data?.record && resp.data.record.__removedSelects) ||
                            (resp.data?.data && resp.data.data.__removedSelects) ||
                            resp.data?.__removedSelects;
      if (Array.isArray(removedSelects) && removedSelects.length) {
        alert('⚠️ El registro se guardó, pero Airtable rechazó estas listas desplegables: ' + removedSelects.join(', ') +
              '.\nRevisa que el texto enviado coincida EXACTO con las opciones del campo (incluyendo tildes y espacios).');
      }

      // Validación real: si Airtable devolvió un record pero sin fields, entonces sí es un problema.
      const sentCount = Object.keys(fields || {}).length;
      const recFields = (record && record.fields) ? record.fields : {};
      const recCount = Object.keys(recFields || {}).length;
      if (sentCount > 0 && recCount === 0) {
        console.warn('⚠️ Registro creado pero sin fields devueltos por Airtable.', { sent: fields, record });
        alert('⚠️ Se creó el registro pero Airtable no devolvió campos. Revisa nombres exactos de columnas y permisos del token.');
      }
      closeModal('newInventario');
      form.reset();

      // Reset certificados y estado calibrable
      try {
        var _list = document.getElementById('calCertList');
        if (_list) { _list.innerHTML = ''; addCalCertRow(); }
        var _ids = document.getElementById('calibrableIdentSelect');
        var _mns = document.getElementById('calibrableMainSelect');
        var _css = document.getElementById('calCertSection');
        if (_ids) _ids.value = '';
        if (_mns) _mns.value = '';
        if (_css) _css.style.display = 'none';
        var _ii = document.getElementById('invimaFileInput');
        if (_ii) _ii.value = '';
        var _imp = document.getElementById('importacionFileInput');
        if (_imp) _imp.value = '';
      } catch (e) {}

      if (typeof loadInventario === 'function') loadInventario();
      alert('✅ Registro guardado correctamente');
    } else {
      throw new Error('Respuesta inesperada del servidor');
    }
  } catch (err) {
    console.error('Error guardando inventario:', err?.response?.data || err.message);
    let msg = err?.response?.data?.error || err?.response?.data?.details?.error?.message || err?.response?.data?.details?.error || err.message;
    if (typeof msg === 'object') {
      msg = msg?.message || JSON.stringify(msg);
    }
    alert('Error guardando inventario: ' + String(msg));
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = originalText;
    }
  }
}

// ============================================================================
// INVENTARIO - Estado y carga de datos (reemplaza inventario-module.js si no carga)
// ============================================================================

var _invState = window.__HSLV_INVENTARIO_STATE || (window.__HSLV_INVENTARIO_STATE = {
  currentPage: 0,
  currentOffset: null,
  searchQuery: '',
  searchTimeout: null,
  allRecords: [],
  currentEditId: null,
  pageSize: 50
});

// Función principal de carga — se llama desde switchModule('inventario') y botón Actualizar
async function loadInventario(forceRefresh) {
  // Si inventario-module.js ya está cargado y tiene su propia implementación completa, usarla.
  // Detectamos si ya fue inicializada correctamente verificando que el módulo esté listo.
  if (window.__HSLV_INVENTARIO_MODULE_LOADED && typeof window.__invModuleLoadInventario === 'function') {
    return window.__invModuleLoadInventario(forceRefresh);
  }

  const tbody = document.getElementById('inventarioTbody');
  if (!tbody) { console.warn('⚠️ No se encontró #inventarioTbody'); return; }

  tbody.innerHTML = `<tr><td colspan="11" style="text-align:center;padding:18px;color:#607d8b;">⏳ Cargando inventario...</td></tr>`;

  try {
    const params = new URLSearchParams({ pageSize: '50' });
    if (_invState.currentOffset) params.set('offset', _invState.currentOffset);
    const q = (_invState.searchQuery || '').trim();
    if (q) params.set('q', q);

    const res = await fetch(`${API_BASE_URL}/inventario?${params}`, {
      headers: getAuthHeader()
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || `HTTP ${res.status}`);
    }

    const data = await res.json();
    _invState.allRecords = data.records || data.data || [];
    _invState.currentOffset = data.offset || null;

    const total = data.count || _invState.allRecords.length;
    const countEl = document.getElementById('inventarioCount');
    if (countEl) countEl.textContent = `${total} registros`;

    console.log('✅ Inventario cargado:', _invState.allRecords.length, 'registros');
    _renderInventarioTable();
    _updateInventarioPagination();

  } catch (err) {
    console.error('❌ Error cargando inventario:', err);
    tbody.innerHTML = `
      <tr><td colspan="11" style="text-align:center;padding:18px;color:#c62828;">
        ⚠️ Error al cargar el inventario: <strong>${escapeHtml(err.message)}</strong><br>
        <button class="btn btn-primary" onclick="loadInventario(true)" style="margin-top:10px">🔄 Reintentar</button>
      </td></tr>`;
  }
}

function _renderInventarioTable() {
  const tbody = document.getElementById('inventarioTbody');
  if (!tbody) return;

  if (!_invState.allRecords.length) {
    tbody.innerHTML = `<tr><td colspan="11" style="text-align:center;padding:18px;color:#607d8b;">
      📦 No hay equipos registrados.<br><small>Comienza agregando tu primer equipo al inventario.</small>
    </td></tr>`;
    return;
  }

  tbody.innerHTML = _invState.allRecords.map(record => {
    const f = record.fields || {};
    const get = (...keys) => { for (const k of keys) { if (f[k] != null && f[k] !== '') return f[k]; } return ''; };
    const item     = get('Item','ITEM');
    const equipo   = get('Equipo','EQUIPO');
    const marca    = get('Marca','MARCA');
    const modelo   = get('Modelo','MODELO');
    const serie    = get('Serie','SERIE');
    const placa    = get('Numero de Placa','PLACA','Número de Placa');
    const servicio = get('Servicio','SERVICIO');
    const ubic     = get('Ubicacion','Ubicación','UBICACIÓN');
    const vida     = get('Vida Util','VIDA UTIL');
    const fecha    = get('Fecha Programada de Mantenimiento','FECHA PROGRAMADA DE MANTENIMINETO');

    let fechaStr = '—';
    if (fecha) {
      try { fechaStr = new Date(fecha).toLocaleDateString('es-CO', {year:'numeric',month:'short',day:'numeric'}); }
      catch(e) { fechaStr = fecha; }
    }

    const esc = escapeHtml;
    return `<tr>
      <td>${esc(String(item))}</td>
      <td>${esc(equipo)}</td>
      <td>${esc(marca)}</td>
      <td>${esc(modelo)}</td>
      <td>${esc(serie)}</td>
      <td>${esc(placa)}</td>
      <td>${esc(servicio)}</td>
      <td>${esc(ubic)}</td>
      <td>${esc(String(vida))}</td>
      <td>${fechaStr}</td>
      <td>
        <button class="btn btn-small btn-secondary" onclick="editEquipo('${record.id}')" title="Editar">✏️</button>
        <button class="btn btn-small" onclick="deleteEquipo('${record.id}','${esc(equipo)}')" title="Eliminar" style="color:#c62828;">🗑️</button>
      </td>
    </tr>`;
  }).join('');
}

function _updateInventarioPagination() {
  const prev = document.getElementById('inventarioPrevBtn');
  const next = document.getElementById('inventarioNextBtn');
  if (prev) prev.disabled = (_invState.currentPage === 0);
  if (next) next.disabled = !_invState.currentOffset;
}

let inventarioSearchTimer = null;

function debouncedInventarioSearch() {
  clearTimeout(inventarioSearchTimer);
  inventarioSearchTimer = setTimeout(() => {
    const el = document.getElementById('inventarioSearch');
    _invState.searchQuery = el ? el.value.trim() : '';
    _invState.currentOffset = null;
    _invState.currentPage = 0;
    loadInventario();
  }, 400);
}

function inventarioNextPage() {
  if (!_invState.currentOffset) return;
  _invState.currentPage++;
  loadInventario();
}

function inventarioPrevPage() {
  if (_invState.currentPage <= 0) return;
  _invState.currentPage--;
  _invState.currentOffset = null;
  loadInventario();
}

// Editar y Eliminar — se exponen para los botones inline de la tabla
async function editEquipo(recordId) {
  const record = (_invState.allRecords || []).find(r => r.id === recordId);
  if (!record) { alert('Equipo no encontrado'); return; }
  openModal('newInventario');
  const form = document.getElementById('inventarioForm');
  if (!form) return;
  const fields = record.fields || {};
  form.querySelectorAll('input,select,textarea').forEach(input => {
    if (!input.name) return;
    // Intentar con el nombre del campo tal cual y con el mapeado
    const val = fields[input.name] || '';
    input.value = val || '';
  });
  _invState.currentEditId = recordId;
}

async function deleteEquipo(recordId, equipoName) {
  if (!confirm(`¿Eliminar "${equipoName}"?\nEsta acción no se puede deshacer.`)) return;
  try {
    const res = await fetch(`${API_BASE_URL}/inventario?id=${recordId}`, {
      method: 'DELETE', headers: getAuthHeader()
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    _invState.currentOffset = null;
    _invState.currentPage = 0;
    await loadInventario();
  } catch (err) {
    alert('Error al eliminar: ' + err.message);
  }
}

function exportInventarioCSV() {
  if (!_invState.allRecords.length) { alert('No hay datos para exportar'); return; }
  const headers = ['Item','Equipo','Marca','Modelo','Serie','Numero de Placa','Servicio','Ubicacion','Vida Util','Fecha Programada de Mantenimiento'];
  const rows = [headers.join(',')];
  _invState.allRecords.forEach(r => {
    const f = r.fields || {};
    const row = headers.map(h => { const v = String(f[h] || '').replace(/"/g,'""'); return v.includes(',') ? `"${v}"` : v; });
    rows.push(row.join(','));
  });
  const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `inventario_${new Date().toISOString().slice(0,10)}.csv`;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
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


// ==============================================================
// CALIBRABLE: mostrar/ocultar seccion de certificados PDF
// ==============================================================
function toggleCalCertSection() {
  var identSelect = document.getElementById('calibrableIdentSelect');
  var section = document.getElementById('calCertSection');
  if (!identSelect || !section) return;
  var esSI = identSelect.value === 'SI';
  section.style.display = esSI ? '' : 'none';
  var mainSelect = document.getElementById('calibrableMainSelect');
  if (mainSelect && identSelect.value !== '') mainSelect.value = identSelect.value;
  if (!esSI) {
    var list = document.getElementById('calCertList');
    if (list) {
      var inp = list.querySelectorAll('input[name="CAL_CERT_FILE"]');
      for (var i = 0; i < inp.length; i++) inp[i].value = '';
    }
  }
}

function syncCalibrableSelects(origin) {
  if (origin === 'main') {
    var m = document.getElementById('calibrableMainSelect');
    var id = document.getElementById('calibrableIdentSelect');
    if (m && id) { id.value = m.value; toggleCalCertSection(); }
  }
}

window.toggleCalCertSection = toggleCalCertSection;
window.syncCalibrableSelects = syncCalibrableSelects;

// ─────────────────────────────────────────────────────────────────────────────
// PROGRAMACIÓN DE MANTENIMIENTO: elige mes + semana para cada periodo
// ─────────────────────────────────────────────────────────────────────────────
var MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
var FREQ_COUNT = { Mensual:12, Bimestral:6, Trimestral:4, Cuatrimestral:3, Semestral:2, Anual:1 };
var FREQ_WINDOWS = {
  Mensual:      [[0],[1],[2],[3],[4],[5],[6],[7],[8],[9],[10],[11]],
  Bimestral:    [[0,1],[2,3],[4,5],[6,7],[8,9],[10,11]],
  Trimestral:   [[0,1,2],[3,4,5],[6,7,8],[9,10,11]],
  Cuatrimestral:[[0,1,2,3],[4,5,6,7],[8,9,10,11]],
  Semestral:    [[0,1,2,3,4,5],[6,7,8,9,10,11]],
  Anual:        [[0,1,2,3,4,5,6,7,8,9,10,11]]
};
var _mttoSlots = [];

function onFreqChange() {
  var sel = document.getElementById('invFreqSelect');
  var grp = document.getElementById('scheduleBuilderGroup');
  if (!sel || !grp) return;
  if (!sel.value) { grp.style.display = 'none'; return; }
  var freq = sel.value;
  var count = FREQ_COUNT[freq] || 1;
  _mttoSlots = [];
  for (var i = 0; i < count; i++) _mttoSlots.push({ mes: null, sem: null });
  grp.style.display = '';
  buildSlotGrid(freq);
  updateMttoTextarea();
}

function buildSlotGrid(freq) {
  var container = document.getElementById('scheduleMonthGrid');
  if (!container) return;
  container.innerHTML = '';
  var windows = FREQ_WINDOWS[freq] || [[0,1,2,3,4,5,6,7,8,9,10,11]];
  _mttoSlots.forEach(function(slot, idx) {
    var win = windows[idx] || windows[0];
    var card = document.createElement('div');
    card.style.cssText = 'padding:10px 14px; background:#f4f7ff; border-radius:10px; border:1px solid #dbe4ff; display:flex; flex-direction:column; gap:8px;';

    var header = document.createElement('div');
    header.style.cssText = 'font-weight:700; font-size:0.83em; color:#2563eb; text-transform:uppercase; letter-spacing:0.04em;';
    header.textContent = 'Periodo ' + (idx+1) + ' · ' + (win.length > 1 ? MESES[win[0]].slice(0,3) + '–' + MESES[win[win.length-1]].slice(0,3) : MESES[win[0]]);
    card.appendChild(header);

    var mesRow = document.createElement('div');
    mesRow.style.cssText = 'display:flex; align-items:center; gap:8px; flex-wrap:wrap;';
    var mesLbl = document.createElement('span');
    mesLbl.textContent = 'Mes:';
    mesLbl.style.cssText = 'font-size:0.83em; font-weight:600; color:#555; white-space:nowrap; min-width:42px;';
    mesRow.appendChild(mesLbl);
    win.forEach(function(mi) {
      var mb = document.createElement('button');
      mb.type = 'button';
      mb.textContent = MESES[mi].slice(0,3);
      mb.dataset.slot = idx; mb.dataset.mes = mi;
      mb.style.cssText = 'padding:4px 9px; border-radius:5px; border:1.5px solid #b0bec5; font-size:0.8em; cursor:pointer; background:#fff; font-weight:600; transition:all 0.15s;';
      if (_mttoSlots[idx].mes === mi) applyMttoActive(mb, true);
      mb.onclick = function() { selectMesForSlot(idx, mi, card); };
      mesRow.appendChild(mb);
    });
    card.appendChild(mesRow);

    var semRow = document.createElement('div');
    semRow.id = 'semRow_' + idx;
    semRow.style.cssText = 'display:' + (_mttoSlots[idx].mes !== null ? 'flex' : 'none') + '; align-items:center; gap:8px; flex-wrap:wrap;';
    var semLbl = document.createElement('span');
    semLbl.textContent = 'Semana:';
    semLbl.style.cssText = 'font-size:0.83em; font-weight:600; color:#555; white-space:nowrap; min-width:62px;';
    semRow.appendChild(semLbl);
    ['S1','S2','S3','S4'].forEach(function(s, si) {
      var sb = document.createElement('button');
      sb.type = 'button';
      sb.dataset.slot = idx; sb.dataset.sem = s;
      var mesActual = _mttoSlots[idx].mes;
      sb.textContent = s + (mesActual !== null ? ' (' + getWeekDatesOfMonth(mesActual, si) + ')' : '');
      sb.style.cssText = 'padding:4px 10px; border-radius:5px; border:1.5px solid #b0bec5; font-size:0.8em; cursor:pointer; background:#fff; font-weight:600; transition:all 0.15s; white-space:nowrap;';
      if (_mttoSlots[idx].sem === s) applyMttoActive(sb, true);
      sb.onclick = function() { selectSemForSlot(idx, s, semRow); };
      semRow.appendChild(sb);
    });
    card.appendChild(semRow);
    container.appendChild(card);
  });
}

function applyMttoActive(btn, active) {
  if (active) { btn.style.background='#2563eb'; btn.style.color='#fff'; btn.style.borderColor='#2563eb'; }
  else { btn.style.background='#fff'; btn.style.color=''; btn.style.borderColor='#b0bec5'; }
}

function selectMesForSlot(slotIdx, mesIdx, card) {
  _mttoSlots[slotIdx].mes = mesIdx;
  _mttoSlots[slotIdx].sem = null;
  card.querySelectorAll('button[data-mes]').forEach(function(b) { applyMttoActive(b, +b.dataset.mes === mesIdx); });
  var semRow = document.getElementById('semRow_' + slotIdx);
  if (semRow) {
    semRow.style.display = 'flex';
    semRow.querySelectorAll('button[data-sem]').forEach(function(sb, si) {
      sb.textContent = sb.dataset.sem + ' (' + getWeekDatesOfMonth(mesIdx, si) + ')';
      applyMttoActive(sb, false);
    });
  }
  updateMttoTextarea();
}

function selectSemForSlot(slotIdx, sem, semRow) {
  _mttoSlots[slotIdx].sem = sem;
  semRow.querySelectorAll('button[data-sem]').forEach(function(b) { applyMttoActive(b, b.dataset.sem === sem); });
  updateMttoTextarea();
}

function getWeekDatesOfMonth(monthIndex, weekIndex) {
  var year = new Date().getFullYear();
  var firstDay = new Date(year, monthIndex, 1);
  var dayOfWeek = firstDay.getDay() || 7;
  var offset = dayOfWeek === 1 ? 0 : (8 - dayOfWeek);
  var weekStart = new Date(year, monthIndex, 1 + offset + weekIndex * 7);
  var weekEnd = new Date(weekStart.getTime() + 6 * 86400000);
  return weekStart.getDate() + '/' + (weekStart.getMonth()+1) + '–' + weekEnd.getDate() + '/' + (weekEnd.getMonth()+1);
}

function updateMttoTextarea() {
  var ta = document.getElementById('invScheduleAnnual');
  if (!ta) return;
  var year = new Date().getFullYear();
  var parts = _mttoSlots.map(function(slot, i) {
    if (slot.mes === null) return 'P' + (i+1) + ': pendiente';
    if (!slot.sem) return MESES[slot.mes] + ': semana pendiente';
    var wn = +slot.sem.replace('S','');
    return MESES[slot.mes] + ' ' + slot.sem + ' (' + getWeekDatesOfMonth(slot.mes, wn-1) + '/' + year + ')';
  });
  ta.value = parts.join(' | ');
}

function clearMttoSchedule() {
  _mttoSlots = [];
  var sel = document.getElementById('invFreqSelect');
  if (sel) sel.value = '';
  var grp = document.getElementById('scheduleBuilderGroup');
  if (grp) grp.style.display = 'none';
  var ta = document.getElementById('invScheduleAnnual');
  if (ta) ta.value = '';
}

function clearManualFile() {
  var mi = document.getElementById('manualFileInput');
  if (mi) mi.value = '';
}

function generateAnnualSchedule() {}
function clearAnnualSchedule() { clearMttoSchedule(); }

window.onFreqChange = onFreqChange;
window.clearMttoSchedule = clearMttoSchedule;
window.clearManualFile = clearManualFile;
window.generateAnnualSchedule = generateAnnualSchedule;
window.clearAnnualSchedule = clearAnnualSchedule;

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
window.loadInventario = loadInventario;
window.debouncedInventarioSearch = debouncedInventarioSearch;
window.inventarioNextPage = inventarioNextPage;
window.inventarioPrevPage = inventarioPrevPage;
window.exportInventarioCSV = exportInventarioCSV;
window.editEquipo = editEquipo;
window.deleteEquipo = deleteEquipo;
window.addCalCertRow = addCalCertRow;
window.removeCalCertRow = removeCalCertRow;
