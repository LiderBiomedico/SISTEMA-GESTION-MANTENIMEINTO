
// ============================================================================
// HSLV - Frontend app.js (browser-safe)
// - Evita "process is not defined"
// - Incluye switchModule, openModal/closeModal y módulo Inventario
// ============================================================================

const API_BASE_URL = '/.netlify/functions';

// Token "dummy" (la función Netlify solo valida que exista Authorization).
function getAuthHeader() {
  const token =
    localStorage.getItem('HSLV_AUTH_TOKEN') ||
    localStorage.getItem('AIRTABLE_TOKEN') ||
    'ok';
  return { Authorization: `Bearer ${token}` };
}

// ------------------------------
// Navegación entre módulos
// ------------------------------
function switchModule(moduleName, evt) {
  const e = evt || window.event;

  // Ocultar módulos
  document.querySelectorAll('.module').forEach(m => m.classList.remove('active'));

  // Activar módulo seleccionado
  const mod = document.getElementById(moduleName);
  if (mod) mod.classList.add('active');

  // Nav activo
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  // Buscar nav-item por onclick que contiene el nombre (robusto sin data-attrs)
  const nav = Array.from(document.querySelectorAll('.nav-item'))
    .find(n => (n.getAttribute('onclick') || '').includes(`'${moduleName}'`) || (n.getAttribute('onclick') || '').includes(`"${moduleName}"`));
  if (nav) nav.classList.add('active');
  else if (e && e.target) {
    const closest = e.target.closest ? e.target.closest('.nav-item') : null;
    if (closest) closest.classList.add('active');
  }

  // Título
  const titles = {
    dashboard: 'Dashboard Ejecutivo',
    inventario: 'Inventario Maestro',
    equipos: 'Gestión de Equipos',
    mantenimientos: 'Historial de Intervenciones',
    planificacion: 'Planificación y Programación',
    repuestos: 'Gestión de Repuestos',
    documentos: 'Gestión Documental',
    kpis: 'Indicadores de Desempeño',
    reportes: 'Reportes e Informes',
    auditoria: 'Auditoría y Trazabilidad'
  };
  const t = document.getElementById('moduleTitle');
  if (t) t.textContent = titles[moduleName] || moduleName;

  // Cargar datos del módulo
  loadModuleData(moduleName);
}

function loadModuleData(moduleName) {
  console.log(`Cargando datos del módulo: ${moduleName}`);
  if (moduleName === 'inventario') return loadInventario();
  if (moduleName === 'dashboard' && typeof initializeDashboard === 'function') return initializeDashboard();
  // Los demás módulos siguen funcionando con tu lógica existente si la tienes en otros scripts.
}

// ------------------------------
// Modales genéricos
// ------------------------------
function openModal(modalId) {
  const el = document.getElementById(modalId);
  if (!el) return;
  el.style.display = 'block';
}

function closeModal(modalId) {
  const el = document.getElementById(modalId);
  if (!el) return;
  el.style.display = 'none';
}

// Cerrar modal al hacer clic fuera
window.addEventListener('click', (event) => {
  const modals = document.querySelectorAll('.modal');
  modals.forEach(m => {
    if (event.target === m) m.style.display = 'none';
  });
});

// ------------------------------
// Inventario (GET/POST)
// ------------------------------
let inventarioOffset = null;
let inventarioQuery = '';
let inventarioSearchTimer = null;

function debouncedInventarioSearch() {
  clearTimeout(inventarioSearchTimer);
  inventarioSearchTimer = setTimeout(() => {
    inventarioQuery = (document.getElementById('inventarioSearch')?.value || '').trim();
    inventarioOffset = null;
    loadInventario();
  }, 300);
}

