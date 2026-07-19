# Importación DENUE — Piloto Culiacán (V4B)

Primer importador real de datos oficiales sobre la fundación provider-neutral
de Supabase (V4A/V4A.1). Es un **piloto controlado de ingestión local**: la app
instalada NO lo consume (el feature flag cloud sigue OFF y la UI sigue usando
`LocalPlaceRepository`).

## Fuente oficial

| | |
|---|---|
| Fuente | INEGI — Directorio Estadístico Nacional de Unidades Económicas (DENUE) |
| Dataset | `MEX-INEGI.EEC2.05-DENUE-2026` (05_2026; publicado 2026-05-20, corregido 2026-07-01) |
| Descarga | https://www.inegi.org.mx/contenidos/masiva/denue/denue_25_csv.zip (Sinaloa, clave 25) |
| Obtenido | 2026-07-18 |
| Formato | CSV latin1, 42 columnas (`conjunto_de_datos/denue_inegi_25_.csv`) |
| Identificadores | `id` (id de establecimiento DENUE) y `clee` (Clave Estadística Empresarial) |
| Licencia | [Términos de Libre Uso de la Información del INEGI](http://www.inegi.org.mx/inegi/terminos.html) — uso libre con atribución a INEGI/DENUE |

No se usa Google Places ni ningún dataset no oficial. La descarga masiva
(67 MB de Sinaloa) se cachea en `.cache/denue/` (**gitignored**); al repo solo
entra el extracto piloto pequeño y determinista.

## Cómo correr el piloto

```bash
# 1. (una vez) Descargar el zip oficial y extraerlo en .cache/denue/extracted/
# 2. Regenerar el extracto piloto determinista (data/denue/denue_culiacan_pilot.csv)
npm run denue:extract

# 3. Con el stack local arriba (npx supabase start; npx supabase db reset)
npm run denue:import        # idempotente: puede repetirse sin efectos
```

El importador conecta directo a la base local de Docker
(`postgresql://postgres:postgres@127.0.0.1:54322/postgres`, credencial pública
por defecto del CLI de Supabase; configurable con `DENUE_DB_URL`). El esquema
`private` no está expuesto por la API, por eso no se usa la REST API.

## Filtro de Culiacán y selección determinista

- `cve_ent = 25` (Sinaloa) **y** `cve_mun = 006` (municipio de Culiacán); nada
  fuera del municipio piloto (el mapper además lo re-valida y rechaza).
- Solo códigos SCIAN presentes en `data/denue/scian-category-map.json`.
- `id` numérico y coordenadas válidas dentro de una caja envolvente laxa de
  Culiacán (lat 23.5–26.0, lng −108.5–−106.0).
- Por categoría: orden por `id` DENUE ascendente y cuota fija —
  food 120, store 80, coffee 60, beer 50, pharmacy 50, nightlife 50,
  lodging 50, gas 40 → **máximo 500** establecimientos.

Mismo insumo oficial ⇒ mismo extracto, byte a byte.

## Mapeo de categorías (SCIAN → Locavo)

`data/denue/scian-category-map.json` es la única fuente de verdad (la comparten
el extractor y `DenueCategoryMapping.ts`). 22 códigos SCIAN cubren las 8
categorías del MVP; ejemplos: `7225xx` → food/coffee, `461211/461212` → beer,
`7224xx` → nightlife, `7211xx` → lodging, `4641xx` → pharmacy, `468411` → gas,
`461110/46211x` → store. Un código sin entrada **no se importa**.

## Normalización y modelo canónico

- `nom_estab` se preserva **tal cual** como `name` (respaldo: `raz_social`);
  el `normalized_name` se deriva aparte con `normalizeText` (minúsculas, sin
  acentos) y nunca sustituye al original.
- El id DENUE y el CLEE viven en `place_source_refs`
  (`denue/denue_id`, `denue/clee`); el UUID Locavo es independiente.
- Dirección → jsonb canónico (street/exteriorNumber/neighborhood/postalCode/
  locality sin relleno/municipality/state/countryCode=MX + formatted).
- Contacto → teléfono tal cual, email en minúsculas, sitio con `https://`;
  claves vacías se omiten. Opcionales faltantes NO descartan el registro.
- `search_terms`: ≤6 tokens normalizados del nombre de actividad SCIAN, sin
  genéricos (lista de stopwords en `DenueCandidateMapper.ts`).
- Verificación: `source_verified`, confianza 0.6, `last_verified_at` = fecha de
  versión del dataset (`2026-07-01`) — determinista entre corridas.
- El registro crudo completo (42 columnas) se conserva como snapshot en
  `private.provider_snapshots`; cada corrida queda en `private.sync_runs` /
  `sync_items` y cada alta/cambio en `private.place_change_history`.

## Idempotencia y seguridad de datos

- **Upsert por** `(source='denue', ref_type='denue_id', external_id)`; la
  restricción única de la base lo garantiza también a nivel SQL.
- Corrida repetida con el mismo extracto ⇒ todo `unchanged`: cero escrituras
  en `places` (ni trigger de `updated_at`), cero snapshots nuevos, UUIDs
  estables.
- Updates solo tocan campos administrados por DENUE; horarios, precio,
  features, contenido localizado, `status` y `published` jamás se modifican.
- Merge protector: valores vacíos del proveedor nunca borran datos existentes
  (por clave en address/contact).
- Duplicados dentro del lote se omiten (`skipped`).
- Toda la corrida es **una transacción**: cualquier fallo ⇒ rollback total,
  sin importaciones a medias.
- Los lugares mock del seed (`source='mock'`, 9 registros, ids fijos
  `00000000-…`) quedan separados por procedencia/refs; los reportes y
  validaciones cuentan por fuente y nunca se mezclan.

## Reporte de importación

El CLI imprime JSON con: `source`, `dataset`, `sourceVersion`, `municipality`,
`read`, `accepted`, `rejected`, `rejectedReasons`, `skippedDuplicates`,
`inserted`, `updated`, `unchanged`, `errors`, `byCategory` (más el detalle de
rechazos con fila y razón: `missing_or_invalid_id`, `missing_name`,
`unmapped_category`, `invalid_coordinates`, `outside_pilot_municipality`).

## Limitaciones conocidas del dato DENUE

- Sin horarios ni precios; los campos quedan `null` (la app degrada bien).
- Teléfono/correo/web frecuentemente vacíos o desactualizados.
- Nombres en MAYÚSCULAS y con variantes ("SIN NOMBRE" es común).
- Coordenadas de calidad variable (esquina de manzana, no la puerta).
- `localidad` llega con relleno de espacios (se limpia al mapear).
- Actualización oficial ~anual por segmento; no refleja cierres recientes.

## Reutilización futura (otras ciudades/estados/fuentes)

- Otra ciudad/estado: cambiar `cve_ent`/`cve_mun` y cuotas en
  `build-pilot-extract.mjs` (o parametrizarlos); el resto del pipeline no
  cambia.
- Escala nacional: el upsert por referencia externa y las cuotas son el único
  punto a revisar (lotes + paginación).
- Otra fuente (OSM, propietarios): implementar un adaptador paralelo
  (reader/parser/mapper propios) que produzca candidatos canónicos y reutilice
  `DenueImportGateway`-equivalente y el mismo esquema de refs/procedencia/
  snapshots; nada de lógica de proveedor vive en el repositorio canónico.
