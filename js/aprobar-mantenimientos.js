/* ═══════════════════════════════════════════════════════════════════
   APROBAR MANTENIMIENTOS — Preventivos + Correctivos
   Versión 2.0
   ═══════════════════════════════════════════════════════════════════ */

(function () {
  /* ── Estado global ─────────────────────────────────────── */
  let _allPrev = [];
  let _allCorr = [];
  let _tabActivo = 'prev'; // 'prev' | 'corr'
  let _filtroActivo = 'TODOS'; // 'TODOS' | 'Pendiente' | 'Aprobado' | 'Rechazado'

  /* ── Entrada principal ─────────────────────────────────── */
  window.loadAprobarMantenimientos = async function (force = false) {
    aprobSetLoading(true);
    aprobUpdateStats(null);
    try {
      const res = await axios.get('/.netlify/functions/get-aprobaciones');
      _allPrev = res.data.preventivos || [];
      _allCorr = res.data.correctivos || [];
      aprobRenderTab();
      aprobUpdateStats({ prev: _allPrev, corr: _allCorr });
    } catch (err) {
      const msg = err?.response?.data?.error || err.message || 'Error desconocido';
      aprobShowError(msg);
    } finally {
      aprobSetLoading(false);
    }
  };

  /* ── Cambiar pestaña ────────────────────────────────────── */
  window.aprobSwitchTab = function (tab) {
    _tabActivo = tab;
    _filtroActivo = 'TODOS';
    document.querySelectorAll('.aprob-tab-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.tab === tab);
    });
    document.querySelectorAll('.aprob-filter-chip').forEach(b => {
      b.classList.toggle('active', b.dataset.estado === 'TODOS');
    });
    aprobRenderTab();
  };

  /* ── Cambiar filtro de estado ───────────────────────────── */
  window.aprobFiltrarEstado = function (estado) {
    _filtroActivo = estado;
    document.querySelectorAll('.aprob-filter-chip').forEach(b => {
      b.classList.toggle('active', b.dataset.estado === estado);
    });
    aprobRenderTab();
  };

  /* ── Renderizar tabla según pestaña activa ─────────────── */
  function aprobRenderTab() {
    const lista = _tabActivo === 'prev' ? _allPrev : _allCorr;
    const filtrado = _filtroActivo === 'TODOS'
      ? lista
      : lista.filter(r => (r.fields['Estado de aprobación'] || '') === _filtroActivo);

    const tbody = document.getElementById('aprobTbody');
    const countEl = document.getElementById('aprobCount');
    if (!tbody) return;

    if (!filtrado.length) {
      const tipo = _tabActivo === 'prev' ? 'Preventivos' : 'Correctivos';
      tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:40px;color:#90a4ae;">
        <div style="font-size:40px;margin-bottom:12px;">${_tabActivo === 'prev' ? '🛡️' : '🔧'}</div>
        <div style="font-weight:600;font-size:15px;color:#607d8b;">No hay reportes ${tipo.toLowerCase()} ${_filtroActivo !== 'TODOS' ? '"' + _filtroActivo + '"' : ''}</div>
        <div style="font-size:13px;margin-top:6px;">Los reportes aparecerán aquí cuando se generen desde Mantenimientos.</div>
      </td></tr>`;
      if (countEl) countEl.textContent = '0 registros';
      return;
    }

    if (countEl) countEl.textContent = `${filtrado.length} registro${filtrado.length !== 1 ? 's' : ''}`;

    tbody.innerHTML = filtrado.map(rec => {
      const f = rec.fields;
      const estadoAprobacion = f['Estado de aprobación'] || 'Pendiente';
      const tipo = f['Tipo'] || (_tabActivo === 'prev' ? 'Preventivo' : 'Correctivo');
      const equipo = f['Equipo'] || f['EQUIPO'] || '—';
      const placa = f['Placa'] || f['PLACA'] || '—';
      const tecnico = f['Técnico'] || f['TECNICO'] || '—';
      const fecha = f['Fecha'] || f['FECHA'] || '—';
      const servicio = f['Servicio'] || f['SERVICIO'] || '—';

      const badgeColor = {
        'Pendiente': { bg: '#fff3e0', color: '#e65100', border: '#ffcc80' },
        'Aprobado': { bg: '#e8f5e9', color: '#2e7d32', border: '#a5d6a7' },
        'Rechazado': { bg: '#ffebee', color: '#c62828', border: '#ef9a9a' },
      }[estadoAprobacion] || { bg: '#f5f5f5', color: '#607d8b', border: '#cfd8dc' };

      const tipoBadge = tipo === 'Preventivo'
        ? `<span style="background:#e3f2fd;color:#0d47a1;border:1px solid #90caf9;padding:2px 8px;border-radius:6px;font-size:11px;font-weight:700;">🛡️ PREV</span>`
        : `<span style="background:#fce4ec;color:#c62828;border:1px solid #f48fb1;padding:2px 8px;border-radius:6px;font-size:11px;font-weight:700;">🔧 CORR</span>`;

      const puedeAprobar = estadoAprobacion === 'Pendiente';

      return `<tr style="transition:background 0.15s;" onmouseover="this.style.background='#f8f9fa'" onmouseout="this.style.background=''">
        <td style="padding:12px 14px;font-size:13px;">${tipoBadge}</td>
        <td style="padding:12px 14px;font-weight:600;font-size:13px;">${equipo}</td>
        <td style="padding:12px 14px;font-size:12px;color:#607d8b;">${placa}</td>
        <td style="padding:12px 14px;font-size:13px;">${servicio}</td>
        <td style="padding:12px 14px;font-size:12px;color:#546e7a;">${tecnico}</td>
        <td style="padding:12px 14px;font-size:12px;color:#546e7a;">${fecha}</td>
        <td style="padding:10px 14px;">
          <span style="display:inline-block;padding:3px 10px;border-radius:8px;font-size:11px;font-weight:700;
            background:${badgeColor.bg};color:${badgeColor.color};border:1px solid ${badgeColor.border};">
            ${estadoAprobacion === 'Pendiente' ? '⏳' : estadoAprobacion === 'Aprobado' ? '✅' : '❌'} ${estadoAprobacion}
          </span>
        </td>
        <td style="padding:10px 14px;white-space:nowrap;">
          ${puedeAprobar ? `
            <button onclick="aprobAprobar('${rec.id}','${_tabActivo}')" style="padding:5px 12px;background:linear-gradient(135deg,#2e7d32,#388e3c);color:white;border:none;border-radius:7px;font-size:12px;font-weight:700;cursor:pointer;margin-right:4px;" title="Aprobar">✅ Aprobar</button>
            <button onclick="aprobRechazar('${rec.id}','${_tabActivo}')" style="padding:5px 12px;background:linear-gradient(135deg,#c62828,#d32f2f);color:white;border:none;border-radius:7px;font-size:12px;font-weight:700;cursor:pointer;" title="Rechazar">❌ Rechazar</button>
          ` : `<span style="font-size:12px;color:#90a4ae;font-style:italic;">—</span>`}
        </td>
      </tr>`;
    }).join('');
  }

  /* ── Aprobar registro ──────────────────────────────────── */
  window.aprobAprobar = async function (recordId, tab) {
    if (!confirm('¿Aprobar este mantenimiento?')) return;
    await aprobCambiarEstado(recordId, tab, 'Aprobado');
  };

  /* ── Rechazar registro ─────────────────────────────────── */
  window.aprobRechazar = async function (recordId, tab) {
    const obs = prompt('Motivo de rechazo (opcional):');
    if (obs === null) return; // canceló
    await aprobCambiarEstado(recordId, tab, 'Rechazado', obs);
  };

  /* ── Cambiar estado via Netlify function ───────────────── */
  async function aprobCambiarEstado(recordId, tab, nuevoEstado, observacion = '') {
    const tableName = tab === 'prev' ? 'Mantenimientos Preventivos' : 'Mantenimientos Correctivos';
    try {
      await axios.patch('/.netlify/functions/update-aprobacion', {
        recordId,
        tableName,
        estado: nuevoEstado,
        observacion,
      });

      // Actualizar localmente sin recargar todo
      const lista = tab === 'prev' ? _allPrev : _allCorr;
      const rec = lista.find(r => r.id === recordId);
      if (rec) {
        rec.fields['Estado de aprobación'] = nuevoEstado;
        if (observacion) rec.fields['Observaciones aprobación'] = observacion;
      }

      aprobRenderTab();
      aprobUpdateStats({ prev: _allPrev, corr: _allCorr });

      // Actualizar KPIs del dashboard si está disponible
      if (typeof loadDashboardAprobar === 'function') loadDashboardAprobar();

      aprobToast(nuevoEstado === 'Aprobado' ? '✅ Aprobado correctamente' : '❌ Rechazado correctamente',
        nuevoEstado === 'Aprobado' ? '#2e7d32' : '#c62828');
    } catch (err) {
      const msg = err?.response?.data?.error || err.message || 'Error al actualizar';
      alert('Error: ' + msg);
    }
  }

  /* ── Estadísticas del módulo ───────────────────────────── */
  function aprobUpdateStats(data) {
    const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val ?? '0'; };

    if (!data) {
      ['aprobStatTotalPrev', 'aprobStatPendPrev', 'aprobStatAprobPrev',
        'aprobStatTotalCorr', 'aprobStatPendCorr', 'aprobStatAprobCorr'].forEach(id => set(id, '—'));
      return;
    }

    const countEstado = (arr, est) => arr.filter(r => (r.fields['Estado de aprobación'] || 'Pendiente') === est).length;

    set('aprobStatTotalPrev', data.prev.length);
    set('aprobStatPendPrev', countEstado(data.prev, 'Pendiente'));
    set('aprobStatAprobPrev', countEstado(data.prev, 'Aprobado'));

    set('aprobStatTotalCorr', data.corr.length);
    set('aprobStatPendCorr', countEstado(data.corr, 'Pendiente'));
    set('aprobStatAprobCorr', countEstado(data.corr, 'Aprobado'));

    // También actualizar las cards del header (las que ya existían en la vista)
    set('aprobKpiTotal', data.prev.length + data.corr.length);
    set('aprobKpiPend', countEstado(data.prev, 'Pendiente') + countEstado(data.corr, 'Pendiente'));
    set('aprobKpiAprob', countEstado(data.prev, 'Aprobado') + countEstado(data.corr, 'Aprobado'));
  }

  /* ── Helpers de UI ─────────────────────────────────────── */
  function aprobSetLoading(on) {
    const el = document.getElementById('aprobLoadingOverlay');
    if (el) el.style.display = on ? 'flex' : 'none';
  }

  function aprobShowError(msg) {
    const tbody = document.getElementById('aprobTbody');
    if (tbody) tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:40px;color:#c62828;">
      ⚠️ Error al cargar: ${msg}
    </td></tr>`;
  }

  function aprobToast(msg, color = '#2e7d32') {
    const t = document.createElement('div');
    t.textContent = msg;
    Object.assign(t.style, {
      position: 'fixed', bottom: '24px', right: '24px', background: color,
      color: 'white', padding: '12px 22px', borderRadius: '10px', fontWeight: '700',
      fontSize: '14px', zIndex: '99999', boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
      fontFamily: "'Outfit', sans-serif", transition: 'opacity 0.4s',
    });
    document.body.appendChild(t);
    setTimeout(() => { t.style.opacity = '0'; setTimeout(() => t.remove(), 400); }, 3000);
  }

  /* ── Exponer para el dashboard ─────────────────────────── */
  window.getAprobarStats = function () {
    const countEstado = (arr, est) => arr.filter(r => (r.fields['Estado de aprobación'] || 'Pendiente') === est).length;
    return {
      totalPrev: _allPrev.length,
      pendPrev: countEstado(_allPrev, 'Pendiente'),
      aprobPrev: countEstado(_allPrev, 'Aprobado'),
      totalCorr: _allCorr.length,
      pendCorr: countEstado(_allCorr, 'Pendiente'),
      aprobCorr: countEstado(_allCorr, 'Aprobado'),
    };
  };

})();
