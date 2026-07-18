# Locavo — Arquitectura de datos (V3 Data Foundation)

## Propósito

Preparar a Locavo para operar con **negocios reales de múltiples fuentes**
sin reescribir la aplicación, manteniendo costos en cero durante esta fase.
La UI quedó desacoplada de cualquier proveedor concreto y el modelo de
datos es neutral respecto a la fuente.

Locavo no busca ser una copia de Google Maps: Google Maps responde
*"¿dónde está este negocio?"*; Locavo responde *"¿a dónde me conviene ir en
este momento?"*. La arquitectura debe soportar preguntas futuras como
"abierto después de medianoche", "accesible en silla de ruedas", "con
estacionamiento" o "dentro de mi presupuesto" — por eso el modelo canónico
ya incluye horarios, características, precio, verificación y procedencia.

## Por qué NO usamos Google Places

- Costo: Places API/Nearby/Details/Photos/Autocomplete generan facturación
  por solicitud y atan el producto a precios de terceros.
- Licencia: los datos de Places no pueden almacenarse ni mezclarse
  libremente con otras fuentes, lo que mata la estrategia multi-fuente.
- Diferenciación: nuestros datos (DENUE + OSM + propietarios + comunidad)
  con verificación propia son el activo del producto.

Google se mantiene **únicamente** para navegación externa ("Cómo llegar")
mediante el enlace universal sin API key. No existe Places API, geocoding
de Google ni facturación de Google Maps Platform en el proyecto.

## Fuentes previstas

1. **INEGI / DENUE** — fuente oficial principal para negocios en México.
2. **OpenStreetMap** — complemento abierto (licencia ODbL, atribución).
3. **Datos propios de Locavo** — curaduría interna.
4. **Propietarios** — datos enviados por los dueños (fase futura).
5. **Comunidad** — envíos/verificaciones de usuarios (fase futura).
6. Otros proveedores futuros, siempre detrás de adaptadores.

## Flujo de datos

```
Screens / Hooks (usePlacesQuery, useDirections)
        ↓  (solo modelos canónicos + i18n)
PlaceSearchService        ← telemetría local de consultas
        ↓
PlaceRepository (contrato)
        ↓
LocalPlaceRepository (hoy, dataMode 'mock')
CloudPlaceRepository (futuro, dataMode 'cloud', Supabase/PostGIS)
        ↓
Provider adapters (futuros, importación en backend)
DenueProvider · OpenStreetMapProvider · Owner · Community
        ↓
CategoryNormalizer → PlaceMergeService → modelo canónico
```

Mapa de módulos:

- `src/domain/places/LocavoPlace.ts` — modelo canónico.
- `src/domain/places/LocalizedText.ts` — contenido localizado (original intocable).
- `src/data/places/` — contratos de consulta, resultado, repositorio,
  mapper de la semilla y `LocalPlaceRepository`.
- `src/services/places/` — `PlaceSearchService`, `PlaceRankingService`,
  `PlaceMergeService`, `CategoryNormalizer`.
- `src/providers/` — contrato `PlaceProvider` + esqueletos DENUE/OSM
  (no conectados; lanzan `ProviderNotConnectedError`).
- `src/config/featureFlags.ts` — flags con defaults seguros y `dataMode`.
- `src/i18n/` — internacionalización fundacional (ver abajo).

## Identidad propia de Locavo

Todo lugar tiene un `locavoPlaceId` interno (`LocavoPlace.id`). Nunca se
usa como llave primaria un id de DENUE, un id de OSM, el teléfono, el
nombre, las coordenadas ni la dirección. Los identificadores externos
viven en `sourceRefs` (`denueId`, `clee`, `osmId`, `ownerId`), de modo que
un mismo negocio puede acumular referencias de varias fuentes sin
duplicarse.

## Normalización de categorías

`CategoryNormalizer` convierte señales externas a las 8 categorías
canónicas (`food, beer, coffee, lodging, pharmacy, gas, store, nightlife`
— IDs internos que **nunca cambian**):

1. Código SCIAN (DENUE): prefijos, el más específico gana (conf. 0.85–0.96).
2. Tags de OSM (`amenity`, `shop`, `tourism`).
3. Palabras del nombre vía Search Alias Engine (conf. 0.55); si el nombre
   es ambiguo entre categorías, devuelve `null` en lugar de adivinar.

