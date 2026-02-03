// ============================================================================
// SISTEMA DE GESTIÓN DE MANTENIMIENTO HOSPITALARIO
// Frontend Logic - app.js
// ============================================================================

// CONFIG
const API_BASE_URL = (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'))
    ? 'http://localhost:9000/.netlify/functions'
    : '/.netlify/functions';

// Token simple para pasar el header Authorization (puedes mejorarlo con auth real si lo necesitas)
const AUTH_TOKEN = 'public';

// Configuración de Airtable
const AIRTABLE_CONFIG = {
    apiKey: (typeof process !== 'undefined' && process.env && process.env.REACT_APP_AIRTABLE_API_KEY) ? process.env.REACT_APP_AIRTABLE_API_KEY : 'YOUR_API_KEY',
    baseId: (typeof process !== 'undefined' && process.env && process.env.REACT_APP_AIRTABLE_BASE_ID) ? process.env.REACT_APP_AIRTABLE_BASE_ID : 'YOUR_BASE_ID',
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
    // Ocultar todos los módulos
    document.querySelectorAll('.module').forEach(m => m.classList.remove('active'));
    
    // Deseleccionar todos los nav items
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    
    // Mostrar módulo seleccionado
    document.getElementById(moduleName).classList.add('active');
    
    // Marcar nav item como activo
    event.target.closest('.nav-item').classList.add('active');
    
    // Actualizar título
    const titles = {
        dashboard: '📊 Dashboard Ejecutivo',
        equipos: '🔧 Gestión de Equipos',
        inventario: '🗃️ Inventario Maestro',
        mantenimientos: '📋 Historial de Intervenciones',
        planificacion: '📅 Planificación y Programación',
        repuestos: '📦 Gestión de Repuestos',
        documentos: '📄 Gestión Documental',
        kpis: '📈 Indicadores de Desempeño',
        reportes: '📑 Reportes e Informes',
        auditoria: '🔍 Auditoría y Trazabilidad'
    };
    
    document.getElementById('moduleTitle').textContent = titles[moduleName] || moduleName;
    
    // Cargar datos del módulo
    loadModuleData(moduleName);
}

function loadModuleData(moduleName) {
    console.log(`Cargando datos del módulo: ${moduleName}`);
    
    // Simular carga de datos (se reemplazaría con llamadas API)
    switch(moduleName) {
        case 'dashboard':
            initializeDashboard();
            break;
        case 'equipos':
            loadEquipos();
            break;
        case 'inventario':
            loadInventario(true);
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
// DASHBOARD EJECUTIVO
// ============================================================================

function initializeDashboard() {
    // Mostrar alerta de sincronización
    const alert = document.getElementById('dashboardAlert');
    alert.style.display = 'block';
    setTimeout(() => alert.style.display = 'none', 5000);
    
    // Inicializar gráficos
    initMTBFChart();
    initComplianceChart();
    initMaintenanceTypeChart();
    
    // Cargar datos en tiempo real
    fetchDashboardData();
}

function initMTBFChart() {
    const ctx = document.getElementById('mtbfChart');
    if (!ctx) return;
    
    new Chart(ctx, {
        type: 'line',
        data: {
            labels: ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'],
            datasets: [
                {
                    label: 'MTBF (Horas)',
                    data: [2400, 2500, 2450, 2600, 2700, 2750, 2800, 2850, 2900, 2920, 2870, 2847],
                    borderColor: '#0d47a1',
                    backgroundColor: 'rgba(13, 71, 161, 0.05)',
                    tension: 0.4,
                    fill: true
                },
                {
                    label: 'MTTR (Horas)',
                    data: [5.2, 5.1, 5.0, 4.9, 4.8, 4.7, 4.6, 4.5, 4.4, 4.3, 4.2, 4.2],
                    borderColor: '#ff6f00',
                    backgroundColor: 'rgba(255, 111, 0, 0.05)',
                    tension: 0.4,
                    fill: true
                }
            ]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    position: 'top',
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    max: 6000
                }
            }
        }
    });
}

function initComplianceChart() {
    const ctx = document.getElementById('complianceChart');
    if (!ctx) return;
    
    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Imagenología', 'Laboratorio', 'UCI', 'Quirófano', 'Emergencias', 'Hospitalización'],
            datasets: [{
                label: 'Cumplimiento Plan (%)',
                data: [96, 92, 94, 98, 88, 93],
                backgroundColor: [
                    '#2e7d32',
                    '#2e7d32',
                    '#f57f17',
                    '#2e7d32',
                    '#c62828',
                    '#2e7d32'
                ],
                borderRadius: 4
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                x: {
                    max: 100
                }
            }
        }
    });
}

