// ============================================================================
// MÓDULO MANTENIMIENTOS - HSLV  v3
// Mantenimiento preventivo con protocolo por equipo, cronómetro,
// firma digital, generación PDF y carga a Airtable
// ============================================================================
(function () {
  console.log('[MANT] mantenimientos.js v3 cargando...');
  if (window.__HSLV_MANT_LOADED) { console.log('[MANT] Ya cargado, saltando'); return; }
  window.__HSLV_MANT_LOADED = true;
  console.log('[MANT] Módulo inicializado');

  const BASE = typeof API_BASE_URL !== 'undefined' ? API_BASE_URL : '/.netlify/functions';

  const FIELD_PREV = 'Mantenimientos preventivo';
  const FIELD_CORR = 'Mantenimientos correctivos';
  const FIELD_TERC = 'Mantenimientos preventivo'; // Terceros también van al campo preventivo con prefijo TERC_

  const mtState = window.__HSLV_MT_STATE || (window.__HSLV_MT_STATE = {
    reports: [],
    inventario: [],
    invLoaded: false,
    filterTipo: 'TODOS',
    filterEstado: 'TODOS',
    filterSearch: '',
    timerRunning: false,
    timerStart: null,
    timerElapsed: 0,
    timerInterval: null,
    signaturePads: {},
  });

  function hdr() { try { if (typeof getAuthHeader === 'function') return getAuthHeader(); } catch(e){} return {}; }
  function esc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
  function fmt(v) { if(!v)return''; try{ if(/^\d{4}-\d{2}-\d{2}$/.test(v)){var p=v.split('-');return parseInt(p[2])+'/'+parseInt(p[1])+'/'+p[0];} const d=new Date(v); return isNaN(d)?v:d.toLocaleDateString('es-CO'); }catch(_){return v;} }
  function localDateStr(){ var d=new Date(); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); }
  function localTimeStr(){ var d=new Date(); return String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0'); }
  function setText(id,v){ const el=document.getElementById(id); if(el)el.textContent=v; }
  function getVal(id){ return (document.getElementById(id)||{}).value||''; }

  // ══════════════════════════════════════════════════════════════════════
  // PROTOCOLOS DE MANTENIMIENTO POR TIPO DE EQUIPO
  // ══════════════════════════════════════════════════════════════════════
  const PROTOCOLOS = {
    'regulador_vacio_amvex_c2a': {
      nombre: 'Regulador de Vacío AMVEX Modelo C2A',
      categoria: 'Biomédico',
      codigo: 'SLV-GAT-BIO-RV',
      frecuencia: ['Semestral', 'Anual'],
      condicionesPrevias: [
        'Verifique que el equipo se encuentre limpio, seco y sin evidencia de contaminación visible.',
        'Confirme disponibilidad del equipo de verificación: vacuómetro patrón o analizador de vacío calibrado.',
        'No desarme el regulador ni intervenga componentes internos durante el preventivo rutinario.',
        'Si se evidencian daños, fugas, lectura errática o contaminación interna, retire de servicio y remita a soporte técnico autorizado.',
      ],
      inspeccion: [
        { id: 'iv1', item: 'Carcasa íntegra, sin golpes, grietas ni deformaciones' },
        { id: 'iv2', item: 'Manómetro legible y sin fisuras' },
        { id: 'iv3', item: 'Perilla de regulación con giro uniforme' },
        { id: 'iv4', item: 'Selector de modo en buen estado (OFF / REG / INT si aplica)' },
        { id: 'iv5', item: 'Puertos y conexiones sin obstrucción' },
        { id: 'iv6', item: 'Adaptador mural o conexión de entrada en buen estado' },
        { id: 'iv7', item: 'Mangueras, filtro bacteriano y trampa de rebose en buen estado' },
        { id: 'iv8', item: 'Limpieza externa realizada con detergente suave diluido y secado completo' },
      ],
      pruebasFuncionales: [
        { id: 'pf1', prueba: 'Selector en OFF con línea ocluida', valorEsperado: 'Sin movimiento de aguja / 0', resultado: ['Pasa', 'Falla'] },
        { id: 'pf2', prueba: 'Selector en REG con perilla totalmente antihoraria y línea ocluida', valorEsperado: 'Sin lectura de vacío', resultado: ['Pasa', 'Falla'] },
        { id: 'pf3', prueba: 'Ajuste de vacío estándar para verificación', valorEsperado: '-90 mmHg (-12 kPa)', resultado: ['Pasa', 'Falla'] },
        { id: 'pf4', prueba: 'Estabilidad de lectura con línea ocluida durante 30 s', valorEsperado: 'Estable, sin caída apreciable', resultado: ['Pasa', 'Falla'] },
        { id: 'pf5', prueba: 'Verificación modo intermitente (si aplica al equipo)', valorEsperado: 'Ciclo funcional observado', resultado: ['Aplica', 'N/A'] },
      ],
      estadoFinal: ['Apto para uso', 'Apto con observaciones', 'No apto / retirar de servicio'],
      accionesRealizadas: ['Limpieza externa', 'Cambio de accesorios externos', 'Verificación funcional', 'Remisión a servicio técnico'],
    },
    'monitor_nihon_kohden_csm1501': {
      nombre: 'Monitor de Signos Vitales NIHON KOHDEN CSM-1501 (Life Scope G5)',
      categoria: 'Biomédico',
      codigo: 'SLV-GAT-BIO-MN',
      frecuencia: ['Semestral', 'Anual'],
      condicionesPrevias: [
        'Verifique que el equipo esté apagado y desconectado de la red eléctrica antes de iniciar la inspección física.',
        'Confirme disponibilidad del simulador Fluke ProSim 8 (o equivalente) con certificado de calibración vigente.',
        'Conecte los cables de ECG, sensor SpO2, manguito NIBP y sensor de temperatura al simulador antes de iniciar pruebas.',
        'No desarme el equipo ni intervenga componentes internos durante el preventivo rutinario.',
        'Las intervenciones internas y de servicio avanzado deben ser realizadas por personal autorizado según manual de operación oficial Nihon Kohden.',
        'Si se evidencian daños, errores persistentes o mal funcionamiento, retire de servicio y remita a soporte técnico autorizado.',
      ],
      inspeccion: [
        { id: 'nk1', item: 'Carcasa, pantalla, puertos y conectores sin grietas, deformaciones ni daño visible' },
        { id: 'nk2', item: 'Cable de poder y clavija en buen estado, sin sulfatación o roturas' },
        { id: 'nk3', item: 'Accesorios reutilizables (ECG, SpO2, NIBP, temperatura) íntegros y limpios' },
        { id: 'nk4', item: 'Equipo limpio externamente; sin residuos, derrames o contaminación visible' },
        { id: 'nk5', item: 'Batería instalada sin signos externos de fuga, deformación o sobrecalentamiento' },
        { id: 'nk6', item: 'Etiquetas de identificación, activo fijo y número de serie legibles' },
      ],
      pruebasFuncionales: [
        { id: 'nkpf1', prueba: 'ECG: Ritmo sinusal normal (NSR) — Simulación ProSim 8, derivación II', valorEsperado: '80 BPM (± 1 BPM)', resultado: ['Pasa', 'Falla'] },
        { id: 'nkpf2', prueba: 'ECG: Amplitud de onda — Señal 1 mV pico, derivación II', valorEsperado: '1.0 mV (± 5%)', resultado: ['Pasa', 'Falla'] },
        { id: 'nkpf3', prueba: 'ECG: Detección de arritmia — Fibrilación ventricular (V-Fib)', valorEsperado: 'Alarma V-Fib activa', resultado: ['Pasa', 'Falla'] },
        { id: 'nkpf4', prueba: 'RESP: Frecuencia respiratoria — Simulación impedancia ProSim 8', valorEsperado: '20 RPM (± 1 RPM)', resultado: ['Pasa', 'Falla'] },
        { id: 'nkpf5', prueba: 'SpO2: Saturación — Simulación óptica ProSim 8, sensor conectado', valorEsperado: '98% (± 2%)', resultado: ['Pasa', 'Falla'] },
        { id: 'nkpf6', prueba: 'SpO2: Frecuencia de pulso — Simulación ProSim 8', valorEsperado: '80 BPM (± 2 BPM)', resultado: ['Pasa', 'Falla'] },
        { id: 'nkpf7', prueba: 'NIBP: Presión sistólica — Simulación estática ProSim 8', valorEsperado: '120 mmHg (± 3 mmHg)', resultado: ['Pasa', 'Falla'] },
        { id: 'nkpf8', prueba: 'NIBP: Presión diastólica — Simulación estática ProSim 8', valorEsperado: '80 mmHg (± 3 mmHg)', resultado: ['Pasa', 'Falla'] },
        { id: 'nkpf9', prueba: 'NIBP: Presión media (MAP) — Cálculo automático del monitor', valorEsperado: '93 mmHg (± 3 mmHg)', resultado: ['Pasa', 'Falla'] },
        { id: 'nkpf10', prueba: 'NIBP: Prueba de fuga del manguito — Presión sostenida 30 s', valorEsperado: 'Caída < 6 mmHg en 30 s', resultado: ['Pasa', 'Falla'] },
        { id: 'nkpf11', prueba: 'Temperatura: Canal 1 — Simulación resistiva ProSim 8', valorEsperado: '37.0 °C (± 0.1 °C)', resultado: ['Pasa', 'Falla'] },
        { id: 'nkpf12', prueba: 'Alarmas: Límite superior FC — Configurar alarma 100 BPM, simular 120 BPM', valorEsperado: 'Alarma audible/visual activa', resultado: ['Pasa', 'Falla'] },
        { id: 'nkpf13', prueba: 'Alarmas: Límite inferior SpO2 — Configurar alarma 90%, simular 85%', valorEsperado: 'Alarma audible/visual activa', resultado: ['Pasa', 'Falla'] },
        { id: 'nkpf14', prueba: 'Alarmas: Sensor desconectado — Retirar cable ECG / SpO2', valorEsperado: 'Alarma técnica inmediata', resultado: ['Pasa', 'Falla'] },
      ],
      verificacionBasica: [
        { id: 'nkvb1', item: 'Enciende normalmente y completa autoverificación sin errores técnicos persistentes' },
        { id: 'nkvb2', item: 'La pantalla presenta imagen uniforme, buena visibilidad y respuesta correcta de teclas/panel táctil' },
        { id: 'nkvb3', item: 'Opera con red eléctrica y mantiene funcionamiento al desconectar AC (modo batería)' },
        { id: 'nkvb4', item: 'Fecha, hora y parámetros de configuración básica verificados' },
        { id: 'nkvb5', item: 'Alarma audible y visual funcional; volumen adecuado y reconocimiento de alarma correcto' },
        { id: 'nkvb6', item: 'Detección de sensor desconectado / alarma técnica básica confirmada' },
      ],
      estadoFinal: ['Apto para uso', 'Apto con observaciones', 'No apto / retirar de servicio'],
      accionesRealizadas: ['Limpieza externa', 'Verificación funcional con simulador', 'Cambio de accesorios', 'Calibración de parámetros', 'Remisión a servicio técnico'],
    },
    'desfibrilador_mindray_d6': {
      nombre: 'Desfibrilador Mindray BeneHeart D6',
      categoria: 'Biomédico',
      codigo: 'SLV-GAT-BIO-DF',
      frecuencia: ['Semestral', 'Anual'],
      condicionesPrevias: [
        'Verifique que el equipo esté apagado y desconectado de la red eléctrica antes de iniciar la inspección física.',
        'Confirme disponibilidad del analizador de desfibrilador Fluke Impulse 4000 (o equivalente) con certificado de calibración vigente.',
        'Utilice las paletas internas o parches de desfibrilación del equipo para conectar al analizador Impulse 4000.',
        'No desarme el equipo ni intervenga componentes internos durante el preventivo rutinario.',
        'Asegúrese de que no haya pacientes ni personal en contacto con las paletas durante las pruebas de descarga.',
        'Si se evidencian daños, errores persistentes o mal funcionamiento, retire de servicio y remita a soporte técnico autorizado Mindray.',
      ],
      inspeccion: [
        { id: 'df1', item: 'Carcasa, pantalla y panel frontal sin grietas, deformaciones ni daño visible' },
        { id: 'df2', item: 'Cable de poder, clavija y fusibles en buen estado' },
        { id: 'df3', item: 'Paletas externas e internas sin daño, electrodos limpios y contacto firme' },
        { id: 'df4', item: 'Parches de desfibrilación (fecha de vencimiento vigente)' },
        { id: 'df5', item: 'Cable de ECG y electrodos en buen estado, conexiones firmes' },
        { id: 'df6', item: 'Cable de SpO2 y sensor en buen estado' },
        { id: 'df7', item: 'Batería instalada sin signos de fuga, deformación o sobrecalentamiento' },
        { id: 'df8', item: 'Indicador de carga de batería verificado (nivel adecuado)' },
        { id: 'df9', item: 'Papel de registro térmico disponible y mecanismo de impresión funcional' },
        { id: 'df10', item: 'Etiquetas de identificación, activo fijo y número de serie legibles' },
      ],
      verificacionBasica: [
        { id: 'dfvb1', item: 'Enciende correctamente con AC y en modo batería' },
        { id: 'dfvb2', item: 'Pantalla muestra información clara y sin artefactos' },
        { id: 'dfvb3', item: 'Autotest inicial del equipo pasa sin errores' },
        { id: 'dfvb4', item: 'Selector de modo funcional: Monitor / Desfibrilación / Marcapasos / DEA' },
        { id: 'dfvb5', item: 'Botones de carga, descarga y sincronización responden correctamente' },
        { id: 'dfvb6', item: 'Alarma audible de carga lista funcional' },
        { id: 'dfvb7', item: 'Impresora / registrador térmico funcional' },
        { id: 'dfvb8', item: 'Operación con batería: descarga completa posible sin AC conectado' },
      ],
      pruebasFuncionales: [
        { id: 'dfpf1', prueba: 'Energía entregada 10 J — Carga y descarga en Impulse 4000 (carga interna 50 Ω)', valorEsperado: '10 J (± 15% = 8.5–11.5 J)', resultado: ['Pasa', 'Falla'] },
        { id: 'dfpf2', prueba: 'Energía entregada 50 J — Carga y descarga en Impulse 4000', valorEsperado: '50 J (± 15% = 42.5–57.5 J)', resultado: ['Pasa', 'Falla'] },
        { id: 'dfpf3', prueba: 'Energía entregada 100 J — Carga y descarga en Impulse 4000', valorEsperado: '100 J (± 15% = 85–115 J)', resultado: ['Pasa', 'Falla'] },
        { id: 'dfpf4', prueba: 'Energía entregada 150 J — Carga y descarga en Impulse 4000', valorEsperado: '150 J (± 15% = 127.5–172.5 J)', resultado: ['Pasa', 'Falla'] },
        { id: 'dfpf5', prueba: 'Energía entregada 200 J — Carga y descarga en Impulse 4000', valorEsperado: '200 J (± 15% = 170–230 J)', resultado: ['Pasa', 'Falla'] },
        { id: 'dfpf6', prueba: 'Energía máxima 360 J — Carga y descarga en Impulse 4000', valorEsperado: '360 J (± 15% = 306–414 J)', resultado: ['Pasa', 'Falla'] },
        { id: 'dfpf7', prueba: 'Tiempo de carga a 360 J — Desde inicio hasta "listo" con batería nueva', valorEsperado: '≤ 9 segundos', resultado: ['Pasa', 'Falla'] },
        { id: 'dfpf8', prueba: 'Modo sincronizado — Descarga sincronizada con onda R del ECG simulado', valorEsperado: 'Retardo sync ≤ 60 ms', resultado: ['Pasa', 'Falla'] },
        { id: 'dfpf9', prueba: 'ECG: Ritmo sinusal normal — Simulación Impulse 4000, derivación II', valorEsperado: '80 BPM (± 1 BPM)', resultado: ['Pasa', 'Falla'] },
        { id: 'dfpf10', prueba: 'ECG: Detección de fibrilación ventricular — Señal V-Fib de Impulse 4000', valorEsperado: 'Detección y alarma VF', resultado: ['Pasa', 'Falla'] },
        { id: 'dfpf11', prueba: 'Modo DEA: Análisis de ritmo — V-Fib simulado en Impulse 4000', valorEsperado: 'Recomienda descarga', resultado: ['Pasa', 'Falla'] },
        { id: 'dfpf12', prueba: 'Modo DEA: Análisis de ritmo — NSR simulado en Impulse 4000', valorEsperado: 'No recomienda descarga', resultado: ['Pasa', 'Falla'] },
        { id: 'dfpf13', prueba: 'Marcapasos: Estimulación en modo fijo — Frecuencia y corriente configuradas', valorEsperado: 'Freq: 80 PPM (± 1.5%), Corriente: según config', resultado: ['Pasa', 'Falla'] },
        { id: 'dfpf14', prueba: 'Marcapasos: Captura de pulso — Detección por Impulse 4000', valorEsperado: 'Ancho de pulso 20–40 ms', resultado: ['Pasa', 'Falla'] },
        { id: 'dfpf15', prueba: 'Seguridad: Descarga interna automática — Energía cargada sin descargar por 60 s', valorEsperado: 'Desarme automático (0 J residual)', resultado: ['Pasa', 'Falla'] },
        { id: 'dfpf16', prueba: 'Batería: Autonomía — Mínimo 3 descargas a 360 J con batería cargada', valorEsperado: '≥ 3 descargas a máxima energía', resultado: ['Pasa', 'Falla'] },
      ],
      estadoFinal: ['Apto para uso', 'Apto con observaciones', 'No apto / retirar de servicio'],
      accionesRealizadas: ['Limpieza externa', 'Verificación de energía con analizador', 'Cambio de batería', 'Cambio de paletas/parches', 'Verificación de marcapasos', 'Remisión a servicio técnico'],
    },
    'monitor_nihon_kohden_bsm3562': {
      nombre: 'Monitor de Signos Vitales NIHON KOHDEN BSM-3562 (Life Scope PT)',
      categoria: 'Biomédico',
      codigo: 'SLV-GAT-BIO-MN2',
      frecuencia: ['Semestral', 'Anual'],
      condicionesPrevias: [
        'Verifique que el equipo esté apagado y desconectado de la red eléctrica antes de iniciar la inspección física.',
        'Confirme disponibilidad del simulador Fluke ProSim 8 (o equivalente) con certificado de calibración vigente.',
        'Conecte los cables de ECG, sensor SpO2, manguito NIBP, sensor de temperatura y líneas de IBP/EtCO2 al simulador según aplique.',
        'Verifique disponibilidad de gas de calibración para módulo de CO2 (si el equipo cuenta con capnografía).',
        'No desarme el equipo ni intervenga componentes internos durante el preventivo rutinario.',
        'Las intervenciones internas y de servicio avanzado deben ser realizadas por personal autorizado según manual de operación oficial Nihon Kohden.',
        'Si se evidencian daños, errores persistentes o mal funcionamiento, retire de servicio y remita a soporte técnico autorizado.',
      ],
      inspeccion: [
        { id: 'bsm1', item: 'Carcasa, pantalla táctil, perilla y puertos sin grietas, deformaciones ni daño visible' },
        { id: 'bsm2', item: 'Cable de poder y clavija en buen estado, sin sulfatación o roturas' },
        { id: 'bsm3', item: 'Cable troncal de ECG y derivaciones en buen estado, conectores firmes' },
        { id: 'bsm4', item: 'Sensor de SpO2 (clip/adhesivo) íntegro, ventana óptica limpia' },
        { id: 'bsm5', item: 'Manguito de NIBP y manguera sin fugas, conectores firmes' },
        { id: 'bsm6', item: 'Sensor/sonda de temperatura íntegro y limpio' },
        { id: 'bsm7', item: 'Transductor de presión invasiva (IBP) y línea de presión verificados (si aplica)' },
        { id: 'bsm8', item: 'Línea de muestreo de CO2/EtCO2 y trampa de agua verificadas (si aplica)' },
        { id: 'bsm9', item: 'Batería instalada sin signos de fuga, deformación o sobrecalentamiento' },
        { id: 'bsm10', item: 'Soporte/brazo de montaje estable y seguro' },
        { id: 'bsm11', item: 'Etiquetas de identificación, activo fijo y número de serie legibles' },
        { id: 'bsm12', item: 'Equipo limpio externamente; sin residuos, derrames o contaminación visible' },
      ],
      verificacionBasica: [
        { id: 'bsmvb1', item: 'Enciende normalmente con AC y con batería; completa autoverificación sin errores' },
        { id: 'bsmvb2', item: 'Pantalla táctil presenta imagen uniforme, buena visibilidad y respuesta correcta al tacto' },
        { id: 'bsmvb3', item: 'Perilla de navegación y teclas de función responden correctamente' },
        { id: 'bsmvb4', item: 'Opera con red eléctrica y mantiene funcionamiento al desconectar AC (modo batería)' },
        { id: 'bsmvb5', item: 'Fecha, hora y configuración de parámetros verificados' },
        { id: 'bsmvb6', item: 'Alarma audible y visual funcional; volumen y prioridades configuradas correctamente' },
        { id: 'bsmvb7', item: 'Detección de sensor desconectado / alarma técnica confirmada en todos los canales' },
        { id: 'bsmvb8', item: 'Conectividad de red (si aplica): comunicación con central de monitoreo verificada' },
      ],
      pruebasFuncionales: [
        { id: 'bsmpf1', prueba: 'ECG: Ritmo sinusal normal (NSR) — ProSim 8, derivación II', valorEsperado: '80 BPM (± 1 BPM)', resultado: ['Pasa', 'Falla'] },
        { id: 'bsmpf2', prueba: 'ECG: Amplitud de onda — Señal 1 mV pico, derivación II', valorEsperado: '1.0 mV (± 5%)', resultado: ['Pasa', 'Falla'] },
        { id: 'bsmpf3', prueba: 'ECG: Detección de arritmia — Fibrilación ventricular (V-Fib) ProSim 8', valorEsperado: 'Alarma V-Fib activa', resultado: ['Pasa', 'Falla'] },
        { id: 'bsmpf4', prueba: 'ECG: Detección de arritmia — Taquicardia ventricular (V-Tach) ProSim 8', valorEsperado: 'Alarma V-Tach activa', resultado: ['Pasa', 'Falla'] },
        { id: 'bsmpf5', prueba: 'ECG: Verificación de segmento ST — Simulación ProSim 8', valorEsperado: 'Medición ST estable (± 0.02 mV)', resultado: ['Pasa', 'Falla'] },
        { id: 'bsmpf6', prueba: 'RESP: Frecuencia respiratoria — Impedancia ProSim 8', valorEsperado: '20 RPM (± 1 RPM)', resultado: ['Pasa', 'Falla'] },
        { id: 'bsmpf7', prueba: 'SpO2: Saturación — Simulación óptica ProSim 8', valorEsperado: '98% (± 2%)', resultado: ['Pasa', 'Falla'] },
        { id: 'bsmpf8', prueba: 'SpO2: Frecuencia de pulso — ProSim 8', valorEsperado: '80 BPM (± 2 BPM)', resultado: ['Pasa', 'Falla'] },
        { id: 'bsmpf9', prueba: 'SpO2: Alarma de desaturación — Simular 85% en ProSim 8', valorEsperado: 'Alarma activa (límite 90%)', resultado: ['Pasa', 'Falla'] },
        { id: 'bsmpf10', prueba: 'NIBP: Presión sistólica — Simulación estática ProSim 8', valorEsperado: '120 mmHg (± 3 mmHg)', resultado: ['Pasa', 'Falla'] },
        { id: 'bsmpf11', prueba: 'NIBP: Presión diastólica — Simulación estática ProSim 8', valorEsperado: '80 mmHg (± 3 mmHg)', resultado: ['Pasa', 'Falla'] },
        { id: 'bsmpf12', prueba: 'NIBP: Presión media (MAP) — Cálculo automático', valorEsperado: '93 mmHg (± 3 mmHg)', resultado: ['Pasa', 'Falla'] },
        { id: 'bsmpf13', prueba: 'NIBP: Prueba de fuga del manguito — Presión sostenida 30 s', valorEsperado: 'Caída < 6 mmHg en 30 s', resultado: ['Pasa', 'Falla'] },
        { id: 'bsmpf14', prueba: 'Temperatura: Canal 1 — Simulación resistiva ProSim 8', valorEsperado: '37.0 °C (± 0.1 °C)', resultado: ['Pasa', 'Falla'] },
        { id: 'bsmpf15', prueba: 'IBP: Canal 1 — Presión estática 0 mmHg (calibración de cero)', valorEsperado: '0 mmHg (± 1 mmHg)', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'bsmpf16', prueba: 'IBP: Canal 1 — Presión estática 200 mmHg con columna de agua o simulador', valorEsperado: '200 mmHg (± 4 mmHg)', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'bsmpf17', prueba: 'EtCO2/Capnografía: Lectura con gas patrón o simulación (si aplica)', valorEsperado: 'Valor dentro de ± 2 mmHg del patrón', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'bsmpf18', prueba: 'Alarmas: Límite superior FC — Config 100 BPM, simular 120 BPM', valorEsperado: 'Alarma audible/visual activa', resultado: ['Pasa', 'Falla'] },
        { id: 'bsmpf19', prueba: 'Alarmas: Límite inferior SpO2 — Config 90%, simular 85%', valorEsperado: 'Alarma audible/visual activa', resultado: ['Pasa', 'Falla'] },
        { id: 'bsmpf20', prueba: 'Alarmas: Sensor desconectado — Retirar cable ECG y SpO2', valorEsperado: 'Alarma técnica inmediata', resultado: ['Pasa', 'Falla'] },
      ],
      estadoFinal: ['Apto para uso', 'Apto con observaciones', 'No apto / retirar de servicio'],
      accionesRealizadas: ['Limpieza externa', 'Verificación funcional con simulador', 'Cambio de accesorios', 'Calibración de sensores', 'Verificación IBP/CO2', 'Remisión a servicio técnico'],
    },
    'electrocardiografo_nihon_kohden_ecg2250': {
      nombre: 'Electrocardiógrafo NIHON KOHDEN ECG-2250 (Cardiofax G)',
      categoria: 'Biomédico',
      codigo: 'SLV-GAT-BIO-EG',
      frecuencia: ['Semestral', 'Anual'],
      condicionesPrevias: [
        'Verifique que el equipo esté apagado y desconectado de la red eléctrica antes de iniciar la inspección física.',
        'Confirme disponibilidad del simulador Fluke ProSim 8 (o equivalente) con certificado de calibración vigente.',
        'Conecte el cable de paciente de 10 derivaciones al simulador ProSim 8 en modo ECG de 12 canales.',
        'Verifique disponibilidad de papel térmico compatible (papel cuadriculado ECG de alta resolución).',
        'No desarme el equipo ni intervenga componentes internos durante el preventivo rutinario.',
        'Si se evidencian daños, errores persistentes o degradación en la calidad de trazo, retire de servicio y remita a soporte técnico autorizado Nihon Kohden.',
      ],
      inspeccion: [
        { id: 'ecg1', item: 'Carcasa, pantalla LCD y panel de control sin grietas, deformaciones ni daño visible' },
        { id: 'ecg2', item: 'Cable de poder y clavija en buen estado, sin sulfatación o roturas' },
        { id: 'ecg3', item: 'Cable de paciente de 10 derivaciones íntegro, sin cortes ni conectores sueltos' },
        { id: 'ecg4', item: 'Electrodos de succión (precordiales) y pinzas (extremidades) limpios y funcionales' },
        { id: 'ecg5', item: 'Cabezal de impresión térmica limpio, sin residuos ni rayones' },
        { id: 'ecg6', item: 'Bandeja de papel y mecanismo de alimentación funcionando correctamente' },
        { id: 'ecg7', item: 'Batería interna sin signos de fuga, deformación o sobrecalentamiento' },
        { id: 'ecg8', item: 'Puerto USB / tarjeta SD funcional (almacenamiento de registros)' },
        { id: 'ecg9', item: 'Etiquetas de identificación, activo fijo y número de serie legibles' },
        { id: 'ecg10', item: 'Equipo limpio externamente; sin residuos, gel o contaminación visible' },
      ],
      verificacionBasica: [
        { id: 'ecgvb1', item: 'Enciende correctamente con AC y en modo batería' },
        { id: 'ecgvb2', item: 'Pantalla LCD muestra información clara, fecha y hora correctas' },
        { id: 'ecgvb3', item: 'Teclado/panel táctil responde correctamente a todas las funciones' },
        { id: 'ecgvb4', item: 'Autotest de calibración interna (1 mV) pasa sin errores' },
        { id: 'ecgvb5', item: 'Impresión de prueba con trazo legible y cuadrícula alineada' },
        { id: 'ecgvb6', item: 'Modo automático (adquisición + interpretación + impresión) funcional' },
        { id: 'ecgvb7', item: 'Almacenamiento y recuperación de registros ECG previos verificado' },
        { id: 'ecgvb8', item: 'Indicador de nivel de batería correcto' },
      ],
      pruebasFuncionales: [
        { id: 'ecgpf1', prueba: 'Señal de calibración interna 1 mV — Pulso cuadrado 1 mV del equipo', valorEsperado: '10 mm de deflexión (ganancia 10 mm/mV)', resultado: ['Pasa', 'Falla'] },
        { id: 'ecgpf2', prueba: 'ECG 12 derivaciones: NSR 60 BPM — ProSim 8, todas las derivaciones', valorEsperado: '60 BPM (± 1 BPM), trazo limpio en 12 canales', resultado: ['Pasa', 'Falla'] },
        { id: 'ecgpf3', prueba: 'ECG 12 derivaciones: NSR 80 BPM — ProSim 8', valorEsperado: '80 BPM (± 1 BPM)', resultado: ['Pasa', 'Falla'] },
        { id: 'ecgpf4', prueba: 'ECG 12 derivaciones: NSR 120 BPM — ProSim 8', valorEsperado: '120 BPM (± 1 BPM)', resultado: ['Pasa', 'Falla'] },
        { id: 'ecgpf5', prueba: 'Amplitud de onda: Señal 1 mV en derivación II — ProSim 8', valorEsperado: '10 mm (± 0.5 mm) a ganancia estándar', resultado: ['Pasa', 'Falla'] },
        { id: 'ecgpf6', prueba: 'Amplitud de onda: Señal 2 mV en derivación II — ProSim 8', valorEsperado: '20 mm (± 1 mm) a ganancia estándar', resultado: ['Pasa', 'Falla'] },
        { id: 'ecgpf7', prueba: 'Velocidad de papel 25 mm/s — Medir 5 cuadros grandes = 1 segundo', valorEsperado: '25 mm/s (± 5%)', resultado: ['Pasa', 'Falla'] },
        { id: 'ecgpf8', prueba: 'Velocidad de papel 50 mm/s — Medir 10 cuadros grandes = 1 segundo', valorEsperado: '50 mm/s (± 5%)', resultado: ['Pasa', 'Falla'] },
        { id: 'ecgpf9', prueba: 'Filtro de línea base (0.05 Hz) — Señal con deriva de línea base ProSim 8', valorEsperado: 'Línea base estable, sin deriva visible', resultado: ['Pasa', 'Falla'] },
        { id: 'ecgpf10', prueba: 'Filtro de red 60 Hz — Señal con ruido de red eléctrica ProSim 8', valorEsperado: 'Ruido de 60 Hz eliminado del trazo', resultado: ['Pasa', 'Falla'] },
        { id: 'ecgpf11', prueba: 'Filtro muscular (EMG 25/40 Hz) — Señal con artefacto muscular', valorEsperado: 'Reducción visible de artefacto sin distorsión QRS', resultado: ['Pasa', 'Falla'] },
        { id: 'ecgpf12', prueba: 'Detección de derivación desconectada — Retirar una derivación del simulador', valorEsperado: 'Mensaje de derivación caída en pantalla', resultado: ['Pasa', 'Falla'] },
        { id: 'ecgpf13', prueba: 'Interpretación automática — NSR normal en ProSim 8', valorEsperado: 'Interpretación: "Ritmo sinusal normal" o equivalente', resultado: ['Pasa', 'Falla'] },
        { id: 'ecgpf14', prueba: 'Calidad de impresión — Trazo impreso con todas las derivaciones visibles', valorEsperado: 'Cuadrícula nítida, trazos definidos, sin áreas en blanco', resultado: ['Pasa', 'Falla'] },
        { id: 'ecgpf15', prueba: 'Modo manual vs automático — Comparar trazos del mismo ritmo', valorEsperado: 'Trazos idénticos en ambos modos', resultado: ['Pasa', 'Falla'] },
        { id: 'ecgpf16', prueba: 'Batería: Autonomía — Registros consecutivos hasta agotamiento', valorEsperado: '≥ 100 registros con batería cargada', resultado: ['Pasa', 'Falla'] },
      ],
      estadoFinal: ['Apto para uso', 'Apto con observaciones', 'No apto / retirar de servicio'],
      accionesRealizadas: ['Limpieza externa', 'Limpieza de cabezal térmico', 'Verificación funcional con simulador', 'Cambio de papel térmico', 'Cambio de electrodos', 'Cambio de batería', 'Remisión a servicio técnico'],
    },
    'monitor_fetal_edan_f3': {
      nombre: 'Monitor Fetal EDAN F3',
      categoria: 'Biomédico',
      codigo: 'SLV-GAT-BIO-MF',
      frecuencia: ['Semestral', 'Anual'],
      condicionesPrevias: [
        'Verifique que el equipo esté apagado y desconectado de la red eléctrica antes de iniciar la inspección física.',
        'Confirme disponibilidad del simulador de frecuencia cardíaca fetal (simulador Doppler fetal) con certificado vigente, o en su defecto utilice el modo de autotest del equipo.',
        'Verifique disponibilidad de papel térmico plegado compatible con el EDAN F3 (papel CTG cuadriculado).',
        'No desarme el equipo ni intervenga componentes internos durante el preventivo rutinario.',
        'Los transductores ultrasónicos no deben sumergirse en líquidos; limpiar únicamente con paño húmedo y solución suave.',
        'Si se evidencian daños, errores persistentes o degradación en señal Doppler, retire de servicio y remita a soporte técnico autorizado.',
      ],
      inspeccion: [
        { id: 'mf1', item: 'Carcasa, pantalla LCD y panel de control sin grietas, deformaciones ni daño visible' },
        { id: 'mf2', item: 'Cable de poder y clavija en buen estado, sin sulfatación o roturas' },
        { id: 'mf3', item: 'Transductor ultrasónico FHR (Doppler) íntegro, membrana limpia y sin grietas' },
        { id: 'mf4', item: 'Transductor TOCO (presión uterina) íntegro, membrana flexible y limpia' },
        { id: 'mf5', item: 'Cables de transductores sin cortes, dobleces severos ni conectores dañados' },
        { id: 'mf6', item: 'Cinturones abdominales de sujeción en buen estado, elásticos funcionales' },
        { id: 'mf7', item: 'Cabezal de impresión térmica limpio, sin residuos ni rayones' },
        { id: 'mf8', item: 'Bandeja de papel plegado y mecanismo de alimentación funcionando correctamente' },
        { id: 'mf9', item: 'Batería interna sin signos de fuga, deformación o sobrecalentamiento' },
        { id: 'mf10', item: 'Altavoz de audio Doppler funcional (sonido fetal)' },
        { id: 'mf11', item: 'Conector de marcador de evento (botón de paciente) funcional' },
        { id: 'mf12', item: 'Etiquetas de identificación, activo fijo y número de serie legibles' },
      ],
      verificacionBasica: [
        { id: 'mfvb1', item: 'Enciende correctamente con AC y en modo batería' },
        { id: 'mfvb2', item: 'Pantalla LCD muestra información clara, fecha y hora correctas' },
        { id: 'mfvb3', item: 'Teclas de función responden correctamente (inicio monitoreo, detener, imprimir, volumen)' },
        { id: 'mfvb4', item: 'Autotest del equipo pasa sin errores al encender' },
        { id: 'mfvb5', item: 'Impresión de prueba con cuadrícula legible y velocidad de papel verificada' },
        { id: 'mfvb6', item: 'Control de volumen de audio Doppler funcional (mínimo a máximo)' },
        { id: 'mfvb7', item: 'Indicador de nivel de batería correcto' },
        { id: 'mfvb8', item: 'Modo gemelar (FHR1/FHR2) accesible y funcional (si aplica)' },
      ],
      pruebasFuncionales: [
        { id: 'mfpf1', prueba: 'FHR Canal 1: Detección con simulador Doppler fetal — Frecuencia 140 BPM', valorEsperado: '140 BPM (± 2 BPM)', resultado: ['Pasa', 'Falla'] },
        { id: 'mfpf2', prueba: 'FHR Canal 1: Detección con simulador — Frecuencia 120 BPM', valorEsperado: '120 BPM (± 2 BPM)', resultado: ['Pasa', 'Falla'] },
        { id: 'mfpf3', prueba: 'FHR Canal 1: Detección con simulador — Frecuencia 200 BPM', valorEsperado: '200 BPM (± 2 BPM)', resultado: ['Pasa', 'Falla'] },
        { id: 'mfpf4', prueba: 'FHR Canal 1: Detección con simulador — Frecuencia 60 BPM (confirmación)', valorEsperado: '60 BPM (± 2 BPM)', resultado: ['Pasa', 'Falla'] },
        { id: 'mfpf5', prueba: 'FHR: Audio Doppler — Señal audible clara sin artefactos a volumen medio', valorEsperado: 'Sonido cardíaco fetal claro y nítido', resultado: ['Pasa', 'Falla'] },
        { id: 'mfpf6', prueba: 'FHR Canal 2 (gemelar): Detección con simulador — 140 BPM', valorEsperado: '140 BPM (± 2 BPM)', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'mfpf7', prueba: 'TOCO: Calibración de cero — Transductor en reposo sin presión, ajustar a 0', valorEsperado: 'Línea base 0 unidades (± 5 unidades)', resultado: ['Pasa', 'Falla'] },
        { id: 'mfpf8', prueba: 'TOCO: Respuesta a presión — Aplicar presión manual graduada sobre el transductor', valorEsperado: 'Deflexión proporcional visible en pantalla y registro', resultado: ['Pasa', 'Falla'] },
        { id: 'mfpf9', prueba: 'TOCO: Retorno a línea base — Liberar presión del transductor', valorEsperado: 'Retorno a 0 (± 5 unidades) en < 5 segundos', resultado: ['Pasa', 'Falla'] },
        { id: 'mfpf10', prueba: 'Velocidad de papel 1 cm/min — Medir 1 cm = 1 minuto en registro impreso', valorEsperado: '1 cm/min (± 5%)', resultado: ['Pasa', 'Falla'] },
        { id: 'mfpf11', prueba: 'Velocidad de papel 3 cm/min — Medir 3 cm = 1 minuto en registro impreso', valorEsperado: '3 cm/min (± 5%)', resultado: ['Pasa', 'Falla'] },
        { id: 'mfpf12', prueba: 'Calidad de impresión — Cuadrícula CTG nítida, trazos FHR y TOCO definidos', valorEsperado: 'Cuadrícula completa, trazos sin cortes ni áreas en blanco', resultado: ['Pasa', 'Falla'] },
        { id: 'mfpf13', prueba: 'Marcador de evento — Presionar botón de evento durante monitoreo', valorEsperado: 'Marca visible en el registro impreso', resultado: ['Pasa', 'Falla'] },
        { id: 'mfpf14', prueba: 'Alarma FHR alta — Configurar límite 170 BPM, simular 180 BPM', valorEsperado: 'Alarma audible/visual activa', resultado: ['Pasa', 'Falla'] },
        { id: 'mfpf15', prueba: 'Alarma FHR baja — Configurar límite 110 BPM, simular 100 BPM', valorEsperado: 'Alarma audible/visual activa', resultado: ['Pasa', 'Falla'] },
        { id: 'mfpf16', prueba: 'Alarma pérdida de señal — Retirar transductor FHR del simulador', valorEsperado: 'Alarma de pérdida de señal activa', resultado: ['Pasa', 'Falla'] },
        { id: 'mfpf17', prueba: 'Batería: Autonomía — Monitoreo continuo con impresión hasta agotamiento', valorEsperado: '≥ 2 horas de monitoreo continuo', resultado: ['Pasa', 'Falla'] },
      ],
      estadoFinal: ['Apto para uso', 'Apto con observaciones', 'No apto / retirar de servicio'],
      accionesRealizadas: ['Limpieza externa', 'Limpieza de transductores', 'Limpieza de cabezal térmico', 'Verificación con simulador fetal', 'Cambio de papel CTG', 'Cambio de cinturones', 'Cambio de batería', 'Remisión a servicio técnico'],
    },
    'calentamiento_covidien_warmtouch': {
      nombre: 'Unidad de Calentamiento COVIDIEN WarmTouch',
      categoria: 'Biomédico',
      codigo: 'SLV-GAT-BIO-UC',
      frecuencia: ['Semestral', 'Anual'],
      condicionesPrevias: [
        'Verifique que el equipo esté apagado y desconectado de la red eléctrica antes de iniciar la inspección física.',
        'Confirme disponibilidad de termómetro digital calibrado (rango 30–50 °C) con certificado vigente.',
        'Confirme disponibilidad de manta de calentamiento compatible (manta desechable o reutilizable WarmTouch).',
        'Permita que el equipo alcance temperatura ambiente antes de las mediciones iniciales.',
        'No obstruya las entradas o salidas de aire durante las pruebas de funcionamiento.',
        'Si se evidencian daños, olores a quemado, ruidos anormales o errores persistentes, retire de servicio y remita a soporte técnico autorizado.',
      ],
      inspeccion: [
        { id: 'wt1', item: 'Carcasa y estructura exterior sin grietas, deformaciones ni daño visible' },
        { id: 'wt2', item: 'Cable de poder y clavija en buen estado, sin sulfatación, cortes o roturas' },
        { id: 'wt3', item: 'Manguera de distribución de aire íntegra, sin perforaciones, dobleces ni obstrucciones' },
        { id: 'wt4', item: 'Conector de manguera a la unidad firme y sin fugas de aire' },
        { id: 'wt5', item: 'Filtro de entrada de aire limpio y sin obstrucción (verificar/reemplazar si es necesario)' },
        { id: 'wt6', item: 'Panel de control y perilla/selector de temperatura sin daño, con marcas legibles' },
        { id: 'wt7', item: 'Indicadores LED / pantalla funcionales' },
        { id: 'wt8', item: 'Ruedas de transporte (si aplica) funcionales y con frenos operativos' },
        { id: 'wt9', item: 'Sin residuos, derrames o contaminación visible en el interior accesible' },
        { id: 'wt10', item: 'Etiquetas de identificación, activo fijo y número de serie legibles' },
      ],
      verificacionBasica: [
        { id: 'wtvb1', item: 'Enciende correctamente y realiza autotest sin errores' },
        { id: 'wtvb2', item: 'Ventilador/turbina arranca y mantiene flujo de aire constante' },
        { id: 'wtvb3', item: 'No se perciben ruidos anormales, vibraciones excesivas ni olores a quemado' },
        { id: 'wtvb4', item: 'Selector de temperatura responde correctamente en todos los niveles (Low / Medium / High)' },
        { id: 'wtvb5', item: 'Indicador de modo de operación (calentamiento activo) visible en pantalla/LED' },
        { id: 'wtvb6', item: 'Flujo de aire se distribuye uniformemente a través de la manta conectada' },
      ],
      pruebasFuncionales: [
        { id: 'wtpf1', prueba: 'Temperatura modo LOW — Medir con termómetro calibrado en salida de manguera', valorEsperado: '32 °C (± 2 °C)', resultado: ['Pasa', 'Falla'] },
        { id: 'wtpf2', prueba: 'Temperatura modo MEDIUM — Medir con termómetro calibrado en salida de manguera', valorEsperado: '38 °C (± 2 °C)', resultado: ['Pasa', 'Falla'] },
        { id: 'wtpf3', prueba: 'Temperatura modo HIGH — Medir con termómetro calibrado en salida de manguera', valorEsperado: '43 °C (± 2 °C)', resultado: ['Pasa', 'Falla'] },
        { id: 'wtpf4', prueba: 'Modo BOOST/Ambient Cool — Flujo de aire sin calentamiento', valorEsperado: 'Temperatura cercana a ambiente (± 3 °C)', resultado: ['Pasa', 'Falla'] },
        { id: 'wtpf5', prueba: 'Tiempo de calentamiento — Desde encendido hasta alcanzar temperatura HIGH', valorEsperado: '≤ 5 minutos para alcanzar 43 °C', resultado: ['Pasa', 'Falla'] },
        { id: 'wtpf6', prueba: 'Estabilidad de temperatura — Mantener modo MEDIUM durante 10 minutos', valorEsperado: 'Variación ≤ ± 1.5 °C durante 10 min', resultado: ['Pasa', 'Falla'] },
        { id: 'wtpf7', prueba: 'Alarma de sobretemperatura — Verificar activación si temperatura > 44 °C', valorEsperado: 'Alarma activa y corte de calentamiento automático', resultado: ['Pasa', 'Falla'] },
        { id: 'wtpf8', prueba: 'Alarma de manguera desconectada — Retirar manguera durante operación', valorEsperado: 'Alarma audible/visual y reducción de potencia', resultado: ['Pasa', 'Falla'] },
        { id: 'wtpf9', prueba: 'Alarma de flujo de aire bloqueado — Obstruir parcialmente salida de manguera', valorEsperado: 'Alarma de obstrucción activa', resultado: ['Pasa', 'Falla'] },
        { id: 'wtpf10', prueba: 'Uniformidad de distribución de aire — Verificar temperatura en 3 zonas de la manta', valorEsperado: 'Diferencia ≤ 3 °C entre zonas', resultado: ['Pasa', 'Falla'] },
        { id: 'wtpf11', prueba: 'Ruido de operación — Medir con sonómetro o evaluar subjetivamente', valorEsperado: '≤ 55 dB a 1 metro de distancia', resultado: ['Pasa', 'Falla'] },
        { id: 'wtpf12', prueba: 'Apagado de seguridad — Verificar apagado automático por falla térmica simulada', valorEsperado: 'Equipo se apaga y muestra código de error', resultado: ['Pasa', 'Falla'] },
      ],
      estadoFinal: ['Apto para uso', 'Apto con observaciones', 'No apto / retirar de servicio'],
      accionesRealizadas: ['Limpieza externa', 'Limpieza/cambio de filtro de aire', 'Verificación de temperatura con termómetro calibrado', 'Verificación de alarmas', 'Inspección de manguera y conexiones', 'Remisión a servicio técnico'],
    },
  };

  // ── INIT ──────────────────────────────────────────────────────────────
  async function loadMantenimientosModule(force) {
    const body = document.getElementById('mantBody');
    if (!body) return;
    body.innerHTML = '<div class="mt-loading"><div class="mt-spinner"></div><p>Cargando inventario...</p></div>';
    if (!mtState.invLoaded || force) {
      try {
        let inv=[], ioff=null;
        do {
          const p = new URLSearchParams({pageSize:'100'}); if(ioff) p.set('offset',ioff);
          const r = await axios.get(BASE+'/inventario?'+p, {headers:hdr()});
          const d = r.data||{};
          inv = inv.concat(d.records||d.data||[]);
          ioff = d.offset||null;
        } while(ioff);
        mtState.inventario = inv;
        mtState.invLoaded = true;
        extractReportsFromInventario(inv);
      } catch(err) {
        body.innerHTML = '<div style="text-align:center;padding:40px;color:#c62828">⚠️ Error al cargar el inventario<br><small>'+esc((err&&err.message)||'')+'</small><br><button class="btn btn-primary" style="margin-top:12px" onclick="loadMantenimientosModule(true)">🔄 Reintentar</button></div>';
        return;
      }
    }
    updateStats();
    renderList();
  }

  function extractReportsFromInventario(inv) {
    mtState.reports = [];
    inv.forEach(function(rec) {
      var f = rec.fields||{};
      var equipo = f['Equipo']||f['EQUIPO']||'';
      var placa  = f['Numero de Placa']||f['PLACA']||'';
      var servicio = f['Servicio']||f['SERVICIO']||'';
      (f[FIELD_PREV]||[]).forEach(function(att) {
        var fn = att.filename||att.name||'reporte.pdf';
        var esTercero = fn.toUpperCase().startsWith('TERC_');
        mtState.reports.push({ id:att.id||att.url, tipo: esTercero ? 'Tercero' : 'Preventivo', equipo:equipo, placa:placa, servicio:servicio, equipoId:rec.id, filename:fn, url:att.url, fecha:extractDateFromFilename(fn), estado:extractEstadoFromFilename(fn), size:att.size });
      });
      (f[FIELD_CORR]||[]).forEach(function(att) {
        mtState.reports.push({ id:att.id||att.url, tipo:'Correctivo', equipo:equipo, placa:placa, servicio:servicio, equipoId:rec.id, filename:att.filename||att.name||'reporte.pdf', url:att.url, fecha:extractDateFromFilename(att.filename||''), estado:extractEstadoFromFilename(att.filename||''), size:att.size });
      });
    });
    mtState.reports.sort(function(a,b){ return (b.fecha||'').localeCompare(a.fecha||''); });
  }

  function extractDateFromFilename(fn) { var m=fn.match(/(\d{4}-\d{2}-\d{2})/); return m?m[1]:''; }
  function extractEstadoFromFilename(fn) {
    if(/completado/i.test(fn)) return 'Completado';
    if(/en.?proceso/i.test(fn)) return 'En Proceso';
    if(/pendiente/i.test(fn)) return 'Pendiente';
    return 'Completado';
  }

  // ── STATS ─────────────────────────────────────────────────────────────
  function updateStats() {
    var all=mtState.reports;
    setText('mtStatTotal', all.length);
    setText('mtStatPrev', all.filter(function(r){return r.tipo==='Preventivo'}).length);
    setText('mtStatCorr', all.filter(function(r){return r.tipo==='Correctivo'}).length);
    setText('mtStatTerc', all.filter(function(r){return r.tipo==='Tercero'}).length);
    setText('mtStatEquipos', new Set(all.map(function(r){return r.equipoId})).size);
    setText('mtStatInv', mtState.inventario.length);
  }

  // ── RENDER LIST ───────────────────────────────────────────────────────
  function renderList() {
    var body = document.getElementById('mantBody');
    if (!body) return;
    var q = mtState.filterSearch.toLowerCase();
    var filtered = mtState.reports.filter(function(r) {
      if (mtState.filterTipo !== 'TODOS' && r.tipo !== mtState.filterTipo) return false;
      if (mtState.filterEstado !== 'TODOS' && r.estado !== mtState.filterEstado) return false;
      if (q && !r.equipo.toLowerCase().includes(q) && !r.placa.toLowerCase().includes(q) && !r.servicio.toLowerCase().includes(q) && !r.filename.toLowerCase().includes(q) && !(r.empresa||'').toLowerCase().includes(q)) return false;
      return true;
    });
    setText('mtCount', filtered.length+' reporte'+(filtered.length!==1?'s':''));
    if (!filtered.length) {
      body.innerHTML = '<div style="text-align:center;padding:60px;color:#90a4ae"><div style="font-size:48px;opacity:.4">🔧</div><div style="font-size:16px;font-weight:700;color:#546e7a;margin-top:12px">Sin reportes registrados</div><div style="font-size:13px;margin-top:6px;color:#90a4ae">Usa los botones para registrar un mantenimiento preventivo o correctivo.</div></div>';
      return;
    }
    var rows = filtered.map(function(r) {
      var tipoBadge = r.tipo==='Preventivo' ? '<span class="mt-badge mt-badge-prev">🛡️ Preventivo</span>' : r.tipo==='Tercero' ? '<span class="mt-badge" style="background:#e8f5e9;color:#1b5e20;border:1.5px solid #81c784;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:700;">🏢 Tercero</span>' : '<span class="mt-badge mt-badge-corr">🔧 Correctivo</span>';
      var sizeKB = r.size ? Math.round(r.size/1024)+' KB' : '';
      var empresaRow = r.tipo==='Tercero' && r.empresa ? '<div style="font-size:11px;color:#2e7d32;font-weight:600;">🏢 '+esc(r.empresa)+'</div>' : '';
      return '<tr class="mt-row"><td class="mt-td">'+tipoBadge+'</td><td class="mt-td"><div class="mt-eq-name">'+esc(r.equipo)+'</div><div class="mt-eq-sub">'+esc(r.placa)+'</div>'+empresaRow+'</td><td class="mt-td">'+esc(r.servicio)+'</td><td class="mt-td">'+esc(fmt(r.fecha)||'—')+'</td><td class="mt-td" style="font-size:11px;color:#78909c;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="'+esc(r.filename)+'">'+esc(r.filename)+'</td><td class="mt-td" style="font-size:11px;color:#90a4ae">'+sizeKB+'</td><td class="mt-td mt-actions">'+(r.url?'<a href="'+esc(r.url)+'" target="_blank" class="mt-btn-icon" title="Descargar/Ver PDF">📄</a>':'')+'</td></tr>';
    }).join('');
    body.innerHTML = '<div class="mt-table-wrap"><table class="mt-table"><thead><tr><th>TIPO</th><th>EQUIPO / PLACA</th><th>SERVICIO</th><th>FECHA</th><th>ARCHIVO</th><th>TAMAÑO</th><th>VER</th></tr></thead><tbody>'+rows+'</tbody></table></div><div style="padding:10px 16px;font-size:12px;color:#90a4ae;background:white;border-radius:0 0 12px 12px;border-top:1px solid #eceff1">Los reportes se almacenan como PDF en Airtable › Inventario › '+FIELD_PREV+' / '+FIELD_CORR+'</div>';
  }

  window.mtRenderList = renderList; // expuesto para modal de terceros
  window.mtSearch = function(){ mtState.filterSearch=(document.getElementById('mtSearchInput')||{}).value||''; renderList(); };
  window.mtFilterTipo = function(v){
    mtState.filterTipo=v;
    document.querySelectorAll('.mt-filter-btn').forEach(function(b){b.classList.remove('active')});
    var btn = document.querySelector('.mt-filter-btn[data-tipo="'+v+'"]');
    if(btn) btn.classList.add('active');
    renderList();
  };
  window.mtFilterEstado = function(v) { mtState.filterEstado = v || 'TODOS'; renderList(); };

  // ══════════════════════════════════════════════════════════════════════
  // ABRIR FORMULARIO
  // ══════════════════════════════════════════════════════════════════════
  window.openMantForm = function(tipo) {
    console.log('[MANT] openMantForm llamado con tipo:', tipo);
    try {
      var modal = document.getElementById('mantFormModal');
      if (!modal) { console.error('[MANT] Modal mantFormModal no encontrado'); return; }
      var isPrev = tipo==='prev';
      stopTimer();
      mtState.timerElapsed = 0;
      mtState.timerStart = null;
      mtState.photos = {};

      var titleEl = document.getElementById('mantFormTitle');
      var tipoEl = document.getElementById('mantFormTipoHidden');
      var bodyEl = document.getElementById('mantFormBody');

      if (titleEl) titleEl.textContent = isPrev ? '🛡️ Registrar Mantenimiento Preventivo' : '🔧 Registrar Mantenimiento Correctivo';
      if (tipoEl) tipoEl.value = isPrev ? 'Preventivo' : 'Correctivo';

      if (isPrev) {
        console.log('[MANT] Construyendo selector de protocolo...');
        if (bodyEl) bodyEl.innerHTML = buildProtocolSelectorHTML();
        console.log('[MANT] Selector de protocolo renderizado');
      } else {
        if (bodyEl) bodyEl.innerHTML = buildFormHTML(false);
        loadInvSelect();
        if (!mtState.invLoaded || mtState.inventario.length === 0) loadInventarioForForm();
      }

      modal.style.display = 'flex';
      modal.style.pointerEvents = 'auto';
      requestAnimationFrame(function() { 
        modal.classList.add('active'); 
        modal.style.opacity = '1';
      });
      console.log('[MANT] Modal abierto correctamente');
    } catch(e) {
      console.error('[MANT] Error en openMantForm:', e);
    }
  };

  // ── SELECTOR DE PROTOCOLO ─────────────────────────────────────────────
  function buildProtocolSelectorHTML() {
    var allCards = Object.keys(PROTOCOLOS).map(function(key) {
      var proto = PROTOCOLOS[key];
      var catColor = proto.categoria === 'Biomédico' ? '#1565c0' : proto.categoria === 'Mecánico' ? '#e65100' : '#2e7d32';
      var catIcon = proto.categoria === 'Biomédico' ? '🏥' : proto.categoria === 'Mecánico' ? '⚙️' : '🏗️';
      return '<div class="mf-protocol-card" data-proto-nombre="'+esc(proto.nombre.toLowerCase())+'" data-proto-cat="'+esc(proto.categoria.toLowerCase())+'" data-proto-cod="'+esc(proto.codigo.toLowerCase())+'" onclick="selectProtocol(\''+key+'\')" style="cursor:pointer"><div style="display:flex;align-items:center;gap:10px;margin-bottom:8px"><span style="font-size:28px">'+catIcon+'</span><div><div style="font-weight:800;font-size:14px;color:#0a1628">'+esc(proto.nombre)+'</div><span style="display:inline-block;padding:2px 10px;border-radius:12px;font-size:10px;font-weight:700;background:'+catColor+'22;color:'+catColor+';margin-top:4px">'+esc(proto.categoria)+'</span></div></div><div style="font-size:12px;color:#607d8b;margin-top:4px">Código: <strong>'+esc(proto.codigo)+'</strong> · Frecuencia: '+proto.frecuencia.join(' / ')+'</div><div style="font-size:11px;color:#90a4ae;margin-top:6px">'+proto.inspeccion.length+' ítems de inspección · '+proto.pruebasFuncionales.length+' pruebas funcionales</div></div>';
    }).join('');
    return '<div style="padding:10px 0">'
      + '<div style="font-size:15px;font-weight:700;color:#0a1628;margin-bottom:6px">Seleccione el protocolo de mantenimiento</div>'
      + '<div style="font-size:12px;color:#78909c;margin-bottom:12px">Cada tipo de equipo tiene su protocolo de inspección y verificación funcional específico.</div>'
      + '<div style="position:relative;margin-bottom:16px">'
      +   '<input id="protoSearch" type="text" placeholder="🔍  Buscar protocolo por nombre o categoría..." oninput="filterProtocolCards(this.value)" style="width:100%;padding:10px 14px 10px 38px;border:1.5px solid #90caf9;border-radius:10px;font-size:13px;font-family:Outfit,sans-serif;outline:none;box-sizing:border-box;background:#f0f7ff;">'
      +   '<span style="position:absolute;left:12px;top:50%;transform:translateY(-50%);font-size:16px;pointer-events:none;">🔍</span>'
      + '</div>'
      + '<div id="protoGrid" class="mf-protocol-grid">'+allCards+'</div>'
      + '<div id="protoEmpty" style="display:none;text-align:center;padding:30px;color:#90a4ae;font-size:13px;">Sin resultados. Intente con otra búsqueda.</div>'
      + '</div>';
  }

  window.filterProtocolCards = function(q) {
    var term = (q||'').toLowerCase().trim();
    var cards = document.querySelectorAll('#protoGrid .mf-protocol-card');
    var visible = 0;
    cards.forEach(function(card) {
      var nombre = card.dataset.protoNombre || '';
      var cat = card.dataset.protoCat || '';
      var cod = card.dataset.protoCod || '';
      var show = !term || nombre.includes(term) || cat.includes(term) || cod.includes(term);
      card.style.display = show ? '' : 'none';
      if (show) visible++;
    });
    var emptyEl = document.getElementById('protoEmpty');
    if (emptyEl) emptyEl.style.display = visible === 0 ? 'block' : 'none';
  };

  window.selectProtocol = function(protocolKey) {
    var proto = PROTOCOLOS[protocolKey];
    if (!proto) return;
    document.getElementById('mantFormBody').innerHTML = buildPrevProtocolFormHTML(protocolKey, proto);
    loadInvSelect();
    if (!mtState.invLoaded || mtState.inventario.length === 0) loadInventarioForForm();
    setTimeout(function() { initSignaturePads(); }, 300);
  };

  // ══════════════════════════════════════════════════════════════════════
  // FORMULARIO PREVENTIVO CON PROTOCOLO COMPLETO
  // ══════════════════════════════════════════════════════════════════════
  function buildPrevProtocolFormHTML(protocolKey, proto) {
    var color = '#1565c0';
    var inspeccionRows = proto.inspeccion.map(function(item, i) {
      return '<tr><td style="text-align:center;font-weight:700;color:#546e7a;width:40px">'+(i+1)+'</td><td style="font-size:12px;color:#263238;padding:8px 10px">'+esc(item.item)+'</td><td style="text-align:center;width:100px"><div style="display:flex;gap:6px;justify-content:center"><label class="mf-check-label"><input type="radio" name="insp_'+item.id+'" value="Si" class="mf-radio-input"><span class="mf-check-si">Sí</span></label><label class="mf-check-label"><input type="radio" name="insp_'+item.id+'" value="No" class="mf-radio-input"><span class="mf-check-no">No</span></label></div></td><td style="width:180px"><input type="text" class="mf-input mf-obs-input" id="obs_'+item.id+'" placeholder="Observaciones..." style="font-size:11px;padding:5px 8px"></td></tr>';
    }).join('');

    var pruebasRows = proto.pruebasFuncionales.map(function(pf, i) {
      var resButtons = pf.resultado.map(function(r) {
        return '<label class="mf-check-label"><input type="radio" name="pf_'+pf.id+'" value="'+r+'" class="mf-radio-input"><span class="mf-check-'+(r==='Pasa'||r==='Aplica'?'si':'no')+'">'+r+'</span></label>';
      }).join('');
      return '<tr><td style="text-align:center;font-weight:700;color:#546e7a;width:40px">'+(i+1)+'</td><td style="font-size:12px;color:#263238;padding:8px 10px">'+esc(pf.prueba)+'</td><td style="font-size:11px;color:#607d8b;text-align:center">'+esc(pf.valorEsperado)+'</td><td style="width:120px"><input type="text" class="mf-input" id="medido_'+pf.id+'" placeholder="Valor medido" style="font-size:11px;padding:5px 8px"></td><td style="text-align:center;width:110px"><div style="display:flex;gap:4px;justify-content:center">'+resButtons+'</div></td><td style="width:140px"><input type="text" class="mf-input mf-obs-input" id="pfobs_'+pf.id+'" placeholder="Obs..." style="font-size:11px;padding:5px 8px"></td></tr>';
    }).join('');

    var estadoOptions = proto.estadoFinal.map(function(e) {
      var icon = e === 'Apto para uso' ? '✅' : e === 'Apto con observaciones' ? '⚠️' : '❌';
      return '<label class="mf-radio-card"><input type="radio" name="estado_final" value="'+e+'"><span class="mf-radio-card-label">'+icon+' '+e+'</span></label>';
    }).join('');

    var accionesChecks = proto.accionesRealizadas.map(function(a) {
      return '<label class="mf-checkbox-card"><input type="checkbox" name="acciones_realizadas" value="'+a+'"><span class="mf-checkbox-card-label">'+a+'</span></label>';
    }).join('');

    var frecOptions = proto.frecuencia.map(function(f) { return '<option value="'+f+'">'+f+'</option>'; }).join('') + '<option value="Otra">Otra</option>';

    var condList = proto.condicionesPrevias.map(function(c) { return '<li style="font-size:12px;color:#37474f;line-height:1.5">'+esc(c)+'</li>'; }).join('');

    return '<input type="hidden" id="mfProtocolKey" value="'+protocolKey+'">'

    + '<div class="mf-proto-header"><div style="display:flex;align-items:center;gap:12px"><span style="font-size:32px">🏥</span><div><div style="font-weight:800;font-size:16px;color:#0a1628">'+esc(proto.nombre)+'</div><div style="font-size:12px;color:#607d8b;margin-top:2px">Código: '+esc(proto.codigo)+' · Categoría: '+esc(proto.categoria)+'</div></div></div></div>'

    + '<div class="mf-section-title" style="background:'+color+'">🏥 DATOS DEL EQUIPO</div>'
    + '<div class="mf-row"><div class="mf-group mf-full"><label class="mf-label">Equipo del Inventario *</label><select id="mfEquipoSelect" class="mf-select" style="display:none"><option value="">Cargando...</option></select><input type="hidden" id="mfEquipoId"><div id="mfEquipoSearchWrap" style="background:#f0f7ff;border:1.5px solid #90caf9;border-radius:12px;padding:14px;margin-top:6px;"><div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px;"><div><label style="font-size:11px;font-weight:700;color:#1565c0;text-transform:uppercase;letter-spacing:.4px;display:block;margin-bottom:4px;">📋 Nombre / Equipo</label><input id="mfSrchNombre" type="text" class="mf-input" placeholder="Ej: Monitor, Desfibrilador..." oninput="onInvSearchMulti()" autocomplete="off" style="background:white;"></div><div><label style="font-size:11px;font-weight:700;color:#1565c0;text-transform:uppercase;letter-spacing:.4px;display:block;margin-bottom:4px;">🏷️ Marca</label><input id="mfSrchMarca" type="text" class="mf-input" placeholder="Ej: Nihon Kohden, Mindray..." oninput="onInvSearchMulti()" autocomplete="off" style="background:white;"></div></div><div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px;"><div><label style="font-size:11px;font-weight:700;color:#1565c0;text-transform:uppercase;letter-spacing:.4px;display:block;margin-bottom:4px;">⚙️ Modelo</label><input id="mfSrchModelo" type="text" class="mf-input" placeholder="Ej: CSM-1501, BeneHeart D6..." oninput="onInvSearchMulti()" autocomplete="off" style="background:white;"></div><div><label style="font-size:11px;font-weight:700;color:#1565c0;text-transform:uppercase;letter-spacing:.4px;display:block;margin-bottom:4px;">🔢 Número de Serie</label><input id="mfSrchSerie" type="text" class="mf-input" placeholder="Número de serie..." oninput="onInvSearchMulti()" autocomplete="off" style="background:white;"></div></div><div id="mfEquipoDropdown" style="display:none;background:white;border:1.5px solid #90caf9;border-radius:10px;max-height:280px;overflow-y:auto;box-shadow:0 8px 24px rgba(0,0,0,0.12);"></div><div id="mfEquipoSelected" style="display:none;background:#e8f5e9;border:1.5px solid #81c784;border-radius:8px;padding:10px 14px;margin-top:8px;"><div style="display:flex;justify-content:space-between;align-items:center;"><div id="mfEquipoSelectedLabel" style="font-size:13px;font-weight:700;color:#1b5e20;"></div><button type="button" onclick="clearInvEquipo()" style="background:none;border:none;color:#c62828;cursor:pointer;font-size:16px;font-weight:700;padding:0 4px;" title="Quitar selección">✕</button></div><div id="mfEquipoSelectedSub" style="font-size:11px;color:#388e3c;margin-top:3px;"></div></div></div></div></div>'
    + '<div class="mf-inv-card"><div class="mf-inv-title">📋 Datos del Equipo (autocompletados)</div><div class="mf-inv-grid"><div><span class="mf-inv-label">Nombre</span><input id="mf_equipo" class="mf-inv-val" readonly></div><div><span class="mf-inv-label">Placa</span><input id="mf_placa" class="mf-inv-val" readonly></div><div><span class="mf-inv-label">Marca</span><input id="mf_marca" class="mf-inv-val" readonly></div><div><span class="mf-inv-label">Modelo</span><input id="mf_modelo" class="mf-inv-val" readonly></div><div><span class="mf-inv-label">Serie</span><input id="mf_serie" class="mf-inv-val" readonly></div><div><span class="mf-inv-label">Servicio / Ubicación</span><input id="mf_servicio" class="mf-inv-val" readonly></div><div><span class="mf-inv-label">Clasificación Riesgo</span><input id="mf_riesgo" class="mf-inv-val" readonly></div></div></div>'

    + '<div class="mf-section-title" style="background:'+color+'">📅 EJECUCIÓN Y CRONÓMETRO</div>'
    + '<div class="mf-row"><div class="mf-group"><label class="mf-label">Fecha de Ejecución *</label><input type="date" id="mfFechaEjecucion" class="mf-input" value="'+localDateStr()+'"></div><div class="mf-group"><label class="mf-label">Responsable / Ingeniero *</label><input type="text" id="mfTecnico" class="mf-input" placeholder="Nombre del ingeniero responsable"></div><div class="mf-group"><label class="mf-label">Frecuencia</label><input type="text" id="mfFrecuencia" class="mf-inv-val" readonly placeholder="Se autocompleta al seleccionar equipo"></div></div>'
    + '<div class="mf-timer-container"><div class="mf-timer-display" id="mfTimerDisplay">00:00:00</div><div style="font-size:11px;color:#78909c;margin-top:6px;text-align:center">El cronómetro se inicia automáticamente al verificar las condiciones previas</div></div>'

    + '<div class="mf-section-title" style="background:#37474f">⚠️ CONDICIONES PREVIAS Y SEGURIDAD</div>'
    + '<div class="mf-conditions-box"><ul style="margin:0;padding-left:18px;display:flex;flex-direction:column;gap:6px">'+condList+'</ul><div style="margin-top:10px"><label class="mf-checkbox-card" style="background:#fff8e1;border-color:#ffd54f"><input type="checkbox" id="mfCondicionesOk" required onchange="onCondicionesPreviasChange(this)"><span class="mf-checkbox-card-label" style="font-weight:700;color:#795548">He leído y verifico que se cumplen todas las condiciones previas</span></label></div></div>'

    + '<div class="mf-section-title" style="background:'+color+'">🔍 INSPECCIÓN VISUAL Y LIMPIEZA</div>'
    + buildPhotoCaptureSectionHTML('inicio', '📸 Foto inicial del equipo (antes de iniciar)', '1️⃣')
    + '<div class="mf-table-container"><table class="mf-protocol-table"><thead><tr><th style="width:40px">No.</th><th>Ítem a verificar</th><th style="width:100px">Cumple</th><th style="width:180px">Observaciones</th></tr></thead><tbody>'+inspeccionRows+'</tbody></table></div>'

    // Verificación funcional básica (si el protocolo la incluye, ej: monitores)
    + (proto.verificacionBasica ? (function() {
      var vbRows = proto.verificacionBasica.map(function(item, i) {
        return '<tr><td style="text-align:center;font-weight:700;color:#546e7a;width:40px">'+(i+1)+'</td><td style="font-size:12px;color:#263238;padding:8px 10px">'+esc(item.item)+'</td><td style="text-align:center;width:100px"><div style="display:flex;gap:6px;justify-content:center"><label class="mf-check-label"><input type="radio" name="vb_'+item.id+'" value="Si" class="mf-radio-input"><span class="mf-check-si">Sí</span></label><label class="mf-check-label"><input type="radio" name="vb_'+item.id+'" value="No" class="mf-radio-input"><span class="mf-check-no">No</span></label></div></td><td style="width:180px"><input type="text" class="mf-input mf-obs-input" id="vbobs_'+item.id+'" placeholder="Observaciones..." style="font-size:11px;padding:5px 8px"></td></tr>';
      }).join('');
      return '<div class="mf-section-title" style="background:'+color+'">🖥️ VERIFICACIÓN FUNCIONAL BÁSICA</div>'
        + '<div class="mf-table-container"><table class="mf-protocol-table"><thead><tr><th style="width:40px">No.</th><th>Actividad / criterio</th><th style="width:100px">Cumple</th><th style="width:180px">Observaciones</th></tr></thead><tbody>'+vbRows+'</tbody></table></div>';
    }()) : '')

    + '<div class="mf-section-title" style="background:'+color+'">📐 EQUIPO DE VERIFICACIÓN</div>'
    + '<div class="mf-row"><div class="mf-group"><label class="mf-label">Equipo utilizado</label><select id="mfEquipoVerificacion" class="mf-select"><option value="Simulador multiparámetro">Simulador multiparámetro</option><option value="Analizador de desfibrilador">Analizador de desfibrilador</option><option value="Vacuómetro patrón">Vacuómetro patrón</option><option value="Analizador de vacío">Analizador de vacío</option><option value="Otro">Otro</option></select></div><div class="mf-group"><label class="mf-label">Marca / Modelo del patrón</label><input type="text" id="mfMarcaPatron" class="mf-input" placeholder="Marca y modelo"></div></div>'
    + '<div class="mf-row"><div class="mf-group"><label class="mf-label">No. Serie del patrón</label><input type="text" id="mfSeriePatron" class="mf-input" placeholder="Número de serie"></div><div class="mf-group"><label class="mf-label">Certificado vigente hasta</label><input type="date" id="mfCertificadoVigente" class="mf-input"></div><div class="mf-group"><label class="mf-label">Tolerancia definida (mmHg/kPa)</label><input type="text" id="mfTolerancia" class="mf-input" placeholder="± ____ mmHg / kPa"></div></div>'

    + '<div class="mf-section-title" style="background:'+color+'">⚡ PRUEBAS FUNCIONALES</div>'
    + buildPhotoCaptureSectionHTML('mitad', '📸 Foto durante el procedimiento (verificación)', '2️⃣')
    + '<div class="mf-table-container"><table class="mf-protocol-table"><thead><tr><th style="width:40px">No.</th><th>Prueba</th><th style="width:140px">Valor esperado</th><th style="width:120px">Valor medido</th><th style="width:110px">Resultado</th><th style="width:140px">Observaciones</th></tr></thead><tbody>'+pruebasRows+'</tbody></table></div>'

    + '<div class="mf-section-title" style="background:#263238">📋 RESULTADO FINAL DEL MANTENIMIENTO</div>'
    + '<div style="margin:10px 0"><label class="mf-label" style="margin-bottom:8px;display:block">Estado final del equipo *</label><div class="mf-radio-group">'+estadoOptions+'</div></div>'
    + '<div style="margin:14px 0"><label class="mf-label" style="margin-bottom:8px;display:block">Acciones realizadas</label><div class="mf-checkbox-group">'+accionesChecks+'</div></div>'
    + '<div class="mf-row"><div class="mf-group mf-full"><label class="mf-label">Observaciones técnicas</label><textarea id="mfObservaciones" class="mf-textarea" rows="3" placeholder="Observaciones sobre el estado del equipo..."></textarea></div></div>'
    + '<div class="mf-row"><div class="mf-group mf-full"><label class="mf-label">Recomendaciones</label><textarea id="mfRecomendaciones" class="mf-textarea" rows="3" placeholder="Recomendaciones para próximos mantenimientos..."></textarea></div></div>'
    + buildPhotoCaptureSectionHTML('final', '📸 Foto final del equipo (después del mantenimiento)', '3️⃣')

    + '<div class="mf-section-title" style="background:#263238">✍️ TRAZABILIDAD Y FIRMAS</div>'
    + '<div class="mf-firma-container"><div class="mf-firma-box"><div class="mf-firma-title">Elaboró / Ejecutó</div><canvas id="sigPadEjecuto" class="mf-signature-canvas" width="320" height="120"></canvas><button type="button" class="mf-firma-clear" onclick="clearSignature(\'sigPadEjecuto\')">Limpiar</button><input type="text" id="mfNombreEjecuto" class="mf-input" placeholder="Nombre completo" style="margin-top:6px;font-size:12px"><input type="text" id="mfCargoEjecuto" class="mf-input" placeholder="Cargo" style="margin-top:4px;font-size:12px"></div><div class="mf-firma-box"><div class="mf-firma-title">Recibió / Verificó</div><canvas id="sigPadRecibio" class="mf-signature-canvas" width="320" height="120"></canvas><button type="button" class="mf-firma-clear" onclick="clearSignature(\'sigPadRecibio\')">Limpiar</button><input type="text" id="mfNombreRecibio" class="mf-input" placeholder="Nombre completo" style="margin-top:6px;font-size:12px"><input type="text" id="mfCargoRecibio" class="mf-input" placeholder="Cargo" style="margin-top:4px;font-size:12px"></div></div>'

    + '<div style="background:#e8f5e9;border:1.5px solid #81c784;border-radius:10px;padding:12px 16px;margin-top:14px;font-size:13px;color:#2e7d32"><strong>💾 Al guardar</strong> se generará un PDF del reporte con el protocolo completo y se adjuntará automáticamente al equipo en Airtable en el campo <strong>"'+FIELD_PREV+'"</strong>.</div>';
  }

  // ══════════════════════════════════════════════════════════════════════
  // FORMULARIO CORRECTIVO
  // ══════════════════════════════════════════════════════════════════════
  function buildFormHTML(isPrev) {
    var color = '#b71c1c';
    return '<div class="mf-section-title" style="background:'+color+'">🔧 EQUIPO</div>'
    + '<div class="mf-row"><div class="mf-group mf-full"><label class="mf-label">Equipo del Inventario *</label><select id="mfEquipoSelect" class="mf-select" style="display:none"><option value="">Cargando...</option></select><input type="hidden" id="mfEquipoId"><div id="mfEquipoSearchWrap" style="background:#f0f7ff;border:1.5px solid #90caf9;border-radius:12px;padding:14px;margin-top:6px;"><div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px;"><div><label style="font-size:11px;font-weight:700;color:#1565c0;text-transform:uppercase;letter-spacing:.4px;display:block;margin-bottom:4px;">📋 Nombre / Equipo</label><input id="mfSrchNombre" type="text" class="mf-input" placeholder="Ej: Monitor, Desfibrilador..." oninput="onInvSearchMulti()" autocomplete="off" style="background:white;"></div><div><label style="font-size:11px;font-weight:700;color:#1565c0;text-transform:uppercase;letter-spacing:.4px;display:block;margin-bottom:4px;">🏷️ Marca</label><input id="mfSrchMarca" type="text" class="mf-input" placeholder="Ej: Nihon Kohden, Mindray..." oninput="onInvSearchMulti()" autocomplete="off" style="background:white;"></div></div><div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px;"><div><label style="font-size:11px;font-weight:700;color:#1565c0;text-transform:uppercase;letter-spacing:.4px;display:block;margin-bottom:4px;">⚙️ Modelo</label><input id="mfSrchModelo" type="text" class="mf-input" placeholder="Ej: CSM-1501, BeneHeart D6..." oninput="onInvSearchMulti()" autocomplete="off" style="background:white;"></div><div><label style="font-size:11px;font-weight:700;color:#1565c0;text-transform:uppercase;letter-spacing:.4px;display:block;margin-bottom:4px;">🔢 Número de Serie</label><input id="mfSrchSerie" type="text" class="mf-input" placeholder="Número de serie..." oninput="onInvSearchMulti()" autocomplete="off" style="background:white;"></div></div><div id="mfEquipoDropdown" style="display:none;background:white;border:1.5px solid #90caf9;border-radius:10px;max-height:280px;overflow-y:auto;box-shadow:0 8px 24px rgba(0,0,0,0.12);"></div><div id="mfEquipoSelected" style="display:none;background:#e8f5e9;border:1.5px solid #81c784;border-radius:8px;padding:10px 14px;margin-top:8px;"><div style="display:flex;justify-content:space-between;align-items:center;"><div id="mfEquipoSelectedLabel" style="font-size:13px;font-weight:700;color:#1b5e20;"></div><button type="button" onclick="clearInvEquipo()" style="background:none;border:none;color:#c62828;cursor:pointer;font-size:16px;font-weight:700;padding:0 4px;" title="Quitar selección">✕</button></div><div id="mfEquipoSelectedSub" style="font-size:11px;color:#388e3c;margin-top:3px;"></div></div></div></div></div>'
    + '<div class="mf-inv-card"><div class="mf-inv-title">📋 Datos del Equipo (autocompletados)</div><div class="mf-inv-grid"><div><span class="mf-inv-label">Nombre</span><input id="mf_equipo" class="mf-inv-val" readonly></div><div><span class="mf-inv-label">Placa</span><input id="mf_placa" class="mf-inv-val" readonly></div><div><span class="mf-inv-label">Marca</span><input id="mf_marca" class="mf-inv-val" readonly></div><div><span class="mf-inv-label">Modelo</span><input id="mf_modelo" class="mf-inv-val" readonly></div><div><span class="mf-inv-label">Serie</span><input id="mf_serie" class="mf-inv-val" readonly></div><div><span class="mf-inv-label">Servicio / Ubicación</span><input id="mf_servicio" class="mf-inv-val" readonly></div><div><span class="mf-inv-label">Clasificación Riesgo</span><input id="mf_riesgo" class="mf-inv-val" readonly></div></div></div>'
    + '<div class="mf-section-title" style="background:'+color+'">📅 EJECUCIÓN</div>'
    + '<div class="mf-row"><div class="mf-group"><label class="mf-label">Fecha de Ejecución *</label><input type="date" id="mfFechaEjecucion" class="mf-input" value="'+localDateStr()+'"></div><div class="mf-group"><label class="mf-label">Técnico Responsable *</label><input type="text" id="mfTecnico" class="mf-input" placeholder="Nombre del técnico"></div></div>'
    + '<div class="mf-row"><div class="mf-group"><label class="mf-label">Duración (horas)</label><input type="number" id="mfDuracion" class="mf-input" step="0.5" min="0" placeholder="2.5"></div><div class="mf-group"><label class="mf-label">Costo (COP)</label><input type="number" id="mfCosto" class="mf-input" min="0" placeholder="150000"></div><div class="mf-group"><label class="mf-label">Estado</label><select id="mfEstado" class="mf-select"><option value="Completado">✔ Completado</option><option value="En Proceso">⚙ En Proceso</option><option value="Pendiente">⏳ Pendiente</option></select></div></div>'
    + '<div class="mf-section-title" style="background:'+color+'">📝 DETALLES</div>'
    + '<div class="mf-row"><div class="mf-group mf-full"><label class="mf-label">Falla Reportada *</label><textarea id="mfFallaReportada" class="mf-textarea" rows="3" placeholder="Describa la falla o problema reportado..."></textarea></div></div>'
    + '<div class="mf-row"><div class="mf-group mf-full"><label class="mf-label">Diagnóstico Técnico *</label><textarea id="mfDiagnostico" class="mf-textarea" rows="3" placeholder="Diagnóstico del problema encontrado..."></textarea></div></div>'
    + '<div class="mf-row"><div class="mf-group mf-full"><label class="mf-label">Acción Tomada / Solución *</label><textarea id="mfAccionTomada" class="mf-textarea" rows="3" placeholder="Solución implementada..."></textarea></div></div>'
    + '<div class="mf-row"><div class="mf-group"><label class="mf-label">Causa Raíz</label><input type="text" id="mfCausaRaiz" class="mf-input" placeholder="Causa raíz identificada"></div><div class="mf-group"><label class="mf-label">Repuestos Cambiados</label><input type="text" id="mfRepuestos" class="mf-input" placeholder="Fusible 5A, tarjeta de control..."></div></div>'
    + '<div class="mf-row"><div class="mf-group mf-full"><label class="mf-label">Hallazgos / Condición del Equipo</label><textarea id="mfHallazgos" class="mf-textarea" rows="3" placeholder="Estado general del equipo..."></textarea></div></div>'
    + '<div class="mf-row"><div class="mf-group mf-full"><label class="mf-label">Observaciones y Recomendaciones</label><textarea id="mfObservaciones" class="mf-textarea" rows="3" placeholder="Recomendaciones para próximos mantenimientos..."></textarea></div></div>'
    + '<div class="mf-section-title" style="background:'+color+'">✍️ FIRMA</div>'
    + '<div class="mf-row"><div class="mf-group"><label class="mf-label">Responsable / Firma</label><input type="text" id="mfFirmaResponsable" class="mf-input" placeholder="Nombre completo y cargo"></div></div>'
    + '<div style="background:#fce4ec;border:1.5px solid #ef9a9a;border-radius:10px;padding:12px 16px;margin-top:14px;font-size:13px;color:#b71c1c"><strong>💾 Al guardar</strong> se generará un PDF del reporte y se adjuntará automáticamente al equipo en Airtable en el campo <strong>"'+FIELD_CORR+'"</strong>.</div>';
  }

  // ══════════════════════════════════════════════════════════════════════
  // CRONÓMETRO
  // ══════════════════════════════════════════════════════════════════════
  window.toggleTimer = function() {
    if (mtState.timerRunning) stopTimer(); else startTimer();
  };
  function startTimer() {
    mtState.timerRunning = true;
    mtState.timerStart = Date.now() - mtState.timerElapsed;
    mtState.timerInterval = setInterval(updateTimerDisplay, 1000);
    var btn = document.getElementById('mfTimerStartBtn');
    if (btn) { btn.textContent = '⏸ Pausar'; btn.classList.remove('mf-timer-start'); btn.classList.add('mf-timer-pause'); }
    updateTimerDisplay();
  }
  function stopTimer() {
    mtState.timerRunning = false;
    if (mtState.timerInterval) { clearInterval(mtState.timerInterval); mtState.timerInterval = null; }
    if (mtState.timerStart) mtState.timerElapsed = Date.now() - mtState.timerStart;
    var btn = document.getElementById('mfTimerStartBtn');
    if (btn) { btn.textContent = '▶ Continuar'; btn.classList.remove('mf-timer-pause'); btn.classList.add('mf-timer-start'); }
  }
  window.resetTimer = function() {
    stopTimer(); mtState.timerElapsed = 0; mtState.timerStart = null; updateTimerDisplay();
    var btn = document.getElementById('mfTimerStartBtn');
    if (btn) btn.textContent = '▶ Iniciar Protocolo';
  };

  // Auto-iniciar cronómetro al marcar condiciones previas
  window.onCondicionesPreviasChange = function(checkbox) {
    if (checkbox.checked) {
      if (!mtState.timerRunning) {
        startTimer();
        showMtToast('⏱️ Cronómetro iniciado automáticamente', 'ok');
      }
    }
  };

  // ══════════════════════════════════════════════════════════════════════
  // CAPTURA DE FOTOS (Inicio, Mitad, Final del procedimiento)
  // ══════════════════════════════════════════════════════════════════════
  window.capturePhoto = function(photoId) {
    var input = document.getElementById('photoInput_' + photoId);
    if (input) input.click();
  };

  window.onPhotoSelected = function(input, photoId) {
    var file = input.files && input.files[0];
    if (!file) return;
    // Comprimir imagen a max 800px y calidad 0.6 para que el HTML no sea enorme
    var reader = new FileReader();
    reader.onload = function(e) {
      var img = new Image();
      img.onload = function() {
        var maxW = 800, maxH = 600;
        var w = img.width, h = img.height;
        if (w > maxW) { h = Math.round(h * maxW / w); w = maxW; }
        if (h > maxH) { w = Math.round(w * maxH / h); h = maxH; }
        var canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        var ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);
        var compressed = canvas.toDataURL('image/jpeg', 0.6);

        var preview = document.getElementById('photoPreview_' + photoId);
        var placeholder = document.getElementById('photoPlaceholder_' + photoId);
        var removeBtn = document.getElementById('photoRemoveBtn_' + photoId);
        if (preview) { preview.src = compressed; preview.style.display = 'block'; }
        if (placeholder) placeholder.style.display = 'none';
        if (removeBtn) removeBtn.style.display = 'inline-block';
        if (!mtState.photos) mtState.photos = {};
        mtState.photos[photoId] = compressed;
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  };

  window.removePhoto = function(photoId) {
    var preview = document.getElementById('photoPreview_' + photoId);
    var placeholder = document.getElementById('photoPlaceholder_' + photoId);
    var removeBtn = document.getElementById('photoRemoveBtn_' + photoId);
    var input = document.getElementById('photoInput_' + photoId);
    if (preview) { preview.src = ''; preview.style.display = 'none'; }
    if (placeholder) placeholder.style.display = 'flex';
    if (removeBtn) removeBtn.style.display = 'none';
    if (input) input.value = '';
    if (mtState.photos) delete mtState.photos[photoId];
  };

  function buildPhotoCaptureSectionHTML(position, label, icon) {
    return '<div class="mf-photo-capture" style="margin:12px 0;padding:12px 16px;background:#f8f9fa;border:1.5px dashed #b0bec5;border-radius:10px">'
      + '<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px"><span style="font-size:20px">'+icon+'</span><div style="font-weight:700;font-size:13px;color:#263238">'+esc(label)+'</div></div>'
      + '<input type="file" accept="image/*" capture="environment" id="photoInput_'+position+'" style="display:none" onchange="onPhotoSelected(this,\''+position+'\')">'
      + '<div id="photoPlaceholder_'+position+'" style="display:flex;flex-direction:column;align-items:center;justify-content:center;padding:20px;background:white;border-radius:8px;cursor:pointer;border:1px solid #e0e0e0" onclick="capturePhoto(\''+position+'\')">'
      + '<span style="font-size:32px;opacity:0.5">📷</span>'
      + '<span style="font-size:12px;color:#78909c;margin-top:6px">Toca para tomar foto</span>'
      + '</div>'
      + '<img id="photoPreview_'+position+'" style="display:none;max-width:100%;max-height:200px;border-radius:8px;margin-top:8px;object-fit:contain;border:1px solid #e0e0e0">'
      + '<button type="button" id="photoRemoveBtn_'+position+'" style="display:none;margin-top:6px;padding:4px 12px;font-size:11px;color:#c62828;background:#ffebee;border:1px solid #ef9a9a;border-radius:6px;cursor:pointer" onclick="removePhoto(\''+position+'\')">✕ Eliminar foto</button>'
      + '</div>';
  }
  function updateTimerDisplay() {
    var el = document.getElementById('mfTimerDisplay');
    if (!el) return;
    var elapsed = mtState.timerRunning ? Date.now() - mtState.timerStart : mtState.timerElapsed;
    var totalSec = Math.floor(elapsed / 1000);
    var h = Math.floor(totalSec / 3600);
    var m = Math.floor((totalSec % 3600) / 60);
    var s = totalSec % 60;
    el.textContent = String(h).padStart(2,'0')+':'+String(m).padStart(2,'0')+':'+String(s).padStart(2,'0');
  }
  function getTimerDuration() {
    var elapsed = mtState.timerRunning ? Date.now() - mtState.timerStart : mtState.timerElapsed;
    var totalMin = Math.round(elapsed / 60000);
    var h = Math.floor(totalMin / 60);
    var m = totalMin % 60;
    return h > 0 ? h+'h '+m+'min' : m+' min';
  }

  // ══════════════════════════════════════════════════════════════════════
  // FIRMA DIGITAL
  // ══════════════════════════════════════════════════════════════════════
  function initSignaturePads() {
    ['sigPadEjecuto', 'sigPadRecibio'].forEach(function(id) {
      var canvas = document.getElementById(id);
      if (!canvas) return;
      var ctx = canvas.getContext('2d');
      var drawing = false;
      var rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * 2;
      canvas.height = rect.height * 2;
      ctx.scale(2, 2);
      ctx.strokeStyle = '#1a237e';
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      function getPos(e) {
        var r = canvas.getBoundingClientRect();
        var touch = e.touches ? e.touches[0] : e;
        return { x: touch.clientX - r.left, y: touch.clientY - r.top };
      }
      canvas.addEventListener('mousedown', function(e) { drawing = true; ctx.beginPath(); var p = getPos(e); ctx.moveTo(p.x, p.y); });
      canvas.addEventListener('mousemove', function(e) { if (!drawing) return; var p = getPos(e); ctx.lineTo(p.x, p.y); ctx.stroke(); });
      canvas.addEventListener('mouseup', function() { drawing = false; });
      canvas.addEventListener('mouseleave', function() { drawing = false; });
      canvas.addEventListener('touchstart', function(e) { e.preventDefault(); drawing = true; ctx.beginPath(); var p = getPos(e); ctx.moveTo(p.x, p.y); }, { passive: false });
      canvas.addEventListener('touchmove', function(e) { e.preventDefault(); if (!drawing) return; var p = getPos(e); ctx.lineTo(p.x, p.y); ctx.stroke(); }, { passive: false });
      canvas.addEventListener('touchend', function() { drawing = false; });
      mtState.signaturePads[id] = { canvas: canvas, ctx: ctx };
    });
  }

  window.clearSignature = function(canvasId) {
    var pad = mtState.signaturePads[canvasId];
    if (!pad) return;
    pad.ctx.clearRect(0, 0, pad.canvas.width, pad.canvas.height);
  };

  function getSignatureDataURL(canvasId) {
    var pad = mtState.signaturePads[canvasId];
    if (!pad) return '';
    var pixels = pad.ctx.getImageData(0, 0, pad.canvas.width, pad.canvas.height).data;
    var hasContent = false;
    for (var i = 3; i < pixels.length; i += 4) { if (pixels[i] > 0) { hasContent = true; break; } }
    if (!hasContent) return '';
    // Crear un canvas más pequeño para reducir el tamaño del base64
    var small = document.createElement('canvas');
    small.width = 320;
    small.height = 120;
    var sctx = small.getContext('2d');
    sctx.fillStyle = '#ffffff';
    sctx.fillRect(0, 0, 320, 120);
    sctx.drawImage(pad.canvas, 0, 0, 320, 120);
    return small.toDataURL('image/jpeg', 0.6);
  }

  // ══════════════════════════════════════════════════════════════════════
  // INVENTARIO + SELECT
  // ══════════════════════════════════════════════════════════════════════
  async function loadInventarioForForm() {
    var sel = document.getElementById('mfEquipoSelect');
    if (sel) sel.innerHTML = '<option value="">⏳ Cargando equipos...</option>';
    try {
      var inv = [], ioff = null;
      do {
        var p = new URLSearchParams({ pageSize: '100' });
        if (ioff) p.set('offset', ioff);
        var r = await axios.get(BASE + '/inventario?' + p, { headers: hdr() });
        var d = r.data || {};
        inv = inv.concat(d.records || d.data || []);
        ioff = d.offset || null;
      } while (ioff);
      mtState.inventario = inv;
      mtState.invLoaded = true;
      loadInvSelect();
    } catch (err) {
      var sel2 = document.getElementById('mfEquipoSelect');
      if (sel2) sel2.innerHTML = '<option value="">⚠️ Error al cargar equipos</option>';
    }
  }

  window.closeMantForm = function() {
    stopTimer();
    var m = document.getElementById('mantFormModal');
    if (m) { 
      m.classList.remove('active'); 
      m.style.opacity = '0';
      m.style.pointerEvents = 'none'; 
      setTimeout(function() { m.style.display = 'none'; }, 260); 
    }
  };

  // Función global para manejar cambio de equipo en select
  window.onEquipoSelectChange = function() {
    // Compatibilidad con select legacy — el widget de búsqueda usa selectInvEquipo()
    var sel = document.getElementById('mfEquipoSelect');
    if (!sel) return;
    var opt = sel.options[sel.selectedIndex];
    if (!opt || !opt.value) return;
    ['equipo','placa','marca','modelo','serie','servicio','riesgo'].forEach(function(k) {
      var el = document.getElementById('mf_'+k);
      if (el) el.value = opt.dataset[k] || '';
    });
    var freqEl = document.getElementById('mfFrecuencia');
    if (freqEl) freqEl.value = opt.dataset.frecuencia || '';
  };

  // ─── Datos de inventario cacheados para búsqueda ───────────────────────
  var _invData = []; // Se llena al cargar

  function _buildInvData(inventario) {
    _invData = inventario.map(function(r) {
      var f = r.fields || {};
      return {
        id: r.id,
        nm: f['Equipo']||f['EQUIPO']||'',
        pl: f['Numero de Placa']||f['PLACA']||'',
        marca: f['Marca']||f['MARCA']||'',
        modelo: f['Modelo']||f['MODELO']||'',
        serie: f['Serie']||f['SERIE']||'',
        servicio: f['Servicio']||f['SERVICIO']||'',
        riesgo: f['Clasificacion del Riesgo']||f['Clasificacion Riesgo']||f['Clasificacion de Riesgo']||f['CLASIFICACION RIESGO']||f['Clasificación del Riesgo']||'',
        frecuencia: f['Frecuencia de MTTO Preventivo']||f['Frecuencia de Mantenimiento']||f['FRECUENCIA DE MTTO PREVENTIVO']||f['Frecuencia de MTTO']||'',
      };
    });
  }

  function _renderInvDropdown(items) {
    var list = document.getElementById('mfEquipoDropdown');
    if (!list) return;
    if (!items.length) {
      list.innerHTML = '<div style="padding:12px 14px;color:#90a4ae;font-size:13px;">Sin resultados</div>';
      list.style.display = 'block';
      return;
    }
    list.innerHTML = items.slice(0, 50).map(function(eq) {
      var label = '<strong>' + esc(eq.nm) + '</strong>';
      if (eq.marca || eq.modelo) label += ' <span style="color:#78909c;font-size:11px;">' + esc([eq.marca, eq.modelo].filter(Boolean).join(' ')) + '</span>';
      var sub = [];
      if (eq.serie) sub.push('S/N: ' + esc(eq.serie));
      if (eq.pl) sub.push('Placa: ' + esc(eq.pl));
      if (eq.servicio) sub.push(esc(eq.servicio));
      var subHtml = sub.length ? '<div style="font-size:11px;color:#90a4ae;margin-top:2px;">' + sub.join(' · ') + '</div>' : '';
      return '<div class="mf-inv-item" data-eqid="' + esc(eq.id) + '" style="padding:10px 14px;cursor:pointer;border-bottom:1px solid #f0f0f0;">'
        + '<div style="font-size:13px;">' + label + '</div>'
        + subHtml
        + '</div>';
    }).join('');
    // Hover via event delegation (avoids quote conflicts)
    list.querySelectorAll('.mf-inv-item').forEach(function(item) {
      item.addEventListener('mouseenter', function() { this.style.background = '#e3f2fd'; });
      item.addEventListener('mouseleave', function() { this.style.background = ''; });
      item.addEventListener('click', function() { selectInvEquipo(this.dataset.eqid); });
    });
    list.style.display = 'block';
  }

  window.onInvSearchMulti = function() {
    var qNombre = (document.getElementById('mfSrchNombre') && document.getElementById('mfSrchNombre').value || '').toLowerCase().trim();
    var qMarca  = (document.getElementById('mfSrchMarca')  && document.getElementById('mfSrchMarca').value  || '').toLowerCase().trim();
    var qModelo = (document.getElementById('mfSrchModelo') && document.getElementById('mfSrchModelo').value || '').toLowerCase().trim();
    var qSerie  = (document.getElementById('mfSrchSerie')  && document.getElementById('mfSrchSerie').value  || '').toLowerCase().trim();

    // Limpiar selección previa
    var hidden = document.getElementById('mfEquipoId');
    if (hidden) hidden.value = '';
    var sel = document.getElementById('mfEquipoSelected');
    if (sel) sel.style.display = 'none';
    ['equipo','placa','marca','modelo','serie','servicio','riesgo'].forEach(function(k) {
      var el = document.getElementById('mf_'+k); if (el) el.value = '';
    });

    // Si todos los campos están vacíos, ocultar dropdown
    if (!qNombre && !qMarca && !qModelo && !qSerie) {
      var list = document.getElementById('mfEquipoDropdown');
      if (list) list.style.display = 'none';
      return;
    }

    var filtered = _invData.filter(function(eq) {
      if (qNombre && !eq.nm.toLowerCase().includes(qNombre)) return false;
      if (qMarca  && !eq.marca.toLowerCase().includes(qMarca))  return false;
      if (qModelo && !eq.modelo.toLowerCase().includes(qModelo)) return false;
      if (qSerie  && !eq.serie.toLowerCase().includes(qSerie))  return false;
      return true;
    });
    _renderInvDropdown(filtered);
  };

  // Mantener compatibilidad con código que llame onInvSearch
  window.onInvSearch = window.onInvSearchMulti;

  window.selectInvEquipo = function(id) {
    var eq = _invData.find(function(e){ return e.id === id; });
    if (!eq) return;
    // Guardar ID en campo oculto
    var hidden = document.getElementById('mfEquipoId');
    if (hidden) hidden.value = id;
    // Mostrar panel de equipo seleccionado
    var selPanel = document.getElementById('mfEquipoSelected');
    var selLabel = document.getElementById('mfEquipoSelectedLabel');
    var selSub   = document.getElementById('mfEquipoSelectedSub');
    if (selPanel) selPanel.style.display = 'block';
    if (selLabel) selLabel.textContent = '✅ ' + eq.nm + (eq.marca||eq.modelo ? ' — '+[eq.marca,eq.modelo].filter(Boolean).join(' ') : '');
    if (selSub) {
      var parts = [];
      if (eq.serie) parts.push('S/N: ' + eq.serie);
      if (eq.pl)    parts.push('Placa: ' + eq.pl);
      if (eq.servicio) parts.push(eq.servicio);
      selSub.textContent = parts.join(' · ');
    }
    // Autocompletar campos del equipo
    ['equipo','placa','marca','modelo','serie','servicio','riesgo'].forEach(function(k) {
      var el = document.getElementById('mf_'+k);
      if (el) el.value = eq[k === 'equipo' ? 'nm' : k === 'placa' ? 'pl' : k] || '';
    });
    var freqEl = document.getElementById('mfFrecuencia');
    if (freqEl) freqEl.value = eq.frecuencia || '';
    // Cerrar dropdown
    var list = document.getElementById('mfEquipoDropdown');
    if (list) list.style.display = 'none';
  };

  window.clearInvEquipo = function() {
    var hidden = document.getElementById('mfEquipoId');
    if (hidden) hidden.value = '';
    var selPanel = document.getElementById('mfEquipoSelected');
    if (selPanel) selPanel.style.display = 'none';
    ['mfSrchNombre','mfSrchMarca','mfSrchModelo','mfSrchSerie'].forEach(function(id) {
      var el = document.getElementById(id); if (el) el.value = '';
    });
    ['equipo','placa','marca','modelo','serie','servicio','riesgo'].forEach(function(k) {
      var el = document.getElementById('mf_'+k); if (el) el.value = '';
    });
    var list = document.getElementById('mfEquipoDropdown');
    if (list) list.style.display = 'none';
    var freqEl = document.getElementById('mfFrecuencia');
    if (freqEl) freqEl.value = '';
  };

  // Cerrar dropdown al hacer clic fuera del panel de búsqueda
  document.addEventListener('click', function(e) {
    var wrap = document.getElementById('mfEquipoSearchWrap');
    if (wrap && !wrap.contains(e.target)) {
      var list = document.getElementById('mfEquipoDropdown');
      if (list) list.style.display = 'none';
    }
  });

  function _invSearchWidget() {
    return '<div id="mfEquipoSearchWrap" style="position:relative;">'
      + '<input id="mfEquipoSearch" type="text" class="mf-input" placeholder="🔍  Buscar por nombre, marca, modelo, serie o servicio..." oninput="onInvSearch(this)" autocomplete="off" style="padding-left:14px;">'
      + '<input type="hidden" id="mfEquipoId">'
      + '<div id="mfEquipoDropdown" style="display:none;position:absolute;top:calc(100% + 4px);left:0;right:0;background:white;border:1.5px solid #90caf9;border-radius:10px;max-height:260px;overflow-y:auto;z-index:9999;box-shadow:0 8px 24px rgba(0,0,0,0.12);">'
      + '</div>'
      + '</div>';
  }

  function loadInvSelect() {
    // Poblar datos de búsqueda
    _buildInvData(mtState.inventario);
    // El widget de búsqueda ya está en el HTML del formulario (mfEquipoSearchWrap)
    // Solo necesitamos asegurar que los datos estén listos — nada más que hacer aquí.
  }

  // ══════════════════════════════════════════════════════════════════════
  // GUARDAR
  // ══════════════════════════════════════════════════════════════════════
  window.saveMantForm = async function() {
    var tipo = getVal('mantFormTipoHidden');
    var isPrev = tipo === 'Preventivo';

    // Soporte para widget de búsqueda (mfEquipoId) y select legacy
    var equipoId = getVal('mfEquipoId');
    var eq = equipoId ? _invData.find(function(e){ return e.id === equipoId; }) : null;
    var sel = document.getElementById('mfEquipoSelect');
    var opt = null;
    if (!eq && sel) {
      opt = sel.options[sel.selectedIndex];
      if (opt && opt.value) {
        equipoId = opt.value;
        eq = { id:equipoId, nm:opt.dataset.equipo||'', pl:opt.dataset.placa||'', marca:opt.dataset.marca||'', modelo:opt.dataset.modelo||'', serie:opt.dataset.serie||'', servicio:opt.dataset.servicio||'', riesgo:opt.dataset.riesgo||'', frecuencia:opt.dataset.frecuencia||'' };
      }
    }
    // Crear opt-like object para compatibilidad con código existente
    if (eq && !opt) {
      opt = { value: eq.id, dataset: { equipo:eq.nm, placa:eq.pl, marca:eq.marca, modelo:eq.modelo, serie:eq.serie, servicio:eq.servicio, riesgo:eq.riesgo, frecuencia:eq.frecuencia } };
    }

    var tecnico = getVal('mfTecnico');
    var fecha = getVal('mfFechaEjecucion');

    if (!opt||!opt.value) { showMtToast('⚠️ Selecciona un equipo usando el buscador.','warn'); return; }
    if (!tecnico.trim()) { showMtToast('⚠️ El responsable es requerido.','warn'); return; }
    if (!fecha) { showMtToast('⚠️ La fecha es requerida.','warn'); return; }

    stopTimer();
    var saveBtn = document.getElementById('mantFormSaveBtn');
    if (saveBtn) { saveBtn.disabled = true; saveBtn.innerHTML = '<span style="display:inline-flex;align-items:center;gap:8px"><span class="mt-spinner" style="width:18px;height:18px;border-width:3px"></span>Generando PDF y guardando...</span>'; }

    try {
      var htmlReport;
      var protocolKey = getVal('mfProtocolKey');

      if (isPrev && protocolKey && PROTOCOLOS[protocolKey]) {
        var proto = PROTOCOLOS[protocolKey];
        var data = collectProtocolData(proto, opt);
        htmlReport = buildProtocolPDFHTML(data, proto);
      } else {
        var data = {
          tipo:tipo, isPrev:isPrev, equipoId:opt.value,
          equipo:opt.dataset.equipo||'', placa:opt.dataset.placa||'',
          marca:opt.dataset.marca||'', modelo:opt.dataset.modelo||'',
          serie:opt.dataset.serie||'', servicio:opt.dataset.servicio||'',
          riesgo:opt.dataset.riesgo||'', fecha:fecha, tecnico:tecnico,
          duracion:getVal('mfDuracion'), costo:getVal('mfCosto'), estado:getVal('mfEstado'),
          hallazgos:getVal('mfHallazgos'), observaciones:getVal('mfObservaciones'),
          firmaResponsable:getVal('mfFirmaResponsable'),
          fallaReportada:getVal('mfFallaReportada'), diagnostico:getVal('mfDiagnostico'),
          accionTomada:getVal('mfAccionTomada'), causaRaiz:getVal('mfCausaRaiz'),
          repuestos:getVal('mfRepuestos'),
        };
        htmlReport = buildCorrectiveReportHTML(data);
      }

      // ── Generar PDF real con html2pdf.js ──
      if (saveBtn) saveBtn.innerHTML = '<span style="display:inline-flex;align-items:center;gap:8px"><span class="mt-spinner" style="width:18px;height:18px;border-width:3px"></span>Generando PDF...</span>';

      var safeName = (opt.dataset.equipo||'equipo').replace(/[^a-zA-Z0-9]/g,'_').slice(0,30);
      var filename = (isPrev?'PREV':'CORR')+'_'+safeName+'_'+fecha+'_Completado.pdf';
      var fieldName = isPrev ? FIELD_PREV : FIELD_CORR;

      // Quitar script y botón imprimir del HTML
      var cleanHTML = htmlReport.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<button[^>]*id="btnPrint"[^>]*>[\s\S]*?<\/button>/gi, '');

      // Generar PDF: usar iframe oculto — html2canvas corre DENTRO del iframe para capturar estilos
      var pdfBlob = await new Promise(function(resolve, reject) {
        var iframe = document.createElement('iframe');
        iframe.style.cssText = 'position:fixed;left:0;top:0;width:794px;height:1123px;opacity:0;pointer-events:none;z-index:-1;border:none;';
        document.body.appendChild(iframe);

        var iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
        iframeDoc.open();
        iframeDoc.write(cleanHTML);
        iframeDoc.close();

        // Esperar renderizado completo del HTML dentro del iframe
        setTimeout(function() {
          var imgs = iframeDoc.querySelectorAll('img');
          var imgPromises = Array.from(imgs).map(function(img) {
            if (img.complete && img.naturalWidth > 0) return Promise.resolve();
            return new Promise(function(res) {
              img.onload = res;
              img.onerror = res;
              setTimeout(res, 5000);
            });
          });

          Promise.all(imgPromises).then(function() {
            setTimeout(function() {
              // Cargar html2pdf.bundle DENTRO del iframe para que capture los estilos del iframe
              var script = iframeDoc.createElement('script');
              script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.2/html2pdf.bundle.min.js';
              script.onload = function() {
                var iframeHtml2pdf = iframe.contentWindow.html2pdf;
                iframeHtml2pdf().set({
                  margin: 10,
                  filename: filename,
                  image: { type: 'jpeg', quality: 0.95 },
                  html2canvas: {
                    scale: 2,
                    useCORS: true,
                    logging: false,
                    letterRendering: true,
                    allowTaint: true,
                    backgroundColor: '#ffffff'
                  },
                  jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
                  pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
                }).from(iframeDoc.body).outputPdf('blob').then(function(blob) {
                  document.body.removeChild(iframe);
                  resolve(blob);
                }).catch(function(err) {
                  document.body.removeChild(iframe);
                  reject(err);
                });
              };
              script.onerror = function() {
                // Fallback: usar html2pdf de la ventana principal (sin estilos iframe)
                html2pdf().set({
                  margin: 10,
                  filename: filename,
                  image: { type: 'jpeg', quality: 0.92 },
                  html2canvas: { scale: 2, useCORS: true, logging: false },
                  jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
                  pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
                }).from(iframeDoc.body).outputPdf('blob').then(function(blob) {
                  document.body.removeChild(iframe);
                  resolve(blob);
                }).catch(function(err) {
                  document.body.removeChild(iframe);
                  reject(err);
                });
              };
              iframeDoc.head.appendChild(script);
            }, 1000);
          });
        }, 800);
      });

      // Convertir blob a base64 para enviar al backend
      var pdfBase64 = await new Promise(function(resolve, reject) {
        var reader = new FileReader();
        reader.onload = function() {
          var b64 = reader.result.split(',')[1];
          resolve(b64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(pdfBlob);
      });

      if (saveBtn) saveBtn.innerHTML = '<span style="display:inline-flex;align-items:center;gap:8px"><span class="mt-spinner" style="width:18px;height:18px;border-width:3px"></span>Subiendo a Airtable...</span>';

      var uploadRes = await axios.post(BASE+'/upload-pdf', {
        recordId: opt.value, fieldName: fieldName, filename: filename,
        contentType: 'application/pdf', base64: pdfBase64,
      }, { headers: hdr() });

      if (!uploadRes.data.ok) throw new Error(uploadRes.data.error||'Error al subir');

      mtState.reports.unshift({
        id:filename, tipo:tipo, equipo:opt.dataset.equipo||'',
        placa:opt.dataset.placa||'', servicio:opt.dataset.servicio||'',
        equipoId:opt.value, filename:filename, fecha:fecha, estado:'Completado', url:null,
      });
      mtState.invLoaded = false;
      closeMantForm();
      updateStats();
      renderList();
      showMtToast('✅ PDF guardado en Airtable · '+fieldName,'ok');
    } catch(err) {
      console.error('saveMantForm error:', err);
      showMtToast('❌ Error: '+(err&&err.message||JSON.stringify(err)),'err');
    } finally {
      if (saveBtn) { saveBtn.disabled = false; saveBtn.innerHTML = '💾 Guardar en Airtable'; }
    }
  };

  // ══════════════════════════════════════════════════════════════════════
  // RECOPILAR DATOS DEL PROTOCOLO
  // ══════════════════════════════════════════════════════════════════════
  function collectProtocolData(proto, opt) {
    var inspeccion = proto.inspeccion.map(function(item) {
      var checked = document.querySelector('input[name="insp_'+item.id+'"]:checked');
      return { item: item.item, cumple: checked ? checked.value : '—', observaciones: getVal('obs_'+item.id) };
    });
    var verificacionBasica = (proto.verificacionBasica||[]).map(function(item) {
      var checked = document.querySelector('input[name="vb_'+item.id+'"]:checked');
      return { item: item.item, cumple: checked ? checked.value : '—', observaciones: getVal('vbobs_'+item.id) };
    });
    var pruebas = proto.pruebasFuncionales.map(function(pf) {
      var checked = document.querySelector('input[name="pf_'+pf.id+'"]:checked');
      return { prueba:pf.prueba, valorEsperado:pf.valorEsperado, valorMedido:getVal('medido_'+pf.id), resultado: checked?checked.value:'—', observaciones:getVal('pfobs_'+pf.id) };
    });
    var estadoFinalRadio = document.querySelector('input[name="estado_final"]:checked');
    var acciones = [];
    document.querySelectorAll('input[name="acciones_realizadas"]:checked').forEach(function(cb) { acciones.push(cb.value); });
    return {
      equipoId:opt.value, equipo:opt.dataset.equipo||'', placa:opt.dataset.placa||'',
      marca:opt.dataset.marca||'', modelo:opt.dataset.modelo||'', serie:opt.dataset.serie||'',
      servicio:opt.dataset.servicio||'', riesgo:opt.dataset.riesgo||'',
      fecha:getVal('mfFechaEjecucion'), tecnico:getVal('mfTecnico'),
      frecuencia:getVal('mfFrecuencia'), duracion:getTimerDuration(),
      condicionesOk: document.getElementById('mfCondicionesOk') ? document.getElementById('mfCondicionesOk').checked : false,
      inspeccion:inspeccion,
      verificacionBasica:verificacionBasica,
      equipoVerificacion:getVal('mfEquipoVerificacion'), marcaPatron:getVal('mfMarcaPatron'),
      seriePatron:getVal('mfSeriePatron'), certificadoVigente:getVal('mfCertificadoVigente'),
      tolerancia:getVal('mfTolerancia'), pruebas:pruebas,
      estadoFinal: estadoFinalRadio?estadoFinalRadio.value:'—', acciones:acciones,
      observaciones:getVal('mfObservaciones'), recomendaciones:getVal('mfRecomendaciones'),
      firmaEjecuto:getSignatureDataURL('sigPadEjecuto'), nombreEjecuto:getVal('mfNombreEjecuto'),
      cargoEjecuto:getVal('mfCargoEjecuto'), firmaRecibio:getSignatureDataURL('sigPadRecibio'),
      nombreRecibio:getVal('mfNombreRecibio'), cargoRecibio:getVal('mfCargoRecibio'),
      fotoInicio: (mtState.photos && mtState.photos['inicio']) || '',
      fotoMitad: (mtState.photos && mtState.photos['mitad']) || '',
      fotoFinal: (mtState.photos && mtState.photos['final']) || '',
    };
  }

  // ══════════════════════════════════════════════════════════════════════
  // GENERAR HTML/PDF PROTOCOLO PREVENTIVO
  // ══════════════════════════════════════════════════════════════════════
  function buildProtocolPDFHTML(d, proto) {
    var color = '#1565c0';
    var colorDark = '#0d47a1';
    var codigo = proto.codigo+'-'+d.fecha+'-'+(d.equipo||'').replace(/[^a-zA-Z0-9]/g,'').slice(0,8).toUpperCase();

    var inspeccionRows = d.inspeccion.map(function(item, i) {
      var bgCumple = item.cumple === 'Si' ? '#e8f5e9' : item.cumple === 'No' ? '#ffebee' : '#f5f5f5';
      var txtColor = item.cumple === 'Si' ? '#2e7d32' : item.cumple === 'No' ? '#c62828' : '#757575';
      var rowBg = i % 2 === 0 ? '#ffffff' : '#f8f9fa';
      return '<tr style="background:'+rowBg+'"><td style="text-align:center;font-weight:700;width:40px;font-size:11px;color:#455a64">'+(i+1)+'</td><td style="font-size:10.5px;padding:6px 10px;color:#263238">'+esc(item.item)+'</td><td style="text-align:center;background:'+bgCumple+';font-weight:700;font-size:11px;color:'+txtColor+';-webkit-print-color-adjust:exact;print-color-adjust:exact">'+esc(item.cumple)+'</td><td style="font-size:10px;color:#607d8b;padding:6px 10px">'+esc(item.observaciones)+'</td></tr>';
    }).join('');

    var pruebasRows = d.pruebas.map(function(pf, i) {
      var bgRes = (pf.resultado==='Pasa'||pf.resultado==='Aplica') ? '#e8f5e9' : pf.resultado==='Falla' ? '#ffebee' : '#f5f5f5';
      var txtColor = (pf.resultado==='Pasa'||pf.resultado==='Aplica') ? '#2e7d32' : pf.resultado==='Falla' ? '#c62828' : '#757575';
      var rowBg = i % 2 === 0 ? '#ffffff' : '#f8f9fa';
      return '<tr style="background:'+rowBg+'"><td style="text-align:center;font-weight:700;width:40px;font-size:11px;color:#455a64">'+(i+1)+'</td><td style="font-size:10.5px;padding:6px 10px;color:#263238">'+esc(pf.prueba)+'</td><td style="font-size:10px;text-align:center;color:#546e7a;padding:6px 8px">'+esc(pf.valorEsperado)+'</td><td style="font-size:11px;text-align:center;font-weight:700;color:#212121">'+esc(pf.valorMedido)+'</td><td style="text-align:center;background:'+bgRes+';font-weight:700;font-size:11px;color:'+txtColor+';-webkit-print-color-adjust:exact;print-color-adjust:exact">'+esc(pf.resultado)+'</td><td style="font-size:9.5px;color:#607d8b;padding:6px 8px">'+esc(pf.observaciones)+'</td></tr>';
    }).join('');

    var estadoColor = d.estadoFinal==='Apto para uso'?'#2e7d32':d.estadoFinal==='Apto con observaciones'?'#f57f17':'#c62828';

    var condPrevias = proto.condicionesPrevias.map(function(c){ return '<li style="margin-bottom:3px;line-height:1.4">'+esc(c)+'</li>'; }).join('');

    var css = '*{box-sizing:border-box;margin:0;padding:0}'
      + 'body{font-family:"Segoe UI",Arial,Helvetica,sans-serif;font-size:10.5px;color:#212121;padding:16px 20px;background:white;line-height:1.35}'
      + '.hdr{display:flex;justify-content:space-between;align-items:stretch;border:2.5px solid '+color+';border-radius:6px;overflow:hidden;margin-bottom:12px}'
      + '.hdr-left{padding:10px 14px;background:white;min-width:210px}'
      + '.hdr-hosp{font-weight:800;font-size:12.5px;color:#1a237e;text-transform:uppercase;letter-spacing:.2px}'
      + '.hdr-dept{font-size:10px;font-weight:600;color:#37474f;margin-top:3px}'
      + '.hdr-addr{font-size:9px;color:#78909c;margin-top:2px}'
      + '.hdr-center{text-align:center;flex:1;padding:10px 14px;background:linear-gradient(180deg,#e8eaf6 0%,#e3f2fd 100%);border-left:2.5px solid '+color+';border-right:2.5px solid '+color+';-webkit-print-color-adjust:exact;print-color-adjust:exact}'
      + '.hdr-title{font-weight:800;font-size:13px;color:'+color+';text-transform:uppercase;letter-spacing:.4px;line-height:1.3}'
      + '.hdr-sub{font-weight:700;font-size:11px;color:#263238;margin-top:4px}'
      + '.hdr-code{font-weight:600;font-size:9px;color:#607d8b;margin-top:3px;letter-spacing:.2px}'
      + '.hdr-right{text-align:right;font-size:9.5px;color:#455a64;white-space:nowrap;padding:10px 14px;background:white;min-width:130px}'
      + '.hdr-right div{margin-bottom:2px}'
      + '.sec{color:white;font-weight:700;padding:6px 12px;font-size:10.5px;text-transform:uppercase;letter-spacing:.5px;border-radius:4px;margin:10px 0 2px;-webkit-print-color-adjust:exact;print-color-adjust:exact;display:flex;align-items:center;gap:6px}'
      + '.sec-blue{background:'+color+'}'
      + '.sec-dark{background:#37474f}'
      + '.sec-icon{font-size:13px;line-height:1}'
      + '.tbl{width:100%;border-collapse:collapse;font-size:10.5px;margin-top:0;border:1px solid #cfd8dc;border-radius:4px;overflow:hidden}'
      + '.tbl td,.tbl th{border:1px solid #cfd8dc;padding:5px 10px;vertical-align:middle}'
      + '.tbl th{background:#eceff1;font-weight:700;font-size:9.5px;text-transform:uppercase;color:#37474f;letter-spacing:.3px;padding:7px 10px;-webkit-print-color-adjust:exact;print-color-adjust:exact}'
      + '.lb{background:#eceff1;font-weight:700;font-size:9.5px;color:#37474f;text-transform:uppercase;width:26%;white-space:nowrap;-webkit-print-color-adjust:exact;print-color-adjust:exact;letter-spacing:.2px}'
      + '.vl{font-size:10.5px;color:#212121}'
      + '.cond-box{background:#fffde7;border:1.5px solid #ffe082;border-radius:6px;padding:10px 14px;margin:6px 0;font-size:10px;color:#5d4037}'
      + '.cond-box ul{margin:0;padding-left:16px}'
      + '.cond-check{margin-top:6px;font-weight:700;font-size:10.5px;padding:4px 0}'
      + '.foto-wrap{margin:8px 0;text-align:center}'
      + '.foto-label{font-size:9.5px;font-weight:700;color:#37474f;margin-bottom:5px;text-transform:uppercase;letter-spacing:.3px}'
      + '.foto-frame{display:inline-block;border:2px solid #cfd8dc;border-radius:6px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);max-width:90%}'
      + '.foto-frame img{display:block;max-width:100%;max-height:200px}'
      + '.firmas{display:flex;gap:24px;margin-top:16px;padding-top:12px;border-top:2px solid #e0e0e0}'
      + '.firma{flex:1;text-align:center;font-size:9.5px;color:#607d8b}'
      + '.firma-sig{min-height:50px;display:flex;align-items:flex-end;justify-content:center;margin-bottom:4px;border-bottom:2px solid #37474f;padding-bottom:4px}'
      + '.firma-sig img{max-height:55px}'
      + '.firma-role{font-size:9px;color:#78909c;margin-top:2px}'
      + '.firma-name{font-weight:700;color:#212121;margin-top:2px;font-size:11px}'
      + '.firma-cargo{font-size:9.5px;color:#546e7a}'
      + '.estado-badge{display:inline-block;padding:4px 16px;border-radius:14px;font-weight:700;font-size:11px;color:white;letter-spacing:.3px;-webkit-print-color-adjust:exact;print-color-adjust:exact}'
      + '.nota{background:#f5f5f5;border:1.5px solid #e0e0e0;border-radius:6px;padding:8px 14px;font-size:9.5px;color:#607d8b;margin-top:12px;line-height:1.4}'
      + '.nota strong{color:#455a64}'
      + '.footer{margin-top:10px;font-size:8.5px;color:#9e9e9e;border-top:1.5px solid #e0e0e0;padding-top:6px;text-align:center;letter-spacing:.2px}'
      + '.btn-print{display:block;margin:16px auto 6px;padding:10px 36px;background:'+color+';color:white;border:none;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer;font-family:"Segoe UI",Arial,sans-serif;letter-spacing:.4px;box-shadow:0 2px 8px rgba(21,101,192,0.3)}'
      + '.btn-print:hover{opacity:.85}'
      + '@media print{@page{size:A4 portrait;margin:8mm}body{padding:0}.btn-print{display:none!important}}';

    return '<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>MANTENIMIENTO PREVENTIVO - '+esc(proto.nombre)+'</title><style>'+css+'</style></head><body>'
    + '<div class="hdr"><div class="hdr-left"><div class="hdr-hosp">HOSPITAL SUSANA LÓPEZ DE VALENCIA E.S.E</div><div class="hdr-dept">GESTIÓN DEL AMBIENTE Y LA TECNOLOGÍA</div><div class="hdr-addr">Calle 15 N°17A-196 Tel. 8217190</div></div><div class="hdr-center"><div class="hdr-title">FORMATO DE MANTENIMIENTO PREVENTIVO Y VERIFICACIÓN FUNCIONAL</div><div class="hdr-sub">'+esc(proto.nombre)+'</div><div class="hdr-code">Código: '+esc(codigo)+'</div></div><div class="hdr-right"><div>Fecha: '+fmt(d.fecha)+'</div><div>Hora: '+localTimeStr()+'</div><div>Duración: '+esc(d.duracion)+'</div><div>Página 1 de 1</div></div></div>'
    + '<div class="sec sec-blue"><span class="sec-icon">🏥</span> DATOS DEL EQUIPO</div><table class="tbl"><tr><td class="lb">Fecha</td><td class="vl">'+fmt(d.fecha)+'</td><td class="lb">Servicio / Área</td><td class="vl">'+esc(d.servicio)+'</td></tr><tr><td class="lb">Marca</td><td class="vl">'+esc(d.marca)+'</td><td class="lb">Modelo</td><td class="vl">'+esc(d.modelo)+'</td></tr><tr><td class="lb">No. Inventario</td><td class="vl">'+esc(d.placa)+'</td><td class="lb">No. Serie</td><td class="vl">'+esc(d.serie)+'</td></tr><tr><td class="lb">Ubicación</td><td class="vl">'+esc(d.servicio)+'</td><td class="lb">Frecuencia</td><td class="vl">'+esc(d.frecuencia)+'</td></tr><tr><td class="lb">Responsable</td><td class="vl">'+esc(d.tecnico)+'</td><td class="lb">Clasificación Riesgo</td><td class="vl">'+esc(d.riesgo)+'</td></tr></table>'
    + '<div class="sec sec-dark"><span class="sec-icon">⚠️</span> CONDICIONES PREVIAS Y SEGURIDAD</div><div class="cond-box"><ul>'+condPrevias+'</ul><div class="cond-check" style="color:'+(d.condicionesOk?'#2e7d32':'#c62828')+'">'+(d.condicionesOk?'✅ Condiciones verificadas y cumplidas':'⚠️ Condiciones no verificadas')+'</div></div>'
    + '<div class="sec sec-blue"><span class="sec-icon">🔍</span> INSPECCIÓN VISUAL Y LIMPIEZA</div>'
    + (d.fotoInicio ? '<div class="foto-wrap"><div class="foto-label">📸 Foto inicial del equipo</div><div class="foto-frame"><img src="'+d.fotoInicio+'" alt="Foto inicial"></div></div>' : '')
    + '<table class="tbl"><tr><th style="width:40px">NO.</th><th>ÍTEM A VERIFICAR</th><th style="width:70px">CUMPLE</th><th style="width:160px">OBSERVACIONES</th></tr>'+inspeccionRows+'</table>'
    + '<div class="sec sec-blue"><span class="sec-icon">📐</span> EQUIPO DE VERIFICACIÓN UTILIZADO</div><table class="tbl"><tr><td class="lb">Equipo utilizado</td><td class="vl">'+esc(d.equipoVerificacion)+'</td><td class="lb">Marca / Modelo</td><td class="vl">'+esc(d.marcaPatron)+'</td></tr><tr><td class="lb">No. Serie patrón</td><td class="vl">'+esc(d.seriePatron)+'</td><td class="lb">Certificado hasta</td><td class="vl">'+fmt(d.certificadoVigente)+'</td></tr><tr><td class="lb">Tolerancia</td><td class="vl" colspan="3">'+esc(d.tolerancia)+'</td></tr></table>'
    + (d.verificacionBasica && d.verificacionBasica.length ? (function() {
      var vbRows = d.verificacionBasica.map(function(item, i) {
        var bgCumple = item.cumple === 'Si' ? '#e8f5e9' : item.cumple === 'No' ? '#ffebee' : '#f5f5f5';
        var txtColor = item.cumple === 'Si' ? '#2e7d32' : item.cumple === 'No' ? '#c62828' : '#757575';
        var rowBg = i % 2 === 0 ? '#ffffff' : '#f8f9fa';
        return '<tr style="background:'+rowBg+'"><td style="text-align:center;font-weight:700;width:40px;font-size:11px;color:#455a64">'+(i+1)+'</td><td style="font-size:10.5px;padding:6px 10px;color:#263238">'+esc(item.item)+'</td><td style="text-align:center;background:'+bgCumple+';font-weight:700;font-size:11px;color:'+txtColor+';-webkit-print-color-adjust:exact;print-color-adjust:exact">'+esc(item.cumple)+'</td><td style="font-size:10px;color:#607d8b;padding:6px 10px">'+esc(item.observaciones)+'</td></tr>';
      }).join('');
      return '<div class="sec sec-blue"><span class="sec-icon">🖥️</span> VERIFICACIÓN FUNCIONAL BÁSICA</div><table class="tbl"><tr><th style="width:40px">NO.</th><th>ACTIVIDAD / CRITERIO</th><th style="width:70px">CUMPLE</th><th style="width:160px">OBSERVACIONES</th></tr>'+vbRows+'</table>';
    }()) : '')
    + '<div class="sec sec-blue"><span class="sec-icon">⚡</span> PRUEBAS FUNCIONALES</div>'
    + (d.fotoMitad ? '<div class="foto-wrap"><div class="foto-label">📸 Foto durante el procedimiento</div><div class="foto-frame"><img src="'+d.fotoMitad+'" alt="Foto procedimiento"></div></div>' : '')
    + '<table class="tbl"><tr><th style="width:40px">NO.</th><th>PRUEBA</th><th style="width:100px">VALOR ESPERADO</th><th style="width:80px">MEDIDO</th><th style="width:70px">RESULT.</th><th style="width:120px">OBS.</th></tr>'+pruebasRows+'</table>'
    + '<div class="sec sec-dark"><span class="sec-icon">📋</span> RESULTADO FINAL DEL MANTENIMIENTO</div><table class="tbl"><tr><td class="lb">Estado final</td><td class="vl"><span class="estado-badge" style="background:'+estadoColor+'">'+esc(d.estadoFinal)+'</span></td></tr><tr><td class="lb">Acciones realizadas</td><td class="vl">'+(d.acciones.length?d.acciones.map(function(a){return esc(a)}).join(' · '):'—')+'</td></tr><tr><td class="lb">Observaciones técnicas</td><td class="vl">'+esc(d.observaciones)+'</td></tr><tr><td class="lb">Recomendaciones</td><td class="vl">'+esc(d.recomendaciones)+'</td></tr><tr><td class="lb">Duración total del mantenimiento</td><td class="vl" style="font-weight:700;font-size:12px;color:'+color+'">⏱️ '+esc(d.duracion)+'</td></tr></table>'
    + (d.fotoFinal ? '<div class="foto-wrap"><div class="foto-label">📸 Foto final del equipo</div><div class="foto-frame"><img src="'+d.fotoFinal+'" alt="Foto final"></div></div>' : '')
    + '<div class="firmas"><div class="firma"><div class="firma-sig">'+(d.firmaEjecuto?'<img src="'+d.firmaEjecuto+'" alt="Firma">':'')+'</div><div class="firma-role">Elaboró / Ejecutó</div><div class="firma-name">'+esc(d.nombreEjecuto)+'</div><div class="firma-cargo">'+esc(d.cargoEjecuto)+'</div></div><div class="firma"><div class="firma-sig">'+(d.firmaRecibio?'<img src="'+d.firmaRecibio+'" alt="Firma">':'')+'</div><div class="firma-role">Recibió / Verificó</div><div class="firma-name">'+esc(d.nombreRecibio)+'</div><div class="firma-cargo">'+esc(d.cargoRecibio)+'</div></div></div>'
    + '<div class="nota"><strong>Nota técnica:</strong> Este formato está diseñado para mantenimiento preventivo rutinario y verificación funcional externa. No autoriza apertura, ajuste interno o reparación del regulador. Cualquier desviación debe documentarse y remitirse a soporte técnico autorizado.</div>'
    + '<button id="btnPrint" class="btn-print">🖨️ Imprimir Reporte</button>'
    + '<div class="footer">HSLV · Sistema de Gestión de la Tecnología · '+esc(proto.codigo)+' · '+esc(codigo)+' · Generado: '+new Date().toLocaleString('es-CO')+'</div>'
    + '<script>document.getElementById("btnPrint").addEventListener("click",function(){window.print();});<\/script>'
    + '</body></html>';
  }

  // ══════════════════════════════════════════════════════════════════════
  // REPORTE CORRECTIVO
  // ══════════════════════════════════════════════════════════════════════
  function buildCorrectiveReportHTML(d) {
    var color = '#b71c1c';
    var colorLight = '#ffebee';
    var codigo = 'CORR-'+d.fecha+'-'+(d.equipo||'').replace(/[^a-zA-Z0-9]/g,'').slice(0,8).toUpperCase();
    var row = function(l,v) { return v ? '<tr><td class="lb">'+l+'</td><td class="vl">'+esc(String(v))+'</td></tr>' : ''; };
    var sec = function(t,rows) { return '<div class="sec"><span class="sec-icon">'+t.split(' ')[0]+'</span> '+t.split(' ').slice(1).join(' ')+'</div><table class="tbl">'+rows+'</table>'; };

    var css = '*{box-sizing:border-box;margin:0;padding:0}'
      + 'body{font-family:"Segoe UI",Arial,Helvetica,sans-serif;font-size:11px;color:#212121;padding:16px 20px;background:white;line-height:1.35}'
      + '.hdr{display:flex;justify-content:space-between;align-items:stretch;border:2.5px solid '+color+';border-radius:6px;overflow:hidden;margin-bottom:12px}'
      + '.hdr-left{padding:10px 14px;background:white;min-width:210px}'
      + '.hdr-hosp{font-weight:800;font-size:12.5px;color:#1a237e;text-transform:uppercase;letter-spacing:.2px}'
      + '.hdr-dept{font-size:10px;font-weight:600;color:#37474f;margin-top:3px}'
      + '.hdr-addr{font-size:9px;color:#78909c;margin-top:2px}'
      + '.hdr-center{text-align:center;flex:1;padding:10px 14px;background:linear-gradient(180deg,#ffebee 0%,#fce4ec 100%);border-left:2.5px solid '+color+';border-right:2.5px solid '+color+';-webkit-print-color-adjust:exact;print-color-adjust:exact}'
      + '.hdr-title{font-weight:800;font-size:13px;color:'+color+';text-transform:uppercase;letter-spacing:.4px;line-height:1.3}'
      + '.hdr-code{font-weight:700;font-size:10px;color:#263238;margin-top:4px}'
      + '.hdr-right{text-align:right;font-size:9.5px;color:#455a64;white-space:nowrap;padding:10px 14px;background:white;min-width:130px}'
      + '.hdr-right div{margin-bottom:2px}'
      + '.sec{background:'+color+';color:white;font-weight:700;padding:6px 12px;font-size:10.5px;text-transform:uppercase;letter-spacing:.5px;border-radius:4px;margin:10px 0 2px;-webkit-print-color-adjust:exact;print-color-adjust:exact;display:flex;align-items:center;gap:6px}'
      + '.sec-icon{font-size:13px;line-height:1}'
      + '.tbl{width:100%;border-collapse:collapse;font-size:11px;margin-top:0;border:1px solid #cfd8dc}'
      + '.tbl td{border:1px solid #cfd8dc;padding:5px 10px;vertical-align:middle}'
      + '.lb{background:#eceff1;font-weight:700;font-size:9.5px;color:#37474f;text-transform:uppercase;width:30%;white-space:nowrap;-webkit-print-color-adjust:exact;print-color-adjust:exact;letter-spacing:.2px}'
      + '.vl{font-size:11px;color:#212121;min-height:18px}'
      + '.firmas{display:flex;gap:24px;margin-top:20px;padding-top:12px;border-top:2px solid #e0e0e0}'
      + '.firma{flex:1;text-align:center;font-size:10px;color:#607d8b}'
      + '.firma-line{border-bottom:2px solid #37474f;height:40px;margin-bottom:4px}'
      + '.firma-name{font-weight:700;color:#212121;margin-top:2px;font-size:11px}'
      + '.footer{margin-top:12px;font-size:8.5px;color:#9e9e9e;border-top:1.5px solid #e0e0e0;padding-top:6px;text-align:center;letter-spacing:.2px}'
      + '.btn-print{display:block;margin:16px auto 6px;padding:10px 36px;background:'+color+';color:white;border:none;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer;font-family:"Segoe UI",Arial,sans-serif;letter-spacing:.4px;box-shadow:0 2px 8px rgba(183,28,28,0.3)}'
      + '.btn-print:hover{opacity:.85}'
      + '@media print{@page{size:A4 portrait;margin:10mm}body{padding:0}.btn-print{display:none!important}}';

    return '<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>REPORTE DE MANTENIMIENTO CORRECTIVO</title><style>'+css+'</style></head><body>'
    + '<div class="hdr"><div class="hdr-left"><div class="hdr-hosp">HOSPITAL SUSANA LÓPEZ DE VALENCIA E.S.E</div><div class="hdr-dept">GESTIÓN DEL AMBIENTE Y LA TECNOLOGÍA</div><div class="hdr-addr">Calle 15 N°17A-196 Tel. 8217190</div></div><div class="hdr-center"><div class="hdr-title">🔧 REPORTE DE MANTENIMIENTO CORRECTIVO</div><div class="hdr-code">Código: '+esc(codigo)+'</div></div><div class="hdr-right"><div>Fecha: '+fmt(d.fecha)+'</div><div>Hora: '+localTimeStr()+'</div><div>Página 1 de 1</div></div></div>'
    + sec('🏥 DATOS DEL EQUIPO', row('Nombre del Equipo',d.equipo)+row('Placa / Inventario',d.placa)+row('Marca',d.marca)+row('Modelo',d.modelo)+row('Serie',d.serie)+row('Servicio / Ubicación',d.servicio)+row('Clasificación de Riesgo',d.riesgo))
    + sec('📅 DATOS DE EJECUCIÓN', row('Fecha de Ejecución',fmt(d.fecha))+row('Técnico Responsable',d.tecnico)+row('Duración',d.duracion?d.duracion+' horas':'')+row('Costo',d.costo?'$ '+Number(d.costo).toLocaleString('es-CO'):'')+row('Estado',d.estado))
    + sec('🔧 ANÁLISIS CORRECTIVO', row('Falla Reportada',d.fallaReportada)+row('Diagnóstico Técnico',d.diagnostico)+row('Acción Tomada',d.accionTomada)+row('Causa Raíz',d.causaRaiz)+row('Repuestos Cambiados',d.repuestos)+row('Hallazgos',d.hallazgos))
    + sec('📝 OBSERVACIONES', row('Observaciones y Recomendaciones',d.observaciones))
    + '<div class="firmas"><div class="firma"><div class="firma-line"></div>Técnico Responsable<div class="firma-name">'+esc(d.tecnico)+'</div></div><div class="firma"><div class="firma-line"></div>Supervisor / Jefe de Área</div><div class="firma"><div class="firma-line"></div>Ingeniero Biomédico<div class="firma-name">'+esc(d.firmaResponsable)+'</div></div></div>'
    + '<button id="btnPrint" class="btn-print">🖨️ Imprimir Reporte</button>'
    + '<div class="footer">HSLV · Sistema de Gestión de la Tecnología · SLV-GAT-MANT-CORR · '+esc(codigo)+' · Generado: '+new Date().toLocaleString('es-CO')+'</div>'
    + '<script>document.getElementById("btnPrint").addEventListener("click",function(){window.print();});<\/script>'
    + '</body></html>';
  }

  // ── TOAST ──────────────────────────────────────────────────────────────
  function showMtToast(msg, type) {
    var t = document.getElementById('mtToast');
    if (!t) { t = document.createElement('div'); t.id = 'mtToast'; document.body.appendChild(t); }
    var bg = type==='ok'?'#2e7d32':type==='warn'?'#f57f17':'#c62828';
    t.style.cssText = 'position:fixed;bottom:32px;right:32px;background:'+bg+';color:white;padding:14px 22px;border-radius:10px;font-size:14px;font-weight:600;font-family:Outfit,sans-serif;z-index:99999;box-shadow:0 8px 24px rgba(0,0,0,0.2);transition:opacity 0.4s;opacity:1;max-width:400px';
    t.textContent = msg;
    clearTimeout(t._to);
    t._to = setTimeout(function() { t.style.opacity = '0'; }, 4000);
  }

  window.loadMantenimientosModule = loadMantenimientosModule;
})();
