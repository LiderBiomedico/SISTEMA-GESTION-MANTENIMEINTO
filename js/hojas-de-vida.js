// ============================================================================
// MÓDULO HOJAS DE VIDA - SLV-GAT-GAB-12-F02
// Sistema HSLV - Hospital Susana López de Valencia E.S.E
// Visualiza registros del inventario maestro como Hoja de Vida oficial
// ============================================================================

(function () {
  if (window.__HSLV_HOJAS_VIDA_LOADED) return;
  window.__HSLV_HOJAS_VIDA_LOADED = true;

  const hvState = window.__HSLV_HV_STATE || (window.__HSLV_HV_STATE = {
    records: [],
    filtered: [],
    currentOffset: null,
    searchQuery: '',
    searchTimeout: null,
    currentPage: 0,
    pageSize: 20,
    currentRecord: null,
  });

  function getHeaders() {
    try { if (typeof getAuthHeader === 'function') return getAuthHeader(); } catch (e) {}
    return {};
  }

  function safeErr(e) {
    try { if (e && e.response && e.response.data) return e.response.data.error || JSON.stringify(e.response.data); } catch (_) {}
    return (e && e.message) ? e.message : 'Error desconocido';
  }

  // ── LOAD ──────────────────────────────────────────────────────────────────

  async function loadHojasVida(resetPage) {
    if (resetPage) { hvState.currentOffset = null; hvState.currentPage = 0; }
    const listEl = document.getElementById('hvListBody');
    if (!listEl) return;

    listEl.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:24px;color:#607d8b;">⏳ Cargando hojas de vida...</td></tr>`;

    try {
      const base = typeof API_BASE_URL !== 'undefined' ? API_BASE_URL : '/.netlify/functions';
      const params = new URLSearchParams({ pageSize: '50' });
      if (hvState.currentOffset) params.set('offset', hvState.currentOffset);
      if (hvState.searchQuery) params.set('q', hvState.searchQuery);

      const response = await axios.get(`${base}/inventario?${params}`, { headers: getHeaders() });
      const data = response.data || {};
      hvState.records = data.records || data.data || [];
      hvState.currentOffset = data.offset || null;
      hvState.filtered = hvState.records;

      const countEl = document.getElementById('hvCount');
      if (countEl) countEl.textContent = `${hvState.records.length} equipos`;

      renderHvList();
      updateHvPagination();
    } catch (err) {
      listEl.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:24px;color:#c62828;">
        ⚠️ Error al cargar los datos<br><small>${safeErr(err)}</small><br>
        <button class="btn btn-primary" style="margin-top:10px" onclick="loadHojasVida(true)">🔄 Reintentar</button>
      </td></tr>`;
    }
  }

  // ── RENDER LIST ───────────────────────────────────────────────────────────

  function renderHvList() {
    const listEl = document.getElementById('hvListBody');
    if (!listEl) return;

    if (!hvState.filtered.length) {
      listEl.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:32px;color:#607d8b;">📋 No se encontraron equipos.</td></tr>`;
      return;
    }

    listEl.innerHTML = hvState.filtered.map(record => {
      const f = record.fields || {};
      const item   = f['Item'] || f['ITEM'] || '—';
      const equipo = f['Equipo'] || f['EQUIPO'] || '—';
      const marca  = f['Marca'] || f['MARCA'] || '—';
      const serie  = f['Serie'] || f['SERIE'] || '—';
      const placa  = f['Numero de Placa'] || f['PLACA'] || '—';
      const servicio = f['Servicio'] || f['SERVICIO'] || '—';
      const riesgo = f['Clasificacion del Riesgo'] || f['CLASIFICACION DEL RIESGO'] || '—';

      const riesgoBadge = {
        'I': { bg:'#e8f5e9', c:'#2e7d32', label:'Clase I' },
        'IIA': { bg:'#fff8e1', c:'#f57f17', label:'Clase IIA' },
        'IIB': { bg:'#fff3e0', c:'#e65100', label:'Clase IIB' },
        'III': { bg:'#ffebee', c:'#c62828', label:'Clase III' },
      };
      const rb = riesgoBadge[riesgo] || { bg:'#eceff1', c:'#546e7a', label: riesgo };

      return `<tr>
        <td style="font-weight:700;color:#0052CC;font-family:'JetBrains Mono',monospace;">${esc(String(item))}</td>
        <td style="font-weight:600;">${esc(equipo)}</td>
        <td>${esc(marca)}</td>
        <td style="font-family:'JetBrains Mono',monospace;font-size:12px;">${esc(serie)}</td>
        <td style="font-family:'JetBrains Mono',monospace;font-size:12px;">${esc(placa)}</td>
        <td>${esc(servicio)}</td>
        <td><span style="display:inline-block;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:700;background:${rb.bg};color:${rb.c};">${esc(rb.label)}</span></td>
        <td>
          <button class="hv-btn-view" onclick="openHojaVida('${record.id}')" title="Ver Hoja de Vida">
            📋 Ver HV
          </button>
        </td>
      </tr>`;
    }).join('');
  }

  // ── SEARCH ────────────────────────────────────────────────────────────────

  function hvSearch() {
    clearTimeout(hvState.searchTimeout);
    hvState.searchTimeout = setTimeout(() => {
      const el = document.getElementById('hvSearchInput');
      const q = (el ? el.value : '').toLowerCase().trim();
      hvState.searchQuery = q;
      if (q) {
        hvState.filtered = hvState.records.filter(r => {
          const f = r.fields || {};
          return ['Equipo','EQUIPO','Marca','MARCA','Serie','SERIE','Numero de Placa','PLACA','Servicio','SERVICIO','Item','ITEM']
            .some(k => String(f[k] || '').toLowerCase().includes(q));
        });
      } else {
        hvState.filtered = hvState.records;
      }
      renderHvList();
    }, 300);
  }

  // ── PAGINATION ────────────────────────────────────────────────────────────

  function updateHvPagination() {
    const prev = document.getElementById('hvPrevBtn');
    const next = document.getElementById('hvNextBtn');
    if (prev) prev.disabled = hvState.currentPage === 0;
    if (next) next.disabled = !hvState.currentOffset;
  }

  function hvNextPage() { if (hvState.currentOffset) { hvState.currentPage++; loadHojasVida(); } }
  function hvPrevPage() { if (hvState.currentPage > 0) { hvState.currentPage--; hvState.currentOffset = null; loadHojasVida(); } }

  // ── OPEN HOJA DE VIDA ────────────────────────────────────────────────────

  function openHojaVida(recordId) {
    const record = hvState.records.find(r => r.id === recordId);
    if (!record) { alert('Registro no encontrado'); return; }
    hvState.currentRecord = record;
    renderHojaVida(record);
    const modal = document.getElementById('hvModal');
    if (modal) { modal.style.display = 'flex'; modal.classList.add('active'); }
    document.body.style.overflow = 'hidden';
  }

  function closeHojaVidaModal() {
    const modal = document.getElementById('hvModal');
    if (modal) { modal.style.display = 'none'; modal.classList.remove('active'); }
    document.body.style.overflow = 'auto';
  }

  // ── RENDER HOJA DE VIDA ───────────────────────────────────────────────────

  function renderHojaVida(record) {
    const f = record.fields || {};
    const get = (...keys) => { for (const k of keys) { if (f[k] !== undefined && f[k] !== null && f[k] !== '') return String(f[k]); } return ''; };
    const getOrDash = (...keys) => get(...keys) || '—';

    // Fuentes de alimentación — check si el campo contiene texto relevante
    const fuenteRaw = get('Fuentes de Alimentacion', 'FUENTES DE ALIMENTACION') || '';
    const fuentes = ['Electricidad Regulada', 'Electricidad Normal', 'Electricidad Emergencia', 'Vapor', 'Gas', 'Agua', 'Aire', 'Energía Solar', 'Derivado Petróleo', 'Otros'];
    const fuentesHtml = fuentes.map(f2 => {
      const active = fuenteRaw.toLowerCase().includes(f2.toLowerCase().slice(0,6));
      return `<td class="hv-check-cell">${active ? '✔' : ''}</td>`;
    }).join('');

    // Manuales checkboxes
    const manualesRaw = get('Manuales', 'MANUALES') || '';
    const manualesList = ['Usuario','Mantenimiento','Partes','Despieces','Operación','Otros'];
    const manualesHtml = manualesList.map(m => {
      const active = manualesRaw.toLowerCase().includes(m.toLowerCase().slice(0,5));
      return `<td class="hv-check-cell">${active ? '✔' : ''}</td>`;
    }).join('');

    // Planos checkboxes
    const planosRaw = get('Planos', 'PLANOS') || '';
    const planosList = ['Eléctricos','Electrónicos','Hidráulicos','Neumáticos','Mecánicos','Otros'];
    const planosHtml = planosList.map(p => {
      const active = planosRaw.toLowerCase().includes(p.toLowerCase().slice(0,5));
      return `<td class="hv-check-cell">${active ? '✔' : ''}</td>`;
    }).join('');

    const calibrable = get('Calibrable', 'CALIBRABLE', 'CALIBRABLE_IDENT');
    const verificable = get('Verificable', 'VERIFICABLE') || '';

    const container = document.getElementById('hvSheetContent');
    if (!container) return;

    container.innerHTML = `
    <div class="hv-sheet" id="hvPrintArea">

      <!-- ENCABEZADO -->
      <div class="hv-header">
        <div class="hv-header-left">
          <div class="hv-logo">🏥</div>
          <div>
            <div class="hv-hospital-name">HOSPITAL SUSANA LÓPEZ DE VALENCIA E.S.E</div>
            <div class="hv-dept">GESTIÓN DEL AMBIENTE Y LA TECNOLOGÍA</div>
            <div class="hv-address">Calle 15 N°17A-196 Tel. 8217190</div>
          </div>
        </div>
        <div class="hv-header-center">
          <div class="hv-doc-title">HOJA DE VIDA DE EQUIPOS</div>
        </div>
        <div class="hv-header-right">
          <div class="hv-code">SLV-GAT-GAB-12-F02</div>
          <div class="hv-page">Página 1 de 2</div>
        </div>
      </div>

      <!-- SECCIÓN 1: DATOS BÁSICOS -->
      <div class="hv-section-title">DATOS BÁSICOS</div>
      <table class="hv-table">
        <tr>
          <td class="hv-label" colspan="3">Nombre del Equipo</td>
          <td class="hv-label" colspan="2">Placa Inventario</td>
        </tr>
        <tr>
          <td class="hv-value" colspan="3">${esc(get('Equipo','EQUIPO'))}</td>
          <td class="hv-value" colspan="2">${esc(get('Numero de Placa','PLACA'))}</td>
        </tr>
        <tr>
          <td class="hv-label">Marca</td>
          <td class="hv-label">Modelo</td>
          <td class="hv-label">Serie</td>
          <td class="hv-label" colspan="2">Tipo Equipo</td>
        </tr>
        <tr>
          <td class="hv-value">${esc(get('Marca','MARCA'))}</td>
          <td class="hv-value">${esc(get('Modelo','MODELO'))}</td>
          <td class="hv-value">${esc(get('Serie','SERIE'))}</td>
          <td class="hv-value" colspan="2">${esc(get('Clasificacion de la Tecnologia','CLASIFICACION DE LA TECNOLOGIA'))}</td>
        </tr>
        <tr>
          <td class="hv-label">Distintivo de Habilitación</td>
          <td class="hv-label">ECRI</td>
          <td class="hv-label" colspan="3">Clasificación Biomédica</td>
        </tr>
        <tr>
          <td class="hv-value">${esc(get('Registro INVIMA','REGISTRO INVIMA'))}</td>
          <td class="hv-value">${esc(get('Codigo ECRI','CODIGO ECRI'))}</td>
          <td class="hv-value" colspan="3">${esc(get('Clasificacion Biomedica','CLASIFICACION BIOMEDICA'))}</td>
        </tr>
        <tr>
          <td class="hv-label">Frecuencia Mantenimiento</td>
          <td class="hv-label">Código Prestador</td>
          <td class="hv-label">Clasificación Riesgo</td>
          <td class="hv-label" colspan="2">Sede</td>
        </tr>
        <tr>
          <td class="hv-value">${esc(get('Frecuencia de Mantenimiento','Frecuencia de MTTO Preventivo','FRECUENCIA DE MTTO PREVENTIVO'))}</td>
          <td class="hv-value">${esc(get('Codigo Prestador','CODIGO PRESTADOR'))}</td>
          <td class="hv-value">${esc(get('Clasificacion del Riesgo','CLASIFICACION DEL RIESGO'))}</td>
          <td class="hv-value" colspan="2">${esc(get('Sede','SEDE'))}</td>
        </tr>
        <tr>
          <td class="hv-label" colspan="2"></td>
          <td class="hv-label">Número</td>
          <td class="hv-label">Tipo</td>
          <td class="hv-label">Tecnología Predominante</td>
        </tr>
        <tr>
          <td class="hv-value" colspan="2"></td>
          <td class="hv-value">${esc(get('Item','ITEM'))}</td>
          <td class="hv-value">${esc(get('Tipo de MTTO','TIPO DE MTTO'))}</td>
          <td class="hv-value">${esc(get('Clasificacion de la Tecnologia','CLASIFICACION DE LA TECNOLOGIA'))}</td>
        </tr>
      </table>

      <!-- SECCIÓN 2: UBICACIÓN -->
      <div class="hv-section-title">UBICACIÓN</div>
      <table class="hv-table">
        <tr>
          <td class="hv-label" style="width:40%">Servicio</td>
          <td class="hv-label" style="width:40%">Ubicación</td>
          <td class="hv-label" style="width:20%">Responsable</td>
        </tr>
        <tr>
          <td class="hv-value">${esc(get('Servicio','SERVICIO'))}</td>
          <td class="hv-value">${esc(get('Ubicacion','Ubicación','UBICACIÓN'))}</td>
          <td class="hv-value">${esc(get('Responsable','RESPONSABLE'))}</td>
        </tr>
      </table>

      <!-- SECCIÓN 3: REGISTRO HISTÓRICO -->
      <div class="hv-section-title">REGISTRO HISTÓRICO</div>
      <table class="hv-table">
        <tr>
          <td class="hv-label">Forma Adquisición</td>
          <td class="hv-label">Fecha Compra</td>
          <td class="hv-label">Fecha Instalación</td>
          <td class="hv-label">Fecha Garantía</td>
        </tr>
        <tr>
          <td class="hv-value">${esc(get('Tipo de Adquisicion','TIPO DE ADQUISICION'))}</td>
          <td class="hv-value">${formatDate(get('Fecha de Compra','FECHA DE COMRPA','FECHA DE COMPRA'))}</td>
          <td class="hv-value">${formatDate(get('Fecha de Instalacion','FECHA DE INSTALACIÓN'))}</td>
          <td class="hv-value">${formatDate(get('Termino de Garantia','TERMINO DE GARANTIA'))}</td>
        </tr>
        <tr>
          <td class="hv-label">Costo</td>
          <td class="hv-label">Documento</td>
          <td class="hv-label">Acta</td>
          <td class="hv-label">Inicio Operación</td>
        </tr>
        <tr>
          <td class="hv-value">${formatCurrency(get('Valor en Pesos','VALOR EN PESOS'))}</td>
          <td class="hv-value">${esc(get('No. de Contrato','NO. DE CONTRATO'))}</td>
          <td class="hv-value">${esc(get('Acta','ACTA'))}</td>
          <td class="hv-value">${formatDate(get('Fecha de Instalacion','FECHA DE INSTALACIÓN'))}</td>
        </tr>
        <tr>
          <td class="hv-label">Fecha Fabricación</td>
          <td class="hv-label">Vida Útil</td>
          <td colspan="2"></td>
        </tr>
        <tr>
          <td class="hv-value">${formatDate(get('Fecha Fabrica','FECHA FABRICA'))}</td>
          <td class="hv-value">${esc(get('Vida Util','VIDA UTIL'))}</td>
          <td colspan="2"></td>
        </tr>
      </table>

      <!-- SECCIÓN 4: REGISTRO TÉCNICO -->
      <div class="hv-section-title">REGISTRO TÉCNICO</div>
      <table class="hv-table">
        <tr>
          <td class="hv-label">Voltaje Max Ope</td>
          <td class="hv-label">Voltaje Min Ope</td>
          <td class="hv-label">Corriente Max Ope</td>
          <td class="hv-label">Corriente Min Ope</td>
          <td class="hv-label">Potencia</td>
          <td class="hv-label">Frecuencia</td>
        </tr>
        <tr>
          <td class="hv-value">${esc(get('Voltaje Max','VOLTAJE MAX'))}</td>
          <td class="hv-value">${esc(get('Voltaje Min','VOLTAJE MIN'))}</td>
          <td class="hv-value">${esc(get('Corriente Max','CORRIENTE MAX'))}</td>
          <td class="hv-value">${esc(get('Corriente Min','CORRIENTE MIN'))}</td>
          <td class="hv-value">${esc(get('Potencia','POTENCIA'))}</td>
          <td class="hv-value">${esc(get('Frecuencia','FRECUENCIA'))}</td>
        </tr>
        <tr>
          <td class="hv-label">Presión</td>
          <td class="hv-label">Velocidad</td>
          <td class="hv-label">Temperatura</td>
          <td class="hv-label">Peso</td>
          <td class="hv-label">Capacidad</td>
          <td class="hv-label">Valor Fus IN</td>
        </tr>
        <tr>
          <td class="hv-value">${esc(get('Presion','PRESION'))}</td>
          <td class="hv-value">${esc(get('Velocidad','VELOCIDAD'))}</td>
          <td class="hv-value">${esc(get('Temperatura','TEMPERATURA'))}</td>
          <td class="hv-value">${esc(get('Peso','PESO'))}</td>
          <td class="hv-value">${esc(get('Capacidad','CAPACIDAD'))}</td>
          <td class="hv-value">${esc(get('Valor Fus','VALOR FUS'))}</td>
        </tr>
      </table>

      <!-- Fuentes de Alimentación -->
      <table class="hv-table" style="margin-top:0">
        <tr>
          <th class="hv-subheader" colspan="10">Fuentes de Alimentación</th>
        </tr>
        <tr>
          <td class="hv-label">Electricidad Regulada</td>
          <td class="hv-label">Electricidad Normal</td>
          <td class="hv-label">Electricidad emergencia</td>
          <td class="hv-label">Vapor</td>
          <td class="hv-label">Gas</td>
          <td class="hv-label">Agua</td>
          <td class="hv-label">Aire</td>
          <td class="hv-label">Energía Solar</td>
          <td class="hv-label">Derivado Petróleo</td>
          <td class="hv-label">Otros</td>
        </tr>
        <tr>${fuentesHtml}</tr>
      </table>

      <!-- SECCIÓN 5: REGISTRO APOYO TÉCNICO -->
      <div class="hv-section-title">REGISTRO APOYO TÉCNICO</div>
      <table class="hv-table">
        <tr>
          <td class="hv-label" style="width:25%">Estado Funcionamiento</td>
          <td class="hv-label" style="width:25%">Verificable</td>
          <td class="hv-label" style="width:25%">Calibrable</td>
          <td class="hv-label" style="width:25%">Periodicidad</td>
        </tr>
        <tr>
          <td class="hv-value">${esc(get('Estado','ESTADO','Estado Funcionamiento') || 'Operativo')}</td>
          <td class="hv-value">${esc(verificable)}</td>
          <td class="hv-value">${esc(calibrable)}</td>
          <td class="hv-value">${esc(get('Frecuencia de MTTO Preventivo','Frecuencia de Mantenimiento','FRECUENCIA DE MTTO PREVENTIVO'))}</td>
        </tr>
      </table>
      <table class="hv-table" style="margin-top:0">
        <tr>
          <th class="hv-subheader" colspan="6">Manuales</th>
        </tr>
        <tr>
          <td class="hv-label">Usuario</td>
          <td class="hv-label">Mantenimiento</td>
          <td class="hv-label">Partes</td>
          <td class="hv-label">Despieces</td>
          <td class="hv-label">Operación</td>
          <td class="hv-label">Otros</td>
        </tr>
        <tr>${manualesHtml}</tr>
      </table>
      <table class="hv-table" style="margin-top:0">
        <tr>
          <th class="hv-subheader" colspan="6">Planos</th>
        </tr>
        <tr>
          <td class="hv-label">Eléctricos</td>
          <td class="hv-label">Electrónicos</td>
          <td class="hv-label">Hidráulicos</td>
          <td class="hv-label">Neumáticos</td>
          <td class="hv-label">Mecánicos</td>
          <td class="hv-label">Otros</td>
        </tr>
        <tr>${planosHtml}</tr>
      </table>

      <!-- SECCIÓN 6: PROVEEDOR (página 2) -->
      <div class="hv-section-title" style="margin-top:24px;page-break-before:always;">PROVEEDOR</div>
      <table class="hv-table">
        <tr>
          <td class="hv-label" colspan="4">Nombre</td>
          <td class="hv-label" colspan="4">Dirección</td>
          <td class="hv-label" colspan="2">Ciudad</td>
        </tr>
        <tr>
          <td class="hv-value" colspan="4">${esc(get('Nombre','NOMBRE'))}</td>
          <td class="hv-value" colspan="4">${esc(get('Direccion','DIRECCION'))}</td>
          <td class="hv-value" colspan="2">${esc(get('Ciudad','CIUDAD'))}</td>
        </tr>
        <tr>
          <td class="hv-label" colspan="4">Correo Electrónico</td>
          <td class="hv-label" colspan="4">Teléfono</td>
          <td class="hv-label" colspan="2">Fax</td>
        </tr>
        <tr>
          <td class="hv-value" colspan="4">${esc(get('Email','EMAIL','Correo','CORREO'))}</td>
          <td class="hv-value" colspan="4">${esc(get('Telefono','TELEFONO'))}</td>
          <td class="hv-value" colspan="2">${esc(get('Fax','FAX'))}</td>
        </tr>
      </table>

      <!-- Titular -->
      <table class="hv-table" style="margin-top:0">
        <tr><th class="hv-subheader" colspan="3">Titular</th></tr>
        <tr>
          <td class="hv-label">Nombre</td>
          <td class="hv-label">Ciudad</td>
          <td class="hv-label">Correo Electrónico</td>
        </tr>
        <tr>
          <td class="hv-value">${esc(get('Titular Nombre','TITULAR'))}</td>
          <td class="hv-value">${esc(get('Titular Ciudad','TITULAR CIUDAD'))}</td>
          <td class="hv-value">${esc(get('Titular Email','TITULAR EMAIL'))}</td>
        </tr>
      </table>

      <!-- Fabricante -->
      <table class="hv-table" style="margin-top:0">
        <tr><th class="hv-subheader" colspan="3">Fabricante</th></tr>
        <tr>
          <td class="hv-label">Nombre</td>
          <td class="hv-label">Email</td>
          <td class="hv-label">País</td>
        </tr>
        <tr>
          <td class="hv-value">${esc(get('Fabricante','FABRICANTE','Marca','MARCA'))}</td>
          <td class="hv-value">${esc(get('Fabricante Email','FABRICANTE EMAIL'))}</td>
          <td class="hv-value">${esc(get('Pais Fabricante','PAIS','País','PAÍS'))}</td>
        </tr>
      </table>

      <!-- Recomendaciones -->
      <div class="hv-section-title">Recomendaciones y Observaciones</div>
      <table class="hv-table">
        <tr>
          <td class="hv-value" style="height:80px;vertical-align:top;">${esc(get('Observaciones','OBSERVACIONES','Recomendaciones','RECOMENDACIONES'))}</td>
        </tr>
      </table>

      <!-- Programación anual -->
      ${get('Programacion de Mantenimiento Anual','PROGRAMACION DE MANTENIMIENTO ANUAL') ? `
      <div class="hv-section-title">PROGRAMACIÓN MANTENIMIENTO ANUAL</div>
      <table class="hv-table">
        <tr><td class="hv-value">${esc(get('Programacion de Mantenimiento Anual','PROGRAMACION DE MANTENIMIENTO ANUAL'))}</td></tr>
      </table>` : ''}

      <!-- Pie de página -->
      <div class="hv-footer">
        <div>HSLV - Sistema de Gestión de Mantenimiento Hospitalario</div>
        <div>Código: SLV-GAT-GAB-12-F02 | Generado: ${new Date().toLocaleDateString('es-CO')}</div>
      </div>
    </div>
    `;
  }

  // ── PRINT ─────────────────────────────────────────────────────────────────

  function printHojaVida() {
    const area = document.getElementById('hvPrintArea');
    if (!area) return;
    const w = window.open('', '_blank', 'width=900,height=700');
    w.document.write(`<!DOCTYPE html><html lang="es"><head>
      <meta charset="UTF-8">
      <title>Hoja de Vida - SLV-GAT-GAB-12-F02</title>
      <style>
        body { font-family: Arial, sans-serif; font-size: 11px; color: #000; margin: 0; padding: 15px; }
        .hv-header { display:flex; justify-content:space-between; align-items:flex-start; border:2px solid #0d47a1; padding:10px; margin-bottom:4px; }
        .hv-hospital-name { font-weight:700; font-size:12px; color:#0d47a1; }
        .hv-dept { font-size:10px; }
        .hv-address { font-size:9px; color:#555; }
        .hv-header-center { text-align:center; }
        .hv-doc-title { font-weight:700; font-size:14px; color:#0d47a1; letter-spacing:1px; }
        .hv-code { font-weight:700; font-size:11px; }
        .hv-page { font-size:9px; color:#555; }
        .hv-section-title { background:#0d47a1; color:white; font-weight:700; padding:4px 8px; font-size:11px; text-transform:uppercase; margin:6px 0 0; }
        .hv-table { width:100%; border-collapse:collapse; font-size:10px; }
        .hv-table td, .hv-table th { border:1px solid #bbb; padding:3px 5px; }
        .hv-label { background:#eceff1; font-weight:600; font-size:9px; color:#37474f; }
        .hv-value { min-height:18px; font-size:10px; }
        .hv-subheader { background:#cfd8dc; font-weight:700; text-align:center; font-size:9px; }
        .hv-check-cell { text-align:center; font-size:13px; }
        .hv-footer { margin-top:12px; font-size:9px; color:#777; border-top:1px solid #ccc; padding-top:4px; display:flex; justify-content:space-between; }
        @media print { @page { size: A4 portrait; margin:10mm; } body { padding:0; } }
      </style>
    </head><body>${area.innerHTML}</body></html>`);
    w.document.close();
    setTimeout(() => { w.focus(); w.print(); }, 400);
  }

  // ── UTILS ─────────────────────────────────────────────────────────────────

  function esc(str) {
    return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
  }

  function formatDate(val) {
    if (!val) return '';
    try {
      const d = new Date(val);
      if (isNaN(d.getTime())) return val;
      return d.toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' });
    } catch { return val; }
  }

  function formatCurrency(val) {
    if (!val) return '';
    const n = parseFloat(String(val).replace(/[^0-9.]/g,''));
    if (isNaN(n)) return val;
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n);
  }

  // ── EXPORTS ───────────────────────────────────────────────────────────────

  window.loadHojasVida = loadHojasVida;
  window.openHojaVida = openHojaVida;
  window.closeHojaVidaModal = closeHojaVidaModal;
  window.printHojaVida = printHojaVida;
  window.hvSearch = hvSearch;
  window.hvNextPage = hvNextPage;
  window.hvPrevPage = hvPrevPage;

})();