function initMaintenanceTypeChart() {
    const ctx = document.getElementById('maintenanceTypeChart');
    if (!ctx) return;
    
    new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Preventivo', 'Correctivo', 'Predictivo', 'Calibración'],
            datasets: [{
                data: [58, 25, 12, 5],
                backgroundColor: [
                    '#0d47a1',
                    '#ff6f00',
                    '#1976d2',
                    '#4caf50'
                ],
                borderColor: 'white',
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    position: 'right',
                }
            }
        }
    });
}

async function fetchDashboardData() {
    try {
        const response = await axios.get(`${API_BASE_URL}/kpis/dashboard`);
        const data = response.data;
        
        // Actualizar KPIs
        document.getElementById('kpiEquipos').textContent = data.equipos.total;
        document.getElementById('kpiCumplimiento').textContent = data.cumplimiento + '%';
        document.getElementById('kpiPendientes').textContent = data.pendientes;
        document.getElementById('kpiMTBF').textContent = Math.round(data.mtbf) + 'h';
        document.getElementById('kpiMTTR').textContent = data.mttr.toFixed(1) + 'h';
        document.getElementById('kpiCosto').textContent = '$' + (data.costo / 1000).toFixed(0) + 'K';
    } catch (error) {
        console.error('Error cargando dashboard:', error);
    }
}

// ============================================================================
// GESTIÓN DE EQUIPOS
// ============================================================================

async function loadEquipos() {
    try {
        const response = await axios.get(`${API_BASE_URL}/equipos`);
        console.log('Equipos cargados:', response.data);
    } catch (error) {
        console.error('Error cargando equipos:', error);
    }
}

// ============================================================================
// GESTIÓN DE MANTENIMIENTOS
// ============================================================================

async function loadMantenimientos() {
    try {
        const response = await axios.get(`${API_BASE_URL}/mantenimientos`);
        console.log('Mantenimientos cargados:', response.data);
    } catch (error) {
        console.error('Error cargando mantenimientos:', error);
    }
}

// ============================================================================
// GESTIÓN DE KPIs
// ============================================================================

async function loadKPIs() {
    try {
        const response = await axios.get(`${API_BASE_URL}/kpis`);
        
        const ctx = document.getElementById('kpiDetailChart');
        if (!ctx) return;
        
        new Chart(ctx, {
            type: 'radar',
            data: {
                labels: ['MTBF', 'MTTR', 'Cumplimiento', 'Disponibilidad', 'Eficiencia', 'Confiabilidad'],
                datasets: [{
                    label: 'Desempeño Actual',
                    data: [85, 90, 94, 92, 88, 86],
                    borderColor: '#0d47a1',
                    backgroundColor: 'rgba(13, 71, 161, 0.1)',
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                scales: {
                    r: {
                        beginAtZero: true,
                        max: 100
                    }
                }
            }
        });
    } catch (error) {
        console.error('Error cargando KPIs:', error);
    }
}

// ============================================================================
// MODALES
// ============================================================================

function openModal(modalId) {
    document.getElementById(modalId).classList.add('active');
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('active');
}

// Cerrar modal al hacer click fuera del contenido
document.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal')) {
        e.target.classList.remove('active');
    }
});

// ============================================================================
// FUNCIONES DE EXPORTACIÓN
// ============================================================================

function exportData() {
    const currentModule = document.querySelector('.module.active').id;
    console.log('Exportando datos del módulo:', currentModule);
    alert('Exportando datos en formato Excel...');
}

