// ============================================================================
// MÓDULO MANTENIMIENTOS - HSLV  v1
// Registro de Mantenimiento Preventivo y Correctivo
// Trae datos del Inventario Maestro, guarda en Airtable via API
// ============================================================================
(function () {
  if (window.__HSLV_MANT_LOADED) return;
  window.__HSLV_MANT_LOADED = true;

  const BASE = typeof API_BASE_URL !== 'undefined' ? API_BASE_URL : '/.netlify/functions';

  const mtState = window.__HSLV_MT_STATE || (window.__HSLV_MT_STATE = {
    records: [], filtered: [], page: 0, perPage: 50,
    search: '', filterTipo: 'TODOS', filterEstado: 'TODOS',
    inventario: [], loaded: false,
  });

  function hdr() { try { if (typeof getAuthHeader === 'function') return getAuthHeader(); } catch(e){} return {}; }
  function esc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
  function fmt(v) { if(!v)return''; try{ const d=new Date(v); return isNaN(d)?v:d.toLocaleDateString('es-CO'); }catch(_){return v;} }
  function setText(id,v){ const el=document.getElementById(id); if(el)el.textContent=v; }

  // ── LOAD RECORDS ──────────────────────────────────────────────────────────
  async function loadMantenimientosModule(force) {
    if (mtState.loaded && !force) { renderList(); return; }
    const body = document.getElementById('mantBody');
    if (!body) return;
    body.innerHTML = `<div class="mt-loading"><div class="mt-spinner"></div><p>Cargando mantenimientos...</p></div>`;
    try {
      let all=[], offset=null;
      do {
        const p = new URLSearchParams({pageSize:'100'}); if(offset) p.set('offset',offset);
        const r = await axios.get(`${BASE}/mantenimientos?${p}`, {headers:hdr()});
        const d = r.data||{};
        all = all.concat(d.records||d.data||[]);
        offset = d.offset||null;
      } while(offset);
      mtState.records = all; mtState.loaded = true;

      // Load inventario for the search dropdown (lightweight: just name+placa+id)
      if (!mtState.inventario.length) {
        let inv=[], ioff=null;
        do {
          const p2 = new URLSearchParams({pageSize:'100'}); if(ioff) p2.set('offset',ioff);
          const r2 = await axios.get(`${BASE}/inventario?${p2}`, {headers:hdr()});
          const d2 = r2.data||{};
          inv = inv.concat(d2.records||d2.data||[]);
          ioff = d2.offset||null;
        } while(ioff);
        mtState.inventario = inv;
      }

      applyFilters(); updateStats();
    } catch(err) {
      body.innerHTML = `<div style="text-align:center;padding:40px;color:#c62828">⚠️ Error al cargar<br><small>${esc((err&&err.message)||'')}</small><br><button class="btn btn-primary" style="margin-top:12px" onclick="loadMantenimientosModule(true)">🔄 Reintentar</button></div>`;
    }
  }

  function applyFilters() {
    const q = mtState.search.toLowerCase();
    mtState.filtered = mtState.records.filter(r => {
      const f = r.fields||{};
      const eq  = (f['Equipo']||f['Nombre Equipo']||'').toLowerCase();
      const tipo = f['Tipo']||f['TIPO']||'';
      const est  = f['Estado']||f['ESTADO']||'';
      const placa = (f['Placa']||f['PLACA']||'').toLowerCase();
      if (mtState.filterTipo !== 'TODOS' && tipo !== mtState.filterTipo) return false;
      if (mtState.filterEstado !== 'TODOS' && est !== mtState.filterEstado) return false;
      if (q && !eq.includes(q) && !placa.includes(q) && !(f['Tecnico']||'').toLowerCase().includes(q)) return false;
      return true;
    });
    mtState.page = 0;
    renderList();
  }

  function updateStats() {
    const all = mtState.records;
    const prev = all.filter(r=>(r.fields||{})['Tipo']==='Preventivo').length;
    const corr = all.filter(r=>(r.fields||{})['Tipo']==='Correctivo').length;
    const pend = all.filter(r=>{const e=(r.fields||{})['Estado']||''; return e==='Pendiente'||e==='En Proceso';}).length;
    const comp = all.filter(r=>(r.fields||{})['Estado']==='Completado').length;
    setText('mtStatTotal', all.length);
    setText('mtStatPrev', prev);
    setText('mtStatCorr', corr);
    setText('mtStatPend', pend);
    setText('mtStatComp', comp);
  }

  // ── RENDER LIST ───────────────────────────────────────────────────────────
  function renderList() {
    const body = document.getElementById('mantBody');
    if (!body) return;
    const start = mtState.page * mtState.perPage;
    const page  = mtState.filtered.slice(start, start + mtState.perPage);

    setText('mtCount', `${mtState.filtered.length} registro${mtState.filtered.length!==1?'s':''}`);

    if (!page.length) {
      body.innerHTML = `<div style="text-align:center;padding:60px;color:#90a4ae"><div style="font-size:48px;opacity:.4">🔧</div><div style="font-size:16px;font-weight:700;color:#546e7a;margin-top:12px">Sin registros</div><div style="font-size:13px;margin-top:6px">Usa los botones de arriba para registrar un mantenimiento.</div></div>`;
      return;
    }

    const rows = page.map(r => {
      const f = r.fields||{};
      const tipo = f['Tipo']||'—';
      const tipoBadge = tipo==='Preventivo'
        ? `<span class="mt-badge mt-badge-prev">🛡️ Preventivo</span>`
        : tipo==='Correctivo'
        ? `<span class="mt-badge mt-badge-corr">🔧 Correctivo</span>`
        : `<span class="mt-badge">${esc(tipo)}</span>`;
      const estado = f['Estado']||'—';
      const estadoBadge = estado==='Completado'
        ? `<span class="mt-badge mt-badge-ok">✔ Completado</span>`
        : estado==='En Proceso'
        ? `<span class="mt-badge mt-badge-proc">⚙ En Proceso</span>`
        : estado==='Pendiente'
        ? `<span class="mt-badge mt-badge-pend">⏳ Pendiente</span>`
        : `<span class="mt-badge">${esc(estado)}</span>`;
      return `<tr class="mt-row" onclick="openMantDetail('${esc(r.id)}')">
        <td class="mt-td"><span class="mt-id">${esc(f['Codigo']||r.id.slice(-6))}</span></td>
        <td class="mt-td"><div class="mt-eq-name">${esc(f['Equipo']||f['Nombre Equipo']||'—')}</div><div class="mt-eq-sub">${esc(f['Placa']||f['PLACA']||'')}</div></td>
        <td class="mt-td">${tipoBadge}</td>
        <td class="mt-td">${esc(f['Servicio']||'—')}</td>
        <td class="mt-td">${esc(fmt(f['Fecha Ejecucion']||f['Fecha Inicio']||''))}</td>
        <td class="mt-td">${esc(f['Tecnico']||f['Técnico']||'—')}</td>
        <td class="mt-td">${estadoBadge}</td>
        <td class="mt-td mt-actions">
          <button class="mt-btn-icon" title="Ver Reporte" onclick="event.stopPropagation();printMantReport('${esc(r.id)}')">🖨️</button>
          <button class="mt-btn-icon" title="Editar" onclick="event.stopPropagation();openMantForm('${esc(tipo==='Preventivo'?'prev':'corr')}','${esc(r.id)}')">✏️</button>
        </td>
      </tr>`;
    }).join('');

    body.innerHTML = `<div class="mt-table-wrap"><table class="mt-table">
      <thead><tr>
        <th>CÓDIGO</th><th>EQUIPO / PLACA</th><th>TIPO</th><th>SERVICIO</th>
        <th>FECHA</th><th>TÉCNICO</th><th>ESTADO</th><th>ACCIONES</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table></div>
    <div class="mt-pagination">
      <span style="font-size:13px;color:#607d8b">Mostrando ${start+1}–${Math.min(start+mtState.perPage,mtState.filtered.length)} de ${mtState.filtered.length}</span>
      <div style="display:flex;gap:8px">
        <button class="mt-pg-btn" onclick="mtPrev()" ${mtState.page===0?'disabled':''}>◀ Anterior</button>
        <button class="mt-pg-btn" onclick="mtNext()" ${start+mtState.perPage>=mtState.filtered.length?'disabled':''}>Siguiente ▶</button>
      </div>
    </div>`;
  }

  window.mtPrev = function(){ if(mtState.page>0){mtState.page--;renderList();} };
  window.mtNext = function(){ if((mtState.page+1)*mtState.perPage<mtState.filtered.length){mtState.page++;renderList();} };
  window.mtSearch = function(){ mtState.search=(document.getElementById('mtSearchInput')||{}).value||''; applyFilters(); };
  window.mtFilterTipo = function(v){ mtState.filterTipo=v; document.querySelectorAll('.mt-filter-btn').forEach(b=>b.classList.remove('active')); document.querySelector(`.mt-filter-btn[data-tipo="${v}"]`)&&document.querySelector(`.mt-filter-btn[data-tipo="${v}"]`).classList.add('active'); applyFilters(); };
  window.mtFilterEstado = function(v){ mtState.filterEstado=v; applyFilters(); };

  // ── FORM: OPEN ─────────────────────────────────────────────────────────────
  window.openMantForm = async function(tipo, editId) {
    const modal = document.getElementById('mantFormModal');
    if (!modal) return;
    const isPrev = tipo === 'prev';
    document.getElementById('mantFormTitle').textContent = (editId ? '✏️ Editar' : '➕ Registrar') + (isPrev ? ' Mantenimiento Preventivo' : ' Mantenimiento Correctivo');
    document.getElementById('mantFormTipoHidden').value = isPrev ? 'Preventivo' : 'Correctivo';

    // Build form
    const formBody = document.getElementById('mantFormBody');
    formBody.innerHTML = buildFormHTML(isPrev, null);

    // Load inventario into select
    loadInvSelect();

    // If editing, load data
    if (editId) {
      const rec = mtState.records.find(r=>r.id===editId);
      if (rec) prefillForm(rec.fields||{});
      document.getElementById('mantFormEditId').value = editId;
    } else {
      document.getElementById('mantFormEditId').value = '';
    }

    modal.style.display = 'flex';
    setTimeout(()=>modal.classList.add('active'),10);
  };

  window.closeMantForm = function() {
    const modal = document.getElementById('mantFormModal');
    if (modal) { modal.classList.remove('active'); setTimeout(()=>modal.style.display='none',250); }
  };

  function loadInvSelect() {
    const sel = document.getElementById('mfEquipoSelect');
    if (!sel) return;
    sel.innerHTML = `<option value="">— Seleccionar equipo —</option>` +
      mtState.inventario.map(r => {
        const f = r.fields||{};
        const nm = f['Equipo']||f['EQUIPO']||'';
        const pl = f['Numero de Placa']||f['PLACA']||'';
        return `<option value="${esc(r.id)}" data-equipo="${esc(nm)}" data-placa="${esc(pl)}" data-marca="${esc(f['Marca']||f['MARCA']||'')}" data-modelo="${esc(f['Modelo']||f['MODELO']||'')}" data-serie="${esc(f['Serie']||f['SERIE']||'')}" data-servicio="${esc(f['Servicio']||f['SERVICIO']||'')}" data-riesgo="${esc(f['Clasificacion Riesgo']||f['Clasificacion de Riesgo']||f['CLASIFICACION RIESGO']||'')}">${esc(nm)}${pl?' — '+pl:''}</option>`;
      }).join('');

    sel.onchange = function() {
      const opt = sel.options[sel.selectedIndex];
      if (!opt||!opt.value) return;
      setText2('mfEquipoNombre', opt.dataset.equipo);
      setText2('mfPlaca', opt.dataset.placa);
      setText2('mfMarca', opt.dataset.marca);
      setText2('mfModelo', opt.dataset.modelo);
      setText2('mfSerie', opt.dataset.serie);
      setText2('mfServicio', opt.dataset.servicio);
      setText2('mfRiesgo', opt.dataset.riesgo);
    };
  }
  function setText2(id,v){ const el=document.getElementById(id); if(el) el.value=v; }

  function prefillForm(f) {
    const fields = {
      'mfFechaEjecucion': f['Fecha Ejecucion']||f['Fecha Inicio']||'',
      'mfFechaProxima': f['Fecha Proxima']||'',
      'mfTecnico': f['Tecnico']||f['Técnico']||'',
      'mfDuracion': f['Duracion']||f['Duración']||'',
      'mfCosto': f['Costo']||'',
      'mfEstado': f['Estado']||'',
      'mfHallazgos': f['Hallazgos']||'',
      'mfActividades': f['Actividades']||'',
      'mfRepuestos': f['Repuestos']||'',
      'mfObservaciones': f['Observaciones']||'',
      'mfFirmaResponsable': f['Firma Responsable']||'',
      // Correctivo extras
      'mfFallaReportada': f['Falla Reportada']||'',
      'mfDiagnostico': f['Diagnostico']||'',
      'mfAccionTomada': f['Accion Tomada']||'',
      'mfCausaRaiz': f['Causa Raiz']||'',
    };
    Object.entries(fields).forEach(([id,v])=>{ const el=document.getElementById(id); if(el&&v) el.value=v; });
    // Try to select the equipo
    const sel = document.getElementById('mfEquipoSelect');
    if (sel && f['EquipoId']) {
      sel.value = f['EquipoId'];
      sel.dispatchEvent(new Event('change'));
    } else if (sel) {
      // Try match by name
      const nm = f['Equipo']||f['Nombre Equipo']||'';
      Array.from(sel.options).forEach(o=>{ if(o.dataset.equipo===nm) sel.value=o.value; });
      if(sel.value) sel.dispatchEvent(new Event('change'));
    }
  }

  // ── BUILD FORM HTML ────────────────────────────────────────────────────────
  function buildFormHTML(isPrev, _) {
    const colorH = isPrev ? '#1565c0' : '#b71c1c';
    const icon   = isPrev ? '🛡️' : '🔧';
    const extras = isPrev ? `
      <div class="mf-row">
        <div class="mf-group mf-full">
          <label class="mf-label">Actividades Realizadas *</label>
          <textarea id="mfActividades" class="mf-textarea" rows="4" placeholder="Describa detalladamente las actividades de mantenimiento preventivo realizadas..."></textarea>
        </div>
      </div>
      <div class="mf-row">
        <div class="mf-group">
          <label class="mf-label">Fecha Próximo Mantenimiento</label>
          <input type="date" id="mfFechaProxima" class="mf-input">
        </div>
        <div class="mf-group">
          <label class="mf-label">Repuestos / Insumos Utilizados</label>
          <input type="text" id="mfRepuestos" class="mf-input" placeholder="Ej: Filtro HEPA, lubricante...">
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
          <textarea id="mfAccionTomada" class="mf-textarea" rows="3" placeholder="Describa la solución implementada..."></textarea>
        </div>
      </div>
      <div class="mf-row">
        <div class="mf-group">
          <label class="mf-label">Causa Raíz</label>
          <input type="text" id="mfCausaRaiz" class="mf-input" placeholder="Causa raíz identificada">
        </div>
        <div class="mf-group">
          <label class="mf-label">Repuestos Cambiados</label>
          <input type="text" id="mfRepuestos" class="mf-input" placeholder="Ej: Fusible 5A, tarjeta de control...">
        </div>
      </div>`;

    return `
    <div class="mf-section-title" style="background:${colorH}">${icon} ${isPrev?'DATOS DEL MANTENIMIENTO PREVENTIVO':'DATOS DEL MANTENIMIENTO CORRECTIVO'}</div>

    <div class="mf-row">
      <div class="mf-group mf-full">
        <label class="mf-label">Equipo del Inventario *</label>
        <select id="mfEquipoSelect" class="mf-select"><option value="">Cargando inventario...</option></select>
      </div>
    </div>

    <!-- Datos traídos del inventario (solo lectura) -->
    <div class="mf-inv-card" id="mfInvCard">
      <div class="mf-inv-title">📋 Datos del Equipo (Inventario Maestro)</div>
      <div class="mf-inv-grid">
        <div><span class="mf-inv-label">Nombre</span><input id="mfEquipoNombre" class="mf-inv-val" readonly></div>
        <div><span class="mf-inv-label">Placa</span><input id="mfPlaca" class="mf-inv-val" readonly></div>
        <div><span class="mf-inv-label">Marca</span><input id="mfMarca" class="mf-inv-val" readonly></div>
        <div><span class="mf-inv-label">Modelo</span><input id="mfModelo" class="mf-inv-val" readonly></div>
        <div><span class="mf-inv-label">Serie</span><input id="mfSerie" class="mf-inv-val" readonly></div>
        <div><span class="mf-inv-label">Servicio</span><input id="mfServicio" class="mf-inv-val" readonly></div>
        <div><span class="mf-inv-label">Clasificación Riesgo</span><input id="mfRiesgo" class="mf-inv-val" readonly></div>
      </div>
    </div>

    <div class="mf-section-title" style="background:${colorH}">📅 FECHAS Y TÉCNICO</div>
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
        <input type="number" id="mfDuracion" class="mf-input" step="0.5" min="0" placeholder="Ej: 2.5">
      </div>
      <div class="mf-group">
        <label class="mf-label">Costo (COP)</label>
        <input type="number" id="mfCosto" class="mf-input" min="0" placeholder="Ej: 150000">
      </div>
    </div>
    <div class="mf-row">
      <div class="mf-group">
        <label class="mf-label">Estado *</label>
        <select id="mfEstado" class="mf-select">
          <option value="Completado">✔ Completado</option>
          <option value="En Proceso">⚙ En Proceso</option>
          <option value="Pendiente">⏳ Pendiente</option>
        </select>
      </div>
    </div>

    <div class="mf-section-title" style="background:${colorH}">📝 DETALLES TÉCNICOS</div>
    ${extras}

    <div class="mf-row">
      <div class="mf-group mf-full">
        <label class="mf-label">Hallazgos / Condición del Equipo</label>
        <textarea id="mfHallazgos" class="mf-textarea" rows="3" placeholder="Estado general del equipo, observaciones técnicas..."></textarea>
      </div>
    </div>
    <div class="mf-row">
      <div class="mf-group mf-full">
        <label class="mf-label">Observaciones y Recomendaciones</label>
        <textarea id="mfObservaciones" class="mf-textarea" rows="3" placeholder="Recomendaciones para próximos mantenimientos..."></textarea>
      </div>
    </div>

    <div class="mf-section-title" style="background:${colorH}">✍️ FIRMA</div>
    <div class="mf-row">
      <div class="mf-group">
        <label class="mf-label">Nombre Responsable / Firma</label>
        <input type="text" id="mfFirmaResponsable" class="mf-input" placeholder="Nombre completo y cargo">
      </div>
    </div>`;
  }

  // ── SAVE FORM ─────────────────────────────────────────────────────────────
  window.saveMantForm = async function() {
    const tipo = document.getElementById('mantFormTipoHidden').value;
    const editId = document.getElementById('mantFormEditId').value;
    const sel = document.getElementById('mfEquipoSelect');
    const opt = sel ? sel.options[sel.selectedIndex] : null;

    const tecnico = (document.getElementById('mfTecnico')||{}).value||'';
    const fecha   = (document.getElementById('mfFechaEjecucion')||{}).value||'';

    if (!opt||!opt.value) { showMtToast('⚠️ Selecciona un equipo del inventario.','warn'); return; }
    if (!tecnico.trim())  { showMtToast('⚠️ El técnico es requerido.','warn'); return; }
    if (!fecha)           { showMtToast('⚠️ La fecha de ejecución es requerida.','warn'); return; }

    const g = id => (document.getElementById(id)||{}).value||'';

    const fields = {
      'Tipo': tipo,
      'EquipoId': opt.value,
      'Equipo': opt.dataset.equipo||'',
      'Placa': opt.dataset.placa||'',
      'Marca': opt.dataset.marca||'',
      'Modelo': opt.dataset.modelo||'',
      'Serie': opt.dataset.serie||'',
      'Servicio': opt.dataset.servicio||'',
      'Clasificacion Riesgo': opt.dataset.riesgo||'',
      'Fecha Ejecucion': fecha,
      'Tecnico': tecnico,
      'Duracion': g('mfDuracion'),
      'Costo': g('mfCosto'),
      'Estado': g('mfEstado'),
      'Hallazgos': g('mfHallazgos'),
      'Observaciones': g('mfObservaciones'),
      'Firma Responsable': g('mfFirmaResponsable'),
      'Actividades': g('mfActividades'),
      'Fecha Proxima': g('mfFechaProxima'),
      'Repuestos': g('mfRepuestos'),
      'Falla Reportada': g('mfFallaReportada'),
      'Diagnostico': g('mfDiagnostico'),
      'Accion Tomada': g('mfAccionTomada'),
      'Causa Raiz': g('mfCausaRaiz'),
    };

    const saveBtn = document.getElementById('mantFormSaveBtn');
    if(saveBtn){ saveBtn.disabled=true; saveBtn.textContent='Guardando...'; }

    try {
      if (editId) {
        await axios.patch(`${BASE}/mantenimientos/${editId}`, {fields}, {headers:hdr()});
        const idx = mtState.records.findIndex(r=>r.id===editId);
        if (idx>-1) mtState.records[idx].fields = {...(mtState.records[idx].fields||{}), ...fields};
      } else {
        const now = new Date();
        fields['Codigo'] = `MT-${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(mtState.records.length+1).padStart(4,'0')}`;
        const res = await axios.post(`${BASE}/mantenimientos`, {fields}, {headers:hdr()});
        const newRec = res.data||{};
        if (newRec.id) mtState.records.unshift(newRec);
      }
      closeMantForm(); applyFilters(); updateStats();
      showMtToast('✅ Mantenimiento guardado correctamente.','ok');
    } catch(err) {
      showMtToast('❌ Error al guardar: '+(err&&err.message||''),'err');
    } finally {
      if(saveBtn){ saveBtn.disabled=false; saveBtn.textContent='💾 Guardar'; }
    }
  };

  // ── DETAIL VIEW ───────────────────────────────────────────────────────────
  window.openMantDetail = function(id) {
    const rec = mtState.records.find(r=>r.id===id);
    if (!rec) return;
    const f = rec.fields||{};
    const modal = document.getElementById('mantDetailModal');
    if (!modal) return;
    document.getElementById('mantDetailBody').innerHTML = buildDetailHTML(f, rec.id);
    modal.style.display = 'flex';
    setTimeout(()=>modal.classList.add('active'),10);
  };
  window.closeMantDetail = function() {
    const m = document.getElementById('mantDetailModal');
    if(m){m.classList.remove('active');setTimeout(()=>m.style.display='none',250);}
  };

  function buildDetailHTML(f, id) {
    const isPrev = f['Tipo']==='Preventivo';
    const color = isPrev ? '#1565c0' : '#b71c1c';
    const icon  = isPrev ? '🛡️' : '🔧';
    const row = (label,val) => val ? `<tr><td class="mf-label" style="width:35%;padding:6px 10px">${label}</td><td style="padding:6px 10px">${esc(val)}</td></tr>` : '';

    return `<div style="font-family:Arial,sans-serif;font-size:13px">
      <div style="background:${color};color:white;padding:10px 16px;border-radius:6px;margin-bottom:14px;font-weight:700;font-size:15px">${icon} ${isPrev?'MANTENIMIENTO PREVENTIVO':'MANTENIMIENTO CORRECTIVO'} · ${esc(f['Codigo']||id.slice(-6))}</div>
      <table style="width:100%;border-collapse:collapse;margin-bottom:10px">
        <tr style="background:#e3f2fd"><td colspan="2" style="padding:6px 10px;font-weight:700;color:${color}">EQUIPO</td></tr>
        ${row('Nombre',f['Equipo']||f['Nombre Equipo'])}
        ${row('Placa',f['Placa']||f['PLACA'])}
        ${row('Marca',f['Marca'])}
        ${row('Modelo',f['Modelo'])}
        ${row('Serie',f['Serie'])}
        ${row('Servicio',f['Servicio'])}
        ${row('Riesgo',f['Clasificacion Riesgo'])}
      </table>
      <table style="width:100%;border-collapse:collapse;margin-bottom:10px">
        <tr style="background:#e3f2fd"><td colspan="2" style="padding:6px 10px;font-weight:700;color:${color}">EJECUCIÓN</td></tr>
        ${row('Fecha',fmt(f['Fecha Ejecucion']||f['Fecha Inicio']))}
        ${row('Técnico',f['Tecnico']||f['Técnico'])}
        ${row('Duración',f['Duracion']?(f['Duracion']+' h'):'')}
        ${row('Costo',f['Costo']?'$'+Number(f['Costo']).toLocaleString('es-CO'):'')}
        ${row('Estado',f['Estado'])}
        ${isPrev?row('Fecha Próxima',fmt(f['Fecha Proxima'])):''
        }
      </table>
      ${isPrev?`<table style="width:100%;border-collapse:collapse;margin-bottom:10px">
        <tr style="background:#e3f2fd"><td colspan="2" style="padding:6px 10px;font-weight:700;color:${color}">ACTIVIDADES PREVENTIVAS</td></tr>
        ${row('Actividades',f['Actividades'])}
        ${row('Repuestos / Insumos',f['Repuestos'])}
        ${row('Hallazgos',f['Hallazgos'])}
      </table>`:
      `<table style="width:100%;border-collapse:collapse;margin-bottom:10px">
        <tr style="background:#fce4ec"><td colspan="2" style="padding:6px 10px;font-weight:700;color:${color}">ANÁLISIS CORRECTIVO</td></tr>
        ${row('Falla Reportada',f['Falla Reportada'])}
        ${row('Diagnóstico',f['Diagnostico'])}
        ${row('Acción Tomada',f['Accion Tomada'])}
        ${row('Causa Raíz',f['Causa Raiz'])}
        ${row('Repuestos Cambiados',f['Repuestos'])}
        ${row('Hallazgos',f['Hallazgos'])}
      </table>`}
      <table style="width:100%;border-collapse:collapse">
        <tr style="background:#e3f2fd"><td colspan="2" style="padding:6px 10px;font-weight:700;color:${color}">OBSERVACIONES</td></tr>
        ${row('Observaciones',f['Observaciones'])}
        ${row('Firma / Responsable',f['Firma Responsable'])}
      </table>
      <div style="margin-top:16px;display:flex;gap:10px;justify-content:flex-end">
        <button onclick="printMantReport('${esc(id)}')" style="padding:9px 20px;background:#1565c0;color:white;border:none;border-radius:8px;cursor:pointer;font-weight:700">🖨️ Imprimir Reporte</button>
        <button onclick="closeMantDetail();openMantForm('${isPrev?'prev':'corr'}','${esc(id)}')" style="padding:9px 20px;background:#eceff1;color:#37474f;border:none;border-radius:8px;cursor:pointer;font-weight:700">✏️ Editar</button>
      </div>
    </div>`;
  }

  // ── PRINT REPORT ──────────────────────────────────────────────────────────
  window.printMantReport = function(id) {
    const rec = mtState.records.find(r=>r.id===id);
    if (!rec) return;
    const f = rec.fields||{};
    const isPrev = f['Tipo']==='Preventivo';
    const color = isPrev ? '#1565c0' : '#b71c1c';
    const bgHead = isPrev ? '#e3f2fd' : '#fce4ec';
    const icon   = isPrev ? '🛡️' : '🔧';

    const table = (title, rows) => `
      <div class="rp-section">${title}</div>
      <table class="rp-table">${rows.map(([l,v])=>v?`<tr><td class="rp-label">${l}</td><td class="rp-val">${v}</td></tr>`:'').join('')}</table>`;

    const logo = (mtState.inventario[0]&&'') || ''; // skip logo for simplicity

    const body = `
      <div class="rp-header">
        <div class="rp-header-left">
          <div class="rp-hospital">HOSPITAL SUSANA LÓPEZ DE VALENCIA E.S.E</div>
          <div class="rp-dept">GESTIÓN DEL AMBIENTE Y LA TECNOLOGÍA</div>
          <div class="rp-addr">Calle 15 N°17A-196 Tel. 8217190</div>
        </div>
        <div class="rp-header-center">
          <div class="rp-doc-title">${isPrev?'REPORTE DE MANTENIMIENTO PREVENTIVO':'REPORTE DE MANTENIMIENTO CORRECTIVO'}</div>
          <div class="rp-code">Código: ${esc(f['Codigo']||id.slice(-6))}</div>
        </div>
        <div class="rp-header-right">
          <div>Fecha: ${new Date().toLocaleDateString('es-CO')}</div>
          <div>Página 1 de 1</div>
        </div>
      </div>

      ${table('<span>🏥 DATOS DEL EQUIPO</span>', [
        ['Nombre del Equipo', f['Equipo']||f['Nombre Equipo']],
        ['Placa / Inventario', f['Placa']||f['PLACA']],
        ['Marca', f['Marca']], ['Modelo', f['Modelo']], ['Serie', f['Serie']],
        ['Servicio / Ubicación', f['Servicio']],
        ['Clasificación de Riesgo', f['Clasificacion Riesgo']],
      ])}

      ${table('<span>📅 DATOS DE EJECUCIÓN</span>', [
        ['Fecha de Ejecución', fmt(f['Fecha Ejecucion']||f['Fecha Inicio'])],
        ['Técnico Responsable', f['Tecnico']||f['Técnico']],
        ['Duración', f['Duracion']?(f['Duracion']+' horas'):''],
        ['Costo', f['Costo']?'$ '+Number(f['Costo']).toLocaleString('es-CO'):''],
        ['Estado', f['Estado']],
        ...(isPrev ? [['Fecha Próximo Mantenimiento', fmt(f['Fecha Proxima'])]] : []),
      ])}

      ${isPrev ? table('<span>🛡️ ACTIVIDADES PREVENTIVAS</span>', [
        ['Actividades Realizadas', f['Actividades']],
        ['Repuestos / Insumos', f['Repuestos']],
        ['Hallazgos / Condición', f['Hallazgos']],
      ]) : table('<span>🔧 ANÁLISIS CORRECTIVO</span>', [
        ['Falla Reportada', f['Falla Reportada']],
        ['Diagnóstico Técnico', f['Diagnostico']],
        ['Acción Tomada / Solución', f['Accion Tomada']],
        ['Causa Raíz', f['Causa Raiz']],
        ['Repuestos Cambiados', f['Repuestos']],
        ['Hallazgos', f['Hallazgos']],
      ])}

      ${table('<span>📝 OBSERVACIONES</span>', [
        ['Observaciones y Recomendaciones', f['Observaciones']],
      ])}

      <div class="rp-firmas">
        <div class="rp-firma-box"><div class="rp-firma-line"></div><div>Técnico Responsable</div><div class="rp-firma-name">${esc(f['Tecnico']||f['Técnico']||'')}</div></div>
        <div class="rp-firma-box"><div class="rp-firma-line"></div><div>Supervisor / Jefe de Área</div></div>
        <div class="rp-firma-box"><div class="rp-firma-line"></div><div>Ingeniero Biomédico</div><div class="rp-firma-name">${esc(f['Firma Responsable']||'')}</div></div>
      </div>
      <div class="rp-footer">HSLV · Sistema de Gestión de la Tecnología · ${isPrev?'SLV-GAT-MANT-PREV':'SLV-GAT-MANT-CORR'} · Generado: ${new Date().toLocaleString('es-CO')}</div>`;

    const css = `
      *{box-sizing:border-box;margin:0;padding:0}
      body{font-family:Arial,sans-serif;font-size:11px;color:#212121;padding:14px}
      .rp-header{display:flex;justify-content:space-between;align-items:flex-start;border:2px solid ${color};border-radius:4px;padding:10px 14px;margin-bottom:10px;background:${bgHead};gap:12px}
      .rp-hospital{font-weight:800;font-size:13px;color:#212121;text-transform:uppercase}
      .rp-dept{font-size:11px;font-weight:700;color:#263238;margin-top:2px}
      .rp-addr{font-size:10px;color:#607d8b;margin-top:2px}
      .rp-header-center{text-align:center;flex:1}
      .rp-doc-title{font-weight:800;font-size:14px;color:${color};text-transform:uppercase;letter-spacing:0.5px}
      .rp-code{font-weight:700;font-size:11px;color:#263238;margin-top:4px}
      .rp-header-right{text-align:right;font-size:10px;color:#607d8b;white-space:nowrap}
      .rp-section{background:${color};color:white;font-weight:700;padding:5px 10px;font-size:11px;text-transform:uppercase;border-radius:3px;margin:8px 0 0;-webkit-print-color-adjust:exact;print-color-adjust:exact}
      .rp-table{width:100%;border-collapse:collapse;font-size:11px;margin-top:1px}
      .rp-table td{border:1px solid #b0bec5;padding:4px 8px;vertical-align:top}
      .rp-label{background:#eceff1;font-weight:700;font-size:10px;color:#37474f;text-transform:uppercase;width:30%;white-space:nowrap;-webkit-print-color-adjust:exact;print-color-adjust:exact}
      .rp-val{font-size:11px;color:#212121;min-height:18px}
      .rp-firmas{display:flex;gap:20px;margin-top:24px;padding-top:12px;border-top:1px solid #e0e0e0}
      .rp-firma-box{flex:1;text-align:center;font-size:10px;color:#607d8b}
      .rp-firma-line{border-bottom:1px solid #263238;height:40px;margin-bottom:4px}
      .rp-firma-name{font-weight:700;color:#212121;margin-top:2px;font-size:11px}
      .rp-footer{margin-top:12px;font-size:9px;color:#9e9e9e;border-top:1px solid #e0e0e0;padding-top:5px;text-align:center}
      @media print{@page{size:A4 portrait;margin:10mm}body{padding:0}}
    `;
    const w = window.open('','_blank','width=900,height=700');
    w.document.write(`<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>Reporte Mantenimiento</title><style>${css}</style></head><body>${body}</body></html>`);
    w.document.close();
    setTimeout(()=>{w.focus();w.print();},500);
  };

  // ── TOAST ──────────────────────────────────────────────────────────────────
  function showMtToast(msg, type) {
    let t = document.getElementById('mtToast');
    if (!t) { t=document.createElement('div'); t.id='mtToast'; document.body.appendChild(t); }
    const bg = type==='ok'?'#2e7d32':type==='warn'?'#f57f17':'#c62828';
    t.style.cssText = `position:fixed;bottom:32px;right:32px;background:${bg};color:white;padding:14px 22px;border-radius:10px;font-size:14px;font-weight:600;font-family:'Outfit',sans-serif;z-index:99999;box-shadow:0 8px 24px rgba(0,0,0,0.2);transition:opacity 0.4s;opacity:1`;
    t.textContent = msg;
    clearTimeout(t._to);
    t._to = setTimeout(()=>{t.style.opacity='0';},3200);
  }

  window.loadMantenimientosModule = loadMantenimientosModule;

})();