async function loadInventario() {
  const tbody = document.getElementById('inventarioTableBody');
  const countEl = document.getElementById('inventarioCount');
  if (!tbody) return;

  tbody.innerHTML = `<tr><td colspan="11" style="text-align:center; padding:18px; color:#607d8b;">Cargando inventario...</td></tr>`;

  try {
    const params = new URLSearchParams();
    params.set('pageSize', '20');
    if (inventarioOffset) params.set('offset', inventarioOffset);
    if (inventarioQuery) params.set('q', inventarioQuery);

    const url = `${API_BASE_URL}/inventario?${params.toString()}`;
    const resp = await axios.get(url, { headers: getAuthHeader() });
    const data = resp.data;

    const records = (data.data || []);
    inventarioOffset = data.nextOffset || null;

    if (countEl) countEl.textContent = `${data.count ?? records.length} registros`;

    if (!records.length) {
      tbody.innerHTML = `<tr><td colspan="11" style="text-align:center; padding:18px; color:#607d8b;">Sin registros</td></tr>`;
      return;
    }

    tbody.innerHTML = records.map(r => {
      const f = r.fields || {};
      const item = f['Item'] ?? f['ITEM'] ?? '';
      const equipo = f['Equipo'] ?? f['EQUIPO'] ?? '';
      const marca = f['Marca'] ?? f['MARCA'] ?? '';
      const modelo = f['Modelo'] ?? f['MODELO'] ?? '';
      const serie = f['Serie'] ?? f['SERIE'] ?? '';
      const placa = f['Numero de Placa'] ?? f['Número de Placa'] ?? f['PLACA'] ?? '';
      const servicio = f['Servicio'] ?? f['SERVICIO'] ?? '';
      const ubic = f['Ubicación'] ?? f['UBICACIÓN'] ?? '';
      const vida = f['Vida Util'] ?? f['VIDA UTIL'] ?? '';
      const prox = f['Fecha Programada de Mantenimiento'] ?? f['FECHA PROGRAMADA DE MANTENIMINETO'] ?? '';

      return `<tr>
        <td>${escapeHtml(item)}</td>
        <td>${escapeHtml(equipo)}</td>
        <td>${escapeHtml(marca)}</td>
        <td>${escapeHtml(modelo)}</td>
        <td>${escapeHtml(serie)}</td>
        <td>${escapeHtml(placa)}</td>
        <td>${escapeHtml(servicio)}</td>
        <td>${escapeHtml(ubic)}</td>
        <td>${escapeHtml(String(vida))}</td>
        <td>${escapeHtml(String(prox))}</td>
        <td><button class="btn btn-small btn-secondary" onclick="openInventarioFromRecord('${r.id}')">Ver</button></td>
      </tr>`;
    }).join('');
  } catch (err) {
    console.error('Error cargando inventario:', err?.response?.data || err.message);
    tbody.innerHTML = `<tr><td colspan="11" style="text-align:center; padding:18px; color:#c62828;">Error cargando inventario. Revisa variables AIRTABLE_API_KEY y AIRTABLE_BASE_ID en Netlify, y que exista la tabla "Inventario".</td></tr>`;
  }
}

function inventarioNextPage() {
  if (!inventarioOffset) return;
  loadInventario();
}
function inventarioPrevPage() {
  // Airtable offset no permite "anterior" directo; reseteamos y recargamos.
  inventarioOffset = null;
  loadInventario();
}

function exportInventarioCSV() {
  const rows = [];
  rows.push(['Item','Equipo','Marca','Modelo','Serie','Placa','Servicio','Ubicación','Vida Util','Prox Mtto'].join(','));

  const tbody = document.getElementById('inventarioTableBody');
  if (!tbody) return;
  tbody.querySelectorAll('tr').forEach(tr => {
    const cols = Array.from(tr.querySelectorAll('td')).slice(0,10).map(td => `"${(td.textContent||'').replaceAll('"','""')}"`);
    if (cols.length) rows.push(cols.join(','));
  });

  const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'inventario.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

function openInventarioFromRecord(recordId) {
  // Por ahora: solo muestra el id (luego lo convertimos en editor)
  alert('Registro: ' + recordId);
}

// ------------------------------
// Guardar inventario (modal)
// ------------------------------
document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('inventarioForm');
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      await submitInventarioForm();
    });
  }

  // Carga inicial si el módulo inventario existe y está activo
  const invMod = document.getElementById('inventario');
  if (invMod && invMod.classList.contains('active')) {
    loadInventario();
  }
});

async function submitInventarioForm() {
  const form = document.getElementById('inventarioForm');
  if (!form) return;

  const fd = new FormData(form);
  const fields = {};
  for (const [k, v] of fd.entries()) {
    const val = String(v).trim();
    if (val === '') continue;
    // Normalizamos booleano "Calibrable"
    if (k === 'Calibrable') fields[k] = (val === 'true');
    else fields[k] = val;
  }

  // IMPORTANTE:
  // - Solo enviamos los campos con nombres compatibles con tu tabla actual
  // - Si decides renombrar campos en Airtable a MAYÚSCULAS, igual funcionará porque enviamos Title Case.
  const payload = { fields };

  try {
    const url = `${API_BASE_URL}/inventario`;
    const resp = await axios.post(url, payload, { headers: { ...getAuthHeader(), 'Content-Type': 'application/json' } });

    if (resp.data && resp.data.success) {
      closeModal('newInventario');
      form.reset();
      inventarioOffset = null;
      await loadInventario();
      // ir al módulo inventario si no está visible
      switchModule('inventario');
      return;
    }

    console.error('Respuesta inesperada:', resp.data);
    alert('No se pudo guardar. Revisa consola para detalles.');
  } catch (err) {
    console.error('Error guardando inventario:', err?.response?.data || err.message);
    const msg = err?.response?.data?.detail?.error?.message || err?.response?.data?.error || err.message;
    alert('Error guardando inventario: ' + msg);
  }
}

function escapeHtml(str) {
  return String(str ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

// Exponer funciones al window para onclick=""
window.switchModule = switchModule;
window.openModal = openModal;
window.closeModal = closeModal;
window.loadInventario = loadInventario;
window.debouncedInventarioSearch = debouncedInventarioSearch;
window.inventarioNextPage = inventarioNextPage;
window.inventarioPrevPage = inventarioPrevPage;
window.exportInventarioCSV = exportInventarioCSV;
window.openInventarioFromRecord = openInventarioFromRecord;