function printModule() {
    window.print();
}

// ============================================================================
// INTEGRACIÓN CON AIRTABLE
// ============================================================================

class AirtableAPI {
    constructor(apiKey, baseId) {
        this.apiKey = apiKey;
        this.baseId = baseId;
        this.baseUrl = `https://api.airtable.com/v0/${baseId}`;
    }

    async getRecords(tableName, options = {}) {
        try {
            const response = await axios.get(
                `${this.baseUrl}/${tableName}`,
                {
                    headers: {
                        'Authorization': `Bearer ${this.apiKey}`
                    },
                    params: options
                }
            );
            return response.data.records;
        } catch (error) {
            console.error(`Error fetching from ${tableName}:`, error);
            throw error;
        }
    }

    async createRecord(tableName, fields) {
        try {
            const response = await axios.post(
                `${this.baseUrl}/${tableName}`,
                { records: [{ fields }] },
                {
                    headers: {
                        'Authorization': `Bearer ${this.apiKey}`,
                        'Content-Type': 'application/json'
                    }
                }
            );
            return response.data.records[0];
        } catch (error) {
            console.error(`Error creating record in ${tableName}:`, error);
            throw error;
        }
    }

    async updateRecord(tableName, recordId, fields) {
        try {
            const response = await axios.patch(
                `${this.baseUrl}/${tableName}/${recordId}`,
                { fields },
                {
                    headers: {
                        'Authorization': `Bearer ${this.apiKey}`
                    }
                }
            );
            return response.data;
        } catch (error) {
            console.error(`Error updating record in ${tableName}:`, error);
            throw error;
        }
    }

    async deleteRecord(tableName, recordId) {
        try {
            await axios.delete(
                `${this.baseUrl}/${tableName}/${recordId}`,
                {
                    headers: {
                        'Authorization': `Bearer ${this.apiKey}`
                    }
                }
            );
        } catch (error) {
            console.error(`Error deleting record in ${tableName}:`, error);
            throw error;
        }
    }
}

// Inicializar instancia de Airtable
const airtable = new AirtableAPI(AIRTABLE_CONFIG.apiKey, AIRTABLE_CONFIG.baseId);

// ============================================================================
// INICIALIZACIÓN
// ============================================================================

document.addEventListener('DOMContentLoaded', () => {
    console.log('Sistema de Gestión de Mantenimiento Hospitalario iniciado');
    initializeDashboard();
    
    // Cargar datos periódicamente (cada 5 minutos)
    setInterval(() => {
        const activeModule = document.querySelector('.module.active').id;
        if (activeModule === 'dashboard') {
            fetchDashboardData();
        }
    }, 300000);
});


// ============================================================================
// INVENTARIO (AIRTABLE + NETLIFY FUNCTIONS)
// ============================================================================

const INVENTARIO_TABLE = 'Inventario'; // nombre sugerido de tabla en Airtable

let inventarioState = {
    pageSize: 20,
    query: '',
    // Airtable usa un offset string para paginar
    currentOffset: null,
    nextOffset: null,
    // stack para botón "Anterior"
    offsetStack: [null],
    data: []
};

function getAuthHeaders() {
    return { 'Authorization': `Bearer ${AUTH_TOKEN}` };
}

