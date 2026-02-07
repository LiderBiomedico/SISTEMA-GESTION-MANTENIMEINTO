// ============================================================================
// MODULO DE INVENTARIO - JavaScript Logic
// Sistema HSLV - Hospital San Luis de Valencia
// Adaptado a los IDs reales del index.html
// ============================================================================

// API_BASE_URL ya definido en app.js
if (typeof API_BASE_URL === 'undefined') {
  var API_BASE_URL = '/.netlify/functions';
}

function getHeaders() {
  if (typeof getAuthHeader === 'function') return getAuthHeader();
  return { Authorization: 'Bearer ok' };
}

function escapeHtml(str) {
  str = (str === null || typeof str === 'undefined') ? '' : String(str);
  return str.replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
}



let currentPage = 0;
let totalRecords = 0;
let currentOffset = null;
let searchQuery = '';
let searchTimeout = null;
let allRecords = [];
let currentEditId = null;

// ============================================================================
// INICIALIZACION
// ============================================================================

document.addEventListener('DOMContentLoaded', () => {
    console.log(' Modulo de Inventario iniciado');
    // Solo cargar si el modulo inventario esta activo
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
        console.warn(' No se encontro tbody para inventario (inventarioTbody/tableBody/inventarioTableBody)');
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
        if (currentOffset) params.set('offset', currentOffset);
        if (searchQuery) params.set('q', searchQuery);

        const url = `${API_BASE_URL}/inventario?${params.toString()}`;
        const response = await axios.get(url, {
            headers: getHeaders()
        });

        const data = response.data;
        allRecords = data.data || [];
        currentOffset = data.offset || null;
        totalRecords = data.count || allRecords.length;

        console.log(' Inventario cargado:', allRecords.length, 'registros');

        // Actualizar contador
        const countEl = document.getElementById('inventarioCount');
        if (countEl) countEl.textContent = `${totalRecords} registros`;

        renderTable();
        updatePagination();

    } catch (error) {
        console.error('Error cargando inventario:', error);
        const serverErr = (error && error.response && error.response.data && error.response.data.error) ? error.response.data.error : null;
        const msg = serverErr || (error && error.message) || 'Error desconocido';
        const safeMsg = escapeHtml(msg);
        tbody.innerHTML = (
            '<tr>' +
              '<td colspan="11" style="text-align:center; padding:18px; color:#c62828;">' +
                'Error al cargar el inventario<br>' +
                '<small>' + safeMsg + '</small><br>' +
                '<button class="btn btn-primary" onclick="loadInventario()" style="margin-top:10px">Reintentar</button>' +
              '</td>' +
            '</tr>'
        );
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
                     No hay equipos registrados.<br>
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
        const placa = f['Numero de Placa'] || f['PLACA'] || f['Numero de Placa'] || '';
        const servicio = f['Servicio'] || f['SERVICIO'] || '';
        const ubicacion = f['Ubicacion'] || f['Ubicacion'] || f['UBICACION'] || '';
        const vidaUtil = f['Vida Util'] || f['VIDA UTIL'] || '';
        const fechaMtto = f['Fecha Programada de Mantenimiento'] || f['FECHA PROGRAMADA DE MANTENIMINETO'] || '';

        // Estado basado en fecha
        let estadoText = '';
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
                <button class="btn btn-small btn-secondary" onclick="editEquipo('${record.id}')" title="Editar"></button>
                <button class="btn btn-small" onclick="deleteEquipo('${record.id}', '${esc(equipo)}')" title="Eliminar" style="color:#c62828;"></button>
            </td>
        </tr>`;
    }).join('');
}

// ============================================================================
// PAGINACION
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
// BUSQUEDA
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
    if (!confirm(`Eliminar el equipo "${equipoName}"?\n\nEsta accion no se puede deshacer.`)) return;

    try {
        await axios.delete(`${API_BASE_URL}/inventario/${recordId}`, {
            headers: getHeaders()
        });
        console.log(' Equipo eliminado');
        currentOffset = null;
        currentPage = 0;
        await loadInventario();
    } catch (error) {
        console.error('Error eliminando:', error);
        const serverErr = (error && error.response && error.response.data && error.response.data.error) ? error.response.data.error : null;
        const msg = serverErr || (error && error.message) || 'Error';
        alert('Error al eliminar: ' + msg);
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