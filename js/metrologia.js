// ============================================================================
// MÓDULO CRONOGRAMA DE METROLOGÍA - HSLV
// Extrae equipos calibrables del Inventario Maestro y los organiza por mes
// según el campo "Años de Calibracion" y "Frecuencia de MTTO Preventivo"
// ============================================================================

(function () {
  if (window.__HSLV_METRO_LOADED) return;
  window.__HSLV_METRO_LOADED = true;

  const YEAR  = new Date().getFullYear();
  const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
                 'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  const MESES_SHORT = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

  // Colores por estado de calibración
  const COLOR_VIGENTE  = { bg:'#e8f5e9', border:'#2e7d32', text:'#1b5e20', label:'Vigente'  };
  const COLOR_PROXIMO  = { bg:'#fff8e1', border:'#f57f17', text:'#e65100', label:'Próximo'  };
  const COLOR_VENCIDO  = { bg:'#fce4ec', border:'#c62828', text:'#b71c1c', label:'Vencido'  };
  const COLOR_PROG     = { bg:'#e3f2fd', border:'#1565c0', text:'#0d47a1', label:'Programado'};

  const meState = window.__HSLV_ME_STATE || (window.__HSLV_ME_STATE = {
    allRecords  : [],
    filtered    : [],
    services    : [],
    activeService: 'TODOS',
    searchQuery : '',
    filterEstado: 'TODOS',
    loaded      : false,
  });

  const BASE = typeof API_BASE_URL !== 'undefined' ? API_BASE_URL : '/.netlify/functions';

  function hdr() { try { if (typeof getAuthHeader === 'function') return getAuthHeader(); } catch(e){} return {}; }
  function esc(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
  function setText(id,v){ const el=document.getElementById(id); if(el) el.textContent=v; }
  function safeErr(e){ try{ if(e&&e.response&&e.response.data) return e.response.data.error||JSON.stringify(e.response.data); }catch(_){} return (e&&e.message)?e.message:'Error'; }

  // ── PARSEAR MES DE CALIBRACIÓN ────────────────────────────────────────────
  // Devuelve array de índices de mes (0-11) donde se debe calibrar este año
  function parseCalibrationMonths(record) {
    const f = record.fields || {};

    // 1. Intentar leer campo "Años de Calibracion" para saber si hay cert del año actual
    const aniosCal  = String(f['Años de Calibracion'] || f['AÑOS DE CALIBRACION'] || '');
    const nCert     = String(f['N. Certificado'] || f['N. CERTIFICADO'] || '');
    const calibrable= String(f['Calibrable'] || f['CALIBRABLE'] || '').toUpperCase();
    const freq      = String(f['Frecuencia de MTTO Preventivo'] || f['Frecuencia de Mantenimiento'] || f['FRECUENCIA DE MTTO PREVENTIVO'] || '').toLowerCase();

    // Solo equipos marcados como calibrables
    if (calibrable !== 'SI') return null; // null = no calibrable

    // 2. Determinar meses según frecuencia
    const freqMap = {
      mensual     : [0,1,2,3,4,5,6,7,8,9,10,11],
      bimestral   : [0,2,4,6,8,10],
      trimestral  : [0,3,6,9],
      cuatrimestral:[0,4,8],
      semestral   : [0,6],
      anual       : [0],
    };
    let months = [0]; // default: enero
    for (const [key, vals] of Object.entries(freqMap)) {
      if (freq.includes(key)) { months = vals; break; }
    }

    // 3. Determinar estado de la calibración
    const tieneCertAno = aniosCal.includes(String(YEAR));
    const ultimoAno = aniosCal.split(',').map(s=>parseInt(s.trim())).filter(Boolean).sort().pop() || 0;
    const mesActual = new Date().getMonth();

    let estado = 'programado';
    if (tieneCertAno) {
      estado = 'vigente';
    } else if (ultimoAno === YEAR - 1) {
      // Cert del año pasado - próximo a vencer según mes
      const mesesRestantes = months[0] - mesActual;
      estado = mesesRestantes <= 1 ? 'proximo' : 'programado';
    } else if (ultimoAno > 0 && ultimoAno < YEAR - 1) {
      estado = 'vencido';
    }

    return { months, estado, aniosCal, nCert, freq };
  }

  // ── LOAD ──────────────────────────────────────────────────────────────────
  async function loadMetrologia(force) {
    const container = document.getElementById('metrologiaBody');
    if (!container) return;

    // Reutilizar datos del cronograma si ya están cargados y no se fuerza
    if (!force && meState.loaded && meState.allRecords.length) {
      applyMetroFilters(); return;
    }

    container.innerHTML = `<div class="cr-loading"><div class="cr-spinner"></div><p>Cargando Cronograma de Metrología ${YEAR}…</p></div>`;

    try {
      let all = [], offset = null;
      do {
        const p = new URLSearchParams({ pageSize: '100' });
        if (offset) p.set('offset', offset);
        const r = await axios.get(`${BASE}/inventario?${p}`, { headers: hdr() });
        const d = r.data || {};
        all = all.concat(d.records || d.data || []);
        offset = d.offset || null;
      } while (offset);

      // Solo equipos calibrables
      meState.allRecords = all.filter(r => {
        const cal = String((r.fields||{})['Calibrable']||(r.fields||{})['CALIBRABLE']||'').toUpperCase();
        return cal === 'SI';
      });
      meState.loaded = true;

      const svcSet = new Set();
      meState.allRecords.forEach(r => {
        const svc = (r.fields||{})['Servicio'] || (r.fields||{})['SERVICIO'] || '';
        if (svc.trim()) svcSet.add(svc.trim());
      });
      meState.services = Array.from(svcSet).sort();

      renderMetroTabs();
      applyMetroFilters();
      updateMetroStats();

    } catch (err) {
      container.innerHTML = `<div style="text-align:center;padding:40px;color:#c62828">
        ⚠️ Error al cargar<br><small>${esc(safeErr(err))}</small><br>
        <button class="btn btn-primary" style="margin-top:12px" onclick="loadMetrologia(true)">🔄 Reintentar</button>
      </div>`;
    }
  }

  function renderMetroTabs() {
    const el = document.getElementById('metroServiceTabs');
    if (!el) return;
    el.innerHTML = ['TODOS', ...meState.services].map(svc =>
      `<button class="cr-tab ${meState.activeService === svc ? 'active' : ''}" onclick="metroSetService('${esc(svc)}')">${esc(svc)}</button>`
    ).join('');
  }

  window.metroSetService = function(svc) {
    meState.activeService = svc;
    renderMetroTabs();
    applyMetroFilters();
  };

  window.metroSearch = function() {
    const el = document.getElementById('metroSearchInput');
    meState.searchQuery = el ? el.value.trim() : '';
    applyMetroFilters();
  };

  window.metroFilterEstado = function(v) {
    meState.filterEstado = v || 'TODOS';
    applyMetroFilters();
  };

  function applyMetroFilters() {
    const q = meState.searchQuery.toLowerCase();
    meState.filtered = meState.allRecords.filter(r => {
      const f = r.fields || {};
      const svc  = f['Servicio'] || f['SERVICIO'] || '';
      const eq   = f['Equipo']   || f['EQUIPO']   || '';
      const placa= f['Numero de Placa'] || f['PLACA'] || '';
      const cal  = parseCalibrationMonths(r);
      if (!cal) return false; // no calibrable
      if (meState.activeService !== 'TODOS' && svc.trim() !== meState.activeService) return false;
      if (meState.filterEstado !== 'TODOS' && cal.estado !== meState.filterEstado) return false;
      if (q && !eq.toLowerCase().includes(q) && !svc.toLowerCase().includes(q) && !placa.toLowerCase().includes(q)) return false;
      return true;
    });
    renderMetrologia();
    updateMetroStats();
  }

  function updateMetroStats() {
    const all     = meState.allRecords;
    const vigente = all.filter(r => { const c=parseCalibrationMonths(r); return c&&c.estado==='vigente'; }).length;
    const proximo = all.filter(r => { const c=parseCalibrationMonths(r); return c&&c.estado==='proximo'; }).length;
    const vencido = all.filter(r => { const c=parseCalibrationMonths(r); return c&&c.estado==='vencido'; }).length;
    const mesActual = new Date().getMonth();
    const esteMes  = all.filter(r => { const c=parseCalibrationMonths(r); return c&&c.months.includes(mesActual); }).length;
    setText('meStatTotal',   all.length);
    setText('meStatVigente', vigente);
    setText('meStatProximo', proximo);
    setText('meStatVencido', vencido);
    setText('meStatMes',     esteMes);
  }

  // ── RENDER GRILLA ─────────────────────────────────────────────────────────
  function renderMetrologia() {
    const container = document.getElementById('metrologiaBody');
    if (!container) return;

    if (!meState.filtered.length) {
      container.innerHTML = `<div style="text-align:center;padding:70px;color:#90a4ae">
        <div style="font-size:64px;opacity:.35">⚖️</div>
        <div style="font-size:18px;font-weight:700;color:#546e7a;margin-top:16px">Sin equipos calibrables encontrados</div>
        <div style="font-size:13px;margin-top:8px">Verifica que los equipos tengan el campo "Calibrable = SI" en el inventario.</div>
      </div>`;
      return;
    }

    // Agrupar por servicio
    const groups = {};
    meState.filtered.forEach(r => {
      const f   = r.fields || {};
      const svc = (f['Servicio'] || f['SERVICIO'] || 'Sin Servicio').trim();
      if (!groups[svc]) groups[svc] = [];
      groups[svc].push(r);
    });

    const mesActual = new Date().getMonth();
    let html = '';
    Object.entries(groups).sort(([a],[b]) => a.localeCompare(b)).forEach(([svc, records]) => {
      html += buildMetroServiceBlock(svc, records, mesActual);
    });
    html += buildMetroLegend();
    container.innerHTML = html;
  }

  function buildMetroServiceBlock(svc, records, mesActual) {
    const headers = MESES_SHORT.map((m, i) =>
      `<th class="cr-th-mes ${i === mesActual ? 'cr-mes-current' : ''}">${m}</th>`
    ).join('');

    const rows = records.map(r => {
      const f      = r.fields || {};
      const equipo = f['Equipo'] || f['EQUIPO'] || '—';
      const placa  = f['Numero de Placa'] || f['PLACA'] || '';
      const marca  = f['Marca'] || f['MARCA'] || '';
      const serie  = f['Serie'] || f['SERIE'] || '';
      const nCert  = f['N. Certificado'] || f['N. CERTIFICADO'] || '—';
      const cal    = parseCalibrationMonths(r);
      if (!cal) return '';

      const colorMap = { vigente: COLOR_VIGENTE, proximo: COLOR_PROXIMO, vencido: COLOR_VENCIDO, programado: COLOR_PROG };
      const color    = colorMap[cal.estado] || COLOR_PROG;
      const anios    = cal.aniosCal || '—';

      const cells = MESES_SHORT.map((_, i) => {
        const isCalMonth  = cal.months.includes(i);
        const isCurrent   = i === mesActual;
        const isPast      = i < mesActual;
        if (!isCalMonth) return `<td class="cr-cell-empty ${isCurrent ? 'cr-cell-current-month' : ''}"></td>`;
        return `<td class="cr-cell-active ${isCurrent ? 'cr-cell-current-month' : ''} ${isPast ? 'cr-cell-past' : ''}">
          <div class="cr-cell-inner">
            <span class="cr-week-badge" style="background:${color.bg};border-color:${color.border};color:${color.text};">⚖️</span>
          </div>
        </td>`;
      }).join('');

      const total = cal.months.length;
      const estadoBadge = `<span class="metro-estado-badge" style="background:${color.bg};border:1.5px solid ${color.border};color:${color.text};">${color.label}</span>`;

      return `<tr class="cr-row">
        <td class="cr-td-equipo">
          <div class="cr-equipo-name" title="${esc(equipo)}">${esc(equipo)}</div>
          ${placa ? `<div class="cr-equipo-sub">🏷️ ${esc(placa)}</div>` : ''}
          ${marca ? `<div class="cr-equipo-sub">🏭 ${esc(marca)}${serie ? ' · ' + esc(serie) : ''}</div>` : ''}
        </td>
        <td class="cr-td-freq">
          <div style="display:flex;flex-direction:column;gap:4px;align-items:flex-start">
            ${estadoBadge}
            <span style="font-size:10px;color:#78909c">Cert: ${esc(nCert)}</span>
            <span style="font-size:10px;color:#78909c">Años: ${esc(anios)}</span>
          </div>
        </td>
        ${cells}
        <td class="cr-td-total"><strong>${total}</strong></td>
      </tr>`;
    }).join('');

    if (!rows.replace(/<tr[^>]*>\s*<\/tr>/g,'').trim()) return '';

    return `<div class="cr-service-block">
      <div class="cr-service-header" style="background:linear-gradient(135deg,#4a148c,#6a1b9a)">
        <span class="cr-service-icon">⚖️</span>
        <span class="cr-service-name">${esc(svc)}</span>
        <span class="cr-service-badge">${records.length} equipo${records.length !== 1 ? 's' : ''}</span>
      </div>
      <div class="cr-table-wrap"><table class="cr-table">
        <thead><tr>
          <th class="cr-th-equipo">EQUIPO / PLACA</th>
          <th class="cr-th-freq">ESTADO / CERTIFICADO</th>
          ${headers}
          <th class="cr-th-total">TOTAL</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table></div>
    </div>`;
  }

  function buildMetroLegend() {
    const items = [
      [COLOR_VIGENTE,  'Calibración vigente (cert. del año actual)'],
      [COLOR_PROXIMO,  'Próximo a calibrar (cert. año anterior)'],
      [COLOR_VENCIDO,  'Calibración vencida (cert. > 1 año de retraso)'],
      [COLOR_PROG,     'Programado (sin certificado aún)'],
    ];
    return `<div class="cr-legend" style="margin-top:16px">
      <span class="cr-legend-title">⚖️ Estado:</span>
      ${items.map(([c,label]) => `<span class="cr-legend-item" title="${esc(label)}" style="background:${c.bg};border:1.5px solid ${c.border};color:${c.text};">${c.label}</span>`).join('')}
      <span class="cr-legend-note">· ⚖️ = mes programado de calibración</span>
    </div>`;
  }

  // ── EXPORTAR CSV ──────────────────────────────────────────────────────────
  window.exportMetrologiaCSV = function() {
    if (!meState.allRecords.length) { alert('No hay datos'); return; }
    const rows = [['Servicio','Equipo','Placa','Marca','Serie','N. Certificado','Frecuencia Cal.','Años Calibración','Estado','Meses Programados']];
    meState.allRecords.forEach(r => {
      const f   = r.fields || {};
      const cal = parseCalibrationMonths(r);
      if (!cal) return;
      rows.push([
        f['Servicio']||f['SERVICIO']||'',
        f['Equipo']||f['EQUIPO']||'',
        f['Numero de Placa']||f['PLACA']||'',
        f['Marca']||f['MARCA']||'',
        f['Serie']||f['SERIE']||'',
        f['N. Certificado']||f['N. CERTIFICADO']||'',
        cal.freq,
        cal.aniosCal,
        cal.estado,
        cal.months.map(m => MESES[m]).join(', '),
      ]);
    });
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    a.download = `metrologia_${YEAR}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  };

  // ── IMPRIMIR ──────────────────────────────────────────────────────────────
  window.printMetrologia = function() {
    if (!meState.allRecords.length) { alert('No hay datos para imprimir'); return; }
    const mesActual = new Date().getMonth();
    const css = `
      *{box-sizing:border-box}
      body{font-family:Arial,sans-serif;font-size:10px;color:#000;padding:12px;margin:0}
      .print-header{border-bottom:2px solid #4a148c;padding-bottom:8px;margin-bottom:14px;display:flex;justify-content:space-between;align-items:flex-end}
      h1{font-size:14px;color:#4a148c;margin:0 0 3px}
      .print-subtitle{font-size:10px;color:#607d8b}
      .print-meta{font-size:9px;color:#90a4ae;text-align:right}
      .cr-service-block{margin-bottom:14px;page-break-inside:avoid}
      .cr-service-header{background:#4a148c;color:white;padding:5px 10px;font-weight:700;font-size:11px;border-radius:3px;margin-bottom:2px;display:flex;align-items:center;gap:8px;-webkit-print-color-adjust:exact;print-color-adjust:exact}
      .cr-service-name{flex:1}
      .cr-service-badge{background:rgba(255,255,255,.22);padding:2px 8px;border-radius:10px;font-size:9px}
      .cr-table{width:100%;border-collapse:collapse;font-size:9px}
      .cr-table th,.cr-table td{border:1px solid #ccc;padding:4px;text-align:center;vertical-align:middle}
      .cr-table th{background:#f3e5f5;font-weight:700;font-size:8.5px;text-transform:uppercase;white-space:nowrap;-webkit-print-color-adjust:exact;print-color-adjust:exact}
      .cr-th-equipo,.cr-td-equipo{text-align:left!important;min-width:130px;padding-left:8px!important}
      .cr-equipo-name{font-weight:700;font-size:9px}
      .cr-equipo-sub{font-size:8px;color:#607d8b}
      .cr-week-badge{display:inline-block;padding:1px 5px;border-radius:3px;border:1px solid;font-size:8px;font-weight:700;-webkit-print-color-adjust:exact;print-color-adjust:exact}
      .cr-cell-current-month{background:#fff8e1!important;-webkit-print-color-adjust:exact;print-color-adjust:exact}
      .cr-mes-current{background:#f3e5f5!important;color:#4a148c!important;-webkit-print-color-adjust:exact;print-color-adjust:exact}
      .cr-cell-inner{display:flex;flex-direction:column;align-items:center;gap:2px}
      .cr-td-total{font-weight:700;color:#4a148c}
      .metro-estado-badge{display:inline-block;padding:2px 6px;border-radius:4px;border:1px solid;font-size:8px;font-weight:700;-webkit-print-color-adjust:exact;print-color-adjust:exact}
      .cr-legend{margin-top:10px;font-size:9px;display:flex;align-items:center;gap:6px;flex-wrap:wrap;padding:5px 10px;background:#f5f5f5;border-radius:4px}
      .cr-legend-item{padding:2px 8px;border-radius:4px;border:1px solid;font-weight:700;font-size:8px;-webkit-print-color-adjust:exact;print-color-adjust:exact}
      @media print{@page{size:A3 landscape;margin:7mm}}
    `;

    const groups = {};
    meState.allRecords.forEach(r => {
      const svc = ((r.fields||{})['Servicio']||(r.fields||{})['SERVICIO']||'Sin Servicio').trim();
      if (!groups[svc]) groups[svc] = [];
      groups[svc].push(r);
    });

    let body = `<div class="print-header">
      <div>
        <h1>⚖️ Cronograma de Metrología / Calibración ${YEAR}</h1>
        <div class="print-subtitle">Hospital Susana López de Valencia E.S.E · Sistema de Gestión de la Tecnología</div>
      </div>
      <div class="print-meta">Generado: ${new Date().toLocaleDateString('es-CO')}<br>Total equipos calibrables: ${meState.allRecords.length}</div>
    </div>`;

    Object.entries(groups).sort(([a],[b])=>a.localeCompare(b)).forEach(([svc, records]) => {
      body += buildMetroServiceBlock(svc, records, mesActual);
    });
    body += buildMetroLegend();

    const w = window.open('', '_blank', 'width=1200,height=800');
    w.document.write(`<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>Metrología ${YEAR}</title><style>${css}</style></head><body>${body}</body></html>`);
    w.document.close();
    setTimeout(() => { w.focus(); w.print(); }, 600);
  };

  window.loadMetrologia = loadMetrologia;

})();
