// netlify/functions/reportes/generate-pdf.js
// API para generar reportes PDF profesionales

const axios = require('axios');
const PDFDocument = require('pdfkit');
const { Readable } = require('stream');

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
const AIRTABLE_API = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}`;

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

        const { tipoReporte, filtros = {} } = JSON.parse(event.body);

        // Obtener datos según tipo de reporte
        let datos = {};

        switch (tipoReporte) {
            case 'desempeño':
                datos = await generarReporteDesempeño(filtros);
                break;
            case 'cumplimiento':
                datos = await generarReporteCumplimiento(filtros);
                break;
            case 'costos':
                datos = await generarReporteCostos(filtros);
                break;
            case 'auditoria':
                datos = await generarReporteAuditoria(filtros);
                break;
            default:
                return {
                    statusCode: 400,
                    body: JSON.stringify({ error: 'Tipo de reporte no válido' })
                };
        }

        // Generar PDF
        const pdfBuffer = await generarPDF(tipoReporte, datos);

        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `attachment; filename="reporte-${tipoReporte}-${Date.now()}.pdf"`,
                'Access-Control-Allow-Origin': '*'
            },
            body: pdfBuffer.toString('base64'),
            isBase64Encoded: true
        };
    } catch (error) {
        console.error('Error en generate-pdf:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({
                success: false,
                error: error.message
            })
        };
    }
};

async function generarReporteDesempeño(filtros) {
    const periodo = filtros.periodo || new Date().toISOString().split('-').slice(0, 2).join('-');
    
    const mantenimientos = await axios.get(`${AIRTABLE_API}/Mantenimientos`, {
        headers: { 'Authorization': `Bearer ${AIRTABLE_API_KEY}` }
    });

    const equipos = await axios.get(`${AIRTABLE_API}/Equipos`, {
        headers: { 'Authorization': `Bearer ${AIRTABLE_API_KEY}` }
    });

    // Filtrar por período
    const mntsFiltradas = mantenimientos.data.records.filter(r => {
        const fecha = r.fields['Fecha Real Ejecución'];
        return fecha?.startsWith(periodo);
    });

    const mtbf = calcularMTBF(mntsFiltradas);
    const mttr = calcularMTTR(mntsFiltradas);
    const cumplimiento = calcularCumplimiento(mntsFiltradas, equipos.data.records);

    return {
        periodo,
        equiposActivos: equipos.data.records.filter(e => e.fields['Estado'] === 'Activo').length,
        equiposTotales: equipos.data.records.length,
        intervenciones: mntsFiltradas.length,
        mtbf,
        mttr,
        cumplimiento,
        costoTotal: mntsFiltradas.reduce((sum, r) => sum + (r.fields['Costo Total'] || 0), 0),
        mantenimientosPorTipo: agruparPorTipo(mntsFiltradas)
    };
}

async function generarReporteCumplimiento(filtros) {
    const mantenimientos = await axios.get(`${AIRTABLE_API}/Mantenimientos`, {
        headers: { 'Authorization': `Bearer ${AIRTABLE_API_KEY}` }
    });

    const completados = mantenimientos.data.records.filter(r => 
        r.fields['Cumplimiento'] === true
    ).length;

    const pendientes = mantenimientos.data.records.filter(r => 
        r.fields['Cumplimiento'] === false
    ).length;

    return {
        fechaGeneracion: new Date().toLocaleDateString('es-CO'),
        completados,
        pendientes,
        porcentaje: Math.round((completados / mantenimientos.data.records.length) * 100),
        detalles: mantenimientos.data.records.slice(0, 10)
    };
}

async function generarReporteCostos(filtros) {
    const mantenimientos = await axios.get(`${AIRTABLE_API}/Mantenimientos`, {
        headers: { 'Authorization': `Bearer ${AIRTABLE_API_KEY}` }
    });

    const costos = {
        material: 0,
        manoObra: 0,
        total: 0
    };

    mantenimientos.data.records.forEach(r => {
        costos.material += r.fields['Costo Material'] || 0;
        costos.manoObra += r.fields['Costo Mano de Obra'] || 0;
        costos.total += r.fields['Costo Total'] || 0;
    });

    return {
        periodo: new Date().toISOString().split('-').slice(0, 2).join('-'),
        costos,
        promedioPorIntervención: (costos.total / mantenimientos.data.records.length).toFixed(2),
        intervenciones: mantenimientos.data.records.length
    };
}

async function generarReporteAuditoria(filtros) {
    const auditoria = await axios.get(`${AIRTABLE_API}/Auditoria`, {
        headers: { 'Authorization': `Bearer ${AIRTABLE_API_KEY}` }
    });

    return {
        fechaGeneracion: new Date().toLocaleDateString('es-CO'),
        totalEntradas: auditoria.data.records.length,
        registros: auditoria.data.records.slice(0, 20).map(r => ({
            fecha: r.fields['Fecha Auditoría'],
            usuario: r.fields['Usuario'],
            accion: r.fields['Acción'],
            registro: r.fields['Registro Afectado']
        }))
    };
}

async function generarPDF(tipoReporte, datos) {
    return new Promise((resolve, reject) => {
        const doc = new PDFDocument();
        let buffers = [];

        doc.on('data', buffers.push.bind(buffers));
        doc.on('end', () => {
            resolve(Buffer.concat(buffers));
        });
        doc.on('error', reject);

        // Encabezado
        doc.fontSize(20).font('Helvetica-Bold').text('Sistema de Gestión de Mantenimiento Hospitalario', 50, 50);
        doc.fontSize(12).font('Helvetica').text(`Reporte de ${tipoReporte}`, 50, 75);
        doc.fontSize(10).text(`Generado: ${new Date().toLocaleString('es-CO')}`, 50, 95);

        // Línea divisoria
        doc.moveTo(50, 110).lineTo(550, 110).stroke();

        let y = 130;

        // Contenido según tipo
        switch (tipoReporte) {
            case 'desempeño':
                y = generarContenidoDesempeño(doc, datos, y);
                break;
            case 'cumplimiento':
                y = generarContenidoCumplimiento(doc, datos, y);
                break;
            case 'costos':
                y = generarContenidoCostos(doc, datos, y);
                break;
            case 'auditoria':
                y = generarContenidoAuditoria(doc, datos, y);
                break;
        }

        // Pie de página
        doc.fontSize(8).text('Documento confidencial - Solo para uso interno', 50, 700);
        doc.text(`Trazabilidad: ${new Date().toISOString()}`, 50, 715);

        doc.end();
    });
}

function generarContenidoDesempeño(doc, datos, y) {
    doc.fontSize(14).font('Helvetica-Bold').text('Indicadores de Desempeño', 50, y);
    y += 25;

    const indicadores = [
        { label: 'Período', value: datos.periodo },
        { label: 'Equipos Activos', value: datos.equiposActivos + '/' + datos.equiposTotales },
        { label: 'Total Intervenciones', value: datos.intervenciones },
        { label: 'MTBF Promedio', value: Math.round(datos.mtbf) + ' horas' },
        { label: 'MTTR Promedio', value: datos.mttr + ' horas' },
        { label: 'Cumplimiento Plan', value: datos.cumplimiento + '%' },
        { label: 'Costo Total', value: '$' + datos.costoTotal.toLocaleString('es-CO') }
    ];

    doc.fontSize(11).font('Helvetica');
    indicadores.forEach(ind => {
        doc.text(`${ind.label}: `, 50, y, { continued: true });
        doc.font('Helvetica-Bold').text(ind.value, { underline: false });
        doc.font('Helvetica');
        y += 20;
    });

    return y + 10;
}

function generarContenidoCumplimiento(doc, datos, y) {
    doc.fontSize(14).font('Helvetica-Bold').text('Análisis de Cumplimiento', 50, y);
    y += 25;

    doc.fontSize(11).font('Helvetica');
    doc.text(`Completados: ${datos.completados}`, 50, y);
    y += 20;
    doc.text(`Pendientes: ${datos.pendientes}`, 50, y);
    y += 20;
    doc.text(`Porcentaje Cumplimiento: ${datos.porcentaje}%`, 50, y);

    return y + 10;
}

function generarContenidoCostos(doc, datos, y) {
    doc.fontSize(14).font('Helvetica-Bold').text('Análisis de Costos', 50, y);
    y += 25;

    doc.fontSize(11).font('Helvetica');
    doc.text(`Costo Material: $${datos.costos.material.toLocaleString('es-CO')}`, 50, y);
    y += 20;
    doc.text(`Costo Mano de Obra: $${datos.costos.manoObra.toLocaleString('es-CO')}`, 50, y);
    y += 20;
    doc.text(`Costo Total: $${datos.costos.total.toLocaleString('es-CO')}`, 50, y);
    y += 20;
    doc.text(`Promedio por Intervención: $${datos.promedioPorIntervención}`, 50, y);

    return y + 10;
}

function generarContenidoAuditoria(doc, datos, y) {
    doc.fontSize(14).font('Helvetica-Bold').text('Registro de Auditoría', 50, y);
    y += 25;

    doc.fontSize(10).font('Helvetica');
    datos.registros.forEach(reg => {
        doc.text(`${reg.fecha} - ${reg.usuario}: ${reg.accion}`, 50, y);
        y += 15;
    });

    return y;
}

// Funciones auxiliares
function calcularMTBF(mantenimientos) {
    if (mantenimientos.length === 0) return 0;
    const correctivos = mantenimientos.filter(m => 
        m.fields['Tipo Mantenimiento'] === 'Correctivo'
    ).length;
    return correctivos > 0 ? Math.round(8760 / correctivos) : 8760;
}

function calcularMTTR(mantenimientos) {
    if (mantenimientos.length === 0) return 0;
    const correctivos = mantenimientos.filter(m => 
        m.fields['Tipo Mantenimiento'] === 'Correctivo'
    );
    if (correctivos.length === 0) return 0;
    const totalHoras = correctivos.reduce((sum, m) => 
        sum + (m.fields['Duración Horas (MTTR)'] || 0), 0
    );
    return (totalHoras / correctivos.length).toFixed(2);
}

function calcularCumplimiento(mantenimientos, equipos) {
    const completados = mantenimientos.filter(m => 
        m.fields['Cumplimiento'] === true
    ).length;
    return equipos.length > 0 ? Math.round((completados / equipos.length) * 100) : 0;
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
        ).length
    };
}
