PATCH - Módulo de Inventario (Airtable + Netlify)

Qué incluye
- index.html: agrega botón y módulo "Inventario" + modal de registro.
- js/app.js: agrega lógica de carga/registro/edición + exportación CSV + paginación.
- netlify/functions/inventario.js: función serverless (GET/POST/PUT) contra Airtable.

PASO A PASO

A) Airtable (Base)
1) Crea una tabla llamada exactamente: Inventario
   (Si usas otro nombre, configura AIRTABLE_INVENTARIO_TABLE en Netlify).

2) Crea estos campos EXACTAMENTE como aparecen (copiar/pegar), en el orden que quieras:

   ITEM
   EQUIPO
   MARCA
   MODELO
   FECHA FABRICA (tipo: Date)
   SERIE
   CERTIFICADO 2025
   PLACA
   CODIGO ECRI
   REGISTRO INVIMA
   TIPO DE ADQUISICION
   NO. DE CONTRATO
   SERVICIO
   UBICACIÓN
   VIDA UTIL

   FECHA DE COMRPA (tipo: Date)
   VALOR EN PESOS (tipo: Number)
   FECHA DE RECEPCIÓN (tipo: Date)
   FECHA DE INSTALACIÓN (tipo: Date)
   INICIO DE GARANTIA (tipo: Date)
   TERMINO DE GARANTIA (tipo: Date)

   CLASIFICACION BIOMEDICA
   CLASIFICACION DE LA TECNOLOGIA
   CLASIFICACION DEL RIESGO

   MANUAL (recomendado: Attachment)  *también funciona como texto si prefieres

   TIPO DE MTTO
   COSTO DE MANTENIMIENTO (tipo: Number)

   NOMBRE
   DIRECCION
   TELEFONO
   CIUDAD

   CALIBRABLE (recomendado: Single select SI/NO o Checkbox)
   N. CERTIFICADO

   FRECUENCIA DE MTTO PREVENTIVO (Single select: Mensual, Bimestral, Trimestral, Cuatrimestral, Semestral, Anual)
   FECHA PROGRAMADA DE MANTENIMINETO (tipo: Date)

   RESPONSABLE
   FRECUENCIA DE MANTENIMIENTO
   PROGRAMACION DE MANTENIMIENTO ANUAL (Long text)

Notas:
- El campo "MANUAL": la app envía un URL. Si lo defines como Attachment, Airtable adjunta por URL.
- "UBICACIÓN" incluye tilde: debe ser igual.

B) Netlify (variables de entorno)
En Netlify > Site settings > Environment variables crea:
- AIRTABLE_API_KEY = tu API key / personal access token de Airtable
- AIRTABLE_BASE_ID = tu Base ID (appXXXXXXXXXXXXXX)
- (Opcional) AIRTABLE_INVENTARIO_TABLE = Inventario  (si cambiaste el nombre)

C) Código / repositorio
1) Reemplaza tu index.html por el index.html de esta carpeta.
2) Reemplaza tu js/app.js por el js/app.js de esta carpeta.
3) Copia netlify/functions/inventario.js a tu repo en la misma ruta.

D) Deploy
- Sube los cambios a tu repositorio (git push) y Netlify desplegará.
- En local: netlify dev  (debe correr funciones en http://localhost:9000/.netlify/functions)

E) Uso
- Abre el módulo Inventario.
- + Nuevo Registro: guarda en Airtable.
- Ver/Editar: abre el mismo formulario con los datos.
- Exportar CSV: exporta los registros cargados en pantalla.

