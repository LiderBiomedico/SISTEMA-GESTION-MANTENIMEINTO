// ============================================================================
// SISTEMA DE GESTIÓN DE MANTENIMIENTO HOSPITALARIO
// Frontend Logic - app.js
// ============================================================================

// CONFIG
const API_BASE_URL = process.env.NODE_ENV === 'production' 
    ? '/.netlify/functions'
    : 'http://localhost:9000/.netlify/functions';

// Configuración de Airtable
const AIRTABLE_CONFIG = {
    apiKey: process.env.REACT_APP_AIRTABLE_API_KEY || 'YOUR_API_KEY',
    baseId: process.env.REACT_APP_AIRTABLE_BASE_ID || 'YOUR_BASE_ID',
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
