// ============================================================================
// MÓDULO CRONOGRAMA DE MANTENIMIENTO PREVENTIVO - HSLV  v2
// + Impresión por servicio individual
// + Impresión por mes individual
// + Modal de selección de impresión
// ============================================================================

(function () {
  if (window.__HSLV_CRONOGRAMA_LOADED) return;
  window.__HSLV_CRONOGRAMA_LOADED = true;

  const YEAR = new Date().getFullYear();
  const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  const MESES_SHORT = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  const WEEK_COLORS = {
    S1:{bg:'#e3f2fd',border:'#1565c0',text:'#0d47a1'},
    S2:{bg:'#e8f5e9',border:'#2e7d32',text:'#1b5e20'},
    S3:{bg:'#fff8e1',border:'#f57f17',text:'#e65100'},
    S4:{bg:'#fce4ec',border:'#c62828',text:'#b71c1c'},
  };

  const crState = window.__HSLV_CR_STATE || (window.__HSLV_CR_STATE = {
    allRecords:[], filtered:[], services:[], activeService:'TODOS', searchQuery:'', loaded:false,
  });

  function getHeaders(){try{if(typeof getAuthHeader==='function')return getAuthHeader();}catch(e){}return{};}
  function safeErr(e){try{if(e&&e.response&&e.response.data)return e.response.data.error||JSON.stringify(e.response.data);}catch(_){}return(e&&e.message)?e.message:'Error';}
  function esc(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}

  function parseSchedule(record){
    const f=record.fields||{};
    const raw=f['Programacion de Mantenimiento Anual']||f['PROGRAMACION DE MANTENIMIENTO ANUAL']||'';
    const freq=f['Frecuencia de Mantenimiento']||f['Frecuencia de MTTO Preventivo']||f['FRECUENCIA DE MTTO PREVENTIVO']||'';
    const fechaProg=f['Fecha Programada de Mantenimiento']||f['FECHA PROGRAMADA DE MANTENIMINETO']||'';
    const results=[];
    if(raw&&raw.trim()){
      raw.split('|').forEach(part=>{
        part=part.trim();
        const mi=MESES.findIndex(m=>part.toLowerCase().includes(m.toLowerCase()));
        if(mi===-1)return;
        const sm=part.match(/S([1-4])/i);
        results.push({mesIdx:mi,semana:sm?'S'+sm[1]:'S1'});
      });
      if(results.length)return results;
    }
    if(raw&&raw.includes(',')){
      raw.split(',').forEach(part=>{
        const mi=MESES.findIndex(m=>part.trim().toLowerCase().includes(m.toLowerCase()));
        if(mi!==-1)results.push({mesIdx:mi,semana:'S1'});
      });
      if(results.length)return results;
    }
    const freqLow=(freq||'').toLowerCase();
    const freqMap={mensual:[0,1,2,3,4,5,6,7,8,9,10,11],bimestral:[0,2,4,6,8,10],trimestral:[0,3,6,9],cuatrimestral:[0,4,8],semestral:[0,6],anual:[0]};
    for(const[key,months]of Object.entries(freqMap)){if(freqLow.includes(key)){months.forEach(m=>results.push({mesIdx:m,semana:'S1'}));return results;}}
    if(fechaProg){try{const d=new Date(fechaProg);if(!isNaN(d.getTime()))results.push({mesIdx:d.getMonth(),semana:'S'+Math.min(Math.ceil(d.getDate()/7),4)});}catch(_){}}
    return results;
  }

  // ── LOAD ───────────────────────────────────────────────────────────────────
  async function loadCronograma(){
    const container=document.getElementById('cronogramaBody');
    if(!container)return;
    container.innerHTML=`<div class="cr-loading"><div class="cr-spinner"></div><p>Cargando cronograma ${YEAR}...</p></div>`;
    try{
      const base=typeof API_BASE_URL!=='undefined'?API_BASE_URL:'/.netlify/functions';
      let allRec=[],offset=null;
      do{
        const params=new URLSearchParams({pageSize:'100'});
        if(offset)params.set('offset',offset);
        const resp=await axios.get(`${base}/inventario?${params}`,{headers:getHeaders()});
        const data=resp.data||{};
        allRec=allRec.concat(data.records||data.data||[]);
        offset=data.offset||null;
      }while(offset);
      crState.allRecords=allRec; crState.loaded=true;
      const svcSet=new Set();
      allRec.forEach(r=>{const svc=(r.fields||{})['Servicio']||(r.fields||{})['SERVICIO']||'';if(svc.trim())svcSet.add(svc.trim());});
      crState.services=Array.from(svcSet).sort();
      renderServiceTabs(); applyFiltersAndRender(); updateCronogramaStats();
    }catch(err){
      container.innerHTML=`<div style="text-align:center;padding:40px;color:#c62828;">⚠️ Error<br><small>${esc(safeErr(err))}</small><br><button class="btn btn-primary" style="margin-top:12px" onclick="loadCronograma()">🔄 Reintentar</button></div>`;
    }
  }

  function renderServiceTabs(){
    const el=document.getElementById('crServiceTabs');
    if(!el)return;
    el.innerHTML=['TODOS',...crState.services].map(svc=>`<button class="cr-tab ${crState.activeService===svc?'active':''}" onclick="crSetService('${esc(svc)}')">${esc(svc)}</button>`).join('');
  }
  window.crSetService=function(svc){crState.activeService=svc;renderServiceTabs();applyFiltersAndRender();};

  function applyFiltersAndRender(){
    const q=crState.searchQuery.toLowerCase();
    crState.filtered=crState.allRecords.filter(r=>{
      const f=r.fields||{};
      const svc=f['Servicio']||f['SERVICIO']||'';
      const eq=f['Equipo']||f['EQUIPO']||'';
      const placa=f['Numero de Placa']||f['PLACA']||'';
      if(crState.activeService!=='TODOS'&&svc.trim()!==crState.activeService)return false;
      if(q&&!eq.toLowerCase().includes(q)&&!svc.toLowerCase().includes(q)&&!placa.toLowerCase().includes(q))return false;
      return parseSchedule(r).length>0;
    });
    renderCronograma(); updateCronogramaStats();
  }
  window.crSearch=function(){const el=document.getElementById('crSearchInput');crState.searchQuery=el?el.value.trim():'';applyFiltersAndRender();};

  function updateCronogramaStats(){
    const total=crState.allRecords.length;
    const withSched=crState.allRecords.filter(r=>parseSchedule(r).length>0).length;
    const cm=new Date().getMonth();
    let thisMo=0;
    crState.allRecords.forEach(r=>parseSchedule(r).forEach(s=>{if(s.mesIdx===cm)thisMo++;}));
    setText('crStatTotal',total); setText('crStatProg',withSched); setText('crStatNoProg',total-withSched); setText('crStatMonth',thisMo);
  }
  function setText(id,v){const el=document.getElementById(id);if(el)el.textContent=v;}

  // ── RENDER ─────────────────────────────────────────────────────────────────
  function renderCronograma(){
    const container=document.getElementById('cronogramaBody');
    if(!container)return;
    if(!crState.filtered.length){
      container.innerHTML=`<div style="text-align:center;padding:60px;color:#90a4ae;"><div style="font-size:60px;margin-bottom:16px;opacity:.4">📅</div><div style="font-size:18px;font-weight:700;color:#546e7a">Sin programación registrada</div></div>`;return;
    }
    const groups={};
    crState.filtered.forEach(r=>{
      const f=r.fields||{};
      const svc=(f['Servicio']||f['SERVICIO']||'Sin Servicio').trim();
      if(!groups[svc])groups[svc]=[];
      groups[svc].push(r);
    });
    const cm=new Date().getMonth();
    const allMonths=Array.from({length:12},(_,i)=>i);
    let html='';
    Object.entries(groups).sort(([a],[b])=>a.localeCompare(b)).forEach(([svc,records])=>{
      html+=buildServiceBlock(svc,records,allMonths,cm,true);
    });
    html+=buildLegend();
    container.innerHTML=html;
  }

  function buildServiceBlock(svc,records,showMonths,currentMonth,screen){
    const headers=showMonths.map(i=>`<th class="cr-th-mes ${i===currentMonth?'cr-mes-current':''}">${MESES_SHORT[i]}</th>`).join('');
    const filteredRecords=records.filter(r=>{
      const byMonth={};
      parseSchedule(r).forEach(s=>{if(!byMonth[s.mesIdx])byMonth[s.mesIdx]=[];byMonth[s.mesIdx].push(s.semana);});
      return showMonths.some(i=>byMonth[i]&&byMonth[i].length>0);
    });
    if(!filteredRecords.length)return'';
    const rows=filteredRecords.map(r=>{
      const f=r.fields||{};
      const equipo=f['Equipo']||f['EQUIPO']||'—';
      const placa=f['Numero de Placa']||f['PLACA']||'';
      const marca=f['Marca']||f['MARCA']||'';
      const freq=f['Frecuencia de Mantenimiento']||f['Frecuencia de MTTO Preventivo']||f['FRECUENCIA DE MTTO PREVENTIVO']||'—';
      const schedule=parseSchedule(r);
      const byMonth={};
      schedule.forEach(s=>{if(!byMonth[s.mesIdx])byMonth[s.mesIdx]=[];byMonth[s.mesIdx].push(s.semana);});
      const cells=showMonths.map(i=>{
        const weeks=byMonth[i]||[];
        const isCurrent=i===currentMonth,isPast=i<currentMonth;
        if(!weeks.length)return`<td class="cr-cell-empty ${isCurrent?'cr-cell-current-month':''}"></td>`;
        const wh=weeks.map(w=>{const c=WEEK_COLORS[w]||WEEK_COLORS.S1;return`<span class="cr-week-badge" style="background:${c.bg};border-color:${c.border};color:${c.text};">${w}</span>`;}).join('');
        return`<td class="cr-cell-active ${isCurrent?'cr-cell-current-month':''} ${isPast&&screen?'cr-cell-past':''}"><div class="cr-cell-inner">${wh}</div></td>`;
      }).join('');
      const total=showMonths.reduce((a,i)=>a+(byMonth[i]||[]).length,0);
      return`<tr class="cr-row">
        <td class="cr-td-equipo"><div class="cr-equipo-name" title="${esc(equipo)}">${esc(equipo)}</div>${placa?`<div class="cr-equipo-sub">${esc(placa)}</div>`:''}${marca?`<div class="cr-equipo-sub">${esc(marca)}</div>`:''}</td>
        <td class="cr-td-freq"><span class="cr-freq-badge">${esc(freq)}</span></td>
        ${cells}
        <td class="cr-td-total"><strong>${total}</strong></td>
      </tr>`;
    }).join('');
    return`<div class="cr-service-block">
      <div class="cr-service-header">
        <span class="cr-service-icon">🏥</span>
        <span class="cr-service-name">${esc(svc)}</span>
        <span class="cr-service-badge">${filteredRecords.length} equipo${filteredRecords.length!==1?'s':''}</span>
      </div>
      <div class="cr-table-wrap"><table class="cr-table">
        <thead><tr><th class="cr-th-equipo">EQUIPO / PLACA</th><th class="cr-th-freq">FRECUENCIA</th>${headers}<th class="cr-th-total">TOTAL</th></tr></thead>
        <tbody>${rows}</tbody>
      </table></div>
    </div>`;
  }

  function buildLegend(){
    return`<div class="cr-legend"><span class="cr-legend-title">Semanas:</span>${Object.entries(WEEK_COLORS).map(([s,c])=>`<span class="cr-legend-item" style="background:${c.bg};border:1.5px solid ${c.border};color:${c.text};">${s}</span>`).join('')}<span class="cr-legend-note">· Cada celda muestra la semana programada del mes</span></div>`;
  }

  // ── PRINT MODAL ────────────────────────────────────────────────────────────
  window.openPrintModal=function(){
    const modal=document.getElementById('crPrintModal');
    if(!modal)return;
    const svcList=document.getElementById('crPrintServices');
    if(svcList){
      svcList.innerHTML=crState.services.map(svc=>`<label class="cr-print-check"><input type="checkbox" value="${esc(svc)}" checked><span>${esc(svc)}</span></label>`).join('');
    }
    modal.style.display='flex';
    setTimeout(()=>modal.classList.add('active'),10);
  };

  window.closePrintModal=function(){
    const modal=document.getElementById('crPrintModal');
    if(modal){modal.classList.remove('active');setTimeout(()=>modal.style.display='none',250);}
  };

  window.crSelectAllServices=function(checked){
    document.querySelectorAll('#crPrintServices input[type="checkbox"]').forEach(cb=>cb.checked=checked);
  };
  window.crSelectAllMonths=function(checked){
    document.querySelectorAll('#crPrintMonths input[type="checkbox"]').forEach(cb=>cb.checked=checked);
  };

  window.executePrint=function(){
    const selectedServices=Array.from(document.querySelectorAll('#crPrintServices input[type="checkbox"]:checked')).map(cb=>cb.value);
    const selectedMonths=Array.from(document.querySelectorAll('#crPrintMonths input[type="checkbox"]:checked')).map(cb=>parseInt(cb.value));
    const printMode=document.querySelector('input[name="crPrintMode"]:checked').value;
    if(!selectedServices.length){alert('Selecciona al menos un servicio.');return;}
    if(!selectedMonths.length){alert('Selecciona al menos un mes.');return;}
    closePrintModal();
    setTimeout(()=>doPrint(selectedServices,selectedMonths,printMode),300);
  };

  function doPrint(services,months,mode){
    const cm=new Date().getMonth();
    const css=`
      *{box-sizing:border-box}
      body{font-family:Arial,sans-serif;font-size:10px;color:#000;padding:12px;margin:0}
      .print-header{border-bottom:2px solid #0d47a1;padding-bottom:8px;margin-bottom:14px;display:flex;justify-content:space-between;align-items:flex-end}
      h1{font-size:14px;color:#0d47a1;margin:0 0 3px}
      .print-subtitle{font-size:10px;color:#607d8b}
      .print-meta{font-size:9px;color:#90a4ae;text-align:right}
      .cr-service-block{margin-bottom:14px;page-break-inside:avoid}
      .cr-service-header{background:#0d47a1;color:white;padding:5px 10px;font-weight:700;font-size:11px;border-radius:3px;margin-bottom:2px;display:flex;align-items:center;gap:8px}
      .cr-service-icon{font-size:14px}
      .cr-service-name{flex:1}
      .cr-service-badge{background:rgba(255,255,255,.22);padding:2px 8px;border-radius:10px;font-size:9px}
      .cr-table-wrap{overflow:visible}
      .cr-table{width:100%;border-collapse:collapse;font-size:9px}
      .cr-table th,.cr-table td{border:1px solid #ccc;padding:4px;text-align:center;vertical-align:middle}
      .cr-table th{background:#eceff1;font-weight:700;font-size:8.5px;text-transform:uppercase;white-space:nowrap}
      .cr-th-equipo,.cr-td-equipo{text-align:left!important;min-width:130px;padding-left:8px!important}
      .cr-equipo-name{font-weight:700;font-size:9px}
      .cr-equipo-sub{font-size:8px;color:#607d8b}
      .cr-freq-badge{display:inline-block;padding:1px 6px;border-radius:10px;background:#e3f2fd;color:#0d47a1;font-weight:700;font-size:8px;white-space:nowrap}
      .cr-week-badge{display:inline-block;padding:1px 5px;border-radius:3px;border:1px solid;font-size:8px;font-weight:700;margin:1px}
      .cr-cell-current-month{background:#fff8e1!important}
      .cr-mes-current{background:#fff3e0!important;color:#e65100!important}
      .cr-cell-inner{display:flex;flex-direction:column;align-items:center;gap:2px}
      .cr-td-total{font-weight:700;color:#0d47a1}
      .cr-legend{margin-top:10px;font-size:9px;display:flex;align-items:center;gap:6px;flex-wrap:wrap;padding:5px 10px;background:#f5f5f5;border-radius:4px}
      .cr-legend-title{font-weight:700}
      .cr-legend-item{padding:2px 8px;border-radius:4px;border:1px solid;font-weight:700;font-size:8px}
      .month-page{page-break-after:always}
      .month-page:last-child{page-break-after:auto}
      @media print{@page{size:A3 landscape;margin:7mm}}
    `;

    let bodyHtml='';

    if(mode==='mensual'){
      months.sort((a,b)=>a-b).forEach((monthIdx,pi)=>{
        const isLast=pi===months.length-1;
        bodyHtml+=`<div class="${isLast?'':'month-page'}">
          <div class="print-header">
            <div><h1>Cronograma de Mantenimiento Preventivo ${YEAR}</h1>
            <div class="print-subtitle">Hospital Susana López de Valencia E.S.E · <strong>Mes: ${MESES[monthIdx]}</strong></div></div>
            <div class="print-meta">Generado: ${new Date().toLocaleDateString('es-CO')}<br>Sistema de Gestión de la Tecnología</div>
          </div>`;
        services.forEach(svc=>{
          const records=crState.allRecords.filter(r=>{
            const f=r.fields||{};
            return(f['Servicio']||f['SERVICIO']||'').trim()===svc&&parseSchedule(r).length>0;
          });
          bodyHtml+=buildServiceBlock(svc,records,[monthIdx],cm,false);
        });
        bodyHtml+=buildLegend()+'</div>';
      });
    }else{
      // Año completo / meses seleccionados
      const months_sorted=months.sort((a,b)=>a-b);
      bodyHtml+=`<div class="print-header">
        <div><h1>Cronograma de Mantenimiento Preventivo ${YEAR}</h1>
        <div class="print-subtitle">Hospital Susana López de Valencia E.S.E · ${services.length===crState.services.length?'Todos los servicios':services.join(', ')}</div></div>
        <div class="print-meta">Generado: ${new Date().toLocaleDateString('es-CO')}<br>Sistema de Gestión de la Tecnología</div>
      </div>`;
      services.forEach(svc=>{
        const records=crState.allRecords.filter(r=>{
          const f=r.fields||{};
          return(f['Servicio']||f['SERVICIO']||'').trim()===svc&&parseSchedule(r).length>0;
        });
        bodyHtml+=buildServiceBlock(svc,records,months_sorted,cm,false);
      });
      bodyHtml+=buildLegend();
    }

    const w=window.open('','_blank','width=1200,height=800');
    w.document.write(`<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>Cronograma ${YEAR}</title><style>${css}</style></head><body>${bodyHtml}</body></html>`);
    w.document.close();
    setTimeout(()=>{w.focus();w.print();},600);
  }

  window.exportCronogramaCSV=function(){
    if(!crState.allRecords.length){alert('No hay datos');return;}
    const rows=[['Servicio','Equipo','Placa','Frecuencia','Mes','Semana']];
    crState.allRecords.forEach(r=>{
      const f=r.fields||{};
      parseSchedule(r).forEach(s=>rows.push([f['Servicio']||f['SERVICIO']||'',f['Equipo']||f['EQUIPO']||'',f['Numero de Placa']||f['PLACA']||'',f['Frecuencia de Mantenimiento']||f['Frecuencia de MTTO Preventivo']||'',MESES[s.mesIdx],s.semana]));
    });
    const csv=rows.map(r=>r.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
    const a=document.createElement('a');
    a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8;'}));
    a.download=`cronograma_${YEAR}.csv`;
    document.body.appendChild(a);a.click();document.body.removeChild(a);
  };

  window.loadCronograma=loadCronograma;

})();
