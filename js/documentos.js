// ============================================================================
// MÓDULO GESTIÓN DOCUMENTAL - HSLV
// Muestra por equipo todos los PDF adjuntos en Airtable:
//   Manual | Certificados de Calibración | Reg. INVIMA | Reg. Importación
//   Mantenimientos Preventivos | Mantenimientos Correctivos
// ============================================================================

(function () {
  if (window.__HSLV_DOCS_LOADED) return;
  window.__HSLV_DOCS_LOADED = true;

  const BASE = typeof API_BASE_URL !== 'undefined' ? API_BASE_URL : '/.netlify/functions';

  // Campos adjunto en Airtable → etiqueta visible + icono + color
  const DOC_FIELDS = [
    { key: 'Manual',                      label: 'Manual del Equipo',             icon: '📘', color: '#1565c0', bg: '#e3f2fd' },
    { key: 'Certificados de Calibracion', label: 'Certificados de Calibración',   icon: '⚖️', color: '#4a148c', bg: '#f3e5f5' },
    { key: 'Registro Invima pdf',         label: 'Registro INVIMA',               icon: '🏥', color: '#00695c', bg: '#e0f2f1' },
    { key: 'Registro de importacion',     label: 'Registro de Importación',       icon: '🚢', color: '#e65100', bg: '#fff3e0' },
    { key: 'Mantenimientos preventivo',   label: 'Reportes Mtto. Preventivo',     icon: '🛡️', color: '#1b5e20', bg: '#e8f5e9' },
    { key: 'Mantenimientos correctivos',  label: 'Reportes Mtto. Correctivo',     icon: '🔧', color: '#b71c1c', bg: '#fce4ec' },
  ];

  const docState = window.__HSLV_DOCS_STATE || (window.__HSLV_DOCS_STATE = {
    records      : [],   // todos los registros del inventario
    filtered     : [],   // registros visibles según búsqueda
    selected     : null, // record seleccionado actualmente
    loaded       : false,
    searchQuery  : '',
    filterField  : 'TODOS',
  });

  function hdr() { try { if (typeof getAuthHeader === 'function') return getAuthHeader(); } catch(e){} return {}; }
  function esc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
  function setText(id, v) { const el = document.getElementById(id); if (el) el.textContent = v; }

  // ── LOAD ──────────────────────────────────────────────────────────────────
  async function loadDocumentos(force) {
    if (!force && docState.loaded && docState.records.length) {
      renderDocList(); return;
    }

    const panel = document.getElementById('docListPanel');
    if (panel) panel.innerHTML = `<div class="doc-loading"><div class="doc-spinner"></div><p>Cargando inventario…</p></div>`;

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

      docState.records = all;
      docState.loaded  = true;
      updateDocStats();
      renderDocList();
    } catch (err) {
      if (panel) panel.innerHTML = `<div class="doc-empty">
        <div class="doc-empty-icon">⚠️</div>
        <div class="doc-empty-title">Error al cargar</div>
        <div class="doc-empty-text">${esc((err&&err.message)||'Error de red')}</div>
        <button class="doc-btn doc-btn-primary" onclick="loadDocumentos(true)">🔄 Reintentar</button>
      </div>`;
    }
  }

  // ── STATS ─────────────────────────────────────────────────────────────────
  function updateDocStats() {
    const total    = docState.records.length;
    let totalDocs  = 0, conDocs = 0, sinDocs = 0;
    docState.records.forEach(r => {
      const f = r.fields || {};
      const cnt = DOC_FIELDS.reduce((a, df) => a + ((f[df.key]||[]).length), 0);
      totalDocs += cnt;
      if (cnt > 0) conDocs++; else sinDocs++;
    });
    setText('docStatEquipos', total);
    setText('docStatTotal',   totalDocs);
    setText('docStatCon',     conDocs);
    setText('docStatSin',     sinDocs);
  }

  // ── LISTA DE EQUIPOS (panel izquierdo) ────────────────────────────────────
  function renderDocList() {
    const panel = document.getElementById('docListPanel');
    if (!panel) return;

    const q = docState.searchQuery.toLowerCase();
    docState.filtered = docState.records.filter(r => {
      const f     = r.fields || {};
      const eq    = (f['Equipo'] || f['EQUIPO'] || '').toLowerCase();
      const placa = (f['Numero de Placa'] || f['PLACA'] || '').toLowerCase();
      const svc   = (f['Servicio'] || f['SERVICIO'] || '').toLowerCase();
      const marca = (f['Marca'] || f['MARCA'] || '').toLowerCase();

      // Filtro por tipo de documento
      if (docState.filterField !== 'TODOS') {
        const field = DOC_FIELDS.find(d => d.key === docState.filterField);
        if (field && !((r.fields||{})[field.key]||[]).length) return false;
      }
      if (q && !eq.includes(q) && !placa.includes(q) && !svc.includes(q) && !marca.includes(q)) return false;
      return true;
    });

    if (!docState.filtered.length) {
      panel.innerHTML = `<div class="doc-empty-list"><div style="font-size:36px;opacity:.3">🔍</div><p>Sin resultados</p></div>`;
      return;
    }

    panel.innerHTML = docState.filtered.map(r => {
      const f       = r.fields || {};
      const equipo  = f['Equipo'] || f['EQUIPO'] || '—';
      const placa   = f['Numero de Placa'] || f['PLACA'] || '';
      const svc     = f['Servicio'] || f['SERVICIO'] || '';
      const marca   = f['Marca'] || f['MARCA'] || '';
      const totalD  = DOC_FIELDS.reduce((a, df) => a + ((f[df.key]||[]).length), 0);
      const isActive= docState.selected && docState.selected.id === r.id;

      const dots = DOC_FIELDS.filter(df => (f[df.key]||[]).length > 0)
        .map(df => `<span style="width:8px;height:8px;border-radius:50%;background:${df.color};display:inline-block;" title="${df.label}"></span>`)
        .join('');

      return `<div class="doc-list-item ${isActive ? 'active' : ''}" onclick="selectDocEquipo('${esc(r.id)}')">
        <div class="doc-list-name">${esc(equipo)}</div>
        <div class="doc-list-sub">${placa ? '🏷️ '+esc(placa)+' · ' : ''}${esc(svc)}</div>
        ${marca ? `<div class="doc-list-sub" style="color:#90a4ae">🏭 ${esc(marca)}</div>` : ''}
        <div style="display:flex;align-items:center;justify-content:space-between;margin-top:6px;">
          <div style="display:flex;gap:4px;flex-wrap:wrap">${dots}</div>
          <span class="doc-count-badge ${totalD > 0 ? 'has-docs' : ''}">${totalD} doc${totalD !== 1 ? 's' : ''}</span>
        </div>
      </div>`;
    }).join('');
  }

  // ── SELECCIONAR EQUIPO ────────────────────────────────────────────────────
  window.selectDocEquipo = function(recordId) {
    docState.selected = docState.records.find(r => r.id === recordId) || null;
    renderDocList();   // refresh activo
    renderDocDetail(); // mostrar documentos
  };

  // ── PANEL DERECHO: DOCUMENTOS DEL EQUIPO ──────────────────────────────────
  function renderDocDetail() {
    const panel = document.getElementById('docDetailPanel');
    if (!panel) return;

    if (!docState.selected) {
      panel.innerHTML = `<div class="doc-empty">
        <div class="doc-empty-icon">📂</div>
        <div class="doc-empty-title">Selecciona un equipo</div>
        <div class="doc-empty-text">Elige un equipo de la lista para ver sus documentos adjuntos.</div>
      </div>`;
      return;
    }

    const r  = docState.selected;
    const f  = r.fields || {};
    const eq = f['Equipo'] || f['EQUIPO'] || '—';
    const placa = f['Numero de Placa'] || f['PLACA'] || '';
    const svc   = f['Servicio'] || f['SERVICIO'] || '';
    const marca = f['Marca'] || f['MARCA'] || '';
    const modelo= f['Modelo'] || f['MODELO'] || '';
    const serie = f['Serie'] || f['SERIE'] || '';
    const calibrable = (f['Calibrable'] || f['CALIBRABLE'] || '').toUpperCase();
    const fechaCal   = f['Fecha de calibracion'] || '';
    const fechaProx  = f['Fecha Proxima Calibracion'] || '';

    // Calcular total documentos
    const totalDocs = DOC_FIELDS.reduce((a, df) => a + ((f[df.key]||[]).length), 0);

    // Header del equipo
    let html = `<div class="doc-detail-header">
      <div class="doc-detail-icon">🏥</div>
      <div class="doc-detail-info">
        <div class="doc-detail-name">${esc(eq)}</div>
        <div class="doc-detail-meta">
          ${placa  ? `<span>🏷️ ${esc(placa)}</span>` : ''}
          ${svc    ? `<span>📍 ${esc(svc)}</span>` : ''}
          ${marca  ? `<span>🏭 ${esc(marca)}</span>` : ''}
          ${modelo ? `<span>📋 ${esc(modelo)}</span>` : ''}
          ${serie  ? `<span>🔢 ${esc(serie)}</span>` : ''}
        </div>
        ${calibrable === 'SI' ? `<div class="doc-cal-info">
          <span class="doc-cal-badge">⚖️ Calibrable</span>
          ${fechaCal  ? `<span>📅 Última cal.: <strong>${new Date(fechaCal+'T00:00:00').toLocaleDateString('es-CO')}</strong></span>` : ''}
          ${fechaProx ? `<span>⏭️ Próxima: <strong>${new Date(fechaProx+'T00:00:00').toLocaleDateString('es-CO')}</strong></span>` : ''}
        </div>` : ''}
      </div>
      <div class="doc-detail-total">
        <div class="doc-total-num">${totalDocs}</div>
        <div class="doc-total-label">documentos</div>
      </div>
    </div>`;

    if (totalDocs === 0) {
      html += `<div class="doc-no-docs">
        <div style="font-size:48px;opacity:.25;margin-bottom:12px">📭</div>
        <div style="font-size:16px;font-weight:700;color:#546e7a">Sin documentos adjuntos</div>
        <div style="font-size:13px;color:#90a4ae;margin-top:6px">Este equipo no tiene PDF adjuntos en Airtable todavía.</div>
      </div>`;
    } else {
      // Secciones por tipo de documento
      html += `<div class="doc-sections">`;
      DOC_FIELDS.forEach(df => {
        const atts = f[df.key] || [];
        if (!atts.length) return;
        html += `<div class="doc-section">
          <div class="doc-section-header" style="border-left:4px solid ${df.color}">
            <span class="doc-section-icon" style="background:${df.bg};color:${df.color}">${df.icon}</span>
            <span class="doc-section-title" style="color:${df.color}">${df.label}</span>
            <span class="doc-section-count" style="background:${df.bg};color:${df.color}">${atts.length}</span>
          </div>
          <div class="doc-cards">
            ${atts.map(att => buildDocCard(att, df)).join('')}
          </div>
        </div>`;
      });
      html += `</div>`;
    }

    panel.innerHTML = html;
  }

  function buildDocCard(att, df) {
    const name  = att.filename || att.name || 'documento.pdf';
    const url   = att.url || '';
    const size  = att.size ? formatSize(att.size) : '';
    const ext   = name.split('.').pop().toUpperCase();
    const isImg = ['PNG','JPG','JPEG','GIF','WEBP'].includes(ext);
    const isPdf = ext === 'PDF';
    const date  = extractDate(name);

    return `<div class="doc-card" onclick="openDoc('${esc(url)}','${esc(name)}')" title="${esc(name)}">
      <div class="doc-card-thumb" style="background:${df.bg};color:${df.color}">
        ${isImg ? `<img src="${esc(url)}" alt="${esc(name)}" style="width:100%;height:100%;object-fit:cover;border-radius:6px;" onerror="this.parentNode.innerHTML='🖼️'">` : isPdf ? '📄' : '📁'}
      </div>
      <div class="doc-card-info">
        <div class="doc-card-name" title="${esc(name)}">${esc(name)}</div>
        <div class="doc-card-meta">
          <span class="doc-ext-badge" style="background:${df.bg};color:${df.color}">${ext}</span>
          ${size ? `<span style="font-size:11px;color:#90a4ae">${size}</span>` : ''}
          ${date ? `<span style="font-size:11px;color:#90a4ae">📅 ${date}</span>` : ''}
        </div>
      </div>
      <div class="doc-card-actions">
        ${url ? `<a href="${esc(url)}" target="_blank" class="doc-action-btn" title="Ver/Descargar" onclick="event.stopPropagation()">⬇️</a>` : ''}
      </div>
    </div>`;
  }

  function formatSize(bytes) {
    if (bytes < 1024)        return bytes + ' B';
    if (bytes < 1024*1024)   return Math.round(bytes/1024) + ' KB';
    return (bytes/(1024*1024)).toFixed(1) + ' MB';
  }
  function extractDate(name) {
    const m = name.match(/(\d{4}-\d{2}-\d{2})/);
    if (m) { try { return new Date(m[1]).toLocaleDateString('es-CO'); } catch(_){} }
    return '';
  }

  // ── VER DOCUMENTO ─────────────────────────────────────────────────────────
  window.openDoc = function(url, name) {
    if (!url) return;
    const ext = name.split('.').pop().toUpperCase();
    if (ext === 'HTML' || ext === 'PDF' || ['PNG','JPG','JPEG','GIF','WEBP'].includes(ext)) {
      window.open(url, '_blank');
    } else {
      const a = document.createElement('a');
      a.href = url; a.download = name; a.target = '_blank';
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
    }
  };

  // ── BÚSQUEDA Y FILTROS ────────────────────────────────────────────────────
  window.docSearch = function() {
    const el = document.getElementById('docSearchInput');
    docState.searchQuery = el ? el.value.trim() : '';
    renderDocList();
  };

  window.docFilterField = function(key) {
    docState.filterField = key;
    document.querySelectorAll('.doc-filter-btn').forEach(b => b.classList.remove('active'));
    const btn = document.querySelector(`.doc-filter-btn[data-key="${key}"]`);
    if (btn) btn.classList.add('active');
    renderDocList();
  };

  window.loadDocumentos = loadDocumentos;

})();
