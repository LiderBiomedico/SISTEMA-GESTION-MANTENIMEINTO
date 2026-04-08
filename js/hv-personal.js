// =============================================================================
// js/hv-personal.js - Módulo HV Personal (Hojas de Vida del Personal)
// Gestiona hojas de vida del personal de mantenimiento por servicio
// =============================================================================

(function () {
  'use strict';

  var API = '/.netlify/functions/hv-personal';
  var UPLOAD_API = '/.netlify/functions/upload-pdf';

  var _state = {
    records: [],
    filteredRecords: [],
    currentOffset: null,
    currentPage: 0,
    searchQuery: '',
    servicioFilter: 'TODOS',
    editId: null,
  };

  // ── Helpers ──
  function esc(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  }

  function getAuthHeader() {
    var token = localStorage.getItem('HSLV_AUTH_TOKEN') || localStorage.getItem('AIRTABLE_TOKEN') || 'ok';
    return { Authorization: 'Bearer ' + token };
  }

  // ── Cargar registros ──
  async function loadHVPersonal(force) {
    var tbody = document.getElementById('hvpTbody');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:20px;color:#607d8b;">⏳ Cargando hojas de vida del personal...</td></tr>';

    try {
      var params = new URLSearchParams({ pageSize: '50' });
      if (_state.currentOffset && !force) params.set('offset', _state.currentOffset);
      var q = (_state.searchQuery || '').trim();
      if (q) params.set('q', q);
      if (_state.servicioFilter && _state.servicioFilter !== 'TODOS') {
        params.set('servicio', _state.servicioFilter);
      }

      var res = await fetch(API + '?' + params, { headers: getAuthHeader() });
      var data = await res.json();
      if (!res.ok || !data.ok) {
        var errMsg = data.error || 'HTTP ' + res.status;
        if (typeof errMsg === 'object') errMsg = errMsg.message || errMsg.type || JSON.stringify(errMsg);
        throw new Error(errMsg);
      }
      _state.records = data.records || [];
      _state.currentOffset = data.offset || null;

      var countEl = document.getElementById('hvpCount');
      if (countEl) countEl.textContent = (_state.records.length) + ' registros';

      renderTable();
      updatePagination();

    } catch (err) {
      console.error('❌ Error cargando HV Personal:', err);
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:20px;color:#c62828;">⚠️ Error: <strong>' + esc(err.message) + '</strong><br><button class="btn btn-primary" onclick="loadHVPersonal(true)" style="margin-top:10px;">🔄 Reintentar</button></td></tr>';
    }
  }

  // ── Renderizar tabla ──
  function renderTable() {
    var tbody = document.getElementById('hvpTbody');
    if (!tbody) return;

    if (!_state.records.length) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:24px;color:#607d8b;">📋 No hay hojas de vida registradas.<br><small>Agrega la primera usando el botón "+ Nueva Hoja de Vida".</small></td></tr>';
      return;
    }

    tbody.innerHTML = _state.records.map(function (r) {
      var f = r.fields || {};
      var nombre = f.Nombre || f.Name || '—';
      var cedula = f['Numero de cedula'] || '—';
      var servicio = f.Servicio || '—';
      var hvArr = f['Hoja de vida'];
      var hvLink = '—';
      if (Array.isArray(hvArr) && hvArr.length > 0) {
        hvLink = '<a href="' + esc(hvArr[0].url) + '" target="_blank" style="color:#1565c0;font-weight:600;text-decoration:none;">📄 Ver PDF</a>';
      }

      var servBadge = '';
      if (servicio === 'BIOMEDICA') servBadge = 'background:#e3f2fd;color:#1565c0;';
      else if (servicio === 'INFRAESTRUCTURA') servBadge = 'background:#fff3e0;color:#e65100;';
      else if (servicio === 'MECANICOS') servBadge = 'background:#e8f5e9;color:#2e7d32;';

      return '<tr>' +
        '<td>' + esc(nombre) + '</td>' +
        '<td style="font-family:\'JetBrains Mono\',monospace;font-size:13px;">' + esc(cedula) + '</td>' +
        '<td><span style="display:inline-block;padding:4px 12px;border-radius:20px;font-size:12px;font-weight:700;' + servBadge + '">' + esc(servicio) + '</span></td>' +
        '<td>' + hvLink + '</td>' +
        '<td>' +
        '  <button class="btn btn-small btn-secondary" onclick="hvpEdit(\'' + r.id + '\')" title="Editar">✏️</button> ' +
        '  <button class="btn btn-small" onclick="hvpDelete(\'' + r.id + '\',\'' + esc(nombre).replace(/'/g, "\\'") + '\')" title="Eliminar" style="color:#c62828;">🗑️</button>' +
        '</td>' +
        '</tr>';
    }).join('');
  }

  function updatePagination() {
    var prev = document.getElementById('hvpPrevBtn');
    var next = document.getElementById('hvpNextBtn');
    if (prev) prev.disabled = (_state.currentPage === 0);
    if (next) next.disabled = !_state.currentOffset;
  }

  // ── Búsqueda ──
  var searchTimer = null;
  function hvpSearch() {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(function () {
      var el = document.getElementById('hvpSearchInput');
      _state.searchQuery = el ? el.value.trim() : '';
      _state.currentOffset = null;
      _state.currentPage = 0;
      loadHVPersonal(true);
    }, 400);
  }

  // ── Filtro por servicio ──
  function hvpFilterServicio(servicio) {
    _state.servicioFilter = servicio;
    _state.currentOffset = null;
    _state.currentPage = 0;

    // Actualizar botones activos
    document.querySelectorAll('.hvp-filter-btn').forEach(function (btn) {
      btn.classList.toggle('active', btn.dataset.servicio === servicio);
    });

    loadHVPersonal(true);
  }

  // ── Paginación ──
  function hvpNextPage() {
    if (!_state.currentOffset) return;
    _state.currentPage++;
    loadHVPersonal();
  }

  function hvpPrevPage() {
    if (_state.currentPage <= 0) return;
    _state.currentPage--;
    _state.currentOffset = null;
    loadHVPersonal(true);
  }

  // ── Abrir modal para nuevo registro ──
  function hvpOpenNew() {
    _state.editId = null;
    var form = document.getElementById('hvpForm');
    if (form) form.reset();
    var title = document.getElementById('hvpModalTitle');
    if (title) title.textContent = '➕ Nueva Hoja de Vida';
    var btn = document.getElementById('hvpSubmitBtn');
    if (btn) btn.textContent = '💾 Guardar';

    var modal = document.getElementById('hvpModal');
    if (modal) { modal.style.display = 'flex'; }
  }

  // ── Editar registro ──
  async function hvpEdit(recordId) {
    hvpOpenNew(); // abre modal limpio
    var title = document.getElementById('hvpModalTitle');
    if (title) title.textContent = '✏️ Editar Hoja de Vida';
    var btn = document.getElementById('hvpSubmitBtn');
    if (btn) { btn.textContent = '⏳ Cargando...'; btn.disabled = true; }

    try {
      var res = await fetch(API + '?id=' + recordId, { headers: getAuthHeader() });
      var data = await res.json();
      if (!data.ok || !data.record) throw new Error('No se pudo cargar el registro');

      var f = data.record.fields || {};
      _state.editId = recordId;

      var form = document.getElementById('hvpForm');
      if (!form) return;

      var nameInput = form.querySelector('[name="Nombre"]');
      if (nameInput) nameInput.value = f.Nombre || '';

      var cedulaInput = form.querySelector('[name="Numero de cedula"]');
      if (cedulaInput) cedulaInput.value = f['Numero de cedula'] || '';

      var servicioSelect = form.querySelector('[name="Servicio"]');
      if (servicioSelect) servicioSelect.value = f.Servicio || '';

    } catch (err) {
      alert('Error al cargar registro: ' + err.message);
    } finally {
      if (btn) { btn.textContent = '💾 Actualizar'; btn.disabled = false; }
    }
  }

  // ── Guardar (crear o actualizar) ──
  async function hvpSubmit(e) {
    e.preventDefault();
    var form = e.target;
    var nombre = (form.querySelector('[name="Nombre"]').value || '').trim();
    var cedula = (form.querySelector('[name="Numero de cedula"]').value || '').trim();
    var servicio = form.querySelector('[name="Servicio"]').value || '';
    var fileInput = form.querySelector('[name="HojaDeVida"]');
    var file = fileInput && fileInput.files ? fileInput.files[0] : null;

    if (!nombre) { alert('El nombre es obligatorio.'); return; }
    if (!servicio) { alert('Selecciona un servicio.'); return; }

    var fields = {
      Nombre: nombre,
      Servicio: servicio,
    };

    // Solo enviar cedula si tiene valor (es campo numérico en Airtable)
    if (cedula) {
      var numCedula = Number(cedula);
      fields['Numero de cedula'] = isNaN(numCedula) ? cedula : numCedula;
    }

    var btn = document.getElementById('hvpSubmitBtn');
    var originalText = btn ? btn.textContent : '';
    if (btn) { btn.disabled = true; btn.textContent = '⏳ Guardando...'; }

    try {
      var isEdit = !!_state.editId;
      var url = API;
      var method = isEdit ? 'PUT' : 'POST';
      var payload = isEdit ? { id: _state.editId, fields: fields } : { fields: fields };

      var res = await fetch(url, {
        method: method,
        headers: { ...getAuthHeader(), 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      var data = await res.json();
      if (!data.ok) {
        var errMsg = data.error || 'Error al guardar';
        if (typeof errMsg === 'object') errMsg = errMsg.message || errMsg.type || JSON.stringify(errMsg);
        throw new Error(errMsg);
      }

      var newRecordId = data.recordId || (data.record && data.record.id) || (_state.editId);

      // Subir PDF si se seleccionó archivo
      if (file && newRecordId) {
        if (file.size > 5 * 1024 * 1024) {
          alert('⚠️ El registro se guardó pero el PDF supera 5 MB y no se adjuntó.');
        } else {
          try {
            var b64 = await fileToBase64(file);
            var uploadRes = await fetch(UPLOAD_API, {
              method: 'POST',
              headers: { ...getAuthHeader(), 'Content-Type': 'application/json' },
              body: JSON.stringify({
                recordId: newRecordId,
                tableName: 'HV personal',
                fieldName: 'Hoja de vida',
                filename: file.name,
                contentType: file.type || 'application/pdf',
                base64: b64,
              }),
            });
            var uploadData = await uploadRes.json();
            if (!uploadData.ok) {
              alert('⚠️ Registro guardado, pero el PDF no se pudo adjuntar: ' + (uploadData.error || 'Error desconocido'));
            }
          } catch (upErr) {
            alert('⚠️ Registro guardado, pero error al subir PDF: ' + upErr.message);
          }
        }
      }

      // Cerrar modal y recargar
      hvpCloseModal();
      form.reset();
      _state.editId = null;
      await loadHVPersonal(true);
      alert(isEdit ? '✅ Registro actualizado correctamente' : '✅ Hoja de vida registrada correctamente');

    } catch (err) {
      console.error('Error guardando HV Personal:', err);
      alert('Error: ' + err.message);
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = originalText; }
    }
  }

  // ── Eliminar ──
  async function hvpDelete(recordId, nombre) {
    if (!confirm('¿Eliminar la hoja de vida de "' + nombre + '"?\nEsta acción no se puede deshacer.')) return;
    try {
      var res = await fetch(API + '?id=' + recordId, { method: 'DELETE', headers: getAuthHeader() });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      _state.currentOffset = null;
      _state.currentPage = 0;
      await loadHVPersonal(true);
    } catch (err) {
      alert('Error al eliminar: ' + err.message);
    }
  }

  // ── Cerrar modal ──
  function hvpCloseModal() {
    var modal = document.getElementById('hvpModal');
    if (modal) modal.style.display = 'none';
    _state.editId = null;
  }

  // ── File to base64 ──
  function fileToBase64(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onerror = function () { reject(new Error('No se pudo leer el archivo.')); };
      reader.onload = function () {
        var res = String(reader.result || '');
        var comma = res.indexOf(',');
        resolve(comma >= 0 ? res.slice(comma + 1) : res);
      };
      reader.readAsDataURL(file);
    });
  }

  // ── Exponer al window ──
  window.loadHVPersonal = loadHVPersonal;
  window.hvpSearch = hvpSearch;
  window.hvpFilterServicio = hvpFilterServicio;
  window.hvpNextPage = hvpNextPage;
  window.hvpPrevPage = hvpPrevPage;
  window.hvpOpenNew = hvpOpenNew;
  window.hvpEdit = hvpEdit;
  window.hvpSubmit = hvpSubmit;
  window.hvpDelete = hvpDelete;
  window.hvpCloseModal = hvpCloseModal;

})();
