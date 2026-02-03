// js/app.js (extra helpers for Inventario)
// Este bloque define loadInventario global para evitar: "loadInventario is not defined"
// y provee funciones simples de guardar/actualizar usando Netlify Functions.

(function () {
  const __isLocal = ['localhost', '127.0.0.1'].includes(window.location.hostname);
  const API_BASE_URL = (window.__ENV__ && window.__ENV__.API_BASE_URL)
    ? window.__ENV__.API_BASE_URL
    : (__isLocal ? 'http://localhost:9000/.netlify/functions' : '/.netlify/functions');

  // Si ya existe, no lo sobreescribimos
  if (typeof window.loadInventario !== 'function') {
    window.loadInventario = async function () {
      try {
        console.log('Cargando inventario...');
        const resp = await axios.get(`${API_BASE_URL}/inventario?pageSize=50`);
        console.log('Inventario:', resp.data);

        // Si existe un tbody con id inventarioTbody o inventarioBody, lo llenamos
        const tbody = document.getElementById('inventarioTbody') || document.getElementById('inventarioBody');
        if (tbody && resp.data && resp.data.data) {
          tbody.innerHTML = '';
          for (const r of resp.data.data) {
            const f = r.fields || {};
            const tr = document.createElement('tr');
            tr.innerHTML = `
              <td>${f.Item ?? f.ITEM ?? ''}</td>
              <td>${f.Equipo ?? f.EQUIPO ?? ''}</td>
              <td>${f.Marca ?? f.MARCA ?? ''}</td>
              <td>${f.Modelo ?? f.MODELO ?? ''}</td>
              <td>${f.Serie ?? f.SERIE ?? ''}</td>
              <td>${f['Numero de Placa'] ?? f.PLACA ?? ''}</td>
            `;
            tbody.appendChild(tr);
          }
        }
      } catch (e) {
        console.error('Error cargando inventario', e);
      }
    };
  }

  // Guardar (crear)
  if (typeof window.crearInventario !== 'function') {
    window.crearInventario = async function (fields) {
      const resp = await axios.post(`${API_BASE_URL}/inventario`, { fields });
      return resp.data;
    };
  }

  // Actualizar
  if (typeof window.actualizarInventario !== 'function') {
    window.actualizarInventario = async function (id, fields) {
      const resp = await axios.put(`${API_BASE_URL}/inventario`, { id, fields });
      return resp.data;
    };
  }
})();