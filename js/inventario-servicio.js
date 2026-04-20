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
    if (!_equiposActuales.length) {
      alert('No hay equipos para exportar.');
      return;
    }

    const ahora = new Date();
    const fecha = ahora.toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' });
    const hora  = ahora.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });

    // Construir HTML del PDF
    const rowsHtml = _equiposActuales.map((eq, i) => `
      <tr class="${i % 2 === 0 ? '' : 'alt'}">
        <td class="center">${i + 1}</td>
        <td>${_esc(eq.equipo)}</td>
        <td>${_esc(eq.marca)}</td>
        <td>${_esc(eq.modelo)}</td>
        <td>${_esc(eq.serie)}</td>
        <td>${_esc(eq.sede)}</td>
      </tr>`).join('');

    const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: Arial, sans-serif; font-size: 11px; color: #1a1a2e; background: #fff; }
  .page { padding: 24px 28px; }
  .header { display: flex; align-items: center; justify-content: space-between; border-bottom: 3px solid #0052CC; padding-bottom: 12px; margin-bottom: 16px; }
  .header-left h1 { font-size: 15px; color: #0052CC; font-weight: 700; margin-bottom: 2px; }
  .header-left p  { font-size: 10px; color: #555; }
  .header-right   { text-align: right; font-size: 10px; color: #555; }
  .header-right strong { color: #0052CC; }
  .meta-row { display: flex; gap: 32px; background: #EFF3FA; border-radius: 6px; padding: 10px 14px; margin-bottom: 14px; }
  .meta-item label { font-size: 9px; text-transform: uppercase; color: #0052CC; font-weight: 700; display: block; }
  .meta-item span  { font-size: 11px; font-weight: 600; }
  table { width: 100%; border-collapse: collapse; }
  th { background: #0052CC; color: #fff; font-size: 10px; text-transform: uppercase; padding: 7px 8px; text-align: left; }
  td { padding: 6px 8px; border-bottom: 1px solid #E8ECF4; font-size: 10px; }
  tr.alt td { background: #F7F9FD; }
  .center { text-align: center; }
  .footer { margin-top: 18px; text-align: center; font-size: 9px; color: #888; border-top: 1px solid #ddd; padding-top: 8px; }
</style>
</head>
<body>
<div class="page">
  <div class="header">
    <div class="header-left">
      <h1>Hospital Susana López de Valencia E.S.E.</h1>
      <p>Sistema de Gestión de Tecnología Biomédica · NEXA/HSLV</p>
    </div>
    <div class="header-right">
      <strong>Inventario por Servicio</strong><br>
      Generado: ${fecha} · ${hora}
    </div>
  </div>
  <div class="meta-row">
    <div class="meta-item"><label>Servicio</label><span>${_esc(_servicioActual)}</span></div>
    <div class="meta-item"><label>Total Equipos</label><span>${_equiposActuales.length}</span></div>
    <div class="meta-item"><label>Documento</label><span>Inventario de Equipos Biomédicos</span></div>
  </div>
  <table>
    <thead>
      <tr>
        <th style="width:32px;">#</th>
        <th>Nombre del Equipo</th>
        <th>Marca</th>
        <th>Modelo</th>
        <th>N° de Serie</th>
        <th>Sede</th>
      </tr>
    </thead>
    <tbody>${rowsHtml}</tbody>
  </table>
  <div class="footer">
    Hospital Susana López de Valencia E.S.E. — Área de Gestión de Tecnología Biomédica e Infraestructura
  </div>
</div>
</body>
</html>`;

    // Generar PDF usando html2pdf si está disponible
    if (window.html2pdf) {
      const container = document.createElement('div');
      container.innerHTML = html;
      document.body.appendChild(container);

      const nombreArchivo = `Inventario_${_servicioActual.replace(/\s+/g, '_')}_${ahora.getFullYear()}${String(ahora.getMonth()+1).padStart(2,'0')}${String(ahora.getDate()).padStart(2,'0')}.pdf`;

      html2pdf()
        .set({
          margin: 10,
          filename: nombreArchivo,
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: { scale: 2, useCORS: true },
          jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' }
        })
        .from(container.firstChild)
        .save()
        .finally(() => document.body.removeChild(container));
    } else {
      // Fallback: ventana de impresión
      const win = window.open('', '_blank');
      win.document.write(html);
      win.document.close();
      win.onload = () => { win.print(); };
    }
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
