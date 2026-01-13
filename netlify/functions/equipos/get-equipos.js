// netlify/functions/equipos/get-equipos.js
// API para obtener lista de equipos

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

        // Obtener parámetros de query
        const { area, estado, pagina = 0, limite = 50 } = event.queryStringParameters || {};

        // Construir filtro dinámico
        let filterFormula = '';
        if (area) {
            filterFormula = `{Ubicación/Área} = '${area}'`;
        }
        if (estado) {
            filterFormula = filterFormula 
                ? `AND(${filterFormula}, {Estado} = '${estado}')`
                : `{Estado} = '${estado}'`;
        }

        // Hacer request a Airtable
        const response = await axios.get(
            `${AIRTABLE_API}/Equipos`,
            {
                headers: {
                    'Authorization': `Bearer ${AIRTABLE_API_KEY}`
                },
                params: {
                    filterByFormula: filterFormula || undefined,
                    pageSize: limite,
                    offset: pagina * limite,
                    sort: [{ field: 'Nombre Equipo', direction: 'asc' }]
                }
            }
        );

        // Transformar datos
        const equipos = response.data.records.map(record => ({
            id: record.id,
            ...record.fields
        }));

        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({
                success: true,
                count: equipos.length,
                total: response.data.offset ? response.data.offset + equipos.length : equipos.length,
                data: equipos
            })
        };
    } catch (error) {
        console.error('Error en get-equipos:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({
                success: false,
                error: error.message
            })
        };
    }
};
