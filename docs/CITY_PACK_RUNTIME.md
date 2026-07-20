# City pack de runtime — carga perezosa (V4D) + activación (V4C)

## Activación (V4C)

El city pack OFICIAL de Culiacán (500 establecimientos DENUE) es la fuente
de datos **ACTIVA por defecto**, con respaldo local seguro. La activación
vive en la bandera COMPROMETIDA `useCityPackRepository: true`
(`src/config/featureFlags.ts`): **no depende de crear un `.env` local**.
Supabase/Cloud permanece OFF y nunca es la fuente.

### Empaquetado reproducible desde un clon limpio

El pack de runtime se genera de forma DETERMINISTA a partir del extracto
versionado en el repositorio — **sin** el archivo nacional DENUE de 67 MB ni
la raíz GeoData:

```
data/denue/denue_culiacan_pilot.csv   (500 establecimientos aprobados, versionado)
data/denue/scian-category-map.json    (mapeo SCIAN → categoría, versionado)
   │  npm run citypack:bundle          (reutiliza parser+mapper+builder aprobados)
   ▼
public/citypack/**                        → web/PWA   (gitignored: artefacto de build)
android/app/src/main/assets/citypack/**   → APK        (gitignored: artefacto de build)
```

Flujo de un clon limpio para una release funcional:

```
npm install
npm run citypack:bundle          # genera y empaqueta el pack (web + android)
npm run build:web                # ya ejecuta citypack:bundle como primer paso
# Android: npx expo prebuild → npm run citypack:bundle → (cd android && gradlew assembleRelease)
```

La lógica compartida vive en `src/data/places/citypack/buildBundledPack.ts`
(la usan el script y las pruebas): mismas entradas → mismos bytes. El pack
empaquetado es idéntico al derivado del archivo nacional para esos registros.

## Arquitectura

`CityPackRepository` implementa el contrato `PlaceRepository` existente de
forma **neutral al proveedor**: consume el paquete de runtime generado
(trozos de `CityPackPlace` canónicos con procedencia en `sources[]`),
nunca registros DENUE crudos ni lógica específica de un proveedor. Un pack
futuro puede combinar DENUE, OpenStreetMap, datos de propietarios y
comunidad sin tocar el runtime.

```
pack fuente (culiacan.pack.json, 10.18 MB, fuera del repo)
   │  npm run citypack:build:culiacan -- --data-root "<GeoDataRoot>"
   ▼
paquete de runtime (fuera del repo)
   runtime/manifest.json                    (esquema v1 + bytes + SHA-256)
   runtime/index/place-id-index.json        (id → trozo)
   runtime/index/compact-search-index.json  (texto normalizado mínimo)
   runtime/categories/<cat>/chunk-NNN.json  (≤250 lugares, retícula geográfica)
   │  npm run citypack:stage -- --data-root "<GeoDataRoot>"   (verifica SHA-256)
   ▼
assets de la app (IGNORADOS por git)
   public/citypack/**                        → web/PWA (estáticos same-origin)
   android/app/src/main/assets/citypack/**   → APK (lectura perezosa)
```

## Carga perezosa

- Al arrancar NO se carga nada del pack. La primera operación carga el
  manifiesto (~25 KB) y después SOLO lo necesario:
  - `getById` → índice de ids + 1 trozo;
  - `listByCategory` → trozos de esa categoría, ordenados por cercanía del
    rectángulo del trozo, con corte temprano cuando el top-N ya es exacto;
  - `searchNearby` → solo trozos cuyo rectángulo toca el radio;
  - `searchText` → índice de búsqueda compacto → trozos candidatos →
    verificación final con `placeMatchesQuery` (paridad exacta con la
    búsqueda de dominio, acentos y alias multilenguaje incluidos).
- Caché LRU acotada (12 trozos por defecto); un trozo cacheado no se
  vuelve a parsear; el más antiguo se desaloja al exceder el límite.

## Bandera y respaldo

- `useCityPackRepository: true` (V4C: default comprometido, ACTIVO para el
  pack bundled de Culiacán). `EXPO_PUBLIC_USE_CITY_PACK=1` sigue disponible
  como anulación de desarrollo, pero la activación NO depende de un `.env`.
- Pack ausente, corrupto, incompleto o de esquema desconocido → cada
  llamada degrada automáticamente a `LocalPlaceRepository` (que nunca
  desaparece). Los errores de VALIDACIÓN de consulta sí se propagan.
- Cloud sigue OFF; Google Maps sigue siendo solo navegación.

## Plataformas

- **Web/PWA**: los trozos son estáticos same-origin bajo `/citypack/`;
  jamás entran al bundle de JavaScript. El service worker existente los
  cachea tras la primera lectura (usables offline).
- **Android**: assets del APK (`file:///android_asset/citypack/...`)
  leídos con expo-file-system (incluido en el SDK de Expo: sin nuevas
  dependencias). Sin red tras la instalación.
- **iOS**: misma mecánica desde el bundle de la app (`bundleDirectory` de
  expo-file-system). Auditoría V4D.2 (sin hardware iOS): sin fugas de
  `asset:///android_asset`; `bundleDirectory` ausente → fallo limpio hacia
  el respaldo local; selección de plataforma cubierta por pruebas
  unitarias. **Pendiente con macOS/dispositivo**: (1) extender
  `citypack:stage` para copiar `citypack/` como recurso del proyecto
  `ios/` generado (Xcode "folder reference"), (2) build release iOS,
  (3) matriz de aceptación equivalente a la de Android.

## Regeneración segura

Generación y staging son deterministas, con escrituras atómicas y el
manifiesto siempre al final: una interrupción nunca deja un paquete
"válido" a medias — el runtime cae limpiamente al respaldo local. El
staging verifica el SHA-256 de los 56 archivos contra el manifiesto antes
de copiar y limpia el staging anterior sin tocar los datos fuente.
