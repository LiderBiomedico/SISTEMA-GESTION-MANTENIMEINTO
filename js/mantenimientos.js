// ============================================================================
// MÓDULO MANTENIMIENTOS - HSLV  v2
// Guarda reportes como PDF adjunto en el campo "Mantenimientos preventivo" o
// "Mantenimientos correctivos" de la tabla Inventario en Airtable
// ============================================================================
(function () {
  if (window.__HSLV_MANT_LOADED) return;
  window.__HSLV_MANT_LOADED = true;

  const BASE = typeof API_BASE_URL !== 'undefined' ? API_BASE_URL : '/.netlify/functions';

  // Nombres EXACTOS de los campos adjunto en Airtable (tabla Inventario)
  const FIELD_PREV = 'Mantenimientos preventivo';
  const FIELD_CORR = 'Mantenimientos correctivos';

  const mtState = window.__HSLV_MT_STATE || (window.__HSLV_MT_STATE = {
    // Lista local de reportes guardados (en memoria para la sesión)
    reports: [],
    inventario: [],
    invLoaded: false,
    filterTipo: 'TODOS',
    filterEstado: 'TODOS',
    filterSearch: '',
  });

  function hdr() { try { if (typeof getAuthHeader === 'function') return getAuthHeader(); } catch(e){} return {}; }
  function esc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
  function fmt(v) { if(!v)return''; try{ const d=new Date(v); return isNaN(d)?v:d.toLocaleDateString('es-CO'); }catch(_){return v;} }
  function setText(id,v){ const el=document.getElementById(id); if(el)el.textContent=v; }
  function getVal(id){ return (document.getElementById(id)||{}).value||''; }

  // ── INIT ──────────────────────────────────────────────────────────────────
  async function loadMantenimientosModule(force) {
    const body = document.getElementById('mantBody');
    if (!body) return;

    body.innerHTML = `<div class="mt-loading"><div class="mt-spinner"></div><p>Cargando inventario...</p></div>`;

    // Cargar inventario si no está cargado
    if (!mtState.invLoaded || force) {
      try {
        let inv=[], ioff=null;
        do {
          const p = new URLSearchParams({pageSize:'100'}); if(ioff) p.set('offset',ioff);
          const r = await axios.get(`${BASE}/inventario?${p}`, {headers:hdr()});
          const d = r.data||{};
          inv = inv.concat(d.records||d.data||[]);
          ioff = d.offset||null;
        } while(ioff);
        mtState.inventario = inv;
        mtState.invLoaded = true;

        // Extraer reportes existentes de los campos adjunto
        extractReportsFromInventario(inv);
      } catch(err) {
        body.innerHTML = `<div style="text-align:center;padding:40px;color:#c62828">⚠️ Error al cargar el inventario<br><small>${esc((err&&err.message)||'')}</small><br><button class="btn btn-primary" style="margin-top:12px" onclick="loadMantenimientosModule(true)">🔄 Reintentar</button></div>`;
        return;
      }
    }

    updateStats();
    renderList();
  }

  // Extrae los reportes adjuntos de los equipos del inventario para mostrarlos en la lista
  function extractReportsFromInventario(inv) {
    mtState.reports = [];
    inv.forEach(rec => {
      const f = rec.fields||{};
      const equipo = f['Equipo']||f['EQUIPO']||'';
      const placa  = f['Numero de Placa']||f['PLACA']||'';
      const servicio = f['Servicio']||f['SERVICIO']||'';

      // Preventivos
      const prevAtts = f[FIELD_PREV]||[];
      prevAtts.forEach(att => {
        mtState.reports.push({
          id: att.id||att.url,
          tipo: 'Preventivo',
          equipo, placa, servicio,
          equipoId: rec.id,
          filename: att.filename||att.name||'reporte.pdf',
          url: att.url,
          fecha: extractDateFromFilename(att.filename||''),
          estado: extractEstadoFromFilename(att.filename||''),
          size: att.size,
        });
      });

      // Correctivos
      const corrAtts = f[FIELD_CORR]||[];
      corrAtts.forEach(att => {
        mtState.reports.push({
          id: att.id||att.url,
          tipo: 'Correctivo',
          equipo, placa, servicio,
          equipoId: rec.id,
          filename: att.filename||att.name||'reporte.pdf',
          url: att.url,
          fecha: extractDateFromFilename(att.filename||''),
          estado: extractEstadoFromFilename(att.filename||''),
          size: att.size,
        });
      });
    });
    // Ordenar por fecha desc
    mtState.reports.sort((a,b)=>(b.fecha||'').localeCompare(a.fecha||''));
  }

  function extractDateFromFilename(fn) {
    // Intenta extraer YYYY-MM-DD del nombre del archivo
    const m = fn.match(/(\d{4}-\d{2}-\d{2})/);
    return m ? m[1] : '';
  }

  function extractEstadoFromFilename(fn) {
    // Intenta extraer estado del nombre del archivo (ej: _Completado_, _EnProceso_)
    if (/completado/i.test(fn)) return 'Completado';
    if (/en.?proceso/i.test(fn)) return 'En Proceso';
    if (/pendiente/i.test(fn)) return 'Pendiente';
    return 'Completado'; // default para registros sin estado en nombre
  }

  // ── STATS ──────────────────────────────────────────────────────────────────
  function updateStats() {
    const all   = mtState.reports;
    const prev  = all.filter(r=>r.tipo==='Preventivo').length;
    const corr  = all.filter(r=>r.tipo==='Correctivo').length;
    const equs  = new Set(all.map(r=>r.equipoId)).size;
    setText('mtStatTotal', all.length);
    setText('mtStatPrev',  prev);
    setText('mtStatCorr',  corr);
    setText('mtStatEquipos', equs);
    setText('mtStatInv',   mtState.inventario.length);
  }

  // ── RENDER LIST ────────────────────────────────────────────────────────────
  function renderList() {
    const body = document.getElementById('mantBody');
    if (!body) return;

    const q = mtState.filterSearch.toLowerCase();
    const filtered = mtState.reports.filter(r => {
      if (mtState.filterTipo !== 'TODOS' && r.tipo !== mtState.filterTipo) return false;
      if (mtState.filterEstado !== 'TODOS' && r.estado !== mtState.filterEstado) return false;
      if (q && !r.equipo.toLowerCase().includes(q) && !r.placa.toLowerCase().includes(q) && !r.servicio.toLowerCase().includes(q) && !r.filename.toLowerCase().includes(q)) return false;
      return true;
    });

    setText('mtCount', `${filtered.length} reporte${filtered.length!==1?'s':''}`);

    if (!filtered.length) {
      body.innerHTML = `<div style="text-align:center;padding:60px;color:#90a4ae"><div style="font-size:48px;opacity:.4">🔧</div>
        <div style="font-size:16px;font-weight:700;color:#546e7a;margin-top:12px">Sin reportes registrados</div>
        <div style="font-size:13px;margin-top:6px;color:#90a4ae">Usa los botones para registrar un mantenimiento preventivo o correctivo.</div>
      </div>`;
      return;
    }

    const rows = filtered.map(r => {
      const tipoBadge = r.tipo==='Preventivo'
        ? `<span class="mt-badge mt-badge-prev">🛡️ Preventivo</span>`
        : `<span class="mt-badge mt-badge-corr">🔧 Correctivo</span>`;
      const sizeKB = r.size ? `${Math.round(r.size/1024)} KB` : '';
      return `<tr class="mt-row">
        <td class="mt-td">${tipoBadge}</td>
        <td class="mt-td"><div class="mt-eq-name">${esc(r.equipo)}</div><div class="mt-eq-sub">${esc(r.placa)}</div></td>
        <td class="mt-td">${esc(r.servicio)}</td>
        <td class="mt-td">${esc(fmt(r.fecha)||'—')}</td>
        <td class="mt-td" style="font-size:11px;color:#78909c;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${esc(r.filename)}">${esc(r.filename)}</td>
        <td class="mt-td" style="font-size:11px;color:#90a4ae">${sizeKB}</td>
        <td class="mt-td mt-actions">
          ${r.url ? `<a href="${esc(r.url)}" target="_blank" class="mt-btn-icon" title="Descargar/Ver PDF">📄</a>` : ''}
        </td>
      </tr>`;
    }).join('');

    body.innerHTML = `<div class="mt-table-wrap"><table class="mt-table">
      <thead><tr>
        <th>TIPO</th><th>EQUIPO / PLACA</th><th>SERVICIO</th>
        <th>FECHA</th><th>ARCHIVO</th><th>TAMAÑO</th><th>VER</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table></div>
    <div style="padding:10px 16px;font-size:12px;color:#90a4ae;background:white;border-radius:0 0 12px 12px;border-top:1px solid #eceff1">
      Los reportes se almacenan como PDF en Airtable › Inventario › ${FIELD_PREV} / ${FIELD_CORR}
    </div>`;
  }

  window.mtSearch = function(){ mtState.filterSearch=(document.getElementById('mtSearchInput')||{}).value||''; renderList(); };
  window.mtFilterTipo = function(v){
    mtState.filterTipo=v;
    document.querySelectorAll('.mt-filter-btn').forEach(b=>b.classList.remove('active'));
    const btn = document.querySelector(`.mt-filter-btn[data-tipo="${v}"]`);
    if(btn) btn.classList.add('active');
    renderList();
  };

  // Filtro por estado: Completado / En Proceso / Pendiente / TODOS
  window.mtFilterEstado = function(v) {
    mtState.filterEstado = v || 'TODOS';
    renderList();
  };

  // ── FORM OPEN ──────────────────────────────────────────────────────────────
  window.openMantForm = async function(tipo) {
    const modal = document.getElementById('mantFormModal');
    if (!modal) return;
    const isPrev = tipo==='prev';
    document.getElementById('mantFormTitle').textContent = isPrev ? '🛡️ Registrar Mantenimiento Preventivo' : '🔧 Registrar Mantenimiento Correctivo';
    document.getElementById('mantFormTipoHidden').value = isPrev ? 'Preventivo' : 'Correctivo';

    document.getElementById('mantFormBody').innerHTML = buildFormHTML(isPrev);

    // Si el inventario no está cargado, cargarlo ahora antes de poblar el select
    if (!mtState.invLoaded || mtState.inventario.length === 0) {
      const sel = document.getElementById('mfEquipoSelect');
      if (sel) sel.innerHTML = '<option value="">⏳ Cargando inventario...</option>';
      try {
        let inv=[], ioff=null;
        do {
          const p = new URLSearchParams({pageSize:'100'}); if(ioff) p.set('offset',ioff);
          const r = await axios.get(`${BASE}/inventario?${p}`, {headers:hdr()});
          const d = r.data||{};
          inv = inv.concat(d.records||d.data||[]);
          ioff = d.offset||null;
        } while(ioff);
        mtState.inventario = inv;
        mtState.invLoaded = true;
      } catch(err) {
        const sel2 = document.getElementById('mfEquipoSelect');
        if (sel2) sel2.innerHTML = '<option value="">⚠️ Error al cargar inventario</option>';
      }
    }

    loadInvSelect();

    modal.style.display='flex';
    setTimeout(()=>modal.classList.add('active'),10);
  };

  window.closeMantForm = function(){
    const m=document.getElementById('mantFormModal');
    if(m){m.classList.remove('active');setTimeout(()=>m.style.display='none',250);}
  };

  function loadInvSelect() {
    const sel = document.getElementById('mfEquipoSelect');
    if (!sel) return;
    sel.innerHTML = `<option value="">— Seleccionar equipo —</option>` +
      mtState.inventario.map(r => {
        const f=r.fields||{};
        const nm=f['Equipo']||f['EQUIPO']||'';
        const pl=f['Numero de Placa']||f['PLACA']||'';
        return `<option value="${esc(r.id)}"
          data-equipo="${esc(nm)}" data-placa="${esc(pl)}"
          data-marca="${esc(f['Marca']||f['MARCA']||'')}"
          data-modelo="${esc(f['Modelo']||f['MODELO']||'')}"
          data-serie="${esc(f['Serie']||f['SERIE']||'')}"
          data-servicio="${esc(f['Servicio']||f['SERVICIO']||'')}"
          data-riesgo="${esc(f['Clasificacion Riesgo']||f['Clasificacion de Riesgo']||f['CLASIFICACION RIESGO']||f['Clasificación de Riesgo']||'')}">
          ${esc(nm)}${pl?' — '+pl:''}</option>`;
      }).join('');

    sel.onchange = function(){
      const opt=sel.options[sel.selectedIndex];
      if(!opt||!opt.value) return;
      ['equipo','placa','marca','modelo','serie','servicio','riesgo'].forEach(k=>{
        const el=document.getElementById('mf_'+k); if(el) el.value=opt.dataset[k]||'';
      });
    };
  }

  // ── FORM HTML ──────────────────────────────────────────────────────────────
  function buildFormHTML(isPrev) {
    const color = isPrev ? '#1565c0' : '#b71c1c';
    const icon  = isPrev ? '🛡️' : '🔧';

    const extraFields = isPrev ? `
      <div class="mf-row">
        <div class="mf-group mf-full">
          <label class="mf-label">Actividades Realizadas *</label>
          <textarea id="mfActividades" class="mf-textarea" rows="4" placeholder="Describa detalladamente las actividades preventivas realizadas..."></textarea>
        </div>
      </div>
      <div class="mf-row">
        <div class="mf-group">
          <label class="mf-label">Fecha Próximo Mantenimiento</label>
          <input type="date" id="mfFechaProxima" class="mf-input">
        </div>
        <div class="mf-group">
          <label class="mf-label">Repuestos / Insumos Utilizados</label>
          <input type="text" id="mfRepuestos" class="mf-input" placeholder="Filtro HEPA, lubricante...">
        </div>
      </div>` : `
      <div class="mf-row">
        <div class="mf-group mf-full">
          <label class="mf-label">Falla Reportada *</label>
          <textarea id="mfFallaReportada" class="mf-textarea" rows="3" placeholder="Describa la falla o problema reportado..."></textarea>
        </div>
      </div>
      <div class="mf-row">
        <div class="mf-group mf-full">
          <label class="mf-label">Diagnóstico Técnico *</label>
          <textarea id="mfDiagnostico" class="mf-textarea" rows="3" placeholder="Diagnóstico del problema encontrado..."></textarea>
        </div>
      </div>
      <div class="mf-row">
        <div class="mf-group mf-full">
          <label class="mf-label">Acción Tomada / Solución *</label>
          <textarea id="mfAccionTomada" class="mf-textarea" rows="3" placeholder="Solución implementada..."></textarea>
        </div>
      </div>
      <div class="mf-row">
        <div class="mf-group">
          <label class="mf-label">Causa Raíz</label>
          <input type="text" id="mfCausaRaiz" class="mf-input" placeholder="Causa raíz identificada">
        </div>
        <div class="mf-group">
          <label class="mf-label">Repuestos Cambiados</label>
          <input type="text" id="mfRepuestos" class="mf-input" placeholder="Fusible 5A, tarjeta de control...">
        </div>
      </div>`;

    return `
    <div class="mf-section-title" style="background:${color}">${icon} EQUIPO</div>
    <div class="mf-row">
      <div class="mf-group mf-full">
        <label class="mf-label">Equipo del Inventario *</label>
        <select id="mfEquipoSelect" class="mf-select"><option value="">Cargando...</option></select>
      </div>
    </div>
    <div class="mf-inv-card">
      <div class="mf-inv-title">📋 Datos del Equipo (autocompletados)</div>
      <div class="mf-inv-grid">
        <div><span class="mf-inv-label">Nombre</span><input id="mf_equipo" class="mf-inv-val" readonly></div>
        <div><span class="mf-inv-label">Placa</span><input id="mf_placa" class="mf-inv-val" readonly></div>
        <div><span class="mf-inv-label">Marca</span><input id="mf_marca" class="mf-inv-val" readonly></div>
        <div><span class="mf-inv-label">Modelo</span><input id="mf_modelo" class="mf-inv-val" readonly></div>
        <div><span class="mf-inv-label">Serie</span><input id="mf_serie" class="mf-inv-val" readonly></div>
        <div><span class="mf-inv-label">Servicio</span><input id="mf_servicio" class="mf-inv-val" readonly></div>
        <div><span class="mf-inv-label">Clasificación Riesgo</span><input id="mf_riesgo" class="mf-inv-val" readonly></div>
      </div>
    </div>

    <div class="mf-section-title" style="background:${color}">📅 EJECUCIÓN</div>
    <div class="mf-row">
      <div class="mf-group">
        <label class="mf-label">Fecha de Ejecución *</label>
        <input type="date" id="mfFechaEjecucion" class="mf-input" value="${new Date().toISOString().slice(0,10)}">
      </div>
      <div class="mf-group">
        <label class="mf-label">Técnico Responsable *</label>
        <input type="text" id="mfTecnico" class="mf-input" placeholder="Nombre del técnico">
      </div>
    </div>
    <div class="mf-row">
      <div class="mf-group">
        <label class="mf-label">Duración (horas)</label>
        <input type="number" id="mfDuracion" class="mf-input" step="0.5" min="0" placeholder="2.5">
      </div>
      <div class="mf-group">
        <label class="mf-label">Costo (COP)</label>
        <input type="number" id="mfCosto" class="mf-input" min="0" placeholder="150000">
      </div>
      <div class="mf-group">
        <label class="mf-label">Estado</label>
        <select id="mfEstado" class="mf-select">
          <option value="Completado">✔ Completado</option>
          <option value="En Proceso">⚙ En Proceso</option>
          <option value="Pendiente">⏳ Pendiente</option>
        </select>
      </div>
    </div>

    <div class="mf-section-title" style="background:${color}">📝 DETALLES</div>
    ${extraFields}
    <div class="mf-row">
      <div class="mf-group mf-full">
        <label class="mf-label">Hallazgos / Condición del Equipo</label>
        <textarea id="mfHallazgos" class="mf-textarea" rows="3" placeholder="Estado general del equipo..."></textarea>
      </div>
    </div>
    <div class="mf-row">
      <div class="mf-group mf-full">
        <label class="mf-label">Observaciones y Recomendaciones</label>
        <textarea id="mfObservaciones" class="mf-textarea" rows="3" placeholder="Recomendaciones para próximos mantenimientos..."></textarea>
      </div>
    </div>

    <div class="mf-section-title" style="background:${color}">✍️ FIRMA</div>
    <div class="mf-row">
      <div class="mf-group">
        <label class="mf-label">Responsable / Firma</label>
        <input type="text" id="mfFirmaResponsable" class="mf-input" placeholder="Nombre completo y cargo">
      </div>
    </div>

    <div style="background:#fff8e1;border:1.5px solid #ffd54f;border-radius:10px;padding:12px 16px;margin-top:14px;font-size:13px;color:#795548">
      <strong>💾 Al guardar</strong> se generará un PDF del reporte y se adjuntará automáticamente al equipo en Airtable
      en el campo <strong>"${isPrev ? FIELD_PREV : FIELD_CORR}"</strong>.
    </div>`;
  }

  // ── SAVE ──────────────────────────────────────────────────────────────────
  window.saveMantForm = async function() {
    const tipo   = getVal('mantFormTipoHidden');
    const isPrev = tipo === 'Preventivo';
    const sel    = document.getElementById('mfEquipoSelect');
    const opt    = sel ? sel.options[sel.selectedIndex] : null;
    const tecnico = getVal('mfTecnico');
    const fecha   = getVal('mfFechaEjecucion');

    if (!opt||!opt.value) { showMtToast('⚠️ Selecciona un equipo.','warn'); return; }
    if (!tecnico.trim())  { showMtToast('⚠️ El técnico es requerido.','warn'); return; }
    if (!fecha)           { showMtToast('⚠️ La fecha es requerida.','warn'); return; }

    const saveBtn = document.getElementById('mantFormSaveBtn');
    if(saveBtn){ saveBtn.disabled=true; saveBtn.innerHTML='<span style="display:inline-flex;align-items:center;gap:8px"><span class="mt-spinner" style="width:18px;height:18px;border-width:3px"></span>Guardando...</span>'; }

    const data = {
      tipo, isPrev,
      equipoId    : opt.value,
      equipo      : opt.dataset.equipo||'',
      placa       : opt.dataset.placa||'',
      marca       : opt.dataset.marca||'',
      modelo      : opt.dataset.modelo||'',
      serie       : opt.dataset.serie||'',
      servicio    : opt.dataset.servicio||'',
      riesgo      : opt.dataset.riesgo||'',
      fecha, tecnico,
      duracion    : getVal('mfDuracion'),
      costo       : getVal('mfCosto'),
      estado      : getVal('mfEstado'),
      hallazgos   : getVal('mfHallazgos'),
      observaciones: getVal('mfObservaciones'),
      firmaResponsable: getVal('mfFirmaResponsable'),
      actividades : getVal('mfActividades'),
      fechaProxima: getVal('mfFechaProxima'),
      repuestos   : getVal('mfRepuestos'),
      fallaReportada: getVal('mfFallaReportada'),
      diagnostico : getVal('mfDiagnostico'),
      accionTomada: getVal('mfAccionTomada'),
      causaRaiz   : getVal('mfCausaRaiz'),
    };

    try {
      // 1. Generar HTML del reporte
      const htmlReport = buildReportHTML(data);

      // 2. Convertir a base64 (HTML embebido como PDF stub que Airtable acepta como adjunto HTML)
      const b64 = btoa(unescape(encodeURIComponent(htmlReport)));

      // 3. Nombre del archivo: TIPO_EQUIPO_FECHA.html
      const safeName = (data.equipo||'equipo').replace(/[^a-zA-Z0-9]/g,'_').slice(0,30);
      const filename = `${isPrev?'PREV':'CORR'}_${safeName}_${fecha}.html`;
      const fieldName = isPrev ? FIELD_PREV : FIELD_CORR;

      // 4. Subir a Airtable via upload-pdf function
      const uploadRes = await axios.post(`${BASE}/upload-pdf`, {
        recordId  : data.equipoId,
        fieldName : fieldName,
        filename  : filename,
        contentType: 'text/html',
        base64    : b64,
      }, { headers: hdr() });

      if (!uploadRes.data.ok) throw new Error(uploadRes.data.error||'Error al subir');

      // 5. Actualizar lista local
      mtState.reports.unshift({
        id       : filename,
        tipo,
        equipo   : data.equipo,
        placa    : data.placa,
        servicio : data.servicio,
        equipoId : data.equipoId,
        filename,
        fecha,
        url      : null, // Se verá en Airtable
      });

      // 6. Limpiar estado para que la próxima visita recargue
      mtState.invLoaded = false;

      closeMantForm();
      updateStats();
      renderList();
      showMtToast(`✅ Reporte guardado en Airtable · ${fieldName}`,'ok');

    } catch(err) {
      console.error('saveMantForm error:', err);
      showMtToast('❌ Error: '+(err&&err.message||JSON.stringify(err)),'err');
    } finally {
      if(saveBtn){ saveBtn.disabled=false; saveBtn.innerHTML='💾 Guardar en Airtable'; }
    }
  };

  // ── BUILD REPORT HTML ──────────────────────────────────────────────────────
  function buildReportHTML(d) {
    const color  = d.isPrev ? '#1565c0' : '#b71c1c';
    const bgHead = d.isPrev ? '#e3f2fd' : '#fce4ec';
    const icon   = d.isPrev ? '🛡️' : '🔧';
    const titulo = d.isPrev ? 'REPORTE DE MANTENIMIENTO PREVENTIVO' : 'REPORTE DE MANTENIMIENTO CORRECTIVO';
    const codigo = `${d.isPrev?'PREV':'CORR'}-${d.fecha}-${(d.equipo||'').replace(/[^a-zA-Z0-9]/g,'').slice(0,8).toUpperCase()}`;

    const row = (l,v) => v ? `<tr><td class="lb">${l}</td><td class="vl">${esc(String(v))}</td></tr>` : '';
    const sec = (t,rows) => `<div class="sec">${t}</div><table class="tbl">${rows}</table>`;

    const detalle = d.isPrev ? sec('🛡️ ACTIVIDADES PREVENTIVAS', [
      row('Actividades Realizadas', d.actividades),
      row('Repuestos / Insumos', d.repuestos),
      row('Hallazgos / Condición', d.hallazgos),
      row('Fecha Próximo Mant.', fmt(d.fechaProxima)),
    ].join('')) : sec('🔧 ANÁLISIS CORRECTIVO', [
      row('Falla Reportada', d.fallaReportada),
      row('Diagnóstico Técnico', d.diagnostico),
      row('Acción Tomada', d.accionTomada),
      row('Causa Raíz', d.causaRaiz),
      row('Repuestos Cambiados', d.repuestos),
      row('Hallazgos', d.hallazgos),
    ].join(''));

    return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
<title>${titulo}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:Arial,sans-serif;font-size:11px;color:#212121;padding:14px;background:white}
.hdr{display:flex;justify-content:space-between;align-items:flex-start;border:2px solid ${color};border-radius:4px;padding:10px 14px;margin-bottom:10px;background:${bgHead}}
.hdr-hosp{font-weight:800;font-size:13px;color:#212121;text-transform:uppercase}
.hdr-dept{font-size:11px;font-weight:600;color:#263238;margin-top:2px}
.hdr-addr{font-size:10px;color:#607d8b;margin-top:2px}
.hdr-center{text-align:center;flex:1}
.hdr-title{font-weight:800;font-size:14px;color:${color};text-transform:uppercase;letter-spacing:.5px}
.hdr-code{font-weight:700;font-size:11px;color:#263238;margin-top:4px}
.hdr-right{text-align:right;font-size:10px;color:#607d8b;white-space:nowrap}
.sec{background:${color};color:white;font-weight:700;padding:5px 10px;font-size:11px;text-transform:uppercase;border-radius:3px;margin:8px 0 0;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.tbl{width:100%;border-collapse:collapse;font-size:11px;margin-top:1px}
.tbl td{border:1px solid #b0bec5;padding:4px 8px;vertical-align:top}
.lb{background:#eceff1;font-weight:700;font-size:10px;color:#37474f;text-transform:uppercase;width:30%;white-space:nowrap;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.vl{font-size:11px;color:#212121;min-height:18px}
.firmas{display:flex;gap:20px;margin-top:22px;padding-top:10px;border-top:1px solid #e0e0e0}
.firma{flex:1;text-align:center;font-size:10px;color:#607d8b}
.firma-line{border-bottom:1px solid #263238;height:38px;margin-bottom:4px}
.firma-name{font-weight:700;color:#212121;margin-top:2px;font-size:11px}
.footer{margin-top:12px;font-size:9px;color:#9e9e9e;border-top:1px solid #e0e0e0;padding-top:5px;text-align:center}
@media print{@page{size:A4 portrait;margin:10mm}body{padding:0}}
</style></head><body>

<div class="hdr">
  <div>
    <div class="hdr-hosp">HOSPITAL SUSANA LÓPEZ DE VALENCIA E.S.E</div>
    <div class="hdr-dept">GESTIÓN DEL AMBIENTE Y LA TECNOLOGÍA</div>
    <div class="hdr-addr">Calle 15 N°17A-196 Tel. 8217190</div>
  </div>
  <div class="hdr-center">
    <div class="hdr-title">${icon} ${titulo}</div>
    <div class="hdr-code">Código: ${esc(codigo)}</div>
  </div>
  <div class="hdr-right">
    <div>Fecha: ${fmt(d.fecha)}</div>
    <div>Página 1 de 1</div>
  </div>
</div>

${sec('🏥 DATOS DEL EQUIPO',[
  row('Nombre del Equipo', d.equipo),
  row('Placa / Inventario', d.placa),
  row('Marca', d.marca),
  row('Modelo', d.modelo),
  row('Serie', d.serie),
  row('Servicio / Ubicación', d.servicio),
  row('Clasificación de Riesgo', d.riesgo),
].join(''))}

${sec('📅 DATOS DE EJECUCIÓN',[
  row('Fecha de Ejecución', fmt(d.fecha)),
  row('Técnico Responsable', d.tecnico),
  row('Duración', d.duracion ? d.duracion+' horas' : ''),
  row('Costo', d.costo ? '$ '+Number(d.costo).toLocaleString('es-CO') : ''),
  row('Estado', d.estado),
].join(''))}

${detalle}

${sec('📝 OBSERVACIONES',[
  row('Observaciones y Recomendaciones', d.observaciones),
].join(''))}

<div class="firmas">
  <div class="firma"><div class="firma-line"></div>Técnico Responsable<div class="firma-name">${esc(d.tecnico)}</div></div>
  <div class="firma"><div class="firma-line"></div>Supervisor / Jefe de Área</div>
  <div class="firma"><div class="firma-line"></div>Ingeniero Biomédico<div class="firma-name">${esc(d.firmaResponsable)}</div></div>
</div>

<div class="footer">HSLV · Sistema de Gestión de la Tecnología · ${d.isPrev?'SLV-GAT-MANT-PREV':'SLV-GAT-MANT-CORR'} · ${codigo} · Generado: ${new Date().toLocaleString('es-CO')}</div>
</body></html>`;
  }

  // ── TOAST ──────────────────────────────────────────────────────────────────
  function showMtToast(msg, type) {
    let t=document.getElementById('mtToast');
    if(!t){t=document.createElement('div');t.id='mtToast';document.body.appendChild(t);}
    const bg=type==='ok'?'#2e7d32':type==='warn'?'#f57f17':'#c62828';
    t.style.cssText=`position:fixed;bottom:32px;right:32px;background:${bg};color:white;padding:14px 22px;border-radius:10px;font-size:14px;font-weight:600;font-family:'Outfit',sans-serif;z-index:99999;box-shadow:0 8px 24px rgba(0,0,0,0.2);transition:opacity 0.4s;opacity:1;max-width:400px`;
    t.textContent=msg;
    clearTimeout(t._to);
    t._to=setTimeout(()=>{t.style.opacity='0';},4000);
  }

  window.loadMantenimientosModule = loadMantenimientosModule;

})();
