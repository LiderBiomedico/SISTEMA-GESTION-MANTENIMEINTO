// ============================================================================
// CONNECTION MONITOR - Indicador de conexión con Airtable
// ============================================================================

const ConnectionMonitor = {
  status: 'checking', // checking | connected | disconnected
  lastCheck: null,
  checkInterval: null,
  hasApiKey: false,
  hasBaseId: false,

  init() {
    console.log('🔗 Iniciando monitor de conexión Airtable...');
    this.checkConnection();
    
    // Verificar cada 30 segundos
    this.checkInterval = setInterval(() => {
      this.checkConnection();
    }, 30000);
  },

  async checkConnection() {
    const indicator = document.getElementById('connectionIndicator');
    const dot = indicator?.querySelector('.connection-status-dot');
    const label = indicator?.querySelector('.connection-label');
    const time = document.getElementById('connectionTime');

    // Actualizar UI a "verificando"
    this.updateUI('checking', 'Verificando...');

    try {
      const API_BASE_URL = '/.netlify/functions';
      const url = `${API_BASE_URL}/inventario?debug=1`;
      
      const response = await axios.get(url, {
        timeout: 10000,
        headers: { Authorization: 'Bearer ok' }
      });

      this.lastCheck = new Date();
      
      if (response.data && response.data.ok) {
        this.hasApiKey = response.data.hasApiKey || false;
        this.hasBaseId = response.data.hasBaseId || false;

        if (this.hasApiKey && this.hasBaseId) {
          this.status = 'connected';
          this.updateUI('connected', '✓ Conectado a Airtable');
          console.log('✅ Conexión Airtable exitosa', response.data);
        } else {
          this.status = 'disconnected';
          const missing = [];
          if (!this.hasApiKey) missing.push('API Key');
          if (!this.hasBaseId) missing.push('Base ID');
          this.updateUI('disconnected', `⚠️ Falta: ${missing.join(', ')}`);
          console.warn('⚠️ Configuración incompleta:', { hasApiKey: this.hasApiKey, hasBaseId: this.hasBaseId });
        }
      } else {
        throw new Error('Respuesta inválida del servidor');
      }

    } catch (error) {
      this.status = 'disconnected';
      this.lastCheck = new Date();
      
      const errorMsg = error.response?.data?.error || error.message || 'Error desconocido';
      this.updateUI('disconnected', '✗ Sin conexión');
      
      console.error('❌ Error verificando conexión Airtable:', {
        status: error.response?.status,
        message: errorMsg,
        url: error.config?.url
      });
    }
  },

  updateUI(status, message) {
    // Actualizar indicador principal
    const indicator = document.getElementById('connectionIndicator');
    const dot = indicator?.querySelector('.connection-status-dot');
    const label = indicator?.querySelector('.connection-label');
    const time = document.getElementById('connectionTime');

    if (indicator) {
      indicator.className = `connection-indicator ${status}`;
    }

    if (dot) {
      dot.className = `connection-status-dot ${status}`;
    }

    if (label) {
      label.textContent = message;
    }

    if (time) {
      const now = new Date();
      const timeStr = now.toLocaleTimeString('es-CO', { 
        hour: '2-digit', 
        minute: '2-digit',
        second: '2-digit'
      });
      time.textContent = `Última verificación: ${timeStr}`;
    }

    // Actualizar modal si está abierto
    this.updateModalInfo();
  },

  updateModalInfo() {
    const modal = document.getElementById('connectionModal');
    if (!modal || !modal.classList.contains('active')) return;

    const modalStatus = document.getElementById('modalStatus');
    const modalApiKey = document.getElementById('modalApiKey');
    const modalBaseId = document.getElementById('modalBaseId');
    const modalLastCheck = document.getElementById('modalLastCheck');

    if (modalStatus) {
      modalStatus.className = 'connection-info-value';
      if (this.status === 'connected') {
        modalStatus.textContent = '✓ Conectado';
        modalStatus.classList.add('success');
      } else if (this.status === 'disconnected') {
        modalStatus.textContent = '✗ Desconectado';
        modalStatus.classList.add('error');
      } else {
        modalStatus.textContent = '⏳ Verificando...';
      }
    }

    if (modalApiKey) {
      modalApiKey.className = 'connection-info-value';
      modalApiKey.textContent = this.hasApiKey ? '✓ Configurada' : '✗ No configurada';
      modalApiKey.classList.add(this.hasApiKey ? 'success' : 'error');
    }

    if (modalBaseId) {
      modalBaseId.className = 'connection-info-value';
      modalBaseId.textContent = this.hasBaseId ? '✓ Configurada' : '✗ No configurada';
      modalBaseId.classList.add(this.hasBaseId ? 'success' : 'error');
    }

    if (modalLastCheck && this.lastCheck) {
      modalLastCheck.textContent = this.lastCheck.toLocaleString('es-CO', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
    }
  },

  destroy() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }
};

// ============================================================================
// FUNCIONES GLOBALES PARA MODAL
// ============================================================================

function showConnectionModal() {
  const modal = document.getElementById('connectionModal');
  if (modal) {
    modal.classList.add('active');
    ConnectionMonitor.updateModalInfo();
  }
}

function closeConnectionModal() {
  const modal = document.getElementById('connectionModal');
  if (modal) {
    modal.classList.remove('active');
  }
}

async function testConnection() {
  const btn = document.getElementById('btnTestConnection');
  if (!btn) return;

  const originalText = btn.textContent;
  btn.textContent = '⏳ Probando...';
  btn.disabled = true;

  await ConnectionMonitor.checkConnection();

  setTimeout(() => {
    btn.textContent = originalText;
    btn.disabled = false;
  }, 1000);
}

// Cerrar modal al hacer clic fuera
document.addEventListener('click', (e) => {
  const modal = document.getElementById('connectionModal');
  if (e.target === modal) {
    closeConnectionModal();
  }
});

// ============================================================================
// INICIALIZACIÓN AUTOMÁTICA
// ============================================================================

document.addEventListener('DOMContentLoaded', () => {
  console.log('🚀 Inicializando Connection Monitor...');
  
  // Esperar 500ms para que el DOM esté completamente listo
  setTimeout(() => {
    ConnectionMonitor.init();
  }, 500);
});

// Limpiar al cerrar la página
window.addEventListener('beforeunload', () => {
  ConnectionMonitor.destroy();
});

// Exponer al window para acceso global
window.ConnectionMonitor = ConnectionMonitor;
window.showConnectionModal = showConnectionModal;
window.closeConnectionModal = closeConnectionModal;
window.testConnection = testConnection;
