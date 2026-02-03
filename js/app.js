// =============================================================================
// js/app.js - HSLV Mantenimiento (Inventario)
// FIX: Guardar "Nuevo Registro" en Airtable via Netlify Function
// - Define: switchModule, loadModuleData, openModal, closeModal
// - Inventario: loadInventario + submit inventarioForm -> POST /.netlify/functions/inventario
// =============================================================================

(() => {
  const __isLocal = ['localhost','127.0.0.1'].includes(window.location.hostname);
  const API_BASE_URL = (window.__ENV__ && window.__ENV__.API_BASE_URL)
    ? window.__ENV__.API_BASE_URL
    : (__isLocal ? 'http://localhost:9000/.netlify/functions' : '/.netlify/functions');

  // ------------------------------
  // Helpers UI
  // ------------------------------
  function qs(id) { return document.getElementById(id); }
  function setText(id, txt) { const el = qs(id); if (el) el.textContent = txt; }
  function toast(msg) { alert(msg); } // simple; puedes reemplazar por toast UI

  // ------------------------------
  // Modal helpers (required by inline onclick)
  // ------------------------------
  window.openModal = function openModal(modalId) {
    const modal = qs(modalId);
    if (!modal) {
      console.warn(`openModal: no existe #${modalId}`);
      return;
    }
    modal.classList.add('active');
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
  };

  window.closeModal = function closeModal(modalId) {
    const modal = qs(modalId);
    if (!modal) return;
    modal.classList.remove('active');
    modal.style.display = 'none';
    document.body.style.overflow = '';
  };

  // Cierra al tocar fondo (si el modal es el overlay)
  document.addEventListener('click', (e) => {
    const t = e.target;
    if (t && t.classList && t.classList.contains('modal')) {
      t.classList.remove('active');
      t.style.display = 'none';
      document.body.style.overflow = '';
    }
  });

  // ------------------------------
  // Navegación
  // ------------------------------
  window.switchModule = function switchModule(moduleName) {
    try {
      document.querySelectorAll('.module').forEach(m => m.classList.remove('active'));
      const moduleEl = qs(moduleName);
      if (moduleEl) moduleEl.classList.add('active');

      document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
      let navEl = null;
      if (typeof event !== 'undefined' && event && event.target && event.target.closest) {
        navEl = event.target.closest('.nav-item');
      }
      if (navEl) navEl.classList.add('active');

      const titles = {
        dashboard: 'Dashboard Ejecutivo',
        inventario: 'Inventario Maestro'
      };
      const titleEl = qs('moduleTitle');
      if (titleEl) titleEl.textContent = titles[moduleName] || moduleName;

      window.loadModuleData(moduleName);
    } catch (err) {
      console.error('switchModule error:', err);
    }
  };

  window.loadModuleData = function loadModuleData(moduleName) {
    console.log(`Cargando datos del módulo: ${moduleName}`);
    try {
      if (moduleName === 'inventario') window.loadInventario();
      if (moduleName === 'dashboard' && typeof window.fetchDashboardData === 'function') window.fetchDashboardData();
    } catch (err) {
      console.error('loadModuleData error:', err);
    }
  };

  // ------------------------------
  // Inventario - GET list
  // ------------------------------
  let invOffset = null;
  const invPageSize = 20;

  async function fetchInventarioPage(offset=null) {
    const params = new URLSearchParams();
    params.set('pageSize', String(invPageSize));
    if (offset) params.set('offset', offset);
    const url = `${API_BASE_URL}/inventario?${params.toString()}`;
    const resp = await axios.get(url);
    return resp.data || {};
  }

  window.inventarioPrevPage = function inventarioPrevPage() {
    // En este template no guardamos historial; solo recarga inicio
    invOffset = null;
    window.loadInventario();
  };

  window.inventarioNextPage = async function inventarioNextPage() {
    if (!invOffset) return;
    await window.loadInventario(invOffset);
  };

  window.loadInventario = async function loadInventario(offset=null) {
    try {
      console.log('Cargando inventario...');
      const payload = await fetchInventarioPage(offset);
      const rows = payload.data || [];
      invOffset = payload.offset || null;

      // badge
      if (qs('inventarioCount')) {
        const count = payload.count ?? rows.length;
        qs('inventarioCount').textContent = `${count} registros`;
      }

      // paging buttons
      const nextBtn = qs('inventarioNextBtn');
      const prevBtn = qs('inventarioPrevBtn');
      if (nextBtn) nextBtn.disabled = !invOffset;
      if (prevBtn) prevBtn.disabled = !offset; // solo habilita si no es primera

      const tbody = qs('inventarioTbody');
      if (!tbody) return;

      tbody.innerHTML = '';
      for (const r of rows) {
        const f = r.fields || {};
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${f.Item ?? f.ITEM ?? ''}</td>
          <td>${f.Equipo ?? f.EQUIPO ?? ''}</td>
          <td>${f.Marca ?? f.MARCA ?? ''}</td>
          <td>${f.Modelo ?? f.MODELO ?? ''}</td>
          <td>${f.Serie ?? f.SERIE ?? ''}</td>
          <td>${f['Numero de Placa'] ?? f.PLACA ?? ''}</td>
          <td>${f.Servicio ?? f.SERVICIO ?? ''}</td>
          <td>${f['Ubicación'] ?? f['UBICACIÓN'] ?? f.UBICACION ?? ''}</td>
          <td>${f['Vida Util'] ?? f['VIDA UTIL'] ?? f['VIDA ÚTIL'] ?? ''}</td>
          <td>${f['Próx. MTTO'] ?? f['PROX. MTTO'] ?? ''}</td>
          <td></td>
        `;
        tbody.appendChild(tr);
      }

    } catch (err) {
      console.error('Error cargando inventario:', err?.response?.data || err);
      const tbody = qs('inventarioTbody');
      if (tbody) {
        tbody.innerHTML = `<tr><td colspan="11" style="text-align:center; color:#888; padding:18px;">
          Error cargando inventario. Revisa AIRTABLE_API_KEY y AIRTABLE_BASE_ID en Netlify.
        </td></tr>`;
      }
    }
  };

  // ------------------------------
  // Inventario - POST create (Guardar)
  // ------------------------------
  function formDataToFields(formEl) {
    const fd = new FormData(formEl);
    const fields = {};
    for (const [k, v] of fd.entries()) {
      const val = (typeof v === 'string') ? v.trim() : v;
      if (val === '' || val === null || typeof val === 'undefined') continue;
      fields[k] = val;
    }

    // MANUAL: si parece URL y el campo en Airtable es Attachment, backend lo convertirá.
    return fields;
  }

  async function postInventario(fields) {
    const url = `${API_BASE_URL}/inventario`;
    const resp = await axios.post(url, { fields });
    return resp.data;
  }

  function disableForm(form, disabled=true) {
    form.querySelectorAll('button, input, select, textarea').forEach(el => {
      el.disabled = disabled;
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    console.log('Sistema de Gestión de Mantenimiento Hospitalario iniciado');

    // Hook inventario form submit
    const invForm = qs('inventarioForm');
    if (invForm) {
      invForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const fields = formDataToFields(invForm);

        try {
          disableForm(invForm, true);
          console.log('Enviando inventario fields:', fields);

          const result = await postInventario(fields);
          console.log('Guardado OK:', result);

          toast('✅ Registro guardado en Airtable');
          window.closeModal('newInventario');
          invForm.reset();

          // recargar tabla
          await window.loadInventario();

        } catch (err) {
          const data = err?.response?.data;
          console.error('❌ Error guardando inventario:', data || err);

          const msg = data?.error || data?.message || 'No se pudo guardar. Revisa consola (Network).';
          toast(`❌ No se pudo guardar: ${msg}`);
        } finally {
          disableForm(invForm, false);
        }
      });
    }

    // Auto-load inventario si está activo al inicio
    if (qs('inventario') && qs('inventario').classList.contains('active')) {
      window.loadInventario();
    }
  });

})();
