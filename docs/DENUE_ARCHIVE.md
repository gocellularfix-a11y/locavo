# Archivo oficial DENUE y city pack de Culiacán (V4C)

## Principio

El archivo nacional DENUE es **material fuente**: nunca se incluye en el
bundle de la aplicación y nunca se versiona en git. La aplicación consume
**packs de ciudad** optimizados que se derivan de esa fuente con un
pipeline determinista.

## Edición

- Dataset: `MEX-INEGI.EEC2.05-DENUE-2026` (DENUE 05_2026)
- Publicado: 2026-05-20 · Correcciones oficiales: 2026-05-29 y 2026-07-01
- Fuente oficial: descarga masiva del INEGI
  (`https://www.inegi.org.mx/app/descarga/?ti=6`, distribución
  `https://www.inegi.org.mx/contenidos/masiva/denue/denue_XX_csv.zip`,
  una por entidad; Estado de México dividido en `15_1`/`15_2`)
- Licencia: Términos de Libre Uso de la Información del INEGI

## Estructura del archivo local (fuera del repositorio)

```
<GeoDataRoot>\
  INEGI\DENUE\05_2026\
    raw\        ZIPs oficiales con nombre original (nunca se borran)
    extracted\  contenido extraído (CSV + diccionario + metadatos por ZIP)
    docs\       boletín, metodología, nota técnica de corrección, diccionario
    manifests\  manifiesto local con SHA-256 (contiene rutas de máquina; NO va a git)
    derived\culiacan\  pack derivado, cuarentena y reporte de corrida
```

La raíz `<GeoDataRoot>` es configurable y **jamás** se asume una letra de
unidad: se pasa con `--data-root` o con la variable `LOCAVO_GEODATA_DIR`.

## Comandos

```
# Manifiesto verificable del archivo descargado (+ extracción opcional)
npm run denue:manifest -- --data-root "D:\GeoData" --extract

# Derivar el pack real de Culiacán (determinista, sin red)
npm run denue:prepare:culiacan -- --data-root "D:\GeoData"
```

Salidas de la preparación (en `derived\culiacan\`):

- `culiacan.pack.json` — pack canónico (DTO neutral al proveedor; cada
  lugar lleva su procedencia DENUE en `sources[]`). Determinista: mismas
  entradas → mismos bytes; sin marcas de tiempo de ejecución.
- `culiacan.quarantine.json` — registros con datos inutilizables
  (coordenadas/id/nombre); nunca se inventan datos.
- `culiacan.report.json` — estadísticas y diagnóstico de la corrida (aquí
  sí hay marca de tiempo).

## Reutilización V4B

El pipeline reutiliza el parser (`DenueCsvParser`), el mapper
(`DenueCandidateMapper`) y el mapa SCIAN → categoría
(`data/denue/scian-category-map.json`) aprobados en V4B. No existe una
segunda interpretación de DENUE. Las actividades SCIAN sin categoría
Locavo se reportan agregadas en el reporte (`unmappedActivities`) para
ampliar cobertura en el futuro; no se descartan en silencio.

## Frontera de runtime

El runtime **no** consume el pack todavía. `LocalPlaceRepository` sigue
siendo el repositorio activo y Cloud permanece OFF. La integración del
pack se decidirá con las medidas registradas en el reporte (número de
establecimientos, tamaño, memoria, arranque, impacto Android/web/iOS); ver
la decisión y sus números en el reporte del milestone V4C.

Un manifiesto de ejemplo saneado (sin rutas de máquina) está en
`docs/denue-archive-manifest.example.json`.