Siempre devuelve `{ category, confidence, matchedBy }`.

## Deduplicación (PlaceMergeService)

Antes de fusionar registros de fuentes distintas se calcula
`PlaceMatchResult { likelySamePlace, confidence, reasons }` con señales:
distancia entre coordenadas, nombre normalizado, teléfono (últimos 10
dígitos), dominio web, dirección y categoría. Reglas duras:

- Teléfono o dominio web coincidente pesan mucho.
- Nombre similar sin cercanía NO basta (cadenas/sucursales).
- Cercanía sin nombre similar NO basta (locales vecinos).
- Umbral 0.75 + señal fuerte obligatoria; nunca se fusiona con confianza
  baja y la procedencia (`provenance`) se conserva siempre.

## Procedencia y confianza

Cada `LocavoPlace` registra `provenance[]` (fuente, importedAt, updatedAt)
y `verification { status, confidence 0–1, lastVerifiedAt }`. La UI muestra
confianza en lenguaje claro (alta/reciente/limitada), jamás porcentajes,
estrellas ni reseñas inventadas.

## Base Supabase (V4A)

La fundación cloud ya existe de forma local y versionada: migración real
(PostGIS + pg_trgm + RLS + RPCs de lectura), seed de desarrollo,
`SupabasePlaceRepository` implementando el mismo contrato `PlaceRepository`
y una factory (`createPlaceRepository`) que compone local/cloud según el
feature flag. Sin proyecto remoto ni datos reales todavía. Detalles en
`docs/SUPABASE_FOUNDATION.md` y `docs/SUPABASE_SECURITY.md`.

## Transición mock → cloud

- Semilla actual: 24 lugares "Demo" migrados al modelo canónico por
  `PlaceMapper` con `source: 'mock'` y estado `unverified`. No se
  eliminaron y siguen alimentando toda la experiencia.
- `dataMode` (`'mock' | 'cloud'`) deriva de `featureFlags` (visible en
  desarrollo vía `globalThis.locavoFlags`); jamás se mezclan datos demo
  con producción en silencio (la procedencia lo hace explícito).
- El esquema SQL propuesto (no ejecutado) vive en
  `docs/cloud/SUPABASE_SCHEMA_PROPOSAL.sql`. No se creó ningún recurso
  cloud ni credenciales en esta fase.

## Internacionalización (fundacional)

- 7 idiomas: es, en, pt, fr, it, de, zh-CN. Catálogos tipados y
  empaquetados en el bundle → la UI traducida funciona 100% offline.
- Toda cadena visible pasa por `t()`/`translateIn`; el dominio produce
  datos estructurados y `i18n/format.ts` los presenta (12h/24h, km/millas,
  fechas y moneda por locale).
- **Los datos no se traducen**: nombres comerciales, calles, colonias y
  ciudades se muestran en su forma original ("Mariscos El Güero" queda
  igual en chino).
- Search Alias Engine: "restaurant/restaurante/餐厅" → `food`;
  "beer/cerveza/啤酒" → `beer`; etc. Los IDs internos no cambian.
- Contenido localizado de negocios: `LocalizedText` guarda texto original
  (idioma, fuente, fecha) y traducciones como campos separados; el
  original nunca se sobrescribe.

## Seguridad y privacidad

- Sin claves en el cliente; los tokens de proveedores vivirán en backend.
- Sin coordenadas del usuario en la telemetría (verificado por prueba).
- Analítica local en el dispositivo; sin trackers externos ni IDs
  publicitarios. Ubicación puntual, nunca en segundo plano.

## Límites de V3 (deliberados)

Sin importaciones reales de DENUE/OSM, sin llamadas a Overpass, sin
scraping, sin backend de producción, sin cuentas/reseñas/fotos remotas,
sin IA. Los proveedores son esqueletos honestos que lanzan
`ProviderNotConnectedError`.

## Siguiente fase recomendada

V4 — Importación real acotada a Culiacán: backend mínimo (Supabase) con el
esquema propuesto, token DENUE en servidor, importador DENUE → normalizador
→ merge → tabla `places`, y `CloudPlaceRepository` activable con
`useCloudPlaceRepository` sin tocar pantallas.
