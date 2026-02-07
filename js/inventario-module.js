// ============================================================================
// MÓDULO DE INVENTARIO - JavaScript Logic
// Sistema HSLV - Inventario Maestro
// Nota: protegido contra carga duplicada (evita "Identifier ... already been declared")
// ============================================================================

(function () {
  if (typeof window !== 'undefined' && window.__HSLV_INVENTARIO_MODULE_LOADED__) return;
  if (typeof window !== 'undefined') window.__HSLV_INVENTARIO_MODULE_LOADED__ = true;

if (typeof API_BASE_URL === 'undefined') {
  var API_BASE_URL = '/.netlify/functions';
}

let currentPage = 0;
let totalRecords = 0;
let searchQuery = '';
let searchTimeout = null;
let allRecords = [];
let currentEditId = null;

// ============================================================================
// INICIALIZACIÓN
// ============================================================================

document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 Módulo de Inventario iniciado');
    // Solo cargar si el módulo inventario está activo
    const invMod = document.getElementById('inventario');
    if (invMod && invMod.classList.contains('active')) {
        loadInventario();
    }
});

// ============================================================================
// CARGA DE DATOS
// ============================================================================

async function loadInventario() {
    // Buscar tbody con cualquiera de los IDs posibles
    const tbody = document.getElementById('inventarioTbody') 
                || document.getElementById('tableBody')
                || document.getElementById('inventarioTableBody');
    if (!tbody) {
        console.warn('⚠️ No se encontró tbody para inventario (inventarioTbody/tableBody/inventarioTableBody)');
        return;
    }

    tbody.innerHTML = `
        <tr>
            <td colspan="11" style="text-align:center; padding:18px; color:#607d8b;">
                Cargando inventario...
            </td>
        </tr>
    `;

    try {
        const params = new URLSearchParams();
        params.set('pageSize', '50');
        const offset = (typeof window !== 'undefined' && window.inventarioOffset) ? window.inventarioOffset : null;
        if (offset) params.set('offset', offset);
        if (searchQuery) params.set('q', searchQuery);

        const url = `${API_BASE_URL}/inventario?${params.toString()}`;
        const response = await axios.get(url, {
            headers: (typeof getAuthHeader === 'function' ? getAuthHeader() : { Authorization: 'Bearer ok' })
        });

        const data = response.data;
        allRecords = data.data || [];
        if (typeof window !== 'undefined') window.inventarioOffset = data.offset || null;
        totalRecords = data.count || allRecords.length;

        console.log('✅ Inventario cargado:', allRecords.length, 'registros');

        // Actualizar contador
        const countEl = document.getElementById('inventarioCount');
        if (countEl) countEl.textContent = `${totalRecords} registros`;

        renderTable();
        updatePagination();

    } catch (error) {
        console.error('❌ Error cargando inventario:', error);
        tbody.innerHTML = `
            <tr>
                <td colspan="11" style="text-align:center; padding:18px; color:#c62828;">
                    ⚠️ Error al cargar el inventario<br>
                    <small>${(error && error.response && error.response.data && (error.response.data.error || error.response.data.message)) || error.message || 'Error desconocido'}</small><br>
                    <button class="btn btn-primary" onclick="loadInventario()" style="margin-top:10px">
                        🔄 Reintentar
                    </button>
                </td>
            </tr>
        `;
    }
}

// ============================================================================
// RENDERIZADO DE TABLA
// ============================================================================

function renderTable() {
    const tbody = document.getElementById('inventarioTbody') 
                || document.getElementById('tableBody')
                || document.getElementById('inventarioTableBody');
    if (!tbody) return;

    if (allRecords.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="11" style="text-align:center; padding:18px; color:#607d8b;">
                    📦 No hay equipos registrados.<br>
                    <small>Comienza agregando tu primer equipo al inventario.</small>
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = allRecords.map(record => {
        const f = record.fields || {};
        const item = f['Item'] || f['ITEM'] || '';
        const equipo = f['Equipo'] || f['EQUIPO'] || '';
        const marca = f['Marca'] || f['MARCA'] || '';
        const modelo = f['Modelo'] || f['MODELO'] || '';
        const serie = f['Serie'] || f['SERIE'] || '';
        const placa = f['Numero de Placa'] || f['PLACA'] || f['Número de Placa'] || '';
        const servicio = f['Servicio'] || f['SERVICIO'] || '';
        const ubicacion = f['Ubicacion'] || f['Ubicación'] || f['UBICACIÓN'] || '';
        const vidaUtil = f['Vida Util'] || f['VIDA UTIL'] || '';
        const fechaMtto = f['Fecha Programada de Mantenimiento'] || f['FECHA PROGRAMADA DE MANTENIMINETO'] || '';

        // Estado basado en fecha
        let estadoText = '—';
        if (fechaMtto) {
            const d = new Date(fechaMtto);
            estadoText = d.toLocaleDateString('es-CO', { year: 'numeric', month: 'short', day: 'numeric' });
        }

        return `<tr>
            <td>${esc(item)}</td>
            <td>${esc(equipo)}</td>
            <td>${esc(marca)}</td>
            <td>${esc(modelo)}</td>
            <td>${esc(serie)}</td>
            <td>${esc(placa)}</td>
            <td>${esc(servicio)}</td>
            <td>${esc(ubicacion)}</td>
            <td>${esc(String(vidaUtil))}</td>
            <td>${estadoText}</td>
            <td>
                <button class="btn btn-small btn-secondary" onclick="editEquipo('${record.id}')" title="Editar">✏️</button>
                <button class="btn btn-small" onclick="deleteEquipo('${record.id}', '${esc(equipo)}')" title="Eliminar" style="color:#c62828;">🗑️</button>
            </td>
        </tr>`;
    }).join('');
}

// ============================================================================
// PAGINACIÓN
// ============================================================================

function updatePagination() {
    const prevBtn = document.getElementById('inventarioPrevBtn');
    const nextBtn = document.getElementById('inventarioNextBtn');

    if (prevBtn) prevBtn.disabled = currentPage === 0;
    if (nextBtn) nextBtn.disabled = !currentOffset;
}

function inventarioNextPage() {
    if (currentOffset) {
        currentPage++;
        loadInventario();
    }
}

function inventarioPrevPage() {
    if (currentPage > 0) {
        currentPage--;
        currentOffset = null;
        loadInventario();
    }
}

// ============================================================================
// BÚSQUEDA
// ============================================================================

function debouncedInventarioSearch() {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
        const el = document.getElementById('inventarioSearch');
        searchQuery = el ? el.value.trim() : '';
        currentOffset = null;
        currentPage = 0;
        loadInventario();
    }, 500);
}

