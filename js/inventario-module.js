// ============================================================================
// MÓDULO DE INVENTARIO - JavaScript Logic (HSLV) - PATCH V4
// - Evita doble carga del módulo (no redeclare)
// - Estado persistente en window.__HSLV_INVENTARIO_STATE
// - Headers auth unificados (getAuthHeader si existe)
// - Manejo de error compatible sin optional chaining
// ============================================================================

(function () {
  if (window.__HSLV_INVENTARIO_MODULE_LOADED) {
    console.warn('Inventario module already loaded; skipping re-execution.');
    return;
  }
  window.__HSLV_INVENTARIO_MODULE_LOADED = true;

  const state = window.__HSLV_INVENTARIO_STATE || (window.__HSLV_INVENTARIO_STATE = {
    currentPage: 0,
    totalRecords: 0,
    currentOffset: null,
    searchQuery: '',
    searchTimeout: null,
    allRecords: [],
    currentEditId: null,
    pageSize: 50
  });

  function getHeaders() {
    try {
      if (typeof getAuthHeader === 'function') return getAuthHeader();
    } catch (e) {}
    // Fallback: sin auth
    return {};
  }

  function safeErr(error) {
    try {
      if (error && error.response && error.response.data) {
        return error.response.data.error || JSON.stringify(error.response.data);
      }
    } catch (e) {}
    return (error && error.message) ? error.message : 'Error desconocido';
  }


// ============================================================================
// MÓDULO DE INVENTARIO - JavaScript Logic
// Sistema HSLV - Hospital San Luis de Valencia
// Adaptado a los IDs reales del index.html
// ============================================================================

// API_BASE_URL ya definido en app.js
if (typeof API_BASE_URL === 'undefined') {
  var API_BASE_URL = '/.netlify/functions';
}

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
        if (state.currentOffset) params.set('offset', state.currentOffset);
        if (state.searchQuery) params.set('q', state.searchQuery);

        const url = `${API_BASE_URL}/inventario?${params.toString()}`;
        const response = await axios.get(url, {
            headers: getHeaders()
        });

        const data = response.data;
        state.allRecords = data.data || [];
        state.currentOffset = data.offset || null;
        state.totalRecords = data.count || state.allRecords.length;

        console.log('✅ Inventario cargado:', state.allRecords.length, 'registros');

        // Actualizar contador
        const countEl = document.getElementById('inventarioCount');
        if (countEl) countEl.textContent = `${state.totalRecords} registros`;

        renderTable();
        updatePagination();

    } catch (error) {
        console.error('❌ Error cargando inventario:', error);
        tbody.innerHTML = `
            <tr>
                <td colspan="11" style="text-align:center; padding:18px; color:#c62828;">
                    ⚠️ Error al cargar el inventario<br>
                    <small>${safeErr(error) || error.message || 'Error desconocido'}</small><br>
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

    if (state.allRecords.length === 0) {
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

    tbody.innerHTML = state.allRecords.map(record => {
        const f = record.fields || {};
        const item = f['Item'] || f['ITEM'] || '';
        const equipo = f['Equipo'] || f['EQUIPO'] || '';
        const marca = f['Marca'] || f['MARCA'] || '';
        const modelo = f['Modelo'] || f['MODELO'] || '';
        const serie = f['Serie'] || f['SERIE'] || '';
        const placa = f['Numero de Placa'] || f['PLACA'] || f['Número de Placa'] || '';
        const servicio = f['Servicio'] || f['SERVICIO'] || '';
        const ubicacion = f['Ubicacion'] || f['Ubicación'] || f['UBICACIÓN'] || '';
        const vidaUtil = f['Vida Util en años'] || f['Vida Util'] || f['VIDA UTIL'] || '';
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

    if (prevBtn) prevBtn.disabled = state.currentPage === 0;
    if (nextBtn) nextBtn.disabled = !state.currentOffset;
}

function inventarioNextPage() {
    if (state.currentOffset) {
        state.currentPage++;
        loadInventario();
    }
}

function inventarioPrevPage() {
    if (state.currentPage > 0) {
        state.currentPage--;
        state.currentOffset = null;
        loadInventario();
    }
}

// ============================================================================
// BÚSQUEDA
// ============================================================================

function debouncedInventarioSearch() {
    clearTimeout(state.searchTimeout);
    state.searchTimeout = setTimeout(() => {
        const el = document.getElementById('inventarioSearch');
        state.searchQuery = el ? el.value.trim() : '';
        state.currentOffset = null;
        state.currentPage = 0;
        loadInventario();
    }, 500);
}

// ============================================================================
// EDITAR EQUIPO
// ============================================================================

async function editEquipo(recordId) {
    const record = state.allRecords.find(r => r.id === recordId);
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
    state.currentEditId = recordId;
}

// ============================================================================
// ELIMINAR EQUIPO
// ============================================================================

async function deleteEquipo(recordId, equipoName) {
    if (!confirm(`¿Eliminar el equipo "${equipoName}"?\n\nEsta acción no se puede deshacer.`)) return;

    try {
        await axios.delete(`${API_BASE_URL}/inventario/${recordId}`, {
            headers: getHeaders()
        });
        console.log('✅ Equipo eliminado');
        state.currentOffset = null;
        state.currentPage = 0;
        await loadInventario();
    } catch (error) {
        console.error('❌ Error eliminando:', error);
        alert('Error al eliminar: ' + (safeErr(error) || error.message));
    }
}

// ============================================================================
// EXPORTAR CSV
// ============================================================================

function exportInventarioCSV() {
    if (state.allRecords.length === 0) { alert('No hay datos para exportar'); return; }

    const headers = ['Item','Equipo','Marca','Modelo','Serie','Numero de Placa','Servicio','Ubicacion','Vida Util','Fecha Programada de Mantenimiento'];
    const rows = [headers.join(',')];

    state.allRecords.forEach(record => {
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

})();
