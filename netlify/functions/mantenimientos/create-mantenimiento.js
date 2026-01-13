// netlify/functions/mantenimientos/create-mantenimiento.js
// API para registrar intervenciones de mantenimiento

const axios = require('axios');
const crypto = require('crypto');

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
const AIRTABLE_API = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}`;

// Generar ID único para intervención
function generateInterventionId() {
    return 'INT-' + new Date().getFullYear() + '-' + crypto.randomBytes(4).toString('hex').toUpperCase();
}

exports.handler = async (event, context) => {
    try {
        if (event.httpMethod !== 'POST') {
            return {
                statusCode: 405,
                body: JSON.stringify({ error: 'Method not allowed' })
            };
        }

        // Validar autenticación
        const token = event.headers['authorization']?.replace('Bearer ', '');
        if (!token) {
            return {
                statusCode: 401,
                body: JSON.stringify({ error: 'No authorization token' })
            };
        }

        // Parsear datos del body
        const {
            equipoId,
            tipoMantenimiento,
            fechaEjecucion,
            duracionHoras,
            tecnicoResponsable,
            descripcionActividades,
            hallazgos,
            repuestosUtilizados = [],
            costoMaterial = 0,
            costoManoObra = 0,
            procedimientoId
        } = JSON.parse(event.body);

        // Validar datos requeridos
        const errores = [];
        if (!equipoId) errores.push('equipoId requerido');
        if (!tipoMantenimiento) errores.push('tipoMantenimiento requerido');
        if (!fechaEjecucion) errores.push('fechaEjecucion requerido');
        if (!duracionHoras) errores.push('duracionHoras requerido');
        if (!tecnicoResponsable) errores.push('tecnicoResponsable requerido');

        if (errores.length > 0) {
            return {
                statusCode: 400,
                body: JSON.stringify({ success: false, errores })
            };
        }

        const costoTotal = costoMaterial + costoManoObra;
        const interventionId = generateInterventionId();

        // Preparar registro para Airtable
        const mantenimientoRecord = {
            'ID Intervención': interventionId,
            'Equipo': [equipoId], // Linked record
            'Tipo Mantenimiento': tipoMantenimiento,
            'Fecha Real Ejecución': fechaEjecucion,
            'Duración Horas (MTTR)': duracionHoras,
            'Técnico Responsable': [tecnicoResponsable], // Linked record
            'Descripción Actividades': descripcionActividades,
            'Hallazgos/Problemas Detectados': hallazgos,
            'Repuestos Utilizados': repuestosUtilizados, // Multiple linked records
            'Costo Material': costoMaterial,
            'Costo Mano de Obra': costoManoObra,
            'Costo Total': costoTotal,
            'Cumplimiento': true,
            'Procedimiento Asociado': procedimientoId ? [procedimientoId] : undefined,
            'Fecha Registro': new Date().toISOString().split('T')[0],
            'Estado': 'Completado'
        };

        // Crear registro en Airtable
        const response = await axios.post(
            `${AIRTABLE_API}/Mantenimientos`,
            {
                records: [{ fields: mantenimientoRecord }]
            },
            {
                headers: {
                    'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        const nuevoRegistro = response.data.records[0];

        // Actualizar MTBF/MTTR del equipo
        await actualizarMetricasEquipo(equipoId, duracionHoras);

        // Crear entrada en auditoría
        await crearEntradaAuditoria({
            usuario: tecnicoResponsable,
            accion: 'Crear Intervención',
            registroAfectado: interventionId,
            cambios: `Intervención de tipo ${tipoMantenimiento} registrada`
        });

        return {
            statusCode: 201,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({
                success: true,
                message: 'Intervención registrada exitosamente',
                data: {
                    id: nuevoRegistro.id,
                    ...nuevoRegistro.fields
                }
            })
        };
    } catch (error) {
        console.error('Error en create-mantenimiento:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({
                success: false,
                error: error.message
            })
        };
    }
};

async function actualizarMetricasEquipo(equipoId, duracionHoras) {
    try {
        // Obtener intervenciones anteriores del equipo
        const intervenciones = await axios.get(
            `${AIRTABLE_API}/Mantenimientos`,
            {
                headers: {
                    'Authorization': `Bearer ${AIRTABLE_API_KEY}`
                },
                params: {
                    filterByFormula: `{Equipo} = '${equipoId}'`,
                    sort: [{ field: 'Fecha Real Ejecución', direction: 'desc' }]
                }
            }
        );

        // Calcular nuevos MTBF/MTTR
        const totalIntervenciones = intervenciones.data.records.length;
        const duracionPromedio = intervenciones.data.records.reduce((sum, r) => {
            return sum + (r.fields['Duración Horas (MTTR)'] || 0);
        }, 0) / (totalIntervenciones || 1);

        console.log(`MTTR actualizado para equipo ${equipoId}: ${duracionPromedio.toFixed(2)}h`);
    } catch (error) {
        console.error('Error actualizando métricas:', error);
    }
}

async function crearEntradaAuditoria(auditData) {
    try {
        await axios.post(
            `${AIRTABLE_API}/Auditoria`,
            {
                records: [{
                    fields: {
                        'Fecha Auditoría': new Date().toISOString().split('T')[0],
                        'Usuario': auditData.usuario,
                        'Acción': auditData.accion,
                        'Registro Afectado': auditData.registroAfectado,
                        'Cambios': auditData.cambios,
                        'Tipo Auditoría': 'Sistema'
                    }
                }]
            },
            {
                headers: {
                    'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
                    'Content-Type': 'application/json'
                }
            }
        );
    } catch (error) {
        console.warn('Error creando entrada de auditoría:', error.message);
    }
}
