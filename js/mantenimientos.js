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
        { id: 'wtpf3', prueba: 'Temperatura modo HIGH — Medir con termómetro calibrado en salida de manguera', valorEsperado: '43 °C (± 2 °C)', resultado: ['Pasa', 'Falla'] },        { id: 'wtpf6', prueba: 'Estabilidad de temperatura — Mantener modo MEDIUM durante 10 minutos', valorEsperado: 'Variación ≤ ± 1.5 °C durante 10 min', resultado: ['Pasa', 'Falla'] },
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

    'termohigrometro_ubibot_gs1a': {
      nombre: 'Termohigrómetro UbiBot GS1-A',
      categoria: 'Biomédico',
      codigo: 'SLV-GAT-BIO-TH',
      frecuencia: ['Semestral', 'Anual'],
      condicionesPrevias: [
        'Verifique que el dispositivo esté operativo y con indicador LED en estado normal (verde intermitente) antes de iniciar el procedimiento.',
        'Confirme disponibilidad del patrón de referencia certificado: termohigrómetro calibrado con vigencia de calibración activa, o cámara climática de referencia.',
        'Asegúrese de que el sensor no estuvo expuesto a humedad extrema (> 95% HR), condensación o inmersión en las últimas 24 horas.',
        'El procedimiento debe realizarse en ambiente estable: temperatura entre 15 °C y 35 °C, sin corrientes de aire directas sobre el sensor.',
        'Disponga de acceso a la plataforma UbiBot Console (app móvil o web) para verificar la conectividad Wi-Fi y los datos en tiempo real.',
        'No cubra ni obstruya las ranuras del sensor de temperatura/humedad (parte superior del dispositivo) durante las pruebas.',
        'Si el dispositivo presenta indicador LED rojo permanente o sin respuesta, retire de servicio y remita a soporte técnico antes de continuar.',
      ],
      inspeccion: [
        { id: 'th1',  item: 'Carcasa exterior íntegra, sin grietas, deformaciones, quemaduras ni daño físico visible' },
        { id: 'th2',  item: 'Cubierta del sensor (rejilla superior) limpia, sin polvo acumulado, hongos ni contaminantes visibles' },
        { id: 'th3',  item: 'Indicador LED frontal funcional y visible (verde intermitente = normal; rojo = error)' },
        { id: 'th4',  item: 'Pantalla LCD (si aplica al modelo) con visualización clara de temperatura, humedad y estado de batería' },
        { id: 'th5',  item: 'Conector USB / puerto de carga sin corrosión, deformación ni suciedad' },
        { id: 'th6',  item: 'Antena Wi-Fi interna sin daño externo evidente; señal de red disponible en el área de instalación' },
        { id: 'th7',  item: 'Batería interna o externa (según configuración): sin signos de hinchazón, fuga o sulfatación' },
        { id: 'th8',  item: 'Soporte de montaje o base de instalación en buen estado, fijo y seguro en su posición' },
        { id: 'th9',  item: 'Etiqueta de identificación de activo fijo legible; número de serie coincide con el inventario' },
        { id: 'th10', item: 'Limpieza externa realizada con paño seco o ligeramente humedecido con alcohol isopropílico 70%; rejilla del sensor soplada con aire comprimido seco' },
      ],
      verificacionBasica: [
        { id: 'thvb1', item: 'Dispositivo enciende correctamente y LED parpadea en verde (modo normal de operación)' },
        { id: 'thvb2', item: 'Conexión Wi-Fi establecida: el dispositivo aparece en línea en UbiBot Console (app o web)' },
        { id: 'thvb3', item: 'Datos de temperatura y humedad se actualizan en la plataforma en el intervalo configurado (≤ 10 min)' },
        { id: 'thvb4', item: 'Nivel de señal Wi-Fi adecuado en el punto de instalación (RSSI ≥ -75 dBm recomendado)' },
        { id: 'thvb5', item: 'Nivel de batería reportado en la plataforma: ≥ 20% (o fuente de alimentación USB activa)' },
        { id: 'thvb6', item: 'Fecha y hora del dispositivo sincronizadas correctamente en la plataforma' },
        { id: 'thvb7', item: 'Historial de datos sin brechas prolongadas (gaps) que indiquen desconexiones recurrentes' },
      ],
      pruebasFuncionales: [
        { id: 'thpf1',  prueba: 'Lectura de temperatura — Comparación con patrón de referencia calibrado a temperatura ambiente', valorEsperado: 'Diferencia ≤ ± 0.5 °C respecto al patrón (rango operativo: -20 °C a 60 °C)', resultado: ['Pasa', 'Falla'] },
        { id: 'thpf2',  prueba: 'Lectura de humedad relativa — Comparación con patrón calibrado a HR ambiente', valorEsperado: 'Diferencia ≤ ± 3% HR respecto al patrón (rango: 0–95% HR sin condensación)', resultado: ['Pasa', 'Falla'] },
        { id: 'thpf3',  prueba: 'Estabilidad de lectura de temperatura — 3 lecturas consecutivas en 15 min en ambiente estable', valorEsperado: 'Variación entre lecturas ≤ ± 0.3 °C', resultado: ['Pasa', 'Falla'] },
        { id: 'thpf4',  prueba: 'Estabilidad de lectura de humedad — 3 lecturas consecutivas en 15 min en ambiente estable', valorEsperado: 'Variación entre lecturas ≤ ± 2% HR', resultado: ['Pasa', 'Falla'] },
        { id: 'thpf5',  prueba: 'Prueba de alarma de temperatura alta — Configurar umbral 5 °C por debajo del valor actual; verificar notificación', valorEsperado: 'Notificación push/email recibida en ≤ 5 min del evento', resultado: ['Pasa', 'Falla'] },
        { id: 'thpf6',  prueba: 'Prueba de alarma de temperatura baja — Configurar umbral 5 °C por encima del valor actual; verificar notificación', valorEsperado: 'Notificación push/email recibida en ≤ 5 min del evento', resultado: ['Pasa', 'Falla'] },
        { id: 'thpf7',  prueba: 'Prueba de alarma de humedad — Configurar umbral de HR fuera del rango actual; verificar notificación', valorEsperado: 'Notificación push/email recibida correctamente', resultado: ['Pasa', 'Falla'] },
        { id: 'thpf8',  prueba: 'Prueba de reconexión Wi-Fi — Desconectar y reconectar la red Wi-Fi; verificar reconexión automática', valorEsperado: 'Reconexión automática en ≤ 3 min sin intervención manual', resultado: ['Pasa', 'Falla'] },
        { id: 'thpf9',  prueba: 'Intervalo de muestreo configurado — Verificar que los datos se registran en el intervalo programado', valorEsperado: 'Datos disponibles en plataforma en el intervalo configurado (recomendado: 5–10 min)', resultado: ['Pasa', 'Falla'] },
        { id: 'thpf10', prueba: 'Exportación/descarga de datos históricos — Exportar datos de los últimos 30 días desde UbiBot Console', valorEsperado: 'Archivo CSV/Excel descargado correctamente con datos continuos y sin corrupción', resultado: ['Pasa', 'Falla'] },
      ],
      estadoFinal: ['Apto para uso', 'Apto con observaciones', 'No apto / retirar de servicio'],
      accionesRealizadas: [
        'Limpieza externa de carcasa y rejilla del sensor',
        'Verificación y ajuste de conectividad Wi-Fi',
        'Comparación y verificación con patrón calibrado (temperatura y humedad)',
        'Verificación de alarmas y notificaciones en plataforma',
        'Actualización de firmware (si aplica)',
        'Cambio / carga de batería',
        'Ajuste de configuración en UbiBot Console',
        'Remisión a soporte técnico UbiBot',
      ],
    },

    'monitor_mindray_epm10': {
      nombre: 'Monitor de Signos Vitales Mindray EPM-10',
      categoria: 'Biomédico',
      codigo: 'SLV-GAT-BIO-ME',
      frecuencia: ['Semestral', 'Anual'],
      condicionesPrevias: [
        'Verifique que el equipo esté apagado y desconectado de la red eléctrica antes de iniciar la inspección física externa.',
        'Confirme disponibilidad del simulador de paciente Fluke ProSim 8 (o equivalente Rigel UNI-SIM / BIOPAK) con certificado de calibración vigente.',
        'Conecte los cables de ECG (10 derivaciones), sensor SpO2, manguito NIBP y sonda de temperatura al simulador antes de iniciar las pruebas funcionales.',
        'Verifique que la batería del monitor esté cargada al 100% antes de las pruebas de autonomía.',
        'No desarme el equipo ni intervenga componentes internos durante el preventivo rutinario.',
        'Las intervenciones internas y de servicio avanzado deben realizarse exclusivamente por personal autorizado Mindray según manual de servicio EPM-10.',
        'Si el equipo presenta errores de arranque, pantalla en blanco persistente o alarmas de falla de hardware, retire de servicio y remita a soporte técnico antes de continuar.',
      ],
      inspeccion: [
        { id: 'me1',  item: 'Carcasa frontal y posterior sin grietas, deformaciones, quemaduras ni daño físico visible' },
        { id: 'me2',  item: 'Pantalla TFT de 10.1" sin manchas, píxeles muertos, rayaduras ni reflejo anormal; brillo adecuado' },
        { id: 'me3',  item: 'Teclas de función, perilla giratoria y botón de encendido con respuesta táctil correcta y sin atascamiento' },
        { id: 'me4',  item: 'Cable de alimentación AC, clavija y conector IEC sin corrosión, dobladuras ni daño en el aislante' },
        { id: 'me5',  item: 'Módulo de batería: sin signos de hinchazón, fuga electrolítica ni sulfatación en terminales' },
        { id: 'me6',  item: 'Cable de ECG (5 o 10 derivaciones): conductores íntegros, conectores sin corrosión, codificación de colores legible' },
        { id: 'me7',  item: 'Sensor SpO2 (dedo o clip): cable sin peladura, ventana óptica limpia, sujeción firme' },
        { id: 'me8',  item: 'Manguito NIBP y tubería: sin fisuras, deformaciones ni fugas visibles; válvula de escape funcional' },
        { id: 'me9',  item: 'Sonda de temperatura (si aplica): sin daño, conexión firme, superficie del sensor limpia' },
        { id: 'me10', item: 'Puertos laterales y traseros (USB, red, SpO2, NIBP, temperatura) sin obstrucción ni daño' },
        { id: 'me11', item: 'Rejilla de ventilación sin polvo acumulado ni obstrucción' },
        { id: 'me12', item: 'Etiqueta de identificación, activo fijo y número de serie legibles y coincidentes con inventario' },
        { id: 'me13', item: 'Limpieza externa realizada: carcasa con paño húmedo con alcohol isopropílico 70%; pantalla con paño suave seco' },
      ],
      verificacionBasica: [
        { id: 'mevb1', item: 'Enciende normalmente con AC y completa autoverificación de hardware sin errores persistentes' },
        { id: 'mevb2', item: 'Pantalla muestra imagen uniforme, sin artefactos; brillo y contraste ajustables' },
        { id: 'mevb3', item: 'Transición a modo batería: el monitor opera normalmente al desconectar AC' },
        { id: 'mevb4', item: 'Icono de nivel de batería en pantalla corresponde al estado real de carga' },
        { id: 'mevb5', item: 'Fecha, hora y configuración de alarmas verificadas y correctas' },
        { id: 'mevb6', item: 'Alarma audible: volumen audible a ≥ 1 metro; tono de urgencia diferenciable por prioridad' },
        { id: 'mevb7', item: 'Alarma visual: indicador LED de alarma activo en pantalla para cada condición de alerta' },
        { id: 'mevb8', item: 'Menú de configuración accesible; idioma y unidades correctamente configurados' },
      ],
      pruebasFuncionales: [
        { id: 'mepf1',  prueba: 'ECG: Frecuencia cardíaca — Simulación NSR ProSim 8, derivación II', valorEsperado: '80 BPM (± 1 BPM)', resultado: ['Pasa', 'Falla'] },
        { id: 'mepf2',  prueba: 'ECG: Amplitud de onda R — Señal 1 mV, derivación II', valorEsperado: '1.0 mV (± 5%)', resultado: ['Pasa', 'Falla'] },
        { id: 'mepf3',  prueba: 'ECG: Frecuencia respiratoria derivada — Impedancia torácica ProSim 8', valorEsperado: '20 RPM (± 1 RPM)', resultado: ['Pasa', 'Falla'] },
        { id: 'mepf4',  prueba: 'ECG: Detección de arritmia VF — Fibrilación ventricular simulada ProSim 8', valorEsperado: 'Alarma V-Fib activa en ≤ 10 s', resultado: ['Pasa', 'Falla'] },
        { id: 'mepf5',  prueba: 'ECG: Detección de arritmia VT — Taquicardia ventricular simulada ProSim 8', valorEsperado: 'Alarma VT activa', resultado: ['Pasa', 'Falla'] },
        { id: 'mepf6',  prueba: 'SpO2: Saturación de oxígeno — Simulación óptica ProSim 8, sensor conectado', valorEsperado: '98% (± 2%)', resultado: ['Pasa', 'Falla'] },
        { id: 'mepf7',  prueba: 'SpO2: Frecuencia de pulso — Simulación ProSim 8', valorEsperado: '80 BPM (± 2 BPM)', resultado: ['Pasa', 'Falla'] },
        { id: 'mepf8',  prueba: 'NIBP: Presión sistólica — Simulación estática ProSim 8 / manómetro patrón', valorEsperado: '120 mmHg (± 3 mmHg)', resultado: ['Pasa', 'Falla'] },
        { id: 'mepf9',  prueba: 'NIBP: Presión diastólica — Simulación estática ProSim 8', valorEsperado: '80 mmHg (± 3 mmHg)', resultado: ['Pasa', 'Falla'] },
        { id: 'mepf10', prueba: 'NIBP: Presión media (MAP) — Cálculo automático del monitor', valorEsperado: '93 mmHg (± 3 mmHg)', resultado: ['Pasa', 'Falla'] },
        { id: 'mepf11', prueba: 'NIBP: Prueba de fuga neumática — Presurizar manguito a 150 mmHg, ocluir y sostener 30 s', valorEsperado: 'Caída ≤ 6 mmHg en 30 s', resultado: ['Pasa', 'Falla'] },
        { id: 'mepf12', prueba: 'Temperatura: Canal 1 — Simulación resistiva ProSim 8 (sonda piel o rectal)', valorEsperado: '37.0 °C (± 0.1 °C)', resultado: ['Pasa', 'Falla'] },
        { id: 'mepf13', prueba: 'Alarma FC alta — Configurar límite 100 BPM; simular 120 BPM con ProSim 8', valorEsperado: 'Alarma audible/visual activa ≤ 5 s', resultado: ['Pasa', 'Falla'] },
        { id: 'mepf14', prueba: 'Alarma SpO2 baja — Configurar límite 90%; simular 85% con ProSim 8', valorEsperado: 'Alarma audible/visual activa ≤ 5 s', resultado: ['Pasa', 'Falla'] },
        { id: 'mepf15', prueba: 'Alarma NIBP alta — Configurar límite 140 mmHg sistólica; verificar activación', valorEsperado: 'Alarma activa al superar umbral', resultado: ['Pasa', 'Falla'] },
        { id: 'mepf16', prueba: 'Alarma sensor desconectado — Desconectar cable ECG y sensor SpO2', valorEsperado: 'Alarma técnica inmediata (Lead Off / Sensor Off)', resultado: ['Pasa', 'Falla'] },
        { id: 'mepf17', prueba: 'Autonomía de batería — Operar en modo batería con ECG + SpO2 + NIBP activos', valorEsperado: '≥ 2 horas de operación continua', resultado: ['Pasa', 'Falla'] },
        { id: 'mepf18', prueba: 'Tendencia de datos — Revisar tendencia de FC y SpO2 de las últimas 2 horas', valorEsperado: 'Datos continuos sin brechas; tendencia gráfica correcta', resultado: ['Pasa', 'Falla'] },
      ],
      estadoFinal: ['Apto para uso', 'Apto con observaciones', 'No apto / retirar de servicio'],
      accionesRealizadas: [
        'Limpieza externa de carcasa y pantalla',
        'Verificación funcional completa con simulador ProSim 8',
        'Cambio / reacondicionamiento de batería',
        'Cambio de accesorios (cable ECG, sensor SpO2, manguito NIBP)',
        'Calibración de parámetros (NIBP, temperatura)',
        'Actualización de software/firmware (si aplica)',
        'Verificación y ajuste de configuración de alarmas',
        'Remisión a servicio técnico autorizado Mindray',
      ],
    },

    'desfibrilador_mindray_d3': {
      nombre: 'Desfibrilador Mindray BeneHeart D3',
      categoria: 'Biomédico',
      codigo: 'SLV-GAT-BIO-D3',
      frecuencia: ['Semestral', 'Anual'],
      condicionesPrevias: [
        'Verifique que el equipo esté apagado y desconectado de la red eléctrica antes de iniciar la inspección física externa.',
        'Confirme disponibilidad del analizador de desfibrilador Fluke Impulse 4000 (o equivalente Rigel Uni-Pulse / Metrolight) con certificado de calibración vigente.',
        'Conecte las paletas externas o parches multifunction del equipo al analizador antes de iniciar las pruebas de energía.',
        'Verifique que la batería esté completamente cargada (indicador verde / barra completa) antes de las pruebas de autonomía.',
        'Asegúrese de que no haya pacientes ni personal en contacto con las paletas o electrodos durante las descargas de prueba.',
        'No desarme el equipo ni intervenga componentes internos durante el preventivo rutinario.',
        'Las intervenciones internas y de servicio avanzado deben realizarse exclusivamente por personal autorizado Mindray según manual de servicio BeneHeart D3.',
        'Si el equipo presenta errores de autotest, pantalla en blanco persistente o falla al cargar, retire de servicio y remita a soporte técnico antes de continuar.',
      ],
      inspeccion: [
        { id: 'd3i1',  item: 'Carcasa, panel frontal y posterior sin grietas, deformaciones, quemaduras ni daño físico visible' },
        { id: 'd3i2',  item: 'Pantalla LCD/TFT sin manchas, rayaduras ni artefactos; lectura clara a distancia operativa' },
        { id: 'd3i3',  item: 'Teclas de función, selector de energía y botón de descarga con respuesta táctil correcta y sin atascamiento' },
        { id: 'd3i4',  item: 'Cable de alimentación AC, clavija e IEC sin corrosión, dobladuras ni daño en el aislante' },
        { id: 'd3i5',  item: 'Paletas externas (palas de mano): electrodos de acero sin corrosión, suciedad ni marca de quemadura; sujeción firme al cuerpo del equipo' },
        { id: 'd3i6',  item: 'Botón de descarga en paletas (rojo) funcional al tacto; botón de carga en paleta esternal operativo' },
        { id: 'd3i7',  item: 'Electrodos de desfibrilación multifunction (parches): fecha de vencimiento vigente; envoltorio íntegro sin perforaciones' },
        { id: 'd3i8',  item: 'Cable de ECG (3 o 5 derivaciones): conductores íntegros, conectores sin corrosión, codificación de colores legible' },
        { id: 'd3i9',  item: 'Sensor SpO2 (dedo / clip): cable sin peladura, ventana óptica limpia' },
        { id: 'd3i10', item: 'Manguito NIBP y tubería: sin fisuras, deformaciones ni fugas visibles en el circuito neumático' },
        { id: 'd3i11', item: 'Módulo de batería: sin signos de hinchazón, fuga electrolítica ni sulfatación; indicador de carga correcto' },
        { id: 'd3i12', item: 'Papel de registro térmico: disponible, cargado correctamente y sin humedad' },
        { id: 'd3i13', item: 'Puertos de conexión (SpO2, NIBP, temperatura, USB) sin obstrucción ni daño' },
        { id: 'd3i14', item: 'Etiqueta de identificación, activo fijo y número de serie legibles y coincidentes con inventario' },
        { id: 'd3i15', item: 'Limpieza externa realizada: carcasa con paño con alcohol isopropílico 70%; paletas con paño húmedo y secado completo' },
      ],
      verificacionBasica: [
        { id: 'd3vb1', item: 'Enciende correctamente con AC y completa autotest de hardware sin errores (batería, cargador, descarga interna)' },
        { id: 'd3vb2', item: 'Enciende y opera normalmente en modo batería al desconectar AC' },
        { id: 'd3vb3', item: 'Pantalla muestra parámetros correctamente: ECG, FC, SpO2, NIBP y batería visibles y sin artefactos' },
        { id: 'd3vb4', item: 'Selector de nivel de energía funciona correctamente en todos los pasos (2 J a 360 J)' },
        { id: 'd3vb5', item: 'Indicador de carga completa (tono audible + LED) al presionar botón de carga' },
        { id: 'd3vb6', item: 'Botón de descarga en paletas y botón de descarga frontal responden correctamente' },
        { id: 'd3vb7', item: 'Modo sincronizado (SYNC): indicador de sincronismo activo con marcador sobre onda R del ECG simulado' },
        { id: 'd3vb8', item: 'Modo DEA: pantalla guía al operador con instrucciones de voz y texto correctamente' },
        { id: 'd3vb9', item: 'Marcapasos externo (si aplica al modelo): modo MP activo, parámetros de frecuencia y corriente ajustables' },
        { id: 'd3vb10', item: 'Impresora térmica: imprime registro de evento y ECG sin atascos; papel avanza correctamente' },
        { id: 'd3vb11', item: 'Alarma audible: tono de urgencia diferenciable; volumen audible a ≥ 1 metro en ambiente ruidoso' },
      ],
      pruebasFuncionales: [
        { id: 'd3pf1',  prueba: 'Energía entregada 10 J — Carga y descarga en analizador Impulse 4000 (carga 50 Ω)', valorEsperado: '10 J (± 15% = 8.5–11.5 J)', resultado: ['Pasa', 'Falla'] },
        { id: 'd3pf2',  prueba: 'Energía entregada 50 J — Carga y descarga en Impulse 4000', valorEsperado: '50 J (± 15% = 42.5–57.5 J)', resultado: ['Pasa', 'Falla'] },
        { id: 'd3pf3',  prueba: 'Energía entregada 100 J — Carga y descarga en Impulse 4000', valorEsperado: '100 J (± 15% = 85–115 J)', resultado: ['Pasa', 'Falla'] },
        { id: 'd3pf4',  prueba: 'Energía entregada 150 J — Carga y descarga en Impulse 4000', valorEsperado: '150 J (± 15% = 127.5–172.5 J)', resultado: ['Pasa', 'Falla'] },
        { id: 'd3pf5',  prueba: 'Energía entregada 200 J — Carga y descarga en Impulse 4000', valorEsperado: '200 J (± 15% = 170–230 J)', resultado: ['Pasa', 'Falla'] },
        { id: 'd3pf6',  prueba: 'Energía máxima 360 J — Carga y descarga en Impulse 4000', valorEsperado: '360 J (± 15% = 306–414 J)', resultado: ['Pasa', 'Falla'] },
        { id: 'd3pf7',  prueba: 'Tiempo de carga a energía máxima — Desde inicio de carga hasta tono de listo (batería cargada)', valorEsperado: '≤ 8 segundos a 360 J', resultado: ['Pasa', 'Falla'] },
        { id: 'd3pf8',  prueba: 'Modo sincronizado — Descarga sincronizada con onda R del ECG simulado (NSR 80 BPM ProSim 8)', valorEsperado: 'Retardo de sincronismo ≤ 60 ms post onda R', resultado: ['Pasa', 'Falla'] },
        { id: 'd3pf9',  prueba: 'Descarga automática (safety dump) — Cargar a 200 J sin descargar; aguardar 60 s', valorEsperado: 'Equipo descarga internamente y regresa a 0 J (seguridad)', resultado: ['Pasa', 'Falla'] },
        { id: 'd3pf10', prueba: 'ECG: Frecuencia cardíaca — Simulación NSR 80 BPM ProSim 8, derivación II', valorEsperado: '80 BPM (± 1 BPM)', resultado: ['Pasa', 'Falla'] },
        { id: 'd3pf11', prueba: 'ECG: Detección de fibrilación ventricular — Señal V-Fib ProSim 8', valorEsperado: 'Alarma VF activa; modo DEA recomienda descarga', resultado: ['Pasa', 'Falla'] },
        { id: 'd3pf12', prueba: 'ECG: Ritmo no desfibrilable — NSR simulado en modo DEA', valorEsperado: 'DEA indica "No se recomienda descarga"', resultado: ['Pasa', 'Falla'] },
        { id: 'd3pf13', prueba: 'SpO2: Saturación — Simulación óptica ProSim 8, sensor conectado', valorEsperado: '98% (± 2%)', resultado: ['Pasa', 'Falla'] },
        { id: 'd3pf14', prueba: 'SpO2: Frecuencia de pulso — Simulación ProSim 8', valorEsperado: '80 BPM (± 2 BPM)', resultado: ['Pasa', 'Falla'] },
        { id: 'd3pf15', prueba: 'NIBP: Presión sistólica — Simulación estática ProSim 8', valorEsperado: '120 mmHg (± 3 mmHg)', resultado: ['Pasa', 'Falla'] },
        { id: 'd3pf16', prueba: 'NIBP: Prueba de fuga neumática — Presurizar a 150 mmHg, ocluir y sostener 30 s', valorEsperado: 'Caída ≤ 6 mmHg en 30 s', resultado: ['Pasa', 'Falla'] },
        { id: 'd3pf17', prueba: 'Marcapasos externo (si aplica) — Frecuencia 80 PPM, corriente mínima de captura en Impulse 4000', valorEsperado: 'Ancho de pulso 20–40 ms; frecuencia 80 PPM (± 1.5%)', resultado: ['Pasa', 'N/A'] },
        { id: 'd3pf18', prueba: 'Autonomía de batería — Operar en modo ECG continuo + 3 descargas a 360 J en modo batería', valorEsperado: '≥ 3 descargas a 360 J y ≥ 2 h monitoreo continuo', resultado: ['Pasa', 'Falla'] },
        { id: 'd3pf19', prueba: 'Impresora térmica — Imprimir reporte de evento post descarga', valorEsperado: 'Registro impreso completo, legible, sin manchas ni cortes', resultado: ['Pasa', 'Falla'] },
      ],
      estadoFinal: ['Apto para uso', 'Apto con observaciones', 'No apto / retirar de servicio'],
      accionesRealizadas: [
        'Limpieza externa de carcasa y paletas',
        'Verificación de energía de desfibrilación con analizador Impulse 4000',
        'Verificación de modo DEA y modo sincronizado',
        'Verificación de marcapasos externo (si aplica)',
        'Cambio / reacondicionamiento de batería',
        'Reemplazo de electrodos multifunction (parches) vencidos',
        'Reemplazo de cable ECG o accesorios dañados',
        'Carga de papel térmico',
        'Actualización de software/firmware (si aplica)',
        'Remisión a servicio técnico autorizado Mindray',
      ],
    },

    'aspirador_smaf_sxt5a': {
      nombre: 'Aspirador de Secreciones SMAF SXT-5A',
      categoria: 'Biomédico',
      codigo: 'SLV-GAT-BIO-AS',
      frecuencia: ['Semestral', 'Anual'],
      condicionesPrevias: [
        'Verifique que el equipo esté apagado y desconectado de la red eléctrica antes de iniciar la inspección y limpieza.',
        'Utilice equipo de protección personal (EPP): guantes de nitrilo, tapabocas y gafas de protección durante todo el procedimiento por riesgo biológico.',
        'Vacíe y descontamine el frasco colector antes de iniciar el mantenimiento; descarte el contenido según protocolo de residuos biológicos de la institución.',
        'Confirme disponibilidad del vacuómetro de referencia calibrado (rango mínimo 0 a -760 mmHg) para verificación de vacío.',
        'No sumerja el equipo en líquidos ni permita ingreso de agua a la carcasa o motor.',
        'Si se evidencian daños en el motor, ruidos anormales, vibraciones excesivas o incapacidad de generar vacío, retire de servicio y remita a soporte técnico antes de continuar.',
        'Asegúrese de que el frasco colector esté correctamente ensamblado y con la tapa hermética antes de las pruebas funcionales.',
      ],
      inspeccion: [
        { id: 'as1',  item: 'Carcasa exterior sin grietas, deformaciones, quemaduras ni daño físico visible' },
        { id: 'as2',  item: 'Cable de alimentación AC, clavija y enchufe sin corrosión, dobladuras ni daño en el aislante' },
        { id: 'as3',  item: 'Interruptor de encendido/apagado funcional al tacto; sin atascamiento ni daño' },
        { id: 'as4',  item: 'Perilla o control de regulación de vacío con giro suave y uniforme en todo el rango' },
        { id: 'as5',  item: 'Manómetro o vacuómetro integrado: carátula legible, aguja sin atascamiento, vidrio o acrílico sin fisuras' },
        { id: 'as6',  item: 'Frasco colector: íntegro sin grietas, transparente para visualización del contenido, marcas de nivel legibles' },
        { id: 'as7',  item: 'Tapa del frasco colector: sello hermético en buen estado, sin deformaciones ni grietas; mecanismo de cierre firme' },
        { id: 'as8',  item: 'Flotador de seguridad (anti-desbordamiento): libre de incrustaciones, móvil y funcional' },
        { id: 'as9',  item: 'Tuberías internas y externas: sin acodamientos, fisuras, decoloración ni obstrucciones visibles' },
        { id: 'as10', item: 'Filtro bacteriano (si aplica): sin saturación, decoloración ni humedad excesiva; fecha de cambio vigente' },
        { id: 'as11', item: 'Trampa de agua / filtro hidrofóbico: sin bloqueo por condensación ni humedad' },
        { id: 'as12', item: 'Ruedas o base de soporte: en buen estado, seguras; frenos funcionales (si aplica)' },
        { id: 'as13', item: 'Etiqueta de identificación, activo fijo y número de serie legibles y coincidentes con inventario' },
        { id: 'as14', item: 'Limpieza externa realizada: carcasa con paño con alcohol isopropílico 70%; frasco colector descontaminado con solución enzimática y enjuague completo' },
      ],
      verificacionBasica: [
        { id: 'asvb1', item: 'Enciende correctamente; motor arranca sin ruidos anormales (chirridos, golpeteos o vibraciones excesivas)' },
        { id: 'asvb2', item: 'El equipo genera vacío perceptible al ocluir la entrada de la manguera de aspiración en los primeros 5 segundos' },
        { id: 'asvb3', item: 'Perilla de regulación permite ajustar el vacío de forma progresiva y controlada en todo el rango' },
        { id: 'asvb4', item: 'El frasco colector no presenta fugas de aire con el sistema en operación y la tapa correctamente cerrada' },
        { id: 'asvb5', item: 'Flotador de seguridad bloquea el paso al motor al simular nivel máximo del frasco (prueba funcional de seguridad)' },
        { id: 'asvb6', item: 'El equipo se apaga correctamente al accionar el interruptor; no presenta inercia de motor prolongada anormal' },
      ],
      pruebasFuncionales: [
        { id: 'aspf1', prueba: 'Vacío máximo libre — Encender, ocluir salida de manguera completamente y registrar vacío máximo con vacuómetro patrón', valorEsperado: '≥ -550 mmHg (-73 kPa) en ≤ 30 s (según especificación SXT-5A)', resultado: ['Pasa', 'Falla'] },
        { id: 'aspf2', prueba: 'Vacío de trabajo bajo — Ajustar perilla al mínimo; medir vacío con vacuómetro patrón y manguera ocluid', valorEsperado: 'Vacío regulable ≥ -80 mmHg en posición mínima', resultado: ['Pasa', 'Falla'] },
        { id: 'aspf3', prueba: 'Vacío de trabajo alto — Ajustar perilla al máximo; medir vacío con vacuómetro patrón', valorEsperado: 'Vacío regulable ≤ -550 mmHg en posición máxima', resultado: ['Pasa', 'Falla'] },
        { id: 'aspf4', prueba: 'Estabilidad de vacío — Mantener vacío a -300 mmHg con manguera ocluid durante 60 s; registrar variación', valorEsperado: 'Variación ≤ ± 20 mmHg durante 60 s (sin fugas)', resultado: ['Pasa', 'Falla'] },
        { id: 'aspf6', prueba: 'Tiempo de respuesta — Desde encendido hasta alcanzar -300 mmHg con manguera ocluid', valorEsperado: '≤ 20 segundos', resultado: ['Pasa', 'Falla'] },
        { id: 'aspf7', prueba: 'Prueba de hermeticidad del frasco — Generar vacío a -400 mmHg, cerrar válvula de entrada y monitorear durante 2 min', valorEsperado: 'Pérdida de vacío ≤ 30 mmHg en 2 min (sin fugas en frasco ni tapa)', resultado: ['Pasa', 'Falla'] },
      ],
      estadoFinal: ['Apto para uso', 'Apto con observaciones', 'No apto / retirar de servicio'],
      accionesRealizadas: [
        'Limpieza externa de carcasa',
        'Reemplazo de filtro bacteriano / filtro hidrofóbico',
        'Reemplazo de tuberías o mangueras deterioradas',
        'Verificación de vacío con vacuómetro patrón',
      ],
    },

    'pulsioximetro_mindray_pm60': {
      nombre: 'Pulsioxímetro de Mano Mindray PM-60',
      categoria: 'Biomédico',
      codigo: 'SLV-GAT-BIO-PX',
      frecuencia: ['Semestral', 'Anual'],
      condicionesPrevias: [
        'Verifique que el equipo esté apagado y con batería suficiente (≥ 50%) antes de iniciar la inspección física.',
        'Confirme disponibilidad del simulador de SpO2 (Fluke ProSim 8 o Nonin 6000Q/equivalente) con certificado de calibración vigente, o en su defecto utilice dedo de prueba Mindray compatible.',
        'Limpie el sensor de SpO2 y la ventana óptica antes de las pruebas para evitar lecturas erróneas por suciedad o residuos.',
        'No exponga el sensor a luz ambiental intensa (luz solar directa o fuentes de alta intensidad) durante las pruebas funcionales.',
        'No sumerja el equipo ni el sensor en líquidos; limpiar únicamente con paño levemente humedecido con alcohol isopropílico 70%.',
        'Las intervenciones internas deben realizarse exclusivamente por personal de servicio autorizado Mindray según manual de servicio PM-60.',
        'Si se evidencian daños, lecturas persistentemente erróneas o mensajes de error no resolubles, retire de servicio y remita a soporte técnico autorizado Mindray.',
      ],
      inspeccion: [
        { id: 'pm1',  item: 'Carcasa exterior íntegra, sin grietas, deformaciones, impactos ni daño físico visible' },
        { id: 'pm2',  item: 'Pantalla OLED/LCD: sin pixeles muertos, manchas ni daño visible; visualización clara y nítida' },
        { id: 'pm3',  item: 'Botones de encendido y navegación sin atascamiento, sin daño; respuesta al tacto correcta' },
        { id: 'pm4',  item: 'Cubierta de la bahía de baterías sin grietas; tapa con cierre firme y resortes intactos' },
        { id: 'pm5',  item: 'Baterías AA instaladas sin signos de fuga, corrosión, deformación ni sulfatación en contactos' },
        { id: 'pm6',  item: 'Contactos metálicos de batería limpios y sin oxidación' },
        { id: 'pm7',  item: 'Cable del sensor SpO2 (si es sensor externo): sin cortes, dobleces severos ni pelado del aislante' },
        { id: 'pm8',  item: 'Conector del sensor SpO2: pines sin dobladuras, sin oxidación y con encaje firme al equipo' },
        { id: 'pm9',  item: 'Ventana óptica del sensor SpO2 (fotodiodo/emisores LED): limpia, sin arañazos, manchas ni residuos' },
        { id: 'pm10', item: 'Clip/pinza del sensor de dedo: muelle funcional con presión adecuada, sin deformación' },
        { id: 'pm11', item: 'Etiqueta de identificación de activo fijo y número de serie legible, coincidente con el inventario' },
        { id: 'pm12', item: 'Limpieza externa realizada con paño suave levemente humedecido con alcohol isopropílico 70%; sensor limpiado con paño suave sin sumergir' },
      ],
      verificacionBasica: [
        { id: 'pmvb1', item: 'Enciende correctamente al presionar el botón de encendido; pantalla muestra logo Mindray y autoverificación sin mensajes de error' },
        { id: 'pmvb2', item: 'Pantalla muestra todos los campos activos: SpO2 (%), Frecuencia de Pulso (lpm), barra de pletismografía (onda de pulso) e indicador de batería' },
        { id: 'pmvb3', item: 'Indicador de nivel de batería muestra carga suficiente (≥ 2 segmentos de 4); sin alarma de batería baja' },
        { id: 'pmvb4', item: 'Barra de pletismografía (onda de pulso) se actualiza en tiempo real al colocar el sensor en dedo de prueba o simulador' },
        { id: 'pmvb5', item: 'Botones de navegación permiten acceder al menú de configuración (alarmas, brillo, modo) sin errores' },
        { id: 'pmvb6', item: 'Alarmas audibles: pitido de pulso activo y funcional (ajustar volumen al mínimo para prueba)' },
        { id: 'pmvb7', item: 'Función de silenciamiento de alarmas accesible y funcional según menú del equipo' },
        { id: 'pmvb8', item: 'Apagado automático por inactividad (tiempo configurado según manual) verificado; el equipo se apaga correctamente' },
      ],
      pruebasFuncionales: [
        { id: 'pmpf1',  prueba: 'SpO2: Saturación 100% — Simulador Fluke ProSim 8 / Nonin 6000Q, perfusión normal (PI 5%)', valorEsperado: '100% (± 2%)', resultado: ['Pasa', 'Falla'] },
        { id: 'pmpf2',  prueba: 'SpO2: Saturación 98% — Simulador, perfusión normal', valorEsperado: '98% (± 2%)', resultado: ['Pasa', 'Falla'] },
        { id: 'pmpf3',  prueba: 'SpO2: Saturación 95% — Simulador, perfusión normal', valorEsperado: '95% (± 2%)', resultado: ['Pasa', 'Falla'] },
        { id: 'pmpf4',  prueba: 'SpO2: Saturación 90% — Simulador, perfusión normal', valorEsperado: '90% (± 2%)', resultado: ['Pasa', 'Falla'] },
        { id: 'pmpf5',  prueba: 'SpO2: Saturación 85% — Simulador, perfusión normal', valorEsperado: '85% (± 3%)', resultado: ['Pasa', 'Falla'] },
        { id: 'pmpf6',  prueba: 'SpO2: Saturación 70% — Simulador (punto mínimo de verificación clínica)', valorEsperado: '70% (± 3%)', resultado: ['Pasa', 'Falla'] },
        { id: 'pmpf7',  prueba: 'Frecuencia de pulso: 60 lpm — Simulador ProSim 8 / Nonin 6000Q', valorEsperado: '60 lpm (± 2 lpm)', resultado: ['Pasa', 'Falla'] },
        { id: 'pmpf8',  prueba: 'Frecuencia de pulso: 80 lpm — Simulador', valorEsperado: '80 lpm (± 2 lpm)', resultado: ['Pasa', 'Falla'] },
        { id: 'pmpf9',  prueba: 'Frecuencia de pulso: 100 lpm — Simulador', valorEsperado: '100 lpm (± 2 lpm)', resultado: ['Pasa', 'Falla'] },
        { id: 'pmpf10', prueba: 'Frecuencia de pulso: 120 lpm — Simulador', valorEsperado: '120 lpm (± 2 lpm)', resultado: ['Pasa', 'Falla'] },
        { id: 'pmpf11', prueba: 'Frecuencia de pulso: 250 lpm — Simulador (límite superior)', valorEsperado: '250 lpm (± 3 lpm)', resultado: ['Pasa', 'Falla'] },
        { id: 'pmpf12', prueba: 'Índice de perfusión (PI) — Simulador con perfusión reducida (1%)', valorEsperado: 'PI ≤ 1% visible en pantalla; indicador de señal débil activo si PI < 0.2%', resultado: ['Pasa', 'Falla'] },
        { id: 'pmpf13', prueba: 'Alarma SpO2 baja — Configurar límite inferior 90%; simular 85% con simulador', valorEsperado: 'Alarma audible y visual activa (parpadeo pantalla + pitido)', resultado: ['Pasa', 'Falla'] },
        { id: 'pmpf14', prueba: 'Alarma FC alta — Configurar límite superior 120 lpm; simular 130 lpm', valorEsperado: 'Alarma audible y visual activa', resultado: ['Pasa', 'Falla'] },
        { id: 'pmpf15', prueba: 'Alarma FC baja — Configurar límite inferior 50 lpm; simular 40 lpm', valorEsperado: 'Alarma audible y visual activa', resultado: ['Pasa', 'Falla'] },
        { id: 'pmpf16', prueba: 'Alarma sensor desconectado — Retirar sensor del simulador durante medición activa', valorEsperado: 'Mensaje de error / alarma técnica en pantalla inmediata (≤ 10 s)', resultado: ['Pasa', 'Falla'] },
        { id: 'pmpf17', prueba: 'Alarma batería baja — Verificar comportamiento con batería casi agotada (< 1 segmento)', valorEsperado: 'Mensaje de batería baja visible; alarma audible de advertencia activa', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'pmpf18', prueba: 'Onda pletismográfica — Observar forma de onda en pantalla durante medición activa con simulador', valorEsperado: 'Onda de pulso clara, continua y sincronizada con la frecuencia simulada; sin artefactos', resultado: ['Pasa', 'Falla'] },
        { id: 'pmpf19', prueba: 'Estabilidad de lectura — SpO2 98%, FC 80 lpm durante 3 minutos continuos', valorEsperado: 'Lecturas estables sin caídas ni fluctuaciones superiores a ± 2% SpO2 / ± 2 lpm FC', resultado: ['Pasa', 'Falla'] },
        { id: 'pmpf20', prueba: 'Prueba con dedo real del técnico — Colocar dedo índice del técnico en sensor; aguardar estabilización', valorEsperado: 'SpO2: 95–100%; FC fisiológica del técnico; onda pletismográfica visible y estable', resultado: ['Pasa', 'Falla'] },
      ],
      estadoFinal: ['Apto para uso', 'Apto con observaciones', 'No apto / retirar de servicio'],
      accionesRealizadas: [
        'Limpieza externa de carcasa y pantalla',
        'Limpieza de sensor SpO2 y ventana óptica',
        'Limpieza de contactos de batería',
        'Cambio de baterías AA',
        'Cambio de sensor SpO2 (si deteriorado)',
        'Verificación funcional con simulador de SpO2',
        'Verificación y ajuste de alarmas',
        'Remisión a servicio técnico autorizado Mindray',
      ],
    },

    'monitor_mindray_mec1200': {
      nombre: 'Monitor de Signos Vitales Mindray MEC-1200',
      categoria: 'Biomédico',
      codigo: 'SLV-GAT-BIO-MM',
      frecuencia: ['Semestral', 'Anual'],
      condicionesPrevias: [
        'Verifique que el equipo esté apagado y desconectado de la red eléctrica antes de iniciar la inspección física.',
        'Confirme disponibilidad del simulador de paciente Fluke ProSim 8 (o equivalente) con certificado de calibración vigente.',
        'Conecte los cables de ECG, sensor SpO2, manguito NIBP y sensor de temperatura al simulador antes de iniciar pruebas funcionales.',
        'Verifique que el cable de alimentación AC, la batería y todos los accesorios estén disponibles antes del procedimiento.',
        'No desarme el equipo ni intervenga componentes internos durante el mantenimiento preventivo rutinario.',
        'Las intervenciones internas y de servicio avanzado deben realizarse exclusivamente por personal autorizado Mindray según manual de servicio MEC-1200.',
        'Si se evidencian daños, errores persistentes o mal funcionamiento tras las pruebas, retire de servicio y remita a soporte técnico autorizado Mindray.',
      ],
      inspeccion: [
        { id: 'mc1',  item: 'Carcasa frontal, lateral y posterior sin grietas, deformaciones, impactos ni daño físico visible' },
        { id: 'mc2',  item: 'Pantalla TFT color: sin pixeles muertos, manchas, burbujas ni daño visible; brillo y contraste adecuados' },
        { id: 'mc3',  item: 'Panel táctil o teclas de función: respuesta correcta al tacto sin atascamiento ni daño' },
        { id: 'mc4',  item: 'Perilla de navegación (knob): giro uniforme, sin holgura excesiva ni atascamiento' },
        { id: 'mc5',  item: 'Cable de alimentación AC, clavija y enchufe sin corrosión, dobladuras ni daño en el aislante' },
        { id: 'mc6',  item: 'Batería interna sin signos externos de fuga, deformación ni sobrecalentamiento; indicador de carga visible' },
        { id: 'mc7',  item: 'Cable troncal de ECG (5 ó 10 derivaciones): íntegro, sin cortes, dobleces severos ni conectores dañados' },
        { id: 'mc8',  item: 'Sensor SpO2 (clip de dedo o adhesivo): ventana óptica limpia, sin arañazos; cable sin pelado ni dobleces' },
        { id: 'mc9',  item: 'Manguito NIBP y manguera: sin fisuras, grietas ni fugas; conector firme al equipo' },
        { id: 'mc10', item: 'Sensor/sonda de temperatura: íntegro, limpio y conector firme' },
        { id: 'mc11', item: 'Puertos laterales (USB, Ethernet, impresora): sin daño ni obstrucción visible' },
        { id: 'mc12', item: 'Soporte de montaje, brazo o carro: estable, seguro y sin deformaciones; ruedas y frenos funcionales (si aplica)' },
        { id: 'mc13', item: 'Etiqueta de identificación de activo fijo y número de serie legible, coincidente con el inventario' },
        { id: 'mc14', item: 'Limpieza externa realizada: carcasa con paño humedecido en alcohol isopropílico 70%; pantalla con paño suave seco o ligeramente húmedo; accesorios limpios' },
      ],
      verificacionBasica: [
        { id: 'mcvb1', item: 'Enciende correctamente con AC; logo Mindray visible y autoverificación POST completa sin mensajes de error persistentes' },
        { id: 'mcvb2', item: 'Pantalla muestra todos los campos activos en la pantalla principal: ECG, SpO2, NIBP, Temperatura, FR y estado de batería' },
        { id: 'mcvb3', item: 'Opera en modo batería al desconectar AC: el equipo mantiene funcionamiento completo sin interrupciones' },
        { id: 'mcvb4', item: 'Indicador de carga de batería muestra nivel adecuado; sin alarma de batería baja al conectar AC' },
        { id: 'mcvb5', item: 'Perilla de navegación y teclas de función permiten navegar todos los menús sin errores (Configuración, Alarmas, Revisión, NIBP, etc.)' },
        { id: 'mcvb6', item: 'Fecha, hora y datos de configuración básica (unidades, idioma, volumen de alarmas) verificados y correctos' },
        { id: 'mcvb7', item: 'Alarmas audibles y visuales funcionales: el tono de alarma es audible a volumen medio y el indicador luminoso parpadea correctamente' },
        { id: 'mcvb8', item: 'Función de silenciamiento y pausa de alarmas accesible y funcional desde pantalla principal' },
        { id: 'mcvb9', item: 'Detección de sensor desconectado: al retirar un cable, el equipo muestra mensaje de error o alarma técnica en pantalla en ≤ 10 s' },
        { id: 'mcvb10', item: 'Conectividad de red (si aplica): verificar que el equipo aparece en la central de monitoreo o red hospitalaria' },
      ],
      pruebasFuncionales: [
        { id: 'mcpf1',  prueba: 'ECG: Ritmo sinusal normal (NSR) — ProSim 8, derivación II, 80 BPM', valorEsperado: '80 BPM (± 1 BPM); trazo limpio sin artefactos', resultado: ['Pasa', 'Falla'] },
        { id: 'mcpf2',  prueba: 'ECG: Amplitud de onda — Señal 1 mV pico, derivación II', valorEsperado: '1.0 mV (± 5%)', resultado: ['Pasa', 'Falla'] },
        { id: 'mcpf3',  prueba: 'ECG: Detección de arritmia — Fibrilación ventricular (V-Fib) ProSim 8', valorEsperado: 'Alarma V-Fib activa (audible y visual)', resultado: ['Pasa', 'Falla'] },
        { id: 'mcpf4',  prueba: 'ECG: Detección de arritmia — Taquicardia ventricular (V-Tach) ProSim 8', valorEsperado: 'Alarma V-Tach activa', resultado: ['Pasa', 'Falla'] },
        { id: 'mcpf5',  prueba: 'ECG: Detección de asistolia — ProSim 8', valorEsperado: 'Alarma de asistolia activa', resultado: ['Pasa', 'Falla'] },
        { id: 'mcpf6',  prueba: 'RESP: Frecuencia respiratoria — Simulación por impedancia ProSim 8', valorEsperado: '20 RPM (± 1 RPM)', resultado: ['Pasa', 'Falla'] },
        { id: 'mcpf7',  prueba: 'SpO2: Saturación 98% — Simulador ProSim 8, perfusión normal (PI 5%)', valorEsperado: '98% (± 2%)', resultado: ['Pasa', 'Falla'] },
        { id: 'mcpf8',  prueba: 'SpO2: Saturación 95% — Simulador ProSim 8', valorEsperado: '95% (± 2%)', resultado: ['Pasa', 'Falla'] },
        { id: 'mcpf9',  prueba: 'SpO2: Saturación 90% — Simulador ProSim 8', valorEsperado: '90% (± 2%)', resultado: ['Pasa', 'Falla'] },
        { id: 'mcpf10', prueba: 'SpO2: Frecuencia de pulso — Simulador ProSim 8, 80 lpm', valorEsperado: '80 lpm (± 2 lpm)', resultado: ['Pasa', 'Falla'] },
        { id: 'mcpf11', prueba: 'SpO2: Alarma de desaturación — Configurar límite 92%, simular 88%', valorEsperado: 'Alarma audible y visual activa', resultado: ['Pasa', 'Falla'] },
        { id: 'mcpf12', prueba: 'NIBP: Presión sistólica — Simulación estática ProSim 8', valorEsperado: '120 mmHg (± 3 mmHg)', resultado: ['Pasa', 'Falla'] },
        { id: 'mcpf13', prueba: 'NIBP: Presión diastólica — Simulación estática ProSim 8', valorEsperado: '80 mmHg (± 3 mmHg)', resultado: ['Pasa', 'Falla'] },
        { id: 'mcpf14', prueba: 'NIBP: Presión media (MAP) — Cálculo automático del monitor', valorEsperado: '93 mmHg (± 3 mmHg)', resultado: ['Pasa', 'Falla'] },
        { id: 'mcpf15', prueba: 'NIBP: Prueba de fuga del manguito — Inflar a 200 mmHg, ocluir y sostener 30 s', valorEsperado: 'Caída ≤ 6 mmHg en 30 s', resultado: ['Pasa', 'Falla'] },
        { id: 'mcpf16', prueba: 'NIBP: Alarma de hipertensión — Configurar límite sistólica 140 mmHg; simular 160 mmHg', valorEsperado: 'Alarma audible y visual activa', resultado: ['Pasa', 'Falla'] },
        { id: 'mcpf17', prueba: 'Temperatura: Canal 1 — Simulación resistiva ProSim 8 a 37.0 °C', valorEsperado: '37.0 °C (± 0.1 °C)', resultado: ['Pasa', 'Falla'] },
        { id: 'mcpf18', prueba: 'Temperatura: Canal 1 — Simulación a 38.5 °C (fiebre)', valorEsperado: '38.5 °C (± 0.1 °C)', resultado: ['Pasa', 'Falla'] },
        { id: 'mcpf19', prueba: 'Alarmas de FC: Límite superior 100 lpm — Simular 120 lpm con ProSim 8', valorEsperado: 'Alarma audible y visual activa', resultado: ['Pasa', 'Falla'] },
        { id: 'mcpf20', prueba: 'Alarmas de FC: Límite inferior 50 lpm — Simular 40 lpm con ProSim 8', valorEsperado: 'Alarma audible y visual activa', resultado: ['Pasa', 'Falla'] },
        { id: 'mcpf21', prueba: 'Alarma sensor ECG desconectado — Retirar cable ECG durante monitoreo activo', valorEsperado: 'Mensaje de derivación caída / alarma técnica inmediata en ≤ 10 s', resultado: ['Pasa', 'Falla'] },
        { id: 'mcpf22', prueba: 'Alarma sensor SpO2 desconectado — Retirar sensor SpO2 durante medición activa', valorEsperado: 'Alarma técnica de sensor desconectado en ≤ 10 s', resultado: ['Pasa', 'Falla'] },
        { id: 'mcpf23', prueba: 'Batería: Autonomía — Desconectar AC y verificar funcionamiento continuo', valorEsperado: '≥ 2 horas de operación continua con batería cargada (según especificación Mindray MEC-1200)', resultado: ['Pasa', 'Falla'] },
        { id: 'mcpf24', prueba: 'Revisión de tendencias — Navegar al menú de tendencias y verificar registros históricos de los parámetros', valorEsperado: 'Tendencias guardadas accesibles; datos coherentes con las mediciones realizadas', resultado: ['Pasa', 'Falla'] },
      ],
      estadoFinal: ['Apto para uso', 'Apto con observaciones', 'No apto / retirar de servicio'],
      accionesRealizadas: [
        'Limpieza externa de carcasa y pantalla',
        'Limpieza de accesorios (sensor SpO2, manguito NIBP, sonda temperatura, cables ECG)',
        'Verificación funcional con simulador ProSim 8',
        'Calibración / verificación de parámetros NIBP y temperatura',
        'Verificación de alarmas y configuración',
        'Cambio de batería interna',
        'Cambio de accesorios deteriorados',
        'Verificación de conectividad de red (si aplica)',
        'Remisión a servicio técnico autorizado Mindray',
      ],
    },

    'laringoscopio_convencional_fibra_optica': {
      nombre: 'Laringoscopio Convencional de Fibra Óptica (Hojas Macintosh / Miller)',
      categoria: 'Biomédico',
      codigo: 'SLV-GAT-BIO-LR',
      frecuencia: ['Semestral', 'Anual'],
      condicionesPrevias: [
        'Verifique que el equipo haya sido sometido a proceso de desinfección de alto nivel (DAN) o esterilización según política institucional antes de realizar el mantenimiento preventivo.',
        'Utilice equipo de protección personal (EPP) completo durante todo el procedimiento: guantes de nitrilo, tapabocas y gafas de protección.',
        'Confirme disponibilidad de todas las hojas del set (Macintosh No. 1, 2, 3, 4 y/o Miller No. 0, 1, 2, 3) para inspeccionarlas individualmente.',
        'Confirme disponibilidad de baterías nuevas del tipo correspondiente al mango (AA, C o D según modelo) para verificación de iluminación.',
        'Tenga a mano luxómetro (o aplicación de referencia) para verificación objetiva de intensidad lumínica si está disponible; de lo contrario realice verificación visual comparativa.',
        'No sumerja el mango en líquidos ni exponga la unión mango-hoja a inmersión; solo las hojas desmontables son aptas para esterilización por autoclave o inmersión según su material.',
        'Si se detectan daños en el haz de fibra óptica, fallas eléctricas internas o corrosión severa, retire de servicio y remita a mantenimiento especializado o proveedor.',
      ],
      inspeccion: [
        { id: 'lr1',  item: 'Mango: carcasa exterior sin grietas, deformaciones, corrosión ni daño físico visible' },
        { id: 'lr2',  item: 'Mango: superficie antideslizante (estrías o goma) íntegra, limpia y sin desprendimientos' },
        { id: 'lr3',  item: 'Tapa del compartimento de baterías: abre y cierra correctamente; rosca o mecanismo de cierre funcional sin daño' },
        { id: 'lr4',  item: 'Contactos eléctricos internos del mango: limpios, sin oxidación, sulfatación ni deformación; resorte de contacto con tensión adecuada' },
        { id: 'lr5',  item: 'Conector de acoplamiento mango–hoja (gancho o bayoneta): sin desgaste excesivo, sin dobladuras; encaje firme y seguro con todas las hojas del set' },
        { id: 'lr6',  item: 'Hoja Macintosh No. 1: íntegra, sin fracturas, bordes sin rebabas ni puntos cortantes; superficie limpia y sin incrustaciones' },
        { id: 'lr7',  item: 'Hoja Macintosh No. 2: íntegra, sin fracturas, bordes sin rebabas ni puntos cortantes; superficie limpia y sin incrustaciones' },
        { id: 'lr8',  item: 'Hoja Macintosh No. 3: íntegra, sin fracturas, bordes sin rebabas ni puntos cortantes; superficie limpia y sin incrustaciones' },
        { id: 'lr9',  item: 'Hoja Macintosh No. 4: íntegra, sin fracturas, bordes sin rebabas ni puntos cortantes; superficie limpia y sin incrustaciones' },
        { id: 'lr10', item: 'Hojas Miller (si aplica al set): íntegras, sin fracturas ni rebabas; superficie limpia y sin incrustaciones' },
        { id: 'lr11', item: 'Ventana óptica / fibra óptica de cada hoja: limpia, sin manchas, residuos, rayones ni fibras rotas visibles (puntos oscuros en el haz)' },
        { id: 'lr12', item: 'Bombillo o LED en cada hoja (si aplica a hojas con iluminación propia): íntegro y sin signos de quemado' },
        { id: 'lr13', item: 'Mecanismo de despliegue de hoja: articulación mango–hoja gira libremente hasta posición de trabajo (90°) y queda firme sin juego excesivo' },
        { id: 'lr14', item: 'Bolsa, estuche o caja de transporte: íntegra, limpia y con compartimentos adecuados para cada hoja; cierre funcional' },
        { id: 'lr15', item: 'Etiqueta de identificación de activo fijo y número de serie (mango y set) legible y coincidente con el inventario' },
      ],
      verificacionBasica: [
        { id: 'lrvb1', item: 'Instalar baterías nuevas en el mango y verificar que el compartimento cierra herméticamente sin holguras' },
        { id: 'lrvb2', item: 'Al desplegar cualquier hoja a 90°, el circuito eléctrico se activa y la luz enciende automáticamente (sin botón adicional)' },
        { id: 'lrvb3', item: 'Al plegar la hoja, la luz se apaga completamente (ausencia de destellos o luz residual que indiquen arco eléctrico)' },
        { id: 'lrvb4', item: 'La intensidad lumínica es brillante y uniforme en todas las hojas del set, sin parpadeos ni variaciones durante 60 segundos de operación continua' },
        { id: 'lrvb5', item: 'El color de la luz es blanco frío o blanco neutro (LED) o blanco-amarillo intenso (halógeno/xenón); sin tonalidades amarillas apagadas que indiquen batería agotada o bombillo en mal estado' },
        { id: 'lrvb6', item: 'Todas las hojas encajan firmemente en el mango sin juego lateral ni desprendimiento espontáneo durante el uso simulado' },
      ],
      pruebasFuncionales: [
        { id: 'lrpf1',  prueba: 'Estabilidad de iluminación — Mantener hoja desplegada 3 minutos continuos; observar variación de luz', valorEsperado: 'Luz constante sin parpadeos, atenuaciones ni apagones durante los 3 minutos', resultado: ['Pasa', 'Falla'] },
        { id: 'lrpf2',  prueba: 'Prueba de encendido/apagado cíclico — Desplegar y plegar hoja 10 veces consecutivas', valorEsperado: 'Luz enciende y apaga correctamente en los 10 ciclos; sin falla intermitente', resultado: ['Pasa', 'Falla'] },
        { id: 'lrpf3',  prueba: 'Encaje mecánico bajo carga — Con hoja desplegada a 90°, aplicar presión lateral suave simulando uso clínico', valorEsperado: 'La hoja permanece firme en el mango sin desprendimiento ni variación de ángulo', resultado: ['Pasa', 'Falla'] },
        { id: 'lrpf4', prueba: 'Temperatura del mango durante uso — Medir temperatura exterior del mango tras 5 minutos de operación continua', valorEsperado: 'Temperatura ≤ 40 °C al tacto en carcasa exterior (sin riesgo de quemadura)', resultado: ['Pasa', 'Falla'] },
        { id: 'lrpf5', prueba: 'Verificación de integridad de la curva de hoja — Inspección visual y táctil de la curvatura de cada hoja Macintosh', valorEsperado: 'Curvatura uniforme según talla; sin deformaciones, aplastamientos ni zonas rectas no originales', resultado: ['Pasa', 'Falla'] },
        { id: 'lrpf6', prueba: 'Prueba de duración de baterías — Operación continua con baterías nuevas instaladas durante 30 minutos', valorEsperado: 'Intensidad lumínica sin caída perceptible al final de los 30 minutos', resultado: ['Pasa', 'Falla'] },
      ],
      estadoFinal: ['Apto para uso', 'Apto con observaciones', 'No apto / retirar de servicio'],
      accionesRealizadas: [
        'Inspección física completa de mango y hojas',
        'Limpieza y desinfección de contactos eléctricos del mango',
        'Cambio de baterías',
        'Cambio de bombillo / módulo LED (si aplica)',
        'Sustitución de hoja deteriorada o con fibra óptica dañada',
        'Verificación de iluminación con luxómetro',
        'Verificación de encaje y mecanismo mango–hoja',
      ],
    },

    'termohigrometro_digital_htc2': {
      nombre: 'Termohigrómetro Digital HTC-2',
      categoria: 'Biomédico',
      codigo: 'SLV-GAT-BIO-TH2',
      frecuencia: ['Semestral', 'Anual'],
      condicionesPrevias: [
        'Verifique que el dispositivo esté operativo y con pantalla encendida antes de iniciar el procedimiento.',
        'Confirme disponibilidad de un patrón de referencia certificado: termohigrómetro calibrado con vigencia de calibración activa, o cámara climática de referencia.',
        'Asegúrese de que el sensor no haya estado expuesto a humedad extrema (> 95% HR), condensación o inmersión en las últimas 2 horas antes de la verificación.',
        'El procedimiento debe realizarse en ambiente estable: temperatura entre 15 °C y 35 °C, sin corrientes de aire directas ni fuentes de calor cercanas al sensor.',
        'No cubra ni obstruya las ranuras o ventanas del sensor de temperatura/humedad durante las pruebas; mantenga el dispositivo en posición vertical según lo indica el fabricante.',
        'Disponga de baterías de reemplazo (tipo AAA o AA según configuración del HTC-2) para verificar el nivel de carga y reemplazar si es necesario.',
        'Si el dispositivo presenta pantalla en blanco, lecturas erróneas persistentes o mensaje de error no resolvible con cambio de batería, retire de servicio antes de continuar.',
      ],
      inspeccion: [
        { id: 'h2i1',  item: 'Carcasa exterior íntegra, sin grietas, deformaciones, impactos ni daño físico visible en frontal, lateral y posterior' },
        { id: 'h2i2',  item: 'Pantalla LCD: sin pixeles muertos, manchas, burbujas ni daño visible; todos los segmentos de dígitos funcionales y legibles' },
        { id: 'h2i3',  item: 'Botón(es) de función (MODE / SET / MAX / MIN): sin atascamiento ni daño; respuesta al tacto correcta' },
        { id: 'h2i4',  item: 'Sensor externo (si aplica): cable y sonda íntegros, sin cortes ni conector dañado; rejilla protectora sin obstrucción' },
        { id: 'h2i5',  item: 'Ventana o ranura del sensor interno de HR/temperatura: libre de polvo, hongos, residuos o contaminantes visibles' },
        { id: 'h2i6',  item: 'Compartimento de baterías: tapa con cierre firme; contactos metálicos sin oxidación, sulfatación ni deformación' },
        { id: 'h2i7',  item: 'Baterías instaladas sin signos de fuga, corrosión ni hinchazón; fecha de instalación verificada' },
        { id: 'h2i8',  item: 'Soporte trasero (pie o gancho de pared): íntegro y funcional; el dispositivo se sostiene de forma estable en su posición de trabajo' },
        { id: 'h2i9',  item: 'Etiqueta de identificación de activo fijo y número de serie legible, coincidente con el inventario' },
        { id: 'h2i10', item: 'Limpieza externa realizada con paño seco o ligeramente humedecido con alcohol isopropílico 70%; ranura del sensor soplada con aire comprimido seco' },
      ],
      verificacionBasica: [
        { id: 'h2vb1', item: 'Pantalla enciende correctamente al insertar baterías; todos los segmentos LCD visibles y nítidos' },
        { id: 'h2vb2', item: 'Pantalla muestra simultáneamente temperatura (°C o °F) y humedad relativa (%) en el display principal' },
        { id: 'h2vb3', item: 'Indicador de nivel de batería visible en pantalla; sin símbolo de batería baja con baterías nuevas o en buen estado' },
        { id: 'h2vb4', item: 'Función de cambio de unidades °C/°F operativa: al presionar el botón, el valor se convierte correctamente' },
        { id: 'h2vb5', item: 'Función de memoria MAX/MIN operativa: el dispositivo retiene y muestra los valores máximos y mínimos registrados' },
        { id: 'h2vb6', item: 'Ícono de confort (seco / confort / húmedo) visible y coherente con la lectura de HR actual' },
        { id: 'h2vb7', item: 'Sensor externo (si aplica): la pantalla actualiza la lectura del canal externo al cambiar las condiciones en la sonda remota' },
        { id: 'h2vb8', item: 'Las lecturas se actualizan en pantalla cada 10–30 segundos; sin congelamiento de valores' },
      ],
      pruebasFuncionales: [
        { id: 'h2pf1',  prueba: 'Temperatura interna — Comparación con patrón calibrado en ambiente estable (≥ 15 min de estabilización)', valorEsperado: 'Diferencia ≤ ± 1 °C respecto al patrón (especificación HTC-2: ± 1 °C en rango -10 °C a 50 °C)', resultado: ['Pasa', 'Falla'] },

        { id: 'h2pf2',  prueba: 'Temperatura en escala °F — Convertir lectura del patrón a °F y comparar con display del HTC-2 en modo °F', valorEsperado: 'Diferencia ≤ ± 1.8 °F respecto al valor convertido del patrón', resultado: ['Pasa', 'Falla'] },

        { id: 'h2pf3',  prueba: 'Humedad relativa interna — Comparación con patrón calibrado en ambiente estable (≥ 15 min de estabilización)', valorEsperado: 'Diferencia ≤ ± 5% HR respecto al patrón (especificación HTC-2: ± 5% HR en rango 10–99% HR)', resultado: ['Pasa', 'Falla'] },
      ],
      estadoFinal: ['Apto para uso', 'Apto con observaciones', 'No apto / retirar de servicio'],
      accionesRealizadas: [
        'Limpieza externa de carcasa y ventana del sensor',
        'Soplado de ranura del sensor con aire comprimido seco',
        'Limpieza de contactos de batería',
        'Cambio de baterías (AAA / AA según modelo)',
        'Comparación y verificación con patrón calibrado (temperatura y humedad)',
        'Verificación de funciones MAX/MIN y cambio de unidades',
        'Sustitución del dispositivo por falla en sensor o pantalla',
      ],
    },

    'termometro_digital_witpoce': {
      nombre: 'Termómetro Digital WITPOCE',
      categoria: 'Biomédico',
      codigo: 'SLV-GAT-BIO-TDW',
      frecuencia: ['Semestral', 'Anual'],
      condicionesPrevias: [
        'Verifique que el dispositivo esté operativo, con pantalla LCD visible y batería LR44 instalada antes de iniciar el procedimiento.',
        'Confirme disponibilidad de un termómetro patrón calibrado o simulador/cámara térmica de referencia con vigencia de calibración activa.',
        'Realice la verificación en ambiente estable, sin corrientes de aire directas, radiación solar ni fuentes de calor cercanas al sensor.',
        'Permita estabilización mínima de 15 minutos entre el equipo y el patrón antes de registrar lecturas comparativas.',
        'No sumerja el dispositivo en líquidos ni exponga la pantalla o el compartimento de batería a humedad directa.',
        'Si el equipo presenta pantalla en blanco, segmentos incompletos, lecturas erráticas persistentes o falla de alimentación, retire de servicio antes de continuar.',
      ],
      inspeccion: [
        { id: 'wti1', item: 'Carcasa exterior íntegra, sin grietas, deformaciones, golpes ni daño físico visible' },
        { id: 'wti2', item: 'Pantalla LCD clara, legible y sin pérdida de segmentos' },
        { id: 'wti3', item: 'Botón(es) de función operativos, sin atascamiento ni daño mecánico' },
        { id: 'wti4', item: 'Sensor interno y/o sonda externa (si aplica) íntegros, sin cortes, fisuras ni obstrucciones' },
        { id: 'wti5', item: 'Compartimento de batería limpio; contactos sin corrosión, sulfatación ni deformación' },
        { id: 'wti6', item: 'Batería LR44 instalada sin signos de fuga, hinchazón o agotamiento evidente' },
        { id: 'wti7', item: 'Soporte, clip o sistema de fijación en buen estado (si aplica)' },
        { id: 'wti8', item: 'Etiqueta de identificación o número de serie legible y coincidente con inventario (si aplica)' },
        { id: 'wti9', item: 'Limpieza externa realizada con paño suave seco o ligeramente humedecido con alcohol isopropílico 70%' },
      ],
      verificacionBasica: [
        { id: 'wtvb1', item: 'La pantalla enciende correctamente y muestra lectura estable de temperatura' },
        { id: 'wtvb2', item: 'La lectura se actualiza progresivamente ante cambios moderados de temperatura' },
        { id: 'wtvb3', item: 'La unidad de medición mostrada en pantalla es coherente con la configuración del equipo (°C / °F si aplica)' },
        { id: 'wtvb4', item: 'No se evidencian reinicios espontáneos, parpadeos anormales ni pérdida de visualización' },
        { id: 'wtvb5', item: 'El equipo mantiene lectura continua con alimentación por batería LR44 de 1.5 V' },
      ],
      pruebasFuncionales: [
        { id: 'wtpf1', prueba: 'Temperatura ambiente — Comparación con patrón calibrado en ambiente estable (≥ 15 min de estabilización)', valorEsperado: 'Diferencia ≤ ± 1 °C respecto al patrón', resultado: ['Pasa', 'Falla'] },
        { id: 'wtpf2', prueba: 'Respuesta a incremento moderado de temperatura — Acercar el sensor a una fuente térmica controlada sin exceder el rango del fabricante', valorEsperado: 'La lectura aumenta de forma progresiva y sin saltos erráticos', resultado: ['Pasa', 'Falla'] },
        { id: 'wtpf3', prueba: 'Respuesta a descenso moderado de temperatura — Ubicar el sensor en ambiente más frío controlado sin exceder el rango del fabricante', valorEsperado: 'La lectura disminuye de forma progresiva y sin congelamiento de pantalla', resultado: ['Pasa', 'Falla'] },
        { id: 'wtpf6', prueba: 'Consistencia visual y funcional de pantalla — Verificar visualización continua durante 5 min de operación', valorEsperado: 'Pantalla LCD legible, sin pérdida de segmentos ni apagado inesperado', resultado: ['Pasa', 'Falla'] },
      ],
      estadoFinal: ['Apto para uso', 'Apto con observaciones', 'No apto / retirar de servicio'],
      accionesRealizadas: [
        'Limpieza externa de carcasa y pantalla',
        'Limpieza de contactos de batería',
        'Cambio de batería LR44',
        'Verificación comparativa con patrón calibrado',
        'Revisión de sensor interno y/o sonda externa',
      ],
    },
    'unidad_calentamiento_nellcor_wt6000': {
      nombre: 'Unidad de Calentamiento Nellcor WarmTouch WT 6000',
      categoria: 'Biomédico',
      codigo: 'SLV-GAT-BIO-WT6000',
      frecuencia: ['Semestral', 'Anual'],
      condicionesPrevias: [
        'Verifique que la unidad esté desconectada de la red eléctrica antes de iniciar la inspección física y limpieza externa.',
        'Confirme disponibilidad del analizador de seguridad eléctrica vigente y termómetro patrón o instrumento de referencia para verificación funcional cuando aplique.',
        'Inspeccione que la manguera de salida de aire y el puerto de conexión estén libres de obstrucciones, deformaciones o residuos.',
        'Revise que el filtro de aire se encuentre instalado correctamente y sin indicación de reemplazo vencido en pantalla.',
        'Ubique la unidad sobre soporte estable (carro, baranda o porta sueros) y asegure que exista adecuada ventilación alrededor del equipo.',
        'No opere la unidad sin filtro instalado, con carcasa abierta ni con evidencia de ingreso de líquidos al sistema.',
        'Si se evidencian alarmas persistentes, ausencia de flujo de aire, sobrecalentamiento, olor anormal o falla de pantalla, retire de servicio antes de continuar.',
      ],
      inspeccion: [
        { id: 'wt6000i1', item: 'Carcasa exterior íntegra, sin grietas, deformaciones, golpes ni daño físico visible' },
        { id: 'wt6000i2', item: 'Pantalla LCD y panel de control legibles, sin pérdida de segmentos ni teclas atascadas' },
        { id: 'wt6000i3', item: 'Cable de alimentación, clavija y alivio de tensión en buen estado, sin cortes ni recalentamiento' },
        { id: 'wt6000i4', item: 'Manguera de calentamiento íntegra, sin perforaciones, acodamientos, fisuras ni suciedad excesiva' },
        { id: 'wt6000i5', item: 'Boquilla/nozzle de conexión segura, sin fracturas ni holguras anormales' },
        { id: 'wt6000i6', item: 'Filtro de aire instalado correctamente; compartimiento del filtro limpio y sin obstrucciones visibles' },
        { id: 'wt6000i7', item: 'Soporte de fijación a carro, porta sueros o baranda en buen estado y con ajuste firme' },
        { id: 'wt6000i8', item: 'Rejillas de entrada y salida de aire limpias, libres de polvo y sin obstrucción' },
        { id: 'wt6000i9', item: 'Etiquetas de identificación, activo fijo y número de serie legibles y coincidentes con inventario' },
        { id: 'wt6000i10', item: 'Limpieza externa realizada con paño suave y desinfectante compatible, sin ingreso de líquidos al interior del equipo' },
      ],
      verificacionBasica: [
        { id: 'wt6000vb1', item: 'La unidad enciende correctamente y completa autoverificación inicial sin errores aparentes' },
        { id: 'wt6000vb2', item: 'La pantalla muestra de forma clara el estado del equipo y los ajustes de temperatura disponibles' },
        { id: 'wt6000vb3', item: 'Los botones o controles permiten seleccionar correctamente los modos/temperaturas disponibles' },
        { id: 'wt6000vb4', item: 'Se percibe flujo de aire uniforme a través de la manguera al iniciar el calentamiento' },
        { id: 'wt6000vb5', item: 'No se evidencian ruidos anormales, vibraciones excesivas, olor a quemado ni sobrecalentamiento de carcasa' },
        { id: 'wt6000vb6', item: 'La unidad responde a cambio de modo y retorna a condición segura cuando se apaga' },
      ],
      pruebasFuncionales: [
        { id: 'wt6000pf1', prueba: 'Encendido y autodiagnóstico — Energizar la unidad y verificar arranque normal', valorEsperado: 'Inicio sin códigos de falla ni mensajes de error persistentes', resultado: ['Pasa', 'Falla'] },
        { id: 'wt6000pf2', prueba: 'Selección de modos/temperaturas — Verificar respuesta de cada ajuste disponible en el panel', valorEsperado: 'Permite seleccionar las 5 configuraciones disponibles, incluyendo ambiente y boost', resultado: ['Pasa', 'Falla'] },
        { id: 'wt6000pf3', prueba: 'Flujo de aire — Operar la unidad con manguera conectada y verificar salida continua', valorEsperado: 'Flujo de aire continuo, uniforme y sin interrupciones anormales', resultado: ['Pasa', 'Falla'] },
        { id: 'wt6000pf4', prueba: 'Verificación térmica en modo de calentamiento — Registrar temperatura del aire de salida con instrumento de referencia', valorEsperado: 'Genera aumento de temperatura conforme al modo seleccionado y sin sobrepasar condición de alarma', resultado: ['Pasa', 'Falla'] },
        { id: 'wt6000pf5', prueba: 'Modo Boost — Activar boost y verificar temporización/indicación del modo', valorEsperado: 'El modo boost se activa correctamente y muestra indicación/temporización asociada', resultado: ['Pasa', 'Falla'] },
        { id: 'wt6000pf6', prueba: 'Alarmas / mensajes de servicio — Verificar ausencia de alarmas activas durante la operación normal', valorEsperado: 'Sin alarmas activas; filtro y estado general reportados correctamente en pantalla', resultado: ['Pasa', 'Falla'] },
        { id: 'wt6000pf7', prueba: 'Apagado seguro — Desactivar la unidad al finalizar la prueba', valorEsperado: 'El equipo se apaga correctamente sin comportamiento anormal posterior', resultado: ['Pasa', 'Falla'] },
      ],
      estadoFinal: ['Apto para uso', 'Apto con observaciones', 'No apto / retirar de servicio'],
      accionesRealizadas: [
        'Limpieza externa de carcasa y panel de control',
        'Limpieza de rejillas de ventilación y compartimiento de filtro',
        'Verificación de manguera y boquilla de conexión',
        'Reemplazo de filtro de aire (si aplica)',
        'Verificación funcional de modos de temperatura',
        'Prueba de flujo de aire y calentamiento',
        'Verificación de alarmas e indicadores en pantalla',
      ],
    },
    'gramera_seca_856': {
      nombre: 'Gramera SECA 856',
      categoria: 'Biomédico',
      codigo: 'SLV-GAT-BIO-GS856',
      frecuencia: ['Semestral', 'Anual'],
      condicionesPrevias: [
        'Ubique la gramera sobre una superficie firme, nivelada y libre de vibraciones antes de iniciar la inspección.',
        'Confirme disponibilidad de pesas patrón calibradas o masas de referencia trazables para la verificación funcional.',
        'Verifique que el plato o superficie de pesaje esté limpio, seco y libre de residuos antes de encender el equipo.',
        'Revise que las 4 baterías AAA estén instaladas correctamente y con nivel de carga suficiente.',
        'Permita estabilización del equipo por al menos 5 minutos en el área de uso antes de realizar pruebas comparativas.',
        'No exceda la capacidad máxima de 5 kg ni coloque cargas de impacto sobre la superficie de pesaje.',
        'Si el equipo presenta error de cero, inestabilidad persistente, teclas sin respuesta o daño estructural, retire de servicio antes de continuar.',
      ],
      inspeccion: [
        { id: 'gs856i1', item: 'Carcasa y base íntegras, sin grietas, deformaciones ni daño físico visible' },
        { id: 'gs856i2', item: 'Superficie de pesaje de acero inoxidable limpia, firme y sin corrosión' },
        { id: 'gs856i3', item: 'Pantalla digital legible, sin pérdida de segmentos ni manchas' },
        { id: 'gs856i4', item: 'Teclas de encendido, HOLD/TARE y funciones disponibles responden correctamente al tacto' },
        { id: 'gs856i5', item: 'Compartimento de baterías íntegro; contactos sin sulfatación, corrosión ni deformación' },
        { id: 'gs856i6', item: 'Baterías AAA instaladas sin fugas, abombamiento ni agotamiento evidente' },
        { id: 'gs856i7', item: 'Base de apoyo estable, sin balanceo ni desnivel visible' },
        { id: 'gs856i8', item: 'Etiquetas de identificación, activo fijo y número de serie legibles y coincidentes con inventario' },
        { id: 'gs856i9', item: 'Limpieza externa realizada con paño suave ligeramente humedecido, sin ingreso de líquidos al compartimento eléctrico' },
      ],
      verificacionBasica: [
        { id: 'gs856vb1', item: 'La gramera enciende correctamente y realiza puesta a cero sin carga' },
        { id: 'gs856vb2', item: 'La lectura permanece estable sin carga y retorna a cero después de retirar el peso' },
        { id: 'gs856vb3', item: 'La función TARE/HOLD opera correctamente cuando aplica al equipo' },
        { id: 'gs856vb4', item: 'El cambio de unidades (kg/lb u otra disponible) responde correctamente, si aplica al modelo configurado' },
        { id: 'gs856vb5', item: 'No se evidencian apagados inesperados, mensajes de error persistentes ni fluctuaciones anormales de lectura' },
      ],
      pruebasFuncionales: [
        { id: 'gs856pf1', prueba: 'Puesta a cero inicial — Encender el equipo sin carga sobre superficie nivelada', valorEsperado: 'Indicación 0 g o equivalente, estable y sin deriva visible', resultado: ['Pasa', 'Falla'] },
        { id: 'gs856pf2', prueba: 'Verificación con carga baja — Colocar masa patrón de 500 g', valorEsperado: 'Error máximo permitido dentro de ± 1 g', resultado: ['Pasa', 'Falla'] },
        { id: 'gs856pf3', prueba: 'Verificación con carga media — Colocar masa patrón de 2.000 g', valorEsperado: 'Error máximo permitido dentro de ± 1 g', resultado: ['Pasa', 'Falla'] },
        { id: 'gs856pf4', prueba: 'Verificación con carga alta — Colocar masa patrón de 4.000 g', valorEsperado: 'Error máximo permitido dentro de ± 2 g', resultado: ['Pasa', 'Falla'] },
        { id: 'gs856pf5', prueba: 'Prueba de repetibilidad — Realizar 3 mediciones consecutivas con la misma masa patrón de referencia', valorEsperado: 'Variación entre lecturas ≤ 1 g en cargas < 3 kg o ≤ 2 g en cargas ≥ 3 kg', resultado: ['Pasa', 'Falla'] },
        { id: 'gs856pf6', prueba: 'Prueba de tara — Colocar recipiente, aplicar TARE y luego añadir masa patrón conocida', valorEsperado: 'La lectura neta corresponde al peso agregado dentro de la resolución del equipo', resultado: ['Pasa', 'Falla'] },
        { id: 'gs856pf7', prueba: 'Retorno a cero — Retirar completamente la carga después de la medición', valorEsperado: 'La lectura retorna a cero sin error residual visible', resultado: ['Pasa', 'Falla'] },
        { id: 'gs856pf8', prueba: 'Apagado automático — Dejar el equipo sin interacción durante el tiempo programado por fabricante', valorEsperado: 'Autoapagado funcional para ahorro de batería', resultado: ['Pasa', 'Falla'] },
      ],
      estadoFinal: ['Apto para uso', 'Apto con observaciones', 'No apto / retirar de servicio'],
      accionesRealizadas: [
        'Limpieza externa de carcasa y superficie de pesaje',
        'Limpieza de compartimento y contactos de batería',
        'Cambio de baterías AAA',
        'Verificación de nivelación y estabilidad de apoyo',
        'Verificación metrológica con masas patrón',
        'Prueba funcional de TARE/HOLD',
      ],
    },

