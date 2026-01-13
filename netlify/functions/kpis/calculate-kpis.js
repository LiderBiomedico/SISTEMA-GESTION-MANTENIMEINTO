// netlify/functions/kpis/calculate-kpis.js
// API para calcular indicadores clave de desempeño

const axios = require('axios');

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
const AIRTABLE_API = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}`;

exports.handler = async (event, context) => {
    try {
        // Validar autenticación
        const token = event.headers['authorization']?.replace('Bearer ', '');
        if (!token) {
            return {
                statusCode: 401,
                body: JSON.stringify({ error: 'No authorization token' })
            };
        }

        // Obtener parámetros
        const { periodo, equipoId } = event.queryStringParameters || {};

        // Obtener datos de Airtable
        const [equipos, mantenimientos, repuestos] = await Promise.all([
            axios.get(`${AIRTABLE_API}/Equipos`, {
                headers: { 'Authorization': `Bearer ${AIRTABLE_API_KEY}` }
            }),
            axios.get(`${AIRTABLE_API}/Mantenimientos`, {
                headers: { 'Authorization': `Bearer ${AIRTABLE_API_KEY}` }
            }),
            axios.get(`${AIRTABLE_API}/Movimientos Inventario`, {
                headers: { 'Authorization': `Bearer ${AIRTABLE_API_KEY}` }
            })
        ]);

        // Calcular KPIs globales
        const kpis = calcularKPIs(
            equipos.data.records,
            mantenimientos.data.records,
            repuestos.data.records,
            periodo
        );

        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({
                success: true,
                data: kpis
            })
        };
    } catch (error) {
        console.error('Error en calculate-kpis:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({
                success: false,
                error: error.message
            })
        };
    }
};

function calcularKPIs(equipos, mantenimientos, movimientos, periodo) {
    // Filtrar por período si se especifica
    let mntsList = mantenimientos;
    if (periodo) {
        const [year, month] = periodo.split('-');
        mntsList = mantenimientos.filter(r => {
            const fecha = r.fields['Fecha Real Ejecución'];
            if (!fecha) return false;
            return fecha.startsWith(`${year}-${month}`);
        });
    }

    // 1. MTBF (Mean Time Between Failures)
    const mtbfPromedio = calcularMTBF(mntsList);

    // 2. MTTR (Mean Time To Repair)
    const mttrPromedio = calcularMTTR(mntsList);

    // 3. Cumplimiento del Plan
    const cumplimiento = calcularCumplimiento(mntsList, equipos);

    // 4. Disponibilidad de Equipos
    const disponibilidad = calcularDisponibilidad(equipos);

    // 5. Costo Total de Mantenimiento
    const costoTotal = mntsList.reduce((sum, r) => {
        return sum + (r.fields['Costo Total'] || 0);
    }, 0);

    // 6. Mantenimientos por Tipo
    const mntsPorTipo = agruparPorTipo(mntsList);

    // 7. Consumo de Repuestos
    const consumoRepuestos = calcularConsumoRepuestos(movimientos);

    // 8. Eficiencia Técnica (basada en reducción de correctivos)
    const eficiencia = calcularEficiencia(mntsPorTipo);

    // 9. Índice de Confiabilidad
    const confiabilidad = calcularConfiabilidad(mtbfPromedio);

    // 10. Costo por Equipo
    const costosPorEquipo = calcularCostoPorEquipo(equipos, mntsList);

    return {
        periodo: periodo || 'Actual',
        timestamp: new Date().toISOString(),
        resumenGlobal: {
            equiposActivos: equipos.filter(e => e.fields['Estado'] === 'Activo').length,
            equiposTotales: equipos.length,
            intervenciones: mntsList.length,
            mtbf: mtbfPromedio,
            mttr: mttrPromedio,
            cumplimiento: cumplimiento,
            disponibilidad: disponibilidad,
            costoTotal: costoTotal,
            eficiencia: eficiencia,
            confiabilidad: confiabilidad
        },
        detalles: {
            mntsPorTipo: mntsPorTipo,
            consumoRepuestos: consumoRepuestos,
            costosPorEquipo: costosPorEquipo,
            metricas: {
                tasaCorrective: (mntsPorTipo.correctivo / mntsList.length * 100).toFixed(2),
                tasaPreventiva: (mntsPorTipo.preventivo / mntsList.length * 100).toFixed(2),
                disponibilidadPromedio: disponibilidad
            }
        }
    };
}

function calcularMTBF(mantenimientos) {
    // Mean Time Between Failures - Horas promedio entre fallos
    if (mantenimientos.length === 0) return 0;
    
    const correctivos = mantenimientos.filter(m => 
        m.fields['Tipo Mantenimiento'] === 'Correctivo'
    ).length;

    // MTBF = Tiempo Total Disponible / Número de Fallos
    // Suponiendo 8760 horas/año disponibles
    const tiempoDisponible = 8760;
    return correctivos > 0 ? Math.round(tiempoDisponible / correctivos) : 8760;
}

function calcularMTTR(mantenimientos) {
    // Mean Time To Repair - Horas promedio de reparación
    if (mantenimientos.length === 0) return 0;
    
    const correctivos = mantenimientos.filter(m => 
        m.fields['Tipo Mantenimiento'] === 'Correctivo'
    );

    if (correctivos.length === 0) return 0;

    const totalHoras = correctivos.reduce((sum, m) => {
        return sum + (m.fields['Duración Horas (MTTR)'] || 0);
    }, 0);

    return (totalHoras / correctivos.length).toFixed(2);
}

function calcularCumplimiento(mantenimientos, equipos) {
    // Porcentaje de cumplimiento del plan
    const completados = mantenimientos.filter(m => 
        m.fields['Cumplimiento'] === true
    ).length;

    return equipos.length > 0 
        ? Math.round((completados / equipos.length) * 100)
        : 0;
}

function calcularDisponibilidad(equipos) {
    // Porcentaje de equipos operativos
    const activos = equipos.filter(e => 
        e.fields['Estado'] === 'Activo'
    ).length;

    return equipos.length > 0
        ? ((activos / equipos.length) * 100).toFixed(2)
        : 0;
}

function agruparPorTipo(mantenimientos) {
    return {
        preventivo: mantenimientos.filter(m => 
            m.fields['Tipo Mantenimiento'] === 'Preventivo'
        ).length,
        correctivo: mantenimientos.filter(m => 
            m.fields['Tipo Mantenimiento'] === 'Correctivo'
        ).length,
        predictivo: mantenimientos.filter(m => 
            m.fields['Tipo Mantenimiento'] === 'Predictivo'
        ).length,
        calibracion: mantenimientos.filter(m => 
            m.fields['Tipo Mantenimiento'] === 'Calibración'
        ).length
    };
}

function calcularConsumoRepuestos(movimientos) {
    const consumos = {};
    
    movimientos.forEach(m => {
        if (m.fields['Tipo Movimiento'] === 'Salida') {
            const repuesto = m.fields['Repuesto'];
            if (!consumos[repuesto]) {
                consumos[repuesto] = 0;
            }
            consumos[repuesto] += m.fields['Cantidad'] || 0;
        }
    });

    return consumos;
}

function calcularEficiencia(mntsPorTipo) {
    // Eficiencia basada en ratio preventivo/correctivo
    const total = Object.values(mntsPorTipo).reduce((a, b) => a + b, 0);
    if (total === 0) return 0;

    const preventivo = mntsPorTipo.preventivo;
    return Math.min(100, Math.round((preventivo / total) * 100));
}

function calcularConfiabilidad(mtbf) {
    // Índice de confiabilidad basado en MTBF
    // Máximo 100% en 5000+ horas
    return Math.min(100, Math.round((mtbf / 5000) * 100));
}

function calcularCostoPorEquipo(equipos, mantenimientos) {
    const costos = {};

    equipos.forEach(e => {
        costos[e.id] = {
            nombre: e.fields['Nombre Equipo'],
            costo: 0,
            intervenciones: 0
        };
    });

    mantenimientos.forEach(m => {
        const equipoId = m.fields['Equipo']?.[0];
        if (equipoId && costos[equipoId]) {
            costos[equipoId].costo += m.fields['Costo Total'] || 0;
            costos[equipoId].intervenciones += 1;
        }
    });

    return costos;
}
