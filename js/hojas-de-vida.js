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
        <td style="font-weight:700;color:#90caf9;font-family:'JetBrains Mono',monospace;">${esc(String(item))}</td>
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

  async function openHojaVida(recordId) {
    const modal = document.getElementById('hvModal');
    if (modal) { modal.style.display = 'flex'; modal.classList.add('active'); }
    document.body.style.overflow = 'hidden';

    // Mostrar indicador de carga
    const container = document.getElementById('hvSheetContent');
    if (container) container.innerHTML = '<div style="text-align:center;padding:60px;color:#607d8b;font-size:16px;">⏳ Cargando hoja de vida...</div>';

    try {
      const base = typeof API_BASE_URL !== 'undefined' ? API_BASE_URL : '/.netlify/functions';
      const response = await axios.get(`${base}/inventario?id=${recordId}`, { headers: getHeaders() });
      const data = response.data || {};
      if (!data.ok || !data.record) {
        if (container) container.innerHTML = '<div style="text-align:center;padding:60px;color:#c62828;">⚠️ No se pudo cargar el registro.</div>';
        return;
      }
      hvState.currentRecord = data.record;
      renderHojaVida(data.record);
    } catch (err) {
      console.error('❌ Error cargando hoja de vida:', err);
      if (container) container.innerHTML = `<div style="text-align:center;padding:60px;color:#c62828;">⚠️ Error: ${safeErr(err)}</div>`;
    }
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
    <style>
      .hv-sheet { font-family: Arial, sans-serif; font-size: 12px; color: #212121; }
      .hv-header { display:flex; justify-content:space-between; align-items:flex-start; border:2px solid #90caf9; border-radius:4px; padding:12px 16px; margin-bottom:6px; background:#f0f7ff; gap:16px; }
      .hv-header-left { display:flex; align-items:center; gap:14px; }
      .hv-logo img { width:64px; height:64px; object-fit:contain; }
      .hv-hospital-name { font-weight:800; font-size:14px; color:#212121; text-transform:uppercase; }
      .hv-dept { font-size:12px; font-weight:600; color:#263238; }
      .hv-address { font-size:11px; color:#607d8b; margin-top:2px; }
      .hv-header-center { text-align:center; flex:1; }
      .hv-doc-title { font-weight:800; font-size:16px; color:#212121; letter-spacing:1px; text-transform:uppercase; text-align:center; }
      .hv-code { font-weight:700; font-size:13px; color:#263238; }
      .hv-page { font-size:11px; color:#607d8b; margin-top:4px; }
      .hv-header-right { text-align:right; }
      .hv-section-title { background:linear-gradient(90deg,#64b5f6,#90caf9); color:white; font-weight:700; padding:5px 10px; font-size:12px; text-transform:uppercase; letter-spacing:0.5px; margin:8px 0 0; border-radius:3px; }
      .hv-table { width:100%; border-collapse:collapse; font-size:11.5px; margin-top:1px; }
      .hv-table td, .hv-table th { border:1px solid #b0bec5; padding:5px 8px; vertical-align:top; }
      .hv-label { background:#eceff1; font-weight:700; font-size:10.5px; color:#37474f; text-transform:uppercase; letter-spacing:0.3px; white-space:nowrap; }
      .hv-value { min-height:22px; font-size:11.5px; color:#212121; }
      .hv-subheader { background:#cfd8dc; font-weight:700; text-align:center; font-size:11px; text-transform:uppercase; color:#263238; }
      .hv-check-cell { text-align:center; font-size:15px; color:#90caf9; font-weight:700; }
      .hv-footer { margin-top:16px; font-size:10px; color:#9e9e9e; border-top:1px solid #e0e0e0; padding-top:6px; display:flex; justify-content:space-between; }
    </style>
    <div class="hv-sheet" id="hvPrintArea">

      <!-- ENCABEZADO -->
      <div class="hv-header">
        <div class="hv-header-left">
          <div class="hv-logo"><img src="data:image/png;base64,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" alt="Logo Hospital" style="width:64px;height:64px;object-fit:contain;"></div>
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
          <td class="hv-label">Registro INVIMA</td>
          <td class="hv-label" colspan="2">Clasificación Biomédica</td>
        </tr>
        <tr>
          <td class="hv-value">${esc(get('Distintivo habilitacion','DISTINTIVO HABILITACION'))}</td>
          <td class="hv-value">${esc(get('Codigo ECRI','CODIGO ECRI'))}</td>
          <td class="hv-value">${esc(get('Registro INVIMA','REGISTRO INVIMA'))}</td>
          <td class="hv-value" colspan="2">${esc(get('Clasificacion Biomedica','CLASIFICACION BIOMEDICA'))}</td>
        </tr>
        <tr>
          <td class="hv-label">Frecuencia Mantenimiento</td>
          <td class="hv-label">Código Prestador</td>
          <td class="hv-label">Clasificación Riesgo</td>
          <td class="hv-label" colspan="2">Sede</td>
        </tr>
        <tr>
          <td class="hv-value">${esc(get('Frecuencia de Mantenimiento','Frecuencia de MTTO Preventivo','FRECUENCIA DE MTTO PREVENTIVO'))}</td>
          <td class="hv-value">${esc(get('Codigo de prestador','Codigo Prestador','CODIGO DE PRESTADOR'))}</td>
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
          <td class="hv-value">${esc(get('Frecuencia Instalacion','Frecuencia','FRECUENCIA INSTALACION','FRECUENCIA'))}</td>
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
          <td class="hv-value">${esc(get('Presion Instalacion','Presion','PRESION INSTALACION','PRESION'))}</td>
          <td class="hv-value">${esc(get('Velocidad Instalacion','Velocidad','VELOCIDAD INSTALACION','VELOCIDAD'))}</td>
          <td class="hv-value">${esc(get('Temperatura Instalacion','Temperatura','TEMPERATURA INSTALACION','TEMPERATURA'))}</td>
          <td class="hv-value">${esc(get('Peso Instalacion','Peso','PESO INSTALACION','PESO'))}</td>
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
    const w = window.open('', '_blank', 'width=1000,height=800');
    w.document.write(`<!DOCTYPE html><html lang="es"><head>
      <meta charset="UTF-8">
      <title>Hoja de Vida - SLV-GAT-GAB-12-F02</title>
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: Arial, sans-serif; font-size: 11px; color: #212121; background: white; padding: 14px; }

        /* ── ENCABEZADO ── */
        .hv-sheet { font-family: Arial, sans-serif; }
        .hv-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          border: 2px solid #90caf9;
          border-radius: 4px;
          padding: 10px 14px;
          margin-bottom: 6px;
          background: #f4f8ff;
          gap: 14px;
        }
        .hv-header-left { display: flex; align-items: center; gap: 12px; }
        .hv-logo img { width: 56px; height: 56px; object-fit: contain; }
        .hv-hospital-name { font-weight: 800; font-size: 13px; color: #212121; text-transform: uppercase; }
        .hv-dept { font-size: 11px; font-weight: 600; color: #263238; margin-top: 2px; }
        .hv-address { font-size: 10px; color: #607d8b; margin-top: 2px; }
        .hv-header-center { text-align: center; flex: 1; }
        .hv-doc-title { font-weight: 800; font-size: 15px; color: #212121; letter-spacing: 1px; text-transform: uppercase; text-align: center; }
        .hv-code { font-weight: 700; font-size: 12px; color: #263238; margin-top: 4px; }
        .hv-page { font-size: 10px; color: #607d8b; margin-top: 3px; }

        /* ── TÍTULOS DE SECCIÓN ── */
        .hv-section-title {
          background: #64b5f6;
          color: white !important;
          font-weight: 700;
          padding: 5px 10px;
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin: 7px 0 0;
          border-radius: 3px;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }

        /* ── TABLAS ── */
        .hv-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 10.5px;
          margin-top: 1px;
        }
        .hv-table td,
        .hv-table th {
          border: 1px solid #b0bec5;
          padding: 4px 7px;
          vertical-align: top;
        }
        .hv-label {
          background: #eceff1 !important;
          font-weight: 700;
          font-size: 10px;
          color: #37474f;
          text-transform: uppercase;
          letter-spacing: 0.3px;
          white-space: nowrap;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
        .hv-value {
          min-height: 20px;
          font-size: 11px;
          color: #212121;
        }
        .hv-subheader {
          background: #cfd8dc !important;
          font-weight: 700;
          text-align: center;
          font-size: 10px;
          text-transform: uppercase;
          color: #263238;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
        .hv-check-cell {
          text-align: center;
          font-size: 14px;
          color: #90caf9;
          font-weight: 700;
        }

        /* ── PIE DE PÁGINA ── */
        .hv-footer {
          margin-top: 14px;
          font-size: 10px;
          color: #9e9e9e;
          border-top: 1px solid #e0e0e0;
          padding-top: 5px;
          display: flex;
          justify-content: space-between;
        }

        /* ── PRINT ── */
        @media print {
          @page { size: A4 portrait; margin: 10mm; }
          body { padding: 0; }
          .hv-section-title { background: #64b5f6 !important; color: white !important; }
          .hv-label { background: #eceff1 !important; }
          .hv-subheader { background: #cfd8dc !important; }
          .hv-header { background: #f4f8ff !important; }
        }
      </style>
    </head><body>${area.innerHTML}</body></html>`);
    w.document.close();
    setTimeout(() => { w.focus(); w.print(); }, 500);
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
