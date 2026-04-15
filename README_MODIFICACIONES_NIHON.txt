Implementación incluida:
- Nuevo protocolo preventivo: Monitor de Signos NIHON KOHDEN CSM-1501
- Archivo modificado: js/mantenimientos.js

Qué hace:
- Agrega la tarjeta del nuevo protocolo en “Registrar Mantenimiento Preventivo”.
- Mantiene la misma estructura operativa del protocolo AMVEX.
- Conserva y utiliza:
  - registro fotográfico (inicio / durante / final)
  - cronómetro de ejecución
  - firmas
  - generación de PDF
  - guardado en Airtable en el campo "Mantenimientos preventivo"

Pasos:
1. Reemplaza los archivos del proyecto por los de este paquete.
2. Despliega en Netlify como de costumbre.
3. En la vista Mantenimientos > + Preventivo > Registrar mantenimiento preventivo,
   ya aparecerá el protocolo:
   “Monitor de Signos NIHON KOHDEN CSM-1501”.

Nota:
- No requiere cambios adicionales en las funciones de Netlify para adjuntar el PDF,
  porque sigue usando el mismo flujo ya existente.