function escapeHtml(str) {
    return String(str ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}

function parseISODate(value) {
    if (!value) return null;
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d;
}

function fmtDate(value) {
    const d = parseISODate(value);
    if (!d) return '';
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
}

function computeProxMtto(fields = {}) {
    // 1) Fecha programada directa
    if (fields['FECHA PROGRAMADA DE MANTENIMINETO']) return fmtDate(fields['FECHA PROGRAMADA DE MANTENIMINETO']);

    // 2) Primera fecha en programación anual (si está en formato: "YYYY-MM-DD, YYYY-MM-DD...")
    const sched = fields['PROGRAMACION DE MANTENIMIENTO ANUAL'];
    if (sched && typeof sched === 'string') {
        const first = sched.split(/[\n,;]/).map(s => s.trim()).find(Boolean);
        if (first) return first;
    }
    return '';
}

function setInventarioCount(n) {
    const el = document.getElementById('inventarioCount');
    if (el) el.textContent = `${n} registros`;
}

function setInventarioPagingButtons() {
    const prevBtn = document.getElementById('inventarioPrevBtn');
    const nextBtn = document.getElementById('inventarioNextBtn');
    if (prevBtn) prevBtn.disabled = inventarioState.offsetStack.length <= 1;
    if (nextBtn) nextBtn.disabled = !inventarioState.nextOffset;
}

function renderInventarioTable(records = []) {
    const tbody = document.getElementById('inventarioTbody');
    if (!tbody) return;

    if (!records.length) {
        tbody.innerHTML = `<tr><td colspan="11" class="text-muted" style="padding: 18px; text-align:center;">Sin registros para mostrar</td></tr>`;
        return;
    }

    tbody.innerHTML = records.map(r => {
        const f = r.fields || r;
        const prox = computeProxMtto(f);

        return `
            <tr data-id="${escapeHtml(r.id || '')}">
                <td data-col="ITEM">${escapeHtml(f['ITEM'])}</td>
                <td data-col="EQUIPO">${escapeHtml(f['EQUIPO'])}</td>
                <td data-col="MARCA">${escapeHtml(f['MARCA'])}</td>
                <td data-col="MODELO">${escapeHtml(f['MODELO'])}</td>
                <td data-col="SERIE">${escapeHtml(f['SERIE'])}</td>
                <td data-col="PLACA">${escapeHtml(f['PLACA'])}</td>
                <td data-col="SERVICIO">${escapeHtml(f['SERVICIO'])}</td>
                <td data-col="UBICACIÓN">${escapeHtml(f['UBICACIÓN'])}</td>
                <td data-col="VIDA UTIL">${escapeHtml(f['VIDA UTIL'])}</td>
                <td data-col="PROX_MTTO">${escapeHtml(prox)}</td>
                <td>
                    <button class="btn btn-small btn-secondary" onclick="openInventarioEdit('${escapeHtml(r.id)}')">Ver / Editar</button>
                </td>
            </tr>
        `;
    }).join('');

    setInventarioCount(records.length);
}

async function loadInventario(reset = false) {
    try {
        const searchEl = document.getElementById('inventarioSearch');
        const query = (searchEl?.value || '').trim();

        if (reset) {
            inventarioState.query = query;
            inventarioState.currentOffset = null;
            inventarioState.nextOffset = null;
            inventarioState.offsetStack = [null];
        } else {
            inventarioState.query = query;
        }

        const params = new URLSearchParams();
        params.set('pageSize', String(inventarioState.pageSize));
        if (inventarioState.query) params.set('q', inventarioState.query);
        if (inventarioState.currentOffset) params.set('offset', inventarioState.currentOffset);

        const res = await axios.get(`${API_BASE_URL}/inventario?${params.toString()}`, { headers: getAuthHeaders() });
        const payload = res.data;

        const records = payload?.data || [];
        inventarioState.data = records;
        inventarioState.nextOffset = payload?.nextOffset || null;

        renderInventarioTable(records);
        setInventarioPagingButtons();
    } catch (err) {
        console.error('Error cargando inventario:', err);
        const tbody = document.getElementById('inventarioTbody');
        if (tbody) tbody.innerHTML = `<tr><td colspan="11" class="text-muted" style="padding: 18px; text-align:center;">Error cargando inventario. Revisa AIRTABLE_API_KEY y AIRTABLE_BASE_ID en Netlify.</td></tr>`;
        setInventarioCount(0);
        setInventarioPagingButtons();
    }
}

function inventarioNextPage() {
    if (!inventarioState.nextOffset) return;
    inventarioState.currentOffset = inventarioState.nextOffset;
    inventarioState.offsetStack.push(inventarioState.currentOffset);
    loadInventario(false);
}

function inventarioPrevPage() {
    if (inventarioState.offsetStack.length <= 1) return;
    inventarioState.offsetStack.pop();
    inventarioState.currentOffset = inventarioState.offsetStack[inventarioState.offsetStack.length - 1] || null;
    loadInventario(false);
}

function toggleInventarioColumns() {
    // Simple: alterna columnas secundarias (MARCA/MODELO/VIDA UTIL)
    const cols = ['MARCA', 'MODELO', 'VIDA UTIL'];
    cols.forEach(col => {
        document.querySelectorAll(`[data-col="${col}"]`).forEach(el => el.classList.toggle('hidden'));
    });
}

function exportInventarioCSV() {
    const records = inventarioState.data || [];
    if (!records.length) {
        alert('No hay datos para exportar.');
        return;
    }

    const fieldsOrder = [
        'ITEM','EQUIPO','MARCA','MODELO','FECHA FABRICA','SERIE','CERTIFICADO 2025','PLACA','CODIGO ECRI','REGISTRO INVIMA',
        'TIPO DE ADQUISICION','NO. DE CONTRATO','SERVICIO','UBICACIÓN','VIDA UTIL',
        'FECHA DE COMRPA','VALOR EN PESOS','FECHA DE RECEPCIÓN','FECHA DE INSTALACIÓN','INICIO DE GARANTIA','TERMINO DE GARANTIA',
        'CLASIFICACION BIOMEDICA','CLASIFICACION DE LA TECNOLOGIA','CLASIFICACION DEL RIESGO','MANUAL',
        'TIPO DE MTTO','COSTO DE MANTENIMIENTO','NOMBRE','DIRECCION','TELEFONO','CIUDAD',
        'CALIBRABLE','N. CERTIFICADO','FRECUENCIA DE MTTO PREVENTIVO','FECHA PROGRAMADA DE MANTENIMINETO',
        'RESPONSABLE','FRECUENCIA DE MANTENIMIENTO','PROGRAMACION DE MANTENIMIENTO ANUAL'
    ];

    const rows = records.map(r => {
        const f = r.fields || r;
        return fieldsOrder.map(k => {
            const v = f[k] ?? '';
            const s = String(v).replaceAll('"', '""');
            return `"${s}"`;
        }).join(',');
    });

    const header = fieldsOrder.map(k => `"${k.replaceAll('"','""')}"`).join(',');
    const csv = [header, ...rows].join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `inventario_${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
}

function collectInventarioFormFields(formEl) {
    const fd = new FormData(formEl);
    const fields = {};

    for (const [k, v] of fd.entries()) {
        const val = String(v).trim();
        if (val === '') continue;

        // Campos numéricos
        if (k === 'VALOR EN PESOS' || k === 'COSTO DE MANTENIMIENTO') {
            const n = Number(val);
            if (!Number.isNaN(n)) fields[k] = n;
            continue;
        }

        fields[k] = val;
    }

    // MANUAL: si se proporciona un URL, lo mandamos como attachment por URL (Airtable acepta array)
    if (fields['MANUAL']) {
        const url = fields['MANUAL'];
        // guardamos como attachment si el campo en Airtable es "Attachment", si no, queda como texto.
        // Para compatibilidad, enviamos como texto; si el campo es attachment, Airtable requiere array.
        // En el backend lo convertimos si detecta que parece URL.
    }

    return fields;
}

async function saveInventarioRecord(recordId, fields) {
    const method = recordId ? 'PUT' : 'POST';
    const payload = recordId ? { id: recordId, fields } : { fields };

    const res = await axios({
        url: `${API_BASE_URL}/inventario`,
        method,
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        data: payload
    });

    return res.data;
}

function ensureHiddenIdField(formEl) {
    let hid = formEl.querySelector('input[name="__recordId"]');
    if (!hid) {
        hid = document.createElement('input');
        hid.type = 'hidden';
        hid.name = '__recordId';
        formEl.appendChild(hid);
    }
    return hid;
}

function fillInventarioForm(fields = {}, recordId = '') {
    const formEl = document.getElementById('inventarioForm');
    if (!formEl) return;

    const hid = ensureHiddenIdField(formEl);
    hid.value = recordId || '';

    // set values
    Array.from(formEl.elements).forEach(el => {
        if (!el.name || el.name === '__recordId') return;
        if (el.type === 'checkbox') {
            el.checked = !!fields[el.name];
        } else if (el.tagName === 'SELECT' || el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') {
            if (fields[el.name] != null) el.value = fields[el.name];
            else el.value = '';
        }
    });
}

function openInventarioEdit(recordId) {
    const rec = (inventarioState.data || []).find(r => r.id === recordId);
    if (!rec) {
        alert('No se encontró el registro en la página actual. Actualiza la vista.');
        return;
    }
    fillInventarioForm(rec.fields || rec, rec.id);
    openModal('newInventario');
}

function clearInventarioForm() {
    const formEl = document.getElementById('inventarioForm');
    if (!formEl) return;
    formEl.reset();
    const hid = ensureHiddenIdField(formEl);
    hid.value = '';
    // limpiar textarea programación anual
    const sched = document.getElementById('invScheduleAnnual');
    if (sched) sched.value = '';
}

function clearAnnualSchedule() {
    const sched = document.getElementById('invScheduleAnnual');
    if (sched) sched.value = '';
}

function generateAnnualSchedule() {
    const freq = document.getElementById('invFreqSelect')?.value || '';
    const start = document.getElementById('invStartDate')?.value || '';
    if (!freq || !start) {
        alert('Selecciona FRECUENCIA y FECHA PROGRAMADA (inicio) para generar la programación anual.');
        return;
    }

    const startDate = new Date(start + 'T00:00:00');
    if (isNaN(startDate.getTime())) {
        alert('Fecha inicial inválida.');
        return;
    }

    const monthsMap = {
        'Mensual': 1,
        'Bimestral': 2,
        'Trimestral': 3,
        'Cuatrimestral': 4,
        'Semestral': 6,
        'Anual': 12
    };

    const stepMonths = monthsMap[freq] || 0;
    if (!stepMonths) {
        alert('Frecuencia no válida.');
        return;
    }

    const dates = [];
    const d = new Date(startDate);
    // Generar 12 meses (o el equivalente)
    const end = new Date(startDate);
    end.setMonth(end.getMonth() + 12);

    while (d < end) {
        dates.push(fmtDate(d.toISOString().slice(0,10)));
        d.setMonth(d.getMonth() + stepMonths);
    }

    const sched = document.getElementById('invScheduleAnnual');
    if (sched) sched.value = dates.join(', ');
}

function attachInventarioUIHandlers() {
    // búsqueda con debounce
    const searchEl = document.getElementById('inventarioSearch');
    if (searchEl) {
        let t = null;
        searchEl.addEventListener('input', () => {
            clearTimeout(t);
            t = setTimeout(() => loadInventario(true), 400);
        });
        searchEl.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                loadInventario(true);
            }
        });
    }

    // Form submit
    const formEl = document.getElementById('inventarioForm');
    if (formEl) {
        ensureHiddenIdField(formEl);

        formEl.addEventListener('submit', async (e) => {
            e.preventDefault();

            const hid = formEl.querySelector('input[name="__recordId"]');
            const recordId = hid?.value || '';
            const fields = collectInventarioFormFields(formEl);

            try {
                await saveInventarioRecord(recordId || null, fields);
                closeModal('newInventario');
                clearInventarioForm();
                // recargar inventario desde primera página (para ver el nuevo registro)
                loadInventario(true);
                alert('✅ Registro guardado en Inventario');
            } catch (err) {
                console.error('Error guardando inventario:', err);
                alert('❌ No se pudo guardar. Revisa variables de entorno y estructura de la tabla Inventario en Airtable.');
            }
        });
    }

    // Al abrir modal desde botón + Nuevo Registro, limpiar form
    const newBtn = document.querySelector('[onclick="openModal(\'newInventario\')"]');
    if (newBtn) {
        newBtn.addEventListener('click', () => clearInventarioForm());
    }
}

document.addEventListener('DOMContentLoaded', () => {
    attachInventarioUIHandlers();
});
