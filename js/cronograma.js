// ============================================================================
// MÓDULO CRONOGRAMA DE MANTENIMIENTO PREVENTIVO - HSLV
// Visualiza la programación anual de mantenimientos por servicio
// Datos cargados desde el Inventario Maestro (Airtable)
// ============================================================================

(function () {
  if (window.__HSLV_CRONOGRAMA_LOADED) return;
  window.__HSLV_CRONOGRAMA_LOADED = true;

  const YEAR = new Date().getFullYear();

  const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
                 'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  const MESES_SHORT = ['Ene','Feb','Mar','Abr','May','Jun',
                       'Jul','Ago','Sep','Oct','Nov','Dic'];

  // Colores por semana
  const WEEK_COLORS = {
    S1: { bg: '#e3f2fd', border: '#1565c0', text: '#0d47a1' },
    S2: { bg: '#e8f5e9', border: '#2e7d32', text: '#1b5e20' },
    S3: { bg: '#fff8e1', border: '#f57f17', text: '#e65100' },
    S4: { bg: '#fce4ec', border: '#c62828', text: '#b71c1c' },
  };

  const crState = window.__HSLV_CR_STATE || (window.__HSLV_CR_STATE = {
    allRecords: [],
    filtered: [],
    services: [],
    activeService: 'TODOS',
    viewMode: 'grid',   // 'grid' | 'list'
    searchQuery: '',
    loaded: false,
  });

  // ── HELPERS ────────────────────────────────────────────────────────────────

  function getHeaders() {
    try { if (typeof getAuthHeader === 'function') return getAuthHeader(); } catch (e) {}
    return {};
  }

  function safeErr(e) {
    try { if (e && e.response && e.response.data) return e.response.data.error || JSON.stringify(e.response.data); } catch (_) {}
    return (e && e.message) ? e.message : 'Error desconocido';
  }

  function esc(s) {
    return String(s || '')
      .replace(/&/g,'&amp;').replace(/</g,'&lt;')
      .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  /**
   * Parsea el campo "Programacion de Mantenimiento Anual" y devuelve
   * un array de objetos: [{ mesIdx: 0-11, semana: 'S1'|'S2'|'S3'|'S4' }, ...]
   *
   * Formatos soportados:
   *  • "Enero S1 (...) | Julio S3 (...)"
   *  • "Enero, Abril, Julio, Octubre"
   *  • "Mensual", "Trimestral", etc. (se expanden automáticamente)
   *  • Fechas ISO como 2025-01-06 – 2025-01-10
   */
  function parseSchedule(record) {
    const f = record.fields || {};
    const raw = f['Programacion de Mantenimiento Anual']
             || f['PROGRAMACION DE MANTENIMIENTO ANUAL']
             || '';
    const freq = f['Frecuencia de Mantenimiento']
              || f['Frecuencia de MTTO Preventivo']
              || f['Frecuencia de Mantenimiento Preventivo']
              || f['FRECUENCIA DE MTTO PREVENTIVO']
              || '';
    const fechaProg = f['Fecha Programada de Mantenimiento']
                   || f['FECHA PROGRAMADA DE MANTENIMINETO']
                   || '';

    const results = [];

    // ── A) Parsear campo textual con formato "Mes Sx (...)" separado por |
    if (raw && raw.trim()) {
      const parts = raw.split('|');
      parts.forEach(part => {
        part = part.trim();
        // Buscar nombre de mes
        const mesMatch = MESES.findIndex(m =>
          part.toLowerCase().includes(m.toLowerCase())
        );
        if (mesMatch === -1) return;
        // Buscar semana S1..S4
        const semMatch = part.match(/S([1-4])/i);
        const sem = semMatch ? 'S' + semMatch[1] : 'S1';
        results.push({ mesIdx: mesMatch, semana: sem });
      });
      if (results.length) return results;
    }

    // ── B) Lista de meses separados por coma "Enero, Abril, ..."
    if (raw && raw.includes(',')) {
      raw.split(',').forEach((part, i) => {
        part = part.trim();
        const mesMatch = MESES.findIndex(m =>
          part.toLowerCase().includes(m.toLowerCase())
        );
        if (mesMatch !== -1) results.push({ mesIdx: mesMatch, semana: 'S1' });
      });
      if (results.length) return results;
    }

    // ── C) Expandir por frecuencia estándar
    const freqLow = (freq || '').toLowerCase();
    const freqMap = {
      'mensual':       [0,1,2,3,4,5,6,7,8,9,10,11],
      'bimestral':     [0,2,4,6,8,10],
      'trimestral':    [0,3,6,9],
      'cuatrimestral': [0,4,8],
      'semestral':     [0,6],
      'anual':         [0],
    };
    for (const [key, months] of Object.entries(freqMap)) {
      if (freqLow.includes(key)) {
        months.forEach(m => results.push({ mesIdx: m, semana: 'S1' }));
        return results;
      }
    }

    // ── D) Usar fecha programada como único punto
    if (fechaProg) {
      try {
        const d = new Date(fechaProg);
        if (!isNaN(d.getTime())) {
          const week = Math.ceil(d.getDate() / 7);
          results.push({ mesIdx: d.getMonth(), semana: 'S' + Math.min(week, 4) });
        }
      } catch (_) {}
    }

    return results;
  }

  // ── LOAD ───────────────────────────────────────────────────────────────────

  async function loadCronograma() {
    const container = document.getElementById('cronogramaBody');
    if (!container) return;

    container.innerHTML = `<div class="cr-loading"><div class="cr-spinner"></div><p>Cargando cronograma del año ${YEAR}...</p></div>`;

    try {
      const base = typeof API_BASE_URL !== 'undefined' ? API_BASE_URL : '/.netlify/functions';
      // Cargar todos los registros (hasta 100 por llamada; si hay más se pagina)
      let allRec = [];
      let offset = null;

      do {
        const params = new URLSearchParams({ pageSize: '100' });
        if (offset) params.set('offset', offset);
        const resp = await axios.get(`${base}/inventario?${params}`, { headers: getHeaders() });
        const data = resp.data || {};
        allRec = allRec.concat(data.records || data.data || []);
        offset = data.offset || null;
      } while (offset);

      crState.allRecords = allRec;
      crState.loaded = true;

      // Extraer servicios únicos
      const svcSet = new Set();
      allRec.forEach(r => {
        const f = r.fields || {};
        const svc = f['Servicio'] || f['SERVICIO'] || '';
        if (svc.trim()) svcSet.add(svc.trim());
      });
      crState.services = Array.from(svcSet).sort();

      renderServiceTabs();
      applyFiltersAndRender();

      // Estadísticas
      updateCronogramaStats();

    } catch (err) {
      container.innerHTML = `
        <div style="text-align:center;padding:40px;color:#c62828;">
          ⚠️ Error al cargar el cronograma<br>
          <small>${esc(safeErr(err))}</small><br>
          <button class="btn btn-primary" style="margin-top:12px" onclick="loadCronograma()">🔄 Reintentar</button>
        </div>`;
    }
  }

  // ── SERVICE TABS ───────────────────────────────────────────────────────────

  function renderServiceTabs() {
    const tabsEl = document.getElementById('crServiceTabs');
    if (!tabsEl) return;

    const all = ['TODOS', ...crState.services];
    tabsEl.innerHTML = all.map(svc => `
      <button class="cr-tab ${crState.activeService === svc ? 'active' : ''}"
        onclick="crSetService('${esc(svc)}')">${esc(svc)}</button>
    `).join('');
  }

  window.crSetService = function(svc) {
    crState.activeService = svc;
    renderServiceTabs();
    applyFiltersAndRender();
  };

  // ── FILTERS ────────────────────────────────────────────────────────────────

  function applyFiltersAndRender() {
    const q = crState.searchQuery.toLowerCase();
    crState.filtered = crState.allRecords.filter(r => {
      const f = r.fields || {};
      const svc = f['Servicio'] || f['SERVICIO'] || '';
      const eq  = f['Equipo'] || f['EQUIPO'] || '';
      const placa = f['Numero de Placa'] || f['PLACA'] || '';

      if (crState.activeService !== 'TODOS' && svc.trim() !== crState.activeService) return false;
      if (q && !eq.toLowerCase().includes(q) && !svc.toLowerCase().includes(q) && !placa.toLowerCase().includes(q)) return false;

      // Solo incluir equipos que tengan programación
      const sched = parseSchedule(r);
      return sched.length > 0;
    });

    renderCronograma();
    updateCronogramaStats();
  }

  window.crSearch = function() {
    const el = document.getElementById('crSearchInput');
    crState.searchQuery = el ? el.value.trim() : '';
    applyFiltersAndRender();
  };

  // ── STATS ──────────────────────────────────────────────────────────────────

  function updateCronogramaStats() {
    const total = crState.allRecords.length;
    const withSched = crState.allRecords.filter(r => parseSchedule(r).length > 0).length;
    const noSched = total - withSched;

    // Contar mantenimientos del mes actual
    const currentMonth = new Date().getMonth();
    let thisMo = 0;
    crState.allRecords.forEach(r => {
      parseSchedule(r).forEach(s => { if (s.mesIdx === currentMonth) thisMo++; });
    });

    setText('crStatTotal', total);
    setText('crStatProg', withSched);
    setText('crStatNoProg', noSched);
    setText('crStatMonth', thisMo);
  }

  function setText(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  }

  // ── RENDER MAIN GRID ───────────────────────────────────────────────────────

  function renderCronograma() {
    const container = document.getElementById('cronogramaBody');
    if (!container) return;

    if (!crState.filtered.length) {
      container.innerHTML = `
        <div style="text-align:center;padding:60px;color:#90a4ae;">
          <div style="font-size:60px;margin-bottom:16px;opacity:0.4;">📅</div>
          <div style="font-size:18px;font-weight:700;color:#546e7a;">Sin programación registrada</div>
          <div style="font-size:14px;color:#90a4ae;margin-top:8px;">
            Registra la frecuencia y programación anual en el Inventario Maestro.
          </div>
        </div>`;
      return;
    }

    // Agrupar por servicio
    const groups = {};
    crState.filtered.forEach(r => {
      const f = r.fields || {};
      const svc = (f['Servicio'] || f['SERVICIO'] || 'Sin Servicio').trim();
      if (!groups[svc]) groups[svc] = [];
      groups[svc].push(r);
    });

    let html = '';

    Object.entries(groups).sort(([a],[b]) => a.localeCompare(b)).forEach(([svc, records]) => {
      html += `
      <div class="cr-service-block">
        <div class="cr-service-header">
          <span class="cr-service-icon">🏥</span>
          <span class="cr-service-name">${esc(svc)}</span>
          <span class="cr-service-badge">${records.length} equipo${records.length !== 1 ? 's' : ''}</span>
        </div>
        <div class="cr-table-wrap">
          <table class="cr-table">
            <thead>
              <tr>
                <th class="cr-th-equipo">EQUIPO / PLACA</th>
                <th class="cr-th-freq">FRECUENCIA</th>
                ${MESES_SHORT.map((m, i) => `<th class="cr-th-mes ${i === new Date().getMonth() ? 'cr-mes-current' : ''}">${m}</th>`).join('')}
                <th class="cr-th-total">TOTAL</th>
              </tr>
            </thead>
            <tbody>
              ${records.map(r => renderEquipoRow(r)).join('')}
            </tbody>
          </table>
        </div>
      </div>`;
    });

    // Leyenda de semanas
    html += `
    <div class="cr-legend">
      <span class="cr-legend-title">Semanas:</span>
      ${Object.entries(WEEK_COLORS).map(([s, c]) => `
        <span class="cr-legend-item" style="background:${c.bg};border:1.5px solid ${c.border};color:${c.text};">${s}</span>
      `).join('')}
      <span class="cr-legend-note">· Cada celda muestra la semana programada del mes</span>
    </div>`;

    container.innerHTML = html;
  }

  function renderEquipoRow(record) {
    const f = record.fields || {};
    const equipo = f['Equipo'] || f['EQUIPO'] || '—';
    const placa  = f['Numero de Placa'] || f['PLACA'] || '';
    const marca  = f['Marca'] || f['MARCA'] || '';
    const freq   = f['Frecuencia de Mantenimiento']
                || f['Frecuencia de MTTO Preventivo']
                || f['FRECUENCIA DE MTTO PREVENTIVO']
                || '—';

    const schedule = parseSchedule(record);

    // Indexar por mes → array de semanas
    const byMonth = {};
    schedule.forEach(s => {
      if (!byMonth[s.mesIdx]) byMonth[s.mesIdx] = [];
      byMonth[s.mesIdx].push(s.semana);
    });

    const today = new Date();
    const currentMonth = today.getMonth();

    const cells = MESES.map((_, i) => {
      const weeks = byMonth[i] || [];
      const isPast = i < currentMonth;
      const isCurrent = i === currentMonth;

      if (!weeks.length) {
        return `<td class="cr-cell-empty ${isCurrent ? 'cr-cell-current-month' : ''}"></td>`;
      }

      const weeksHtml = weeks.map(w => {
        const c = WEEK_COLORS[w] || WEEK_COLORS.S1;
        return `<span class="cr-week-badge" style="background:${c.bg};border-color:${c.border};color:${c.text};">${w}</span>`;
      }).join('');

      return `<td class="cr-cell-active ${isCurrent ? 'cr-cell-current-month' : ''} ${isPast ? 'cr-cell-past' : ''}">
        <div class="cr-cell-inner">${weeksHtml}</div>
      </td>`;
    }).join('');

    return `<tr class="cr-row">
      <td class="cr-td-equipo">
        <div class="cr-equipo-name" title="${esc(equipo)}">${esc(equipo)}</div>
        ${placa ? `<div class="cr-equipo-sub">${esc(placa)}</div>` : ''}
        ${marca ? `<div class="cr-equipo-sub">${esc(marca)}</div>` : ''}
      </td>
      <td class="cr-td-freq"><span class="cr-freq-badge">${esc(freq)}</span></td>
      ${cells}
      <td class="cr-td-total"><strong>${schedule.length}</strong></td>
    </tr>`;
  }

  // ── PRINT ──────────────────────────────────────────────────────────────────

  window.printCronograma = function() {
    const area = document.getElementById('cronogramaContent');
    if (!area) return;
    const w = window.open('', '_blank', 'width=1200,height=800');
    w.document.write(`<!DOCTYPE html><html lang="es"><head>
      <meta charset="UTF-8">
      <title>Cronograma Mantenimiento Preventivo ${YEAR}</title>
      <style>
        body { font-family: Arial, sans-serif; font-size: 10px; color: #000; padding: 10px; }
        .cr-service-block { margin-bottom: 20px; page-break-inside: avoid; }
        .cr-service-header { background:#0d47a1; color:white; padding:6px 10px; font-weight:700; font-size:11px; border-radius:4px; margin-bottom:2px; display:flex; align-items:center; gap:8px; }
        .cr-service-badge { background:rgba(255,255,255,0.25); padding:2px 8px; border-radius:10px; font-size:10px; }
        .cr-table { width:100%; border-collapse:collapse; font-size:9px; }
        .cr-table th, .cr-table td { border:1px solid #ccc; padding:3px 4px; text-align:center; }
        .cr-table th { background:#eceff1; font-weight:700; }
        .cr-th-equipo { text-align:left; min-width:120px; }
        .cr-td-equipo { text-align:left; }
        .cr-equipo-name { font-weight:600; }
        .cr-equipo-sub { font-size:8px; color:#607d8b; }
        .cr-week-badge { display:inline-block; padding:1px 4px; border-radius:3px; border:1px solid; font-size:8px; font-weight:700; margin:1px; }
        .cr-mes-current { background:#fff3e0 !important; }
        .cr-freq-badge { font-size:8px; padding:1px 5px; border-radius:10px; background:#e3f2fd; color:#0d47a1; font-weight:700; }
        .cr-legend { margin-top:10px; font-size:9px; display:flex; align-items:center; gap:6px; flex-wrap:wrap; }
        .cr-legend-item { padding:2px 8px; border-radius:10px; border:1px solid; font-weight:700; font-size:8px; }
        .print-header { text-align:center; margin-bottom:16px; border-bottom:2px solid #0d47a1; padding-bottom:10px; }
        .print-header h1 { font-size:16px; color:#0d47a1; margin:0; }
        .print-header p { font-size:10px; color:#607d8b; margin:4px 0 0; }
        @media print { @page { size: A3 landscape; margin: 8mm; } }
      </style>
    </head><body>
      <div class="print-header">
        <h1>Cronograma de Mantenimiento Preventivo ${YEAR}</h1>
        <p>Hospital Susana López de Valencia E.S.E · Sistema de Gestión de la Tecnología · Generado: ${new Date().toLocaleDateString('es-CO')}</p>
      </div>
      ${area.innerHTML}
    </body></html>`);
    w.document.close();
    setTimeout(() => { w.focus(); w.print(); }, 500);
  };

  // ── EXPORTS ────────────────────────────────────────────────────────────────

  window.loadCronograma = loadCronograma;

  window.exportCronogramaCSV = function() {
    if (!crState.allRecords.length) { alert('No hay datos'); return; }
    const rows = [['Servicio','Equipo','Placa','Frecuencia','Mes','Semana']];
    crState.allRecords.forEach(r => {
      const f = r.fields || {};
      const svc  = f['Servicio'] || f['SERVICIO'] || '';
      const eq   = f['Equipo'] || f['EQUIPO'] || '';
      const placa = f['Numero de Placa'] || f['PLACA'] || '';
      const freq  = f['Frecuencia de Mantenimiento'] || f['Frecuencia de MTTO Preventivo'] || '';
      parseSchedule(r).forEach(s => {
        rows.push([svc, eq, placa, freq, MESES[s.mesIdx], s.semana]);
      });
    });
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    a.download = `cronograma_${YEAR}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  };

})();
