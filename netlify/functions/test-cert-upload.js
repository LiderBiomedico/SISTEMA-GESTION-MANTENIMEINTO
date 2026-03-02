// netlify/functions/test-cert-upload.js
// ─────────────────────────────────────────────────────────────────────────────
// FUNCIÓN DE DIAGNÓSTICO - Prueba si el token puede subir adjuntos a Airtable
// Llamar: GET /.netlify/functions/test-cert-upload
// Leer resultado en el navegador o en los logs de Netlify
// ELIMINAR este archivo después del diagnóstico.
// ─────────────────────────────────────────────────────────────────────────────
exports.handler = async (event) => {
  const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY || process.env.AIRTABLE_TOKEN || '';
  const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID || '';
  const TABLE_NAME = process.env.AIRTABLE_INVENTARIO_TABLE || 'Inventario';
  const CAL_FIELD = process.env.AIRTABLE_CAL_CERT_FIELD || 'Certificados de Calibracion';
  const API = 'https://api.airtable.com/v0';

  const results = { steps: [], error: null };

  try {
    // PASO 1: Verificar variables de entorno
    results.steps.push({
      step: '1_env',
      ok: !!(AIRTABLE_API_KEY && AIRTABLE_BASE_ID),
      apiKeyPrefix: AIRTABLE_API_KEY ? AIRTABLE_API_KEY.slice(0,8)+'...' : 'VACÍO',
      baseId: AIRTABLE_BASE_ID || 'VACÍO',
      tableName: TABLE_NAME,
      calField: CAL_FIELD,
    });

    // PASO 2: Obtener el primer registro de la tabla
    const listRes = await fetch(`${API}/${AIRTABLE_BASE_ID}/${encodeURIComponent(TABLE_NAME)}?maxRecords=1`, {
      headers: { Authorization: `Bearer ${AIRTABLE_API_KEY}` }
    });
    const listTxt = await listRes.text();
    let listData; try { listData = JSON.parse(listTxt); } catch(e) { listData = { raw: listTxt }; }
    const firstRecord = listData.records && listData.records[0];
    results.steps.push({
      step: '2_list_records',
      ok: listRes.ok,
      status: listRes.status,
      firstRecordId: firstRecord ? firstRecord.id : null,
      camposDisponibles: firstRecord ? Object.keys(firstRecord.fields||{}) : [],
      error: listRes.ok ? null : listData,
    });
    if (!listRes.ok || !firstRecord) throw new Error('No se pudo listar registros: ' + listRes.status);

    const recordId = firstRecord.id;

    // PASO 3: Intentar PATCH con un PDF mínimo en base64 (un PDF válido de 1 página vacía)
    const minimalPdfB64 = 'JVBERi0xLjAKMSAwIG9iago8PCAvVHlwZSAvQ2F0YWxvZyAvUGFnZXMgMiAwIFIgPj4KZW5kb2JqCjIgMCBvYmoKPDwgL1R5cGUgL1BhZ2VzIC9LaWRzIFszIDAgUl0gL0NvdW50IDEgPj4KZW5kb2JqCjMgMCBvYmoKPDwgL1R5cGUgL1BhZ2UgL1BhcmVudCAyIDAgUiAvTWVkaWFCb3ggWzAgMCAzIDNdID4+CmVuZG9iagp4cmVmCjAgNAowMDAwMDAwMDAwIDY1NTM1IGYgCjAwMDAwMDAwMDkgMDAwMDAgbiAKMDAwMDAwMDA1OCAwMDAwMCBuIAowMDAwMDAwMTE1IDAwMDAwIG4gCnRyYWlsZXIKPDwgL1NpemUgNCAvUm9vdCAxIDAgUiA+PgpzdGFydHhyZWYKMTkwCiUlRU9G';

    // Obtener adjuntos existentes del campo para no borrarlos
    const getRes = await fetch(`${API}/${AIRTABLE_BASE_ID}/${encodeURIComponent(TABLE_NAME)}/${recordId}?fields[]=${encodeURIComponent(CAL_FIELD)}`, {
      headers: { Authorization: `Bearer ${AIRTABLE_API_KEY}` }
    });
    const getTxt = await getRes.text();
    let getData; try { getData = JSON.parse(getTxt); } catch(e) { getData = {}; }
    const existingAtts = ((getData.fields||{})[CAL_FIELD] || []).map(a => ({ url: a.url }));

    const patchFields = {};
    patchFields[CAL_FIELD] = [...existingAtts, { filename: 'test_diagnostico.pdf', content: minimalPdfB64 }];

    const patchRes = await fetch(`${API}/${AIRTABLE_BASE_ID}/${encodeURIComponent(TABLE_NAME)}/${recordId}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${AIRTABLE_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields: patchFields }),
    });
    const patchTxt = await patchRes.text();
    let patchData; try { patchData = JSON.parse(patchTxt); } catch(e) { patchData = { raw: patchTxt }; }

    results.steps.push({
      step: '3_patch_attachment',
      ok: patchRes.ok,
      status: patchRes.status,
      campoUsado: CAL_FIELD,
      recordId,
      response: patchRes.ok
        ? { attachmentsAfterPatch: ((patchData.fields||{})[CAL_FIELD]||[]).length }
        : patchData,
    });

    results.diagnosis = patchRes.ok
      ? '✅ El token SÍ puede subir adjuntos. El problema estaba en el código de inventario.js (ya corregido).'
      : `❌ El token NO puede subir adjuntos al campo "${CAL_FIELD}". Error: ${patchRes.status}. Revisar: 1) Nombre exacto del campo, 2) Scopes del token (necesita data.records:write), 3) Permisos del token sobre la base.`;

  } catch (e) {
    results.error = e.message;
  }

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' },
    body: JSON.stringify(results, null, 2),
  };
};
