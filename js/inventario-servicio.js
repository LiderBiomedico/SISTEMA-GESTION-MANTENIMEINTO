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
  const HOSPITAL_LOGO_DATA_URI = 'data:image/png;base64,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';

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
        <span class="is-selector-icon"><img src="${HOSPITAL_LOGO_DATA_URI}" alt="Logo Hospital Susana López de Valencia" class="is-selector-logo"></span>
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
  async function _descargarPDF() {
    if (!_equiposActuales.length) { alert('No hay equipos para exportar.'); return; }

    var btn = document.getElementById('is-btn-pdf');
    if (btn) { btn.disabled = true; btn.innerHTML = '\u23f3 Generando\u2026'; }

    try {
      var jsPDFCtor = await _obtenerJsPDF();
      if (!jsPDFCtor) throw new Error('No se pudo cargar el motor PDF');

      var ahora = new Date();
      var fechaLarga = ahora.toLocaleDateString('es-CO', { year:'numeric', month:'long', day:'numeric' });
      var hora = ahora.toLocaleTimeString('es-CO', { hour:'2-digit', minute:'2-digit' });
      var archivo = 'Inventario_' + _normalizarNombreArchivo(_servicioActual || 'Servicio') + '_' +
                    ahora.getFullYear() +
                    String(ahora.getMonth() + 1).padStart(2, '0') +
                    String(ahora.getDate()).padStart(2, '0') + '.pdf';

      var pdf = new jsPDFCtor({ orientation: 'landscape', unit: 'mm', format: 'a4', compress: true });
      var pageW = pdf.internal.pageSize.getWidth();
      var pageH = pdf.internal.pageSize.getHeight();
      var margin = 10;
      var usableW = pageW - margin * 2;
      var y = margin;
      var page = 1;

      var cols = [12, 78, 42, 34, 40, 71]; // total 277 mm aprox. dentro del A4 horizontal
      var headers = ['#', 'NOMBRE DEL EQUIPO', 'MARCA', 'MODELO', 'N° DE SERIE', 'SEDE'];
      var rows = _equiposActuales.map(function(eq, i) {
        return [
          String(i + 1),
          String(eq.equipo || ''),
          String(eq.marca || ''),
          String(eq.modelo || ''),
          String(eq.serie || ''),
          String(eq.sede || '')
        ];
      });

      var logoDataUrl = await _imagenADataURL(window.location.origin + '/logoNEXA.jpg').catch(function() { return null; });

      function addHeader() {
        y = margin;

        if (logoDataUrl) {
          try {
            pdf.addImage(logoDataUrl, 'JPEG', margin, y, 58, 24, undefined, 'FAST');
          } catch (e) {
            console.warn('[inventario-servicio] No se pudo insertar logo:', e);
          }
        }

        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(20);
        pdf.setTextColor(33, 37, 41);
        pdf.text('Hospital Susana López de Valencia E.S.E.', margin, y + 34);

        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(10);
        pdf.setTextColor(80, 80, 80);
        pdf.text('Sistema de Gestión de Tecnología Biomédica · NEXA/HSLV', margin, y + 40);

        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(14);
        pdf.setTextColor(0, 82, 204);
        pdf.text('Inventario por Servicio', pageW - margin, y + 12, { align: 'right' });

        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(10);
        pdf.setTextColor(90, 90, 90);
        pdf.text(fechaLarga + ' · ' + hora, pageW - margin, y + 18, { align: 'right' });

        pdf.setDrawColor(0, 82, 204);
        pdf.setLineWidth(0.6);
        pdf.line(margin, y + 45, pageW - margin, y + 45);

        pdf.setFillColor(232, 238, 248);
        pdf.roundedRect(margin, y + 49, usableW, 15, 2, 2, 'F');

        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(8);
        pdf.setTextColor(0, 82, 204);
        pdf.text('SERVICIO', margin + 4, y + 55);
        pdf.text('TOTAL EQUIPOS', margin + 110, y + 55);
        pdf.text('FECHA', margin + 165, y + 55);

        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(11);
        pdf.setTextColor(33, 37, 41);
        pdf.text(String(_servicioActual || ''), margin + 4, y + 61);
        pdf.text(String(_equiposActuales.length), margin + 110, y + 61);
        pdf.text(fechaLarga, margin + 165, y + 61);

        y = y + 70;
        drawTableHeader();
      }

      function drawTableHeader() {
        pdf.setFillColor(46, 81, 196);
        pdf.rect(margin, y, usableW, 9, 'F');
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(8.5);
        pdf.setTextColor(255, 255, 255);
        var x = margin;
        for (var i = 0; i < headers.length; i++) {
          pdf.text(headers[i], x + 2, y + 5.8);
          x += cols[i];
        }
        y += 9;
      }

      function drawFooter() {
        pdf.setDrawColor(220, 220, 220);
        pdf.setLineWidth(0.2);
        pdf.line(margin, pageH - 10, pageW - margin, pageH - 10);
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(8);
        pdf.setTextColor(120, 120, 120);
        pdf.text('Hospital Susana López de Valencia E.S.E. — Gestión de Tecnología Biomédica', margin, pageH - 6.2);
        pdf.text('Página ' + page, pageW - margin, pageH - 6.2, { align: 'right' });
      }

      function addNewPage() {
        drawFooter();
        pdf.addPage();
        page += 1;
        addHeader();
      }

      function drawRow(cells, rowIndex) {
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(8.5);
        pdf.setTextColor(50, 50, 50);

        var paddingX = 2;
        var lineH = 4.2;
        var maxLines = 1;
        var prepared = [];

        for (var i = 0; i < cells.length; i++) {
          var lines = pdf.splitTextToSize(String(cells[i] || ''), cols[i] - paddingX * 2);
          if (!Array.isArray(lines)) lines = [String(lines || '')];
          if (lines.length > maxLines) maxLines = lines.length;
          prepared.push(lines);
        }

        var rowH = Math.max(7.5, maxLines * lineH + 2.5);
        if (y + rowH > pageH - 14) addNewPage();

        if (rowIndex % 2 === 1) {
          pdf.setFillColor(245, 247, 250);
          pdf.rect(margin, y, usableW, rowH, 'F');
        }

        pdf.setDrawColor(222, 226, 230);
        pdf.setLineWidth(0.2);
        pdf.line(margin, y + rowH, pageW - margin, y + rowH);

        var x = margin;
        for (var c = 0; c < prepared.length; c++) {
          var textY = y + 4.8;
          var text = prepared[c];

          if (c === 0) {
            pdf.setTextColor(96, 125, 139);
          } else if (c === 1) {
            pdf.setTextColor(33, 37, 41);
            pdf.setFont('helvetica', 'bold');
          } else if (c === 4) {
            pdf.setTextColor(0, 82, 204);
            pdf.setFont('courier', 'normal');
          } else {
            pdf.setTextColor(60, 60, 60);
            pdf.setFont('helvetica', 'normal');
          }

          for (var li = 0; li < text.length; li++) {
            pdf.text(String(text[li]), x + paddingX, textY + (li * lineH));
          }
          x += cols[c];
        }

        y += rowH;
      }

      addHeader();
      rows.forEach(function(row, idx) { drawRow(row, idx); });
      drawFooter();
      pdf.save(archivo);
    } catch (err) {
      console.error('[inventario-servicio] Error generando PDF:', err);
      alert('No fue posible generar el PDF completo. ' + (err && err.message ? err.message : ''));
    } finally {
      if (btn) { btn.disabled = false; btn.innerHTML = '\u2b07\ufe0f Descargar PDF'; }
    }
  }

  async function _obtenerJsPDF() {
    if (window.jspdf && window.jspdf.jsPDF) return window.jspdf.jsPDF;
    await _cargarScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');
    if (window.jspdf && window.jspdf.jsPDF) return window.jspdf.jsPDF;
    return null;
  }

  function _cargarScript(src) {
    return new Promise(function(resolve, reject) {
      var existente = document.querySelector('script[data-pdf-src="' + src + '"]');
      if (existente) {
        if (existente.dataset.loaded === 'true') return resolve();
        existente.addEventListener('load', function onload() {
          existente.removeEventListener('load', onload);
          resolve();
        });
        existente.addEventListener('error', function onerror() {
          existente.removeEventListener('error', onerror);
          reject(new Error('No se pudo cargar ' + src));
        });
        return;
      }

      var s = document.createElement('script');
      s.src = src;
      s.async = true;
      s.dataset.pdfSrc = src;
      s.onload = function() { s.dataset.loaded = 'true'; resolve(); };
      s.onerror = function() { reject(new Error('No se pudo cargar ' + src)); };
      document.head.appendChild(s);
    });
  }

  function _imagenADataURL(url) {
    return fetch(url, { cache: 'no-store' })
      .then(function(res) {
        if (!res.ok) throw new Error('No se pudo cargar imagen');
        return res.blob();
      })
      .then(function(blob) {
        return new Promise(function(resolve, reject) {
          var reader = new FileReader();
          reader.onloadend = function() { resolve(reader.result); };
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
      });
  }

  function _normalizarNombreArchivo(txt) {
    return String(txt || 'Servicio')
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9_-]+/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '');
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
