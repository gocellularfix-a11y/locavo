# Locavo — Política de fuentes de datos

> Documento de producto (V3). Los puntos marcados como **[REVISIÓN LEGAL]**
> requieren revisión legal formal antes de la publicación comercial. No se
> inventan aquí términos de licencia: solo se registran los principios y
> los pendientes.

## Google

- Uso permitido: **enlace externo de navegación solamente** ("Cómo llegar"),
  mediante `https://www.google.com/maps/dir/?api=1&destination={lat},{lng}`.
- Sin API key, sin Google Places (Nearby/Details/Photos/Autocomplete), sin
  geocoding de Google, sin facturación de Google Maps Platform.
- Los datos de negocios de Google no se consultan, almacenan ni mezclan.

## INEGI / DENUE

- Papel: **fuente oficial principal** prevista para negocios en México.
- Estado en V3: proveedor NO conectado (esqueleto tipado).
- Antes de conectar: token del API de INEGI guardado en backend (nunca en
  el cliente ni el repositorio), consultas acotadas a Culiacán, respeto a
  los límites de uso del API.
- **[REVISIÓN LEGAL]** Confirmar términos de uso y atribución requerida de
  INEGI/DENUE para redistribución dentro de la app.

## OpenStreetMap

- Papel: **complemento abierto** de cobertura y atributos.
- Estado en V3: proveedor NO conectado (esqueleto tipado). El mapa interno
  ya usa teselas de OSM con atribución "© OpenStreetMap".
- Obligatorio al conectar datos: atribución "© OpenStreetMap contributors"
  y cumplimiento de la licencia **ODbL** (incluidas las condiciones de
  share-alike para bases de datos derivadas).
- **No abusar de servidores públicos**: nada de barridos masivos contra la
  Overpass API pública; usar extractos regionales o infraestructura propia.
- **[REVISIÓN LEGAL]** Alcance exacto de share-alike de ODbL al mezclar OSM
  con DENUE y datos propios en la misma base.

## Locavo (datos propios, propietarios y comunidad)

- Datos curados por Locavo, enviados por propietarios o verificados por la
  comunidad (fases futuras; flags apagados en V3).
- Toda contribución conservará procedencia, fecha y estado de verificación.
- Los nombres comerciales y textos originales nunca se sobrescriben; las
  traducciones son campos separados.
- **[REVISIÓN LEGAL]** Términos de contribución para propietarios y
  comunidad (licencia de los datos aportados) antes de habilitar esas vías.

## Principios transversales

- Ninguna fuente se usa como llave primaria: identidad propia
  (`locavoPlaceId`) + referencias externas.
- Prohibido el scraping de servicios que lo prohíben (incluido Google Maps).
- Privacidad primero: sin coordenadas de usuarios en analítica, sin
  rastreo continuo, datos mínimos.
