// =============================================================================
// js/inventario-servicio.js  — Módulo "Inventario por Servicio" NEXA/HSLV
// Carga servicios desde Airtable, muestra equipos filtrados y permite
// exportar a PDF el inventario del servicio seleccionado.
// =============================================================================

(function () {
  'use strict';

  let _serviciosCache = [];
  let _equiposActuales = [];
  let _servicioActual  = '';

  // ── Entrada principal ────────────────────────────────────────────────────────
  window.loadInventarioServicio = async function (force) {
    // Pequeño delay para asegurar que el módulo ya es visible en el DOM
    await new Promise(r => setTimeout(r, 50));

    const cont = document.getElementById('inv-serv-content');
    if (!cont) {
      console.error('[inventario-servicio] No se encontró #inv-serv-content');
      return;
    }

    // Si ya se cargaron los servicios y no se pide forzar, solo re-renderiza
    if (_serviciosCache.length && !force) {
      _renderServicios(_serviciosCache);
      return;
    }

    _setLoading(true);
    try {
      const res  = await fetch('/.netlify/functions/inventario-servicio?action=servicios');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al obtener servicios');
      _serviciosCache = data.servicios || [];
      _renderServicios(_serviciosCache);
    } catch (err) {
      _showError('No se pudieron cargar los servicios: ' + err.message);
    } finally {
      _setLoading(false);
    }
  };

  // ── Render lista de servicios ────────────────────────────────────────────────
  function _renderServicios(servicios) {
    const cont = document.getElementById('inv-serv-content');
    if (!cont) return;

    cont.innerHTML = '';

    // Panel de selección de servicio
    const panel = document.createElement('div');
    panel.className = 'is-selector-panel';
    panel.innerHTML = `
      <div class="is-selector-header">
        <span class="is-selector-icon">🏥</span>
        <div>
          <h3 class="is-selector-title">Seleccione un Servicio</h3>
          <p class="is-selector-sub">${servicios.length} servicio${servicios.length !== 1 ? 's' : ''} encontrado${servicios.length !== 1 ? 's' : ''} en el inventario</p>
        </div>
      </div>
      <div class="is-chips-container" id="is-chips"></div>
    `;
    cont.appendChild(panel);

    // Chips de servicio
    const chips = document.getElementById('is-chips');
    servicios.forEach(s => {
      const chip = document.createElement('button');
      chip.className = 'is-chip';
      chip.dataset.servicio = s;
      chip.innerHTML = `<span class="is-chip-icon">🔹</span>${s}`;
      chip.addEventListener('click', () => _seleccionarServicio(s));
      chips.appendChild(chip);
    });

    // Área de tabla (oculta al inicio)
    const tableArea = document.createElement('div');
    tableArea.id = 'is-table-area';
    tableArea.style.display = 'none';
    tableArea.innerHTML = `
      <div class="is-table-header">
        <div class="is-table-header-left">
          <h3 id="is-table-title" class="is-table-title"></h3>
          <span id="is-table-count" class="is-table-count"></span>
        </div>
        <div class="is-table-actions">
          <button class="is-btn is-btn-secondary" id="is-btn-back">← Volver</button>
          <button class="is-btn is-btn-primary" id="is-btn-pdf">⬇️ Descargar PDF</button>
        </div>
      </div>
      <div id="is-table-loading" style="display:none" class="is-loading-row">
        <span class="is-spinner"></span> Cargando equipos…
      </div>
      <div class="is-table-wrapper">
        <table class="is-table" id="is-main-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Nombre del Equipo</th>
              <th>Marca</th>
              <th>Modelo</th>
              <th>N° de Serie</th>
              <th>Sede</th>
            </tr>
          </thead>
          <tbody id="is-tbody"></tbody>
        </table>
      </div>
      <p id="is-empty-msg" style="display:none" class="is-empty">No se encontraron equipos para este servicio.</p>
    `;
    cont.appendChild(tableArea);

    // Botón volver
    document.getElementById('is-btn-back').addEventListener('click', _volverAServicios);
    // Botón PDF
    document.getElementById('is-btn-pdf').addEventListener('click', _descargarPDF);
  }

  // ── Seleccionar servicio ─────────────────────────────────────────────────────
  async function _seleccionarServicio(servicio) {
    _servicioActual = servicio;

    // Resaltar chip activo
    document.querySelectorAll('.is-chip').forEach(c => {
      c.classList.toggle('is-chip-active', c.dataset.servicio === servicio);
    });

    // Mostrar área de tabla
    const tableArea = document.getElementById('is-table-area');
    if (tableArea) tableArea.style.display = '';

    // Scroll suave al área de tabla
    tableArea && tableArea.scrollIntoView({ behavior: 'smooth', block: 'start' });

    // Título
    const title = document.getElementById('is-table-title');
    if (title) title.textContent = `Servicio: ${servicio}`;
    const count = document.getElementById('is-table-count');
    if (count) count.textContent = '';

    // Limpiar tbody
    const tbody = document.getElementById('is-tbody');
    if (tbody) tbody.innerHTML = '';

    const emptyMsg = document.getElementById('is-empty-msg');
    if (emptyMsg) emptyMsg.style.display = 'none';

    // Mostrar loading
    const loadingRow = document.getElementById('is-table-loading');
    if (loadingRow) loadingRow.style.display = '';

    try {
      const url = `/.netlify/functions/inventario-servicio?action=equipos&servicio=${encodeURIComponent(servicio)}`;
      const res  = await fetch(url);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al obtener equipos');

      _equiposActuales = data.equipos || [];
      _renderTablaEquipos(_equiposActuales);

      if (count) count.textContent = `${_equiposActuales.length} equipo${_equiposActuales.length !== 1 ? 's' : ''}`;
    } catch (err) {
      _showError('Error cargando equipos: ' + err.message);
    } finally {
      if (loadingRow) loadingRow.style.display = 'none';
    }
  }

  // ── Render tabla de equipos ──────────────────────────────────────────────────
  function _renderTablaEquipos(equipos) {
    const tbody = document.getElementById('is-tbody');
    const emptyMsg = document.getElementById('is-empty-msg');
    if (!tbody) return;

    tbody.innerHTML = '';

    if (!equipos.length) {
      if (emptyMsg) emptyMsg.style.display = '';
      return;
    }

    equipos.forEach((eq, idx) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td class="is-td-num">${idx + 1}</td>
        <td class="is-td-name">${_esc(eq.equipo)}</td>
        <td>${_esc(eq.marca)}</td>
        <td>${_esc(eq.modelo)}</td>
        <td class="is-td-serie">${_esc(eq.serie)}</td>
        <td>${_esc(eq.sede)}</td>
      `;
      tbody.appendChild(tr);
    });
  }

  // ── Volver a selección de servicios ─────────────────────────────────────────
  function _volverAServicios() {
    const tableArea = document.getElementById('is-table-area');
    if (tableArea) tableArea.style.display = 'none';
    document.querySelectorAll('.is-chip').forEach(c => c.classList.remove('is-chip-active'));
    _servicioActual  = '';
    _equiposActuales = [];
  }

  // ── Descargar PDF ────────────────────────────────────────────────────────────
  function _descargarPDF() {
    if (!_equiposActuales.length) { alert('No hay equipos para exportar.'); return; }

    var btn = document.getElementById('is-btn-pdf');
    if (btn) { btn.disabled = true; btn.innerHTML = '\u23f3 Generando\u2026'; }

    var ahora = new Date();
    var mes   = ahora.toLocaleDateString('es-CO', {year:'numeric', month:'long', day:'numeric'});
    var hora  = ahora.toLocaleTimeString('es-CO', {hour:'2-digit', minute:'2-digit'});
    var arch  = 'Inventario_' + _servicioActual.replace(/\s+/g, '_') +
                '_' + ahora.getFullYear() +
                String(ahora.getMonth()+1).padStart(2,'0') +
                String(ahora.getDate()).padStart(2,'0') + '.pdf';

    // Logo: URL relativa al dominio (no base64 para evitar problemas de memoria/parsing)
    var logoUrl = window.location.origin + '/logoNEXA.jpg';

    // Construir filas
    var filas = '';
    for (var i = 0; i < _equiposActuales.length; i++) {
      var eq = _equiposActuales[i];
      var bg = i % 2 === 0 ? '#ffffff' : '#f5f7fa';
      filas += '<tr style="background:' + bg + '">' +
        '<td style="text-align:center;color:#607D8B;padding:5px 7px;border-bottom:1px solid #dee2e6;font-size:9px">' + (i+1) + '</td>' +
        '<td style="font-weight:700;padding:5px 7px;border-bottom:1px solid #dee2e6;font-size:9px">' + _esc(eq.equipo) + '</td>' +
        '<td style="padding:5px 7px;border-bottom:1px solid #dee2e6;font-size:9px">' + _esc(eq.marca) + '</td>' +
        '<td style="padding:5px 7px;border-bottom:1px solid #dee2e6;font-size:9px">' + _esc(eq.modelo) + '</td>' +
        '<td style="font-family:monospace;color:#0052CC;padding:5px 7px;border-bottom:1px solid #dee2e6;font-size:9px">' + _esc(eq.serie) + '</td>' +
        '<td style="padding:5px 7px;border-bottom:1px solid #dee2e6;font-size:9px">' + _esc(eq.sede) + '</td>' +
        '</tr>';
    }

    var htmlPDF = '<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">' +
      '<title>' + arch + '</title>' +
      '<style>' +
        '*{margin:0;padding:0;box-sizing:border-box}' +
        'body{font-family:Arial,Helvetica,sans-serif;font-size:10px;color:#212529;background:#ffffff;padding:12mm}' +
        '.hdr{display:flex;align-items:center;gap:12px;border-bottom:2px solid #0052CC;padding-bottom:10px;margin-bottom:10px}' +
        '.logo{width:50px;height:50px;object-fit:contain}' +
        '.hc{flex:1}' +
        '.hc h1{font-size:12px;color:#0052CC;font-weight:700;margin:0 0 2px 0}' +
        '.hc p{font-size:9px;color:#555;margin:0}' +
        '.hr{text-align:right;font-size:9px;color:#555}' +
        '.hr b{display:block;color:#0052CC;font-size:11px;margin-bottom:2px}' +
        '.meta{display:flex;gap:20px;background:#e8eef8;border-radius:4px;padding:7px 12px;margin-bottom:10px}' +
        '.ml label{font-size:8px;text-transform:uppercase;color:#0052CC;font-weight:700;display:block;letter-spacing:.5px}' +
        '.ml span{font-size:10px;font-weight:600}' +
        'table{width:100%;border-collapse:collapse;border:1px solid #dee2e6}' +
        'th{background:#0052CC;color:#fff;font-size:9px;text-transform:uppercase;padding:6px 7px;text-align:left;letter-spacing:.3px}' +
        'td{vertical-align:middle}' +
        '.footer{margin-top:14px;text-align:center;font-size:8px;color:#888;border-top:1px solid #ddd;padding-top:6px}' +
      '</style>' +
      '</head><body>' +
        '<div class="hdr">' +
          '<img class="logo" src="' + logoUrl + '" alt="Logo" crossorigin="anonymous">' +
          '<div class="hc">' +
            '<h1>Hospital Susana L\u00f3pez de Valencia E.S.E.</h1>' +
            '<p>Sistema de Gesti\u00f3n de Tecnolog\u00eda Biom\u00e9dica \u00b7 NEXA/HSLV</p>' +
          '</div>' +
          '<div class="hr"><b>Inventario por Servicio</b>' + mes + ' \u00b7 ' + hora + '</div>' +
        '</div>' +
        '<div class="meta">' +
          '<div class="ml"><label>Servicio</label><span>' + _esc(_servicioActual) + '</span></div>' +
          '<div class="ml"><label>Total Equipos</label><span>' + _equiposActuales.length + '</span></div>' +
          '<div class="ml"><label>Fecha</label><span>' + mes + '</span></div>' +
        '</div>' +
        '<table>' +
          '<thead><tr>' +
            '<th style="width:26px">#</th>' +
            '<th>Nombre del Equipo</th>' +
            '<th>Marca</th>' +
            '<th>Modelo</th>' +
            '<th>N\u00ba de Serie</th>' +
            '<th>Sede</th>' +
          '</tr></thead>' +
          '<tbody>' + filas + '</tbody>' +
        '</table>' +
        '<div class="footer">Hospital Susana L\u00f3pez de Valencia E.S.E. \u2014 \u00c1rea de Gesti\u00f3n de Tecnolog\u00eda Biom\u00e9dica e Infraestructura</div>' +
      '</body></html>';

    // ── Usar el mismo patr\u00f3n probado de mantenimientos.js ──
    var iframe = document.createElement('iframe');
    iframe.style.cssText = 'position:fixed;left:0;top:0;width:1190px;height:842px;opacity:0;pointer-events:none;z-index:-1;border:none;';
    document.body.appendChild(iframe);

    var iDoc = iframe.contentDocument || iframe.contentWindow.document;
    iDoc.open();
    iDoc.write(htmlPDF);
    iDoc.close();

    setTimeout(function() {
      var imgs = iDoc.querySelectorAll('img');
      var imgPromises = Array.from(imgs).map(function(img) {
        if (img.complete && img.naturalWidth > 0) return Promise.resolve();
        return new Promise(function(res) {
          img.onload = res;
          img.onerror = res; // Si el logo no carga, continuar igual
          setTimeout(res, 5000);
        });
      });

      Promise.all(imgPromises).then(function() {
        setTimeout(function() {
          // Cargar html2pdf DENTRO del iframe (patr\u00f3n de mantenimientos.js)
          var script = iDoc.createElement('script');
          script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.2/html2pdf.bundle.min.js';
          script.onload = function() {
            var h2p = iframe.contentWindow.html2pdf;
            h2p().set({
              margin: 10,
              filename: arch,
              image: { type: 'jpeg', quality: 0.95 },
              html2canvas: {
                scale: 2,
                useCORS: true,
                logging: false,
                letterRendering: true,
                allowTaint: true,
                backgroundColor: '#ffffff'
              },
              jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' },
              pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
            }).from(iDoc.body).save()
              .then(function() {
                document.body.removeChild(iframe);
                if (btn) { btn.disabled = false; btn.innerHTML = '\u2b07\ufe0f Descargar PDF'; }
              })
              .catch(function(err) {
                console.error('[PDF iframe] error:', err);
                document.body.removeChild(iframe);
                if (btn) { btn.disabled = false; btn.innerHTML = '\u2b07\ufe0f Descargar PDF'; }
                // Fallback: ventana de impresi\u00f3n
                _abrirVentana(htmlPDF);
              });
          };
          script.onerror = function() {
            console.warn('[PDF] CDN no disponible, usando ventana de impresi\u00f3n');
            document.body.removeChild(iframe);
            if (btn) { btn.disabled = false; btn.innerHTML = '\u2b07\ufe0f Descargar PDF'; }
            _abrirVentana(htmlPDF);
          };
          iDoc.head.appendChild(script);
        }, 1000);
      });
    }, 800);
  }

  function _abrirVentana(htmlPDF) {
    var win = window.open('', '_blank', 'width=1200,height=700,scrollbars=yes');
    if (!win) { alert('Permita ventanas emergentes e intente de nuevo.'); return; }
    win.document.write(htmlPDF);
    win.document.close();
    win.focus();
    // Mostrar instucciones
    setTimeout(function() {
      try {
        var msg = win.document.createElement('div');
        msg.style.cssText = 'position:fixed;top:0;left:0;right:0;background:#0052CC;color:#fff;text-align:center;padding:10px;font-family:Arial,sans-serif;font-size:13px;z-index:9999';
        msg.innerHTML = '\ud83d\udda8\ufe0f Use <strong>Ctrl+P</strong> (o Cmd+P) para imprimir/guardar como PDF';
        win.document.body.insertBefore(msg, win.document.body.firstChild);
      } catch(e) {}
    }, 500);
  }

  // ── Helpers ──────────────────────────────────────────────────────────────────
  function _esc(str) {
    return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  function _setLoading(on) {
    const el = document.getElementById('is-global-loading');
    if (el) el.style.display = on ? '' : 'none';
  }

  function _showError(msg) {
    const cont = document.getElementById('inv-serv-content');
    if (!cont) return;
    cont.innerHTML = `<div class="is-error"><span>⚠️</span> ${msg}</div>`;
  }

})();