// ============================================================================
// EDITAR EQUIPO
// ============================================================================

async function editEquipo(recordId) {
    const record = allRecords.find(r => r.id === recordId);
    if (!record) { alert('Equipo no encontrado'); return; }
    // Abrir modal newInventario y llenar con datos
    openModal('newInventario');
    const form = document.getElementById('inventarioForm');
    if (!form) return;

    const fields = record.fields || {};
    // Llenar campos del formulario
    for (const input of form.querySelectorAll('input, select, textarea')) {
        const name = input.name;
        if (!name) continue;
        const val = fields[name] || '';
        if (input.type === 'checkbox') {
            input.checked = val === true || val === 'true';
        } else {
            input.value = val || '';
        }
    }
    currentEditId = recordId;
}

// ============================================================================
// ELIMINAR EQUIPO
// ============================================================================

async function deleteEquipo(recordId, equipoName) {
    if (!confirm(`¿Eliminar el equipo "${equipoName}"?\n\nEsta acción no se puede deshacer.`)) return;

    try {
        await axios.delete(`${API_BASE_URL}/inventario/${recordId}`, {
            headers: (typeof getAuthHeader === 'function' ? getAuthHeader() : { Authorization: 'Bearer ok' })
        });
        console.log('✅ Equipo eliminado');
        currentOffset = null;
        currentPage = 0;
        await loadInventario();
    } catch (error) {
        console.error('❌ Error eliminando:', error);
        alert('Error al eliminar: ' + ((error && error.response && error.response.data && (error.response.data.error || error.response.data.message)) || error.message));
    }
}

// ============================================================================
// EXPORTAR CSV
// ============================================================================

function exportInventarioCSV() {
    if (allRecords.length === 0) { alert('No hay datos para exportar'); return; }

    const headers = ['Item','Equipo','Marca','Modelo','Serie','Numero de Placa','Servicio','Ubicacion','Vida Util','Fecha Programada de Mantenimiento'];
    const rows = [headers.join(',')];

    allRecords.forEach(record => {
        const f = record.fields || {};
        const row = headers.map(h => {
            const v = String(f[h] || '').replace(/"/g, '""');
            return v.includes(',') ? `"${v}"` : v;
        });
        rows.push(row.join(','));
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
// UTILIDADES
// ============================================================================

function esc(str) {
    return String(str || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// Exponer funciones
window.loadInventario = loadInventario;
window.inventarioNextPage = inventarioNextPage;
window.inventarioPrevPage = inventarioPrevPage;
window.debouncedInventarioSearch = debouncedInventarioSearch;
window.exportInventarioCSV = exportInventarioCSV;
window.editEquipo = editEquipo;
window.deleteEquipo = deleteEquipo;

  
  // Fallback: si app.js no expuso switchModule por algún motivo, crear versión mínima
  if (typeof window !== 'undefined' && typeof window.switchModule !== 'function') {
    window.switchModule = function (moduleName, evt) {
      document.querySelectorAll('.module').forEach(m => m.classList.remove('active'));
      const mod = document.getElementById(moduleName);
      if (mod) mod.classList.add('active');
      document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
      const e = evt || window.event;
      if (e && e.target && e.target.closest) {
        const closest = e.target.closest('.nav-item');
        if (closest) closest.classList.add('active');
      }
    };
  }
// Exponer funciones requeridas por onclick en index.html
  if (typeof window !== 'undefined') {
    window.loadInventario = loadInventario;
  }
})();