'rayos_x_portatil_carestream_motion_mobile': {
      nombre: 'Equipo de Rayos X (Portátil) Carestream Motion Mobile',
      categoria: 'Biomédico',
      codigo: 'SLV-GAT-BIO-RXP',
      frecuencia: ['Semestral', 'Anual'],
      condicionesPrevias: [
        'Verifique que el equipo esté fuera de exposición clínica y ubicado en un área segura antes de iniciar la inspección.',
        'Confirme que el mantenimiento funcional se realizará sin emisión de radiación al paciente y sin exposiciones de prueba, ya que no se dispone de equipo patrón para verificación metrológica del haz.',
        'Asegúrese de que la batería del equipo tenga carga suficiente o que el sistema se encuentre conectado según las recomendaciones del fabricante.',
        'Inspeccione el área de trabajo y garantice que no existan obstáculos para el desplazamiento, extensión del brazo ni posicionamiento del cabezal.',
        'Verifique disponibilidad del dosímetro personal, elementos de protección radiológica institucionales y acceso a los autochequeos internos del sistema.',
        'No abra cubiertas, generador, colimador ni cabezal de rayos X. Cualquier intervención interna debe ser realizada por servicio técnico autorizado.',
        'Si el equipo presenta mensajes de error, daño mecánico, sobrecalentamiento, olor anormal, fallo de frenos o anomalías eléctricas, retire de servicio antes de continuar.'
      ],
      inspeccion: [
        { id: 'mmi1', item: 'Carro/base del equipo íntegro, sin golpes estructurales, deformaciones ni corrosión visible' },
        { id: 'mmi2', item: 'Ruedas, sistema de desplazamiento, frenos y manijas funcionales; sin holguras ni bloqueo anormal' },
        { id: 'mmi3', item: 'Columna, brazo articulado y cabezal del tubo con movimiento controlado y fijación estable' },
        { id: 'mmi4', item: 'Carcasa del generador, panel de control y monitor/touchscreen sin grietas ni daño visible' },
        { id: 'mmi5', item: 'Cableado externo, conectores, cargador y clavija de alimentación en buen estado' },
        { id: 'mmi6', item: 'Colimador luminoso íntegro; perillas, mandos y centrado de campo sin atascamiento' },
        { id: 'mmi7', item: 'Indicadores, luces de estado y mandos de preparación/exposición con protección y rotulación legible' },
        { id: 'mmi8', item: 'Compartimentos, soportes de detector/accesorios y seguros mecánicos en buen estado' },
        { id: 'mmi9', item: 'Etiquetas de identificación, activo fijo, advertencias radiológicas y número de serie legibles' },
        { id: 'mmi10', item: 'Limpieza externa realizada; superficies libres de polvo y suciedad, sin ingreso de líquidos al sistema' }
      ],
      verificacionBasica: [
        { id: 'mmvb1', item: 'El sistema enciende correctamente y completa autoverificación sin mensajes críticos de falla' },
        { id: 'mmvb2', item: 'La interfaz táctil/panel permite navegación normal, selección de paciente o técnica y acceso a menús' },
        { id: 'mmvb3', item: 'La batería muestra nivel de carga y el equipo responde correctamente al modo de carga/conexión eléctrica' },
        { id: 'mmvb4', item: 'El brazo y cabezal se posicionan con estabilidad y mantienen la posición sin deriva evidente' },
        { id: 'mmvb5', item: 'La luz del colimador enciende y el ajuste manual del campo funciona correctamente' },
        { id: 'mmvb6', item: 'No se evidencian ruidos anormales, sobrecalentamiento, bloqueos de movilidad ni alarmas activas durante la revisión funcional' }
      ],
      pruebasFuncionales: [
        { id: 'mmpf1', prueba: 'Encendido y autodiagnóstico del sistema', valorEsperado: 'Inicio completo sin fallas críticas ni bloqueo operativo', resultado: ['Pasa', 'Falla'] },
        { id: 'mmpf2', prueba: 'Pantalla táctil / consola de operación', valorEsperado: 'Respuesta normal al tacto y navegación fluida entre menús', resultado: ['Pasa', 'Falla'] },
        { id: 'mmpf3', prueba: 'Movilidad del carro y frenos', valorEsperado: 'Desplazamiento controlado, frenado efectivo y maniobrabilidad segura', resultado: ['Pasa', 'Falla'] },
        { id: 'mmpf4', prueba: 'Posicionamiento de columna, brazo y cabezal', valorEsperado: 'Permite extensión/rotación normales y conserva la posición seleccionada', resultado: ['Pasa', 'Falla'] },
        { id: 'mmpf5', prueba: 'Colimador luminoso y ajuste de campo', valorEsperado: 'Luz visible y ajuste manual del campo sin atascamientos', resultado: ['Pasa', 'Falla'] },
        { id: 'mmpf6', prueba: 'Selección de técnica radiográfica (APR/manual) sin disparo', valorEsperado: 'Permite configurar parámetros y protocolos disponibles sin error', resultado: ['Pasa', 'Falla'] },
        { id: 'mmpf7', prueba: 'Estado de batería / carga', valorEsperado: 'Indica nivel de batería y estado de carga de forma coherente', resultado: ['Pasa', 'Falla'] },
        { id: 'mmpf8', prueba: 'Mensajes de sistema y alarmas', valorEsperado: 'Sin alarmas activas ni códigos de falla durante la revisión funcional', resultado: ['Pasa', 'Falla'] },
        { id: 'mmpf9', prueba: 'Verificación funcional adaptada sin equipo patrón', valorEsperado: 'Se documenta revisión operativa básica; no se realiza verificación metrológica del haz, kV, mAs, tiempo ni dosis', resultado: ['Pasa', 'Falla'] }
      ],
      estadoFinal: ['Apto para uso', 'Apto con observaciones', 'No apto / retirar de servicio'],
      accionesRealizadas: [
        'Limpieza externa de carcasa, monitor y panel de control',
        'Verificación de ruedas, frenos y maniobrabilidad',
        'Verificación de brazo articulado, columna y cabezal',
        'Verificación funcional de pantalla táctil / consola',
        'Verificación de colimador luminoso y ajuste de campo',
        'Verificación de batería, cargador y estado de alimentación',
        'Registro de observaciones por ausencia de equipo patrón para pruebas metrológicas',
        'Remisión a mantenimiento especializado o proveedor'
      ]
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
        setTimeout(function() { initSignaturePads(); }, 300);
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

    + (protocolKey === 'laringoscopio_convencional_fibra_optica' ? '' :
       '<div class="mf-section-title" style="background:'+color+'">📐 EQUIPO DE VERIFICACIÓN</div>'
    + '<div class="mf-row"><div class="mf-group"><label class="mf-label">Equipo utilizado</label><select id="mfEquipoVerificacion" class="mf-select"><option value="Simulador multiparámetro">Simulador multiparámetro</option><option value="Analizador de desfibrilador">Analizador de desfibrilador</option><option value="Vacuómetro patrón">Vacuómetro patrón</option><option value="Analizador de vacío">Analizador de vacío</option><option value="Termohigrómetro Fluke 971">Termohigrómetro Fluke 971</option><option value="Masas patrón">Masas patrón</option><option value="Otro">Otro</option></select></div><div class="mf-group"><label class="mf-label">Marca / Modelo del patrón</label><input type="text" id="mfMarcaPatron" class="mf-input" placeholder="Marca y modelo"></div></div>'
    + '<div class="mf-row"><div class="mf-group"><label class="mf-label">No. Serie del patrón</label><input type="text" id="mfSeriePatron" class="mf-input" placeholder="Número de serie"></div><div class="mf-group"><label class="mf-label">Certificado vigente hasta</label><input type="date" id="mfCertificadoVigente" class="mf-input"></div><div class="mf-group"><label class="mf-label">Tolerancia definida (mmHg/kPa)</label><input type="text" id="mfTolerancia" class="mf-input" placeholder="± ____ mmHg / kPa"></div></div>')

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
    + '<div class="mf-section-title" style="background:'+color+'">📸 REGISTRO FOTOGRÁFICO</div>'
    + '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin:10px 0">'
    + buildPhotoCaptureSectionHTML('inicio','📸 Foto inicial (antes)', '1️⃣')
    + buildPhotoCaptureSectionHTML('mitad','📸 Durante la intervención', '2️⃣')
    + buildPhotoCaptureSectionHTML('final','📸 Foto final (después)', '3️⃣')
    + '</div>'
    + '<div class="mf-section-title" style="background:'+color+'">✍️ FIRMAS</div>'
    + '<div class="mf-firma-container">'
    + '<div class="mf-firma-box"><div class="mf-firma-title">Elaboró / Ejecutó</div><canvas id="sigPadEjecuto" class="mf-signature-canvas" width="320" height="120"></canvas><button type="button" class="mf-firma-clear" onclick="clearSignature(\'sigPadEjecuto\')">Limpiar</button><input type="text" id="mfNombreEjecuto" class="mf-input" placeholder="Nombre completo" style="margin-top:6px;font-size:12px"><input type="text" id="mfCargoEjecuto" class="mf-input" placeholder="Cargo" style="margin-top:4px;font-size:12px"></div>'
    + '<div class="mf-firma-box"><div class="mf-firma-title">Recibió / Verificó</div><canvas id="sigPadRecibio" class="mf-signature-canvas" width="320" height="120"></canvas><button type="button" class="mf-firma-clear" onclick="clearSignature(\'sigPadRecibio\')">Limpiar</button><input type="text" id="mfNombreRecibio" class="mf-input" placeholder="Nombre completo" style="margin-top:6px;font-size:12px"><input type="text" id="mfCargoRecibio" class="mf-input" placeholder="Cargo" style="margin-top:4px;font-size:12px"></div>'
    + '</div>'
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
          // Firmas digitales
          firmaEjecuto:getSignatureDataURL('sigPadEjecuto'),
          nombreEjecuto:getVal('mfNombreEjecuto'),
          cargoEjecuto:getVal('mfCargoEjecuto'),
          firmaRecibio:getSignatureDataURL('sigPadRecibio'),
          nombreRecibio:getVal('mfNombreRecibio'),
          cargoRecibio:getVal('mfCargoRecibio'),
          // Fotos
          fotoInicio:(mtState.photos&&mtState.photos['inicio'])||null,
          fotoMitad:(mtState.photos&&mtState.photos['mitad'])||null,
          fotoFinal:(mtState.photos&&mtState.photos['final'])||null,
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
    + (proto.codigo === 'SLV-GAT-BIO-LR' ? '' : '<div class="sec sec-blue"><span class="sec-icon">📐</span> EQUIPO DE VERIFICACIÓN UTILIZADO</div><table class="tbl"><tr><td class="lb">Equipo utilizado</td><td class="vl">'+esc(d.equipoVerificacion)+'</td><td class="lb">Marca / Modelo</td><td class="vl">'+esc(d.marcaPatron)+'</td></tr><tr><td class="lb">No. Serie patrón</td><td class="vl">'+esc(d.seriePatron)+'</td><td class="lb">Certificado hasta</td><td class="vl">'+fmt(d.certificadoVigente)+'</td></tr><tr><td class="lb">Tolerancia</td><td class="vl" colspan="3">'+esc(d.tolerancia)+'</td></tr></table>')
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
    + (d.fotoInicio||d.fotoMitad||d.fotoFinal ? '<div class="sec"><span class="sec-icon">📸</span> REGISTRO FOTOGRÁFICO</div><div style="display:flex;gap:16px;flex-wrap:wrap;margin-top:8px">'
      + (d.fotoInicio ? '<div style="flex:1;min-width:180px"><div style="font-size:9px;font-weight:700;color:#455a64;text-transform:uppercase;margin-bottom:4px">1️⃣ Foto Inicial</div><img src="'+d.fotoInicio+'" style="width:100%;border-radius:6px;border:1px solid #cfd8dc;max-height:160px;object-fit:contain"></div>' : '')
      + (d.fotoMitad  ? '<div style="flex:1;min-width:180px"><div style="font-size:9px;font-weight:700;color:#455a64;text-transform:uppercase;margin-bottom:4px">2️⃣ Durante la Intervención</div><img src="'+d.fotoMitad+'" style="width:100%;border-radius:6px;border:1px solid #cfd8dc;max-height:160px;object-fit:contain"></div>' : '')
      + (d.fotoFinal  ? '<div style="flex:1;min-width:180px"><div style="font-size:9px;font-weight:700;color:#455a64;text-transform:uppercase;margin-bottom:4px">3️⃣ Foto Final</div><img src="'+d.fotoFinal+'" style="width:100%;border-radius:6px;border:1px solid #cfd8dc;max-height:160px;object-fit:contain"></div>' : '')
      + '</div>' : '')
    + '<div class="firmas">'
    + '<div class="firma">'+(d.firmaEjecuto&&d.firmaEjecuto!=='data:,'?'<img src="'+d.firmaEjecuto+'" style="height:50px;max-width:180px;object-fit:contain">':'<div class="firma-line"></div>')+'<br>Elaboró / Ejecutó<div class="firma-name">'+esc(d.nombreEjecuto||d.tecnico)+'</div><div style="font-size:9px;color:#78909c">'+esc(d.cargoEjecuto||'')+'</div></div>'
    + '<div class="firma">'+(d.firmaRecibio&&d.firmaRecibio!=='data:,'?'<img src="'+d.firmaRecibio+'" style="height:50px;max-width:180px;object-fit:contain">':'<div class="firma-line"></div>')+'<br>Recibió / Verificó<div class="firma-name">'+esc(d.nombreRecibio||'')+'</div><div style="font-size:9px;color:#78909c">'+esc(d.cargoRecibio||'')+'</div></div>'
    + '</div>'
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
