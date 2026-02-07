// ============================================================================
// MÓDULO DE INVENTARIO - JavaScript Logic
// Sistema HSLV - Hospital San Luis de Valencia
// ============================================================================

// API_BASE_URL ya está definido en app.js — no redeclarar
if (typeof API_BASE_URL === 'undefined') {
  var API_BASE_URL = '/.netlify/functions';
}
let currentPage = 0;
let totalRecords = 0;
let currentOffset = null;
let searchQuery = '';
let searchTimeout = null;
let allRecords = [];
let currentEditId = null;

// ============================================================================
// INICIALIZACIÓN
// ============================================================================

document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 Módulo de Inventario iniciado');
    loadInventario();
});

// ============================================================================
// CARGA DE DATOS
// ============================================================================

async function loadInventario() {
    const tbody = document.getElementById('tableBody');
    const paginationInfo = document.getElementById('paginationInfo');

    tbody.innerHTML = `
        <tr>
            <td colspan="11" class="loading">
                <div class="spinner"></div>
                <p>Cargando inventario...</p>
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
            headers: { Authorization: 'Bearer ok' }
        });

        const data = response.data;
        allRecords = data.data || [];
        currentOffset = data.offset || null;
        totalRecords = data.count || allRecords.length;

        console.log('✅ Inventario cargado:', allRecords.length, 'registros');

        updateStats();
        renderTable();
        updatePagination();

    } catch (error) {
        console.error('❌ Error cargando inventario:', error);
        tbody.innerHTML = `
            <tr>
                <td colspan="11" class="empty-state">
                    <div class="empty-icon">⚠️</div>
                    <div class="empty-title">Error al cargar el inventario</div>
                    <div class="empty-text">
                        ${error.response?.data?.error || error.message || 'Error desconocido'}<br>
                        <small>Verifica la configuración de Airtable en Netlify</small>
                    </div>
                    <button class="btn btn-primary" onclick="loadInventario()">
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
    const tbody = document.getElementById('tableBody');

    if (allRecords.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="11" class="empty-state">
                    <div class="empty-icon">📦</div>
                    <div class="empty-title">No hay equipos registrados</div>
                    <div class="empty-text">
                        Comienza agregando tu primer equipo al inventario
                    </div>
                    <button class="btn btn-success" onclick="openAddModal()">
                        ➕ Agregar Primer Equipo
                    </button>
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = allRecords.map(record => {
        const fields = record.fields || {};
        const item = fields['Item'] || '';
        const equipo = fields['Equipo'] || '';
        const marca = fields['Marca'] || '';
        const modelo = fields['Modelo'] || '';
        const serie = fields['Serie'] || '';
        const placa = fields['Numero de Placa'] || '';
        const servicio = fields['Servicio'] || '';
        const ubicacion = fields['Ubicacion'] || fields['Ubicación'] || '';
        const fechaMtto = fields['Fecha Programada de Mantenimiento'] || '';
        const calibrable = fields['Calibrable'] || false;

        // Determinar estado basado en fecha de mantenimiento
        let estadoBadge = '';
        if (fechaMtto) {
            const fechaMttoDate = new Date(fechaMtto);
            const hoy = new Date();
            const diasDiferencia = Math.floor((fechaMttoDate - hoy) / (1000 * 60 * 60 * 24));

            if (diasDiferencia < 0) {
                estadoBadge = '<span class="badge badge-warning">Vencido</span>';
            } else if (diasDiferencia <= 30) {
                estadoBadge = '<span class="badge badge-warning">Próximo</span>';
            } else {
                estadoBadge = '<span class="badge badge-success">Al día</span>';
            }
        } else {
            estadoBadge = '<span class="badge badge-info">Sin prog.</span>';
        }

        return `
            <tr>
                <td><strong>${escapeHtml(item)}</strong></td>
                <td>${escapeHtml(equipo)}</td>
                <td>${escapeHtml(marca)}</td>
                <td>${escapeHtml(modelo)}</td>
                <td><code style="font-family: 'JetBrains Mono', monospace; font-size: 12px;">${escapeHtml(serie)}</code></td>
                <td><code style="font-family: 'JetBrains Mono', monospace; font-size: 12px;">${escapeHtml(placa)}</code></td>
                <td>${escapeHtml(servicio)}</td>
                <td>${escapeHtml(ubicacion)}</td>
                <td>${estadoBadge}</td>
                <td>${fechaMtto ? formatDate(fechaMtto) : '—'}</td>
                <td class="td-actions">
                    <button class="btn-icon btn-edit" onclick="editEquipo('${record.id}')" title="Editar">
                        ✏️
                    </button>
                    <button class="btn-icon btn-delete" onclick="deleteEquipo('${record.id}', '${escapeHtml(equipo)}')" title="Eliminar">
                        🗑️
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

// ============================================================================
// ESTADÍSTICAS
// ============================================================================

function updateStats() {
    const totalEquiposEl = document.getElementById('totalEquipos');
    const equiposActivosEl = document.getElementById('equiposActivos');
    const equiposMantenimientoEl = document.getElementById('equiposMantenimiento');

    const total = allRecords.length;
    let activos = 0;
    let enMantenimiento = 0;

    allRecords.forEach(record => {
        const fechaMtto = record.fields?.['Fecha Programada de Mantenimiento'];
        if (fechaMtto) {
            const fechaMttoDate = new Date(fechaMtto);
            const hoy = new Date();
            const diasDiferencia = Math.floor((fechaMttoDate - hoy) / (1000 * 60 * 60 * 24));

            if (diasDiferencia <= 30 && diasDiferencia >= 0) {
                enMantenimiento++;
            } else if (diasDiferencia > 30) {
                activos++;
            }
        } else {
            activos++;
        }
    });

    animateNumber(totalEquiposEl, total);
    animateNumber(equiposActivosEl, activos);
    animateNumber(equiposMantenimientoEl, enMantenimiento);
}

function animateNumber(element, target) {
    const current = parseInt(element.textContent) || 0;
    const increment = target > current ? 1 : -1;
    const duration = 500;
    const steps = Math.abs(target - current);
    const stepDuration = steps > 0 ? duration / steps : 0;

    let value = current;
    const timer = setInterval(() => {
        value += increment;
        element.textContent = value;
        if (value === target) {
            clearInterval(timer);
        }
    }, stepDuration);
}

// ============================================================================
// PAGINACIÓN
// ============================================================================

function updatePagination() {
    const paginationInfo = document.getElementById('paginationInfo');
    const btnPrev = document.getElementById('btnPrev');
    const btnNext = document.getElementById('btnNext');

    const showing = allRecords.length;
    paginationInfo.textContent = `Mostrando ${showing} de ${totalRecords} equipos`;

    btnPrev.disabled = currentPage === 0;
    btnNext.disabled = !currentOffset;
}

function nextPage() {
    if (currentOffset) {
        currentPage++;
        loadInventario();
    }
}

function previousPage() {
    if (currentPage > 0) {
        currentPage--;
        currentOffset = null; // Airtable no soporta página anterior directamente
        loadInventario();
    }
}

// ============================================================================
// BÚSQUEDA
// ============================================================================

function debouncedSearch() {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
        searchQuery = document.getElementById('searchInput').value.trim();
        currentOffset = null;
        currentPage = 0;
        loadInventario();
    }, 500);
}

// ============================================================================
// MODAL - ABRIR/CERRAR
// ============================================================================

function openAddModal() {
    const modal = document.getElementById('equipoModal');
    const form = document.getElementById('equipoForm');
    const modalIcon = document.getElementById('modalIcon');
    const modalTitleText = document.getElementById('modalTitleText');
    const btnSave = document.getElementById('btnSave');

    form.reset();
    currentEditId = null;
    document.getElementById('recordId').value = '';

    modalIcon.textContent = '➕';
    modalTitleText.textContent = 'Nuevo Equipo';
    btnSave.innerHTML = '💾 Guardar Equipo';

    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeModal() {
    const modal = document.getElementById('equipoModal');
    modal.classList.remove('active');
    document.body.style.overflow = 'auto';
    currentEditId = null;
}

// Cerrar modal al hacer clic fuera
document.addEventListener('click', (e) => {
    const modal = document.getElementById('equipoModal');
    if (e.target === modal) {
        closeModal();
    }
});

// Cerrar modal con ESC
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        closeModal();
    }
});

// ============================================================================
// TOGGLE CALIBRACIÓN
// ============================================================================

function toggleCalibracion() {
    const checkbox = document.getElementById('calibrableCheckbox');
    const fields = document.getElementById('calibracionFields');
    fields.style.display = checkbox.checked ? 'block' : 'none';
}

// ============================================================================
// EDITAR EQUIPO
// ============================================================================

async function editEquipo(recordId) {
    try {
        // Buscar el registro en allRecords
        const record = allRecords.find(r => r.id === recordId);
        if (!record) {
            alert('Equipo no encontrado');
            return;
        }

        const modal = document.getElementById('equipoModal');
        const form = document.getElementById('equipoForm');
        const modalIcon = document.getElementById('modalIcon');
        const modalTitleText = document.getElementById('modalTitleText');
        const btnSave = document.getElementById('btnSave');

        // Actualizar UI del modal
        modalIcon.textContent = '✏️';
        modalTitleText.textContent = 'Editar Equipo';
        btnSave.innerHTML = '💾 Actualizar Equipo';

        currentEditId = recordId;
        document.getElementById('recordId').value = recordId;

        // Llenar el formulario con los datos
        const fields = record.fields || {};
        
        // Helper para establecer valores
        const setValue = (name, value) => {
            const input = form.querySelector(`[name="${name}"]`);
            if (input) {
                if (input.type === 'checkbox') {
                    input.checked = value === true || value === 'true' || value === 1;
                } else {
                    input.value = value || '';
                }
            }
        };

        // Llenar todos los campos
        Object.keys(fields).forEach(key => {
            setValue(key, fields[key]);
        });

        // Manejar campos especiales
        const calibrable = fields['Calibrable'];
        const calibrableCheckbox = document.getElementById('calibrableCheckbox');
        if (calibrableCheckbox) {
            calibrableCheckbox.checked = calibrable === true;
            toggleCalibracion();
        }

        modal.classList.add('active');
        document.body.style.overflow = 'hidden';

    } catch (error) {
        console.error('Error editando equipo:', error);
        alert('Error al cargar los datos del equipo');
    }
}

// ============================================================================
// GUARDAR EQUIPO (CREAR O ACTUALIZAR)
// ============================================================================

async function saveEquipo(event) {
    event.preventDefault();

    const form = event.target;
    const btnSave = document.getElementById('btnSave');
    const originalText = btnSave.innerHTML;

    btnSave.disabled = true;
    btnSave.innerHTML = '⏳ Guardando...';

    try {
        const formData = new FormData(form);
        const fields = {};

        // Recopilar todos los campos
        for (const [key, value] of formData.entries()) {
            if (key === 'recordId') continue; // Ignorar campo hidden

            const val = String(value).trim();
            
            // Campo booleano
            if (key === 'Calibrable') {
                fields[key] = form.querySelector(`[name="${key}"]`).checked;
                continue;
            }

            // Campos numéricos
            if (['Vida Util', 'Valor en Pesos', 'Costo de Mantenimiento'].includes(key)) {
                if (val) fields[key] = parseFloat(val) || 0;
                continue;
            }

            // Solo agregar si tiene valor
            if (val) {
                fields[key] = val;
            }
        }

        const isEdit = !!currentEditId;
        const url = `${API_BASE_URL}/inventario`;
        
        let response;
        if (isEdit) {
            // Actualizar
            response = await axios.put(url, {
                id: currentEditId,
                fields: fields
            }, {
                headers: {
                    'Authorization': 'Bearer ok',
                    'Content-Type': 'application/json'
                }
            });
        } else {
            // Crear
            response = await axios.post(url, {
                fields: fields
            }, {
                headers: {
                    'Authorization': 'Bearer ok',
                    'Content-Type': 'application/json'
                }
            });
        }

        if (response.data && (response.data.ok || response.data.record)) {
            console.log('✅ Equipo guardado exitosamente');
            
            // Cerrar modal
            closeModal();
            form.reset();

            // Recargar inventario
            currentOffset = null;
            currentPage = 0;
            await loadInventario();

            // Mostrar notificación
            showNotification(
                isEdit ? '✅ Equipo actualizado correctamente' : '✅ Equipo creado correctamente',
                'success'
            );
        } else {
            throw new Error('Respuesta inesperada del servidor');
        }

    } catch (error) {
        console.error('❌ Error guardando equipo:', error);
        
        const errorMsg = error.response?.data?.error 
            || error.response?.data?.details?.error?.message
            || error.message 
            || 'Error desconocido';

        showNotification(`❌ Error: ${errorMsg}`, 'error');
    } finally {
        btnSave.disabled = false;
        btnSave.innerHTML = originalText;
    }
}

// ============================================================================
// ELIMINAR EQUIPO
// ============================================================================

async function deleteEquipo(recordId, equipoName) {
    const confirmDelete = confirm(
        `¿Estás seguro de eliminar el equipo "${equipoName}"?\n\nEsta acción no se puede deshacer.`
    );

    if (!confirmDelete) return;

    try {
        const url = `${API_BASE_URL}/inventario/${recordId}`;
        await axios.delete(url, {
            headers: { Authorization: 'Bearer ok' }
        });

        console.log('✅ Equipo eliminado exitosamente');
        
        // Recargar inventario
        currentOffset = null;
        currentPage = 0;
        await loadInventario();

        showNotification('✅ Equipo eliminado correctamente', 'success');

    } catch (error) {
        console.error('❌ Error eliminando equipo:', error);
        
        const errorMsg = error.response?.data?.error || error.message || 'Error desconocido';
        showNotification(`❌ Error al eliminar: ${errorMsg}`, 'error');
    }
}

// ============================================================================
// EXPORTAR A CSV
// ============================================================================

function exportToCSV() {
    if (allRecords.length === 0) {
        alert('No hay datos para exportar');
        return;
    }

    const headers = [
        'Item', 'Equipo', 'Marca', 'Modelo', 'Serie', 'Numero de Placa',
        'Codigo ECRI', 'Registro INVIMA', 'Tipo de Adquisicion', 'No. de Contrato',
        'Servicio', 'Ubicacion', 'Vida Util', 'Fecha de Compra', 'Valor en Pesos',
        'Fecha de Instalacion', 'Inicio de Garantia', 'Termino de Garantia',
        'Clasificacion Biomedica', 'Clasificacion de la Tecnologia', 'Clasificacion del Riesgo',
        'Tipo de MTTO', 'Costo de Mantenimiento', 'Calibrable', 'N. Certificado',
        'Frecuencia de Mantenimiento', 'Fecha Programada de Mantenimiento',
        'Responsable', 'Nombre', 'Direccion', 'Telefono', 'Ciudad', 'Manual'
    ];

    const rows = [headers];

    allRecords.forEach(record => {
        const fields = record.fields || {};
        const row = headers.map(header => {
            const value = fields[header] || '';
            // Escapar comillas y envolver en comillas si contiene coma
            const escaped = String(value).replace(/"/g, '""');
            return escaped.includes(',') ? `"${escaped}"` : escaped;
        });
        rows.push(row);
    });

    const csv = rows.map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    const fecha = new Date().toISOString().slice(0, 10);
    link.setAttribute('href', url);
    link.setAttribute('download', `inventario_${fecha}.csv`);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showNotification(`✅ Exportado: ${allRecords.length} equipos`, 'success');
}

// ============================================================================
// UTILIDADES
// ============================================================================

function escapeHtml(str) {
    return String(str || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function formatDate(dateString) {
    if (!dateString) return '—';
    const date = new Date(dateString);
    const options = { year: 'numeric', month: 'short', day: 'numeric' };
    return date.toLocaleDateString('es-CO', options);
}

function showNotification(message, type = 'info') {
    // Crear notificación temporal
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 80px;
        right: 20px;
        background: ${type === 'success' ? '#06D6A0' : type === 'error' ? '#E63946' : '#0052CC'};
        color: white;
        padding: 16px 24px;
        border-radius: 12px;
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
        z-index: 10000;
        font-weight: 600;
        font-family: 'Outfit', sans-serif;
        animation: slideIn 0.3s ease;
    `;
    notification.textContent = message;

    document.body.appendChild(notification);

    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => {
            document.body.removeChild(notification);
        }, 300);
    }, 3000);
}

// Agregar estilos de animación
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(400px);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    @keyframes slideOut {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(400px);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);
