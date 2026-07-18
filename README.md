# Locavo

**No busques. Decide.** · Dominio oficial: [locavoapp.com](https://locavoapp.com)

Locavo es una aplicación universal (Android, iOS y web/PWA) que ayuda a decidir
rápidamente a dónde ir **ahora** en Culiacán, Sinaloa: combina ubicación,
horario, distancia, categoría, calidad de la información y recencia de
verificación para recomendar la mejor opción del momento, con una explicación
clara de por qué.

A diferencia de un mapa tradicional (que responde *"¿dónde está?"*), Locavo
responde *"¿cuál opción me conviene ahora?"*. El objetivo de flujo: de una
necesidad a iniciar navegación en menos de diez segundos.

## Dominio oficial

El dominio del producto es **locavoapp.com** (el producto se llama *Locavo*).
La identidad está centralizada en `src/config/appConfig.ts` (`APP_CONFIG`) y se
usa en la metadata web (título, descripción, URL canónica, Open Graph) y la
PWA. En Fase 1 **no hay deploy ni DNS configurado**: el dominio aún no apunta a
la aplicación; el build web (`dist/`) usa rutas relativas y queda listo para
servirse en `https://locavoapp.com` cuando se publique. Los enlaces futuros de
soporte y privacidad vivirán bajo ese dominio.

## Estado actual (Fase 1.1)

MVP funcional con **datos locales simulados** para una sola ciudad
(**Culiacán**): experiencia de decisión completa (inicio → categoría/búsqueda →
resultados con mapa → recomendación explicada → detalles → "Cómo llegar" →
Google Maps), sin backend.

La Fase 1.1 añadió: rutas públicas (`/privacy`, `/terms`, `/support`),
endurecimiento de ubicación (timeout, permisos, mensajes humanos), fallback y
reintento del mapa, manejo de errores al abrir Google Maps, validación de
mensajes del WebView, persistencia tolerante a datos corruptos y scripts de
prueba en dispositivo.

La V2 añadió el sistema de color por categoría. La **V3 (Data Foundation)**
añadió:

- **Internacionalización fundacional**: 7 idiomas (español, English,
  Português, Français, Italiano, Deutsch, 中文简体) con catálogos tipados
  empaquetados (funcionan offline), selector en Ajustes, detección del
  idioma del dispositivo, formato local (12/24 h, km/millas, fechas) y
  búsqueda multilenguaje por alias ("beer", "cerveza" y "啤酒" encuentran
  lo mismo). Los datos (nombres comerciales, calles, colonias) nunca se
  traducen.
- **Arquitectura de lugares neutral al proveedor**: modelo canónico
  `LocavoPlace` con identidad propia, procedencia y confianza;
  `PlaceSearchService` → `PlaceRepository` → `LocalPlaceRepository`;
  normalizador de categorías (SCIAN/OSM/nombre), servicio de deduplicación,
  esqueletos de proveedores DENUE/OSM (no conectados), feature flags con
  defaults seguros y telemetría local de consultas. Sin Google Places.
  Ver [docs/LOCAVO_DATA_ARCHITECTURE.md](docs/LOCAVO_DATA_ARCHITECTURE.md)
  y [docs/DATA_SOURCE_POLICY.md](docs/DATA_SOURCE_POLICY.md).

**Estado: TECHNICALLY READY — OWNER DEVICE ACCEPTANCE PENDING.** Todas las
validaciones automáticas están en verde, pero la aceptación final requiere la
prueba física del propietario siguiendo
[docs/DEVICE-ACCEPTANCE.md](docs/DEVICE-ACCEPTANCE.md). La app **no está
publicada**: no hay deploy web ni DNS configurado y no está en tiendas.

## Plataformas

- Android (Expo)
- iOS/iPadOS (Expo)
- Web responsive + **PWA instalable**

Una sola base de código: Expo + React Native + TypeScript estricto +
Expo Router + React Native Web.

## Requisitos

- Node.js 20+ (probado con Node 24)
- npm 10+
- Para móvil: app **Expo Go** en el dispositivo, o un emulador Android /
  simulador iOS

## Instalación

```bash
git clone https://github.com/gocellularfix-a11y/locavo.git
cd locavo
npm install
```

## Comandos

| Comando                  | Descripción                                                |
| ------------------------ | ---------------------------------------------------------- |
| `npm start`              | Servidor de desarrollo Expo (QR para Expo Go)              |
| `npm run start:lan`      | Desarrollo por red local — para probar en tu teléfono      |
| `npm run start:tunnel`   | Alternativa por túnel cuando la red LAN bloquea el acceso  |
| `npm run android`        | Compila e instala el proyecto nativo Android (`run:android`) |
| `npm run ios`            | Compila e instala el proyecto nativo iOS (requiere macOS)  |
| `npm run web`            | Desarrollo web                                             |
| `npm run lint`           | ESLint (config de Expo)                                    |
| `npm run typecheck`      | TypeScript estricto sin emitir                             |
| `npm test`               | Pruebas unitarias (Jest + jest-expo)                       |
| `npm run build:web`      | Build web estático de producción (carpeta `dist`)          |
| `npm run acceptance:web` | Build web + servidor local para la aceptación PWA          |
| `npm run validate`       | lint + typecheck + tests + build web                       |

### Probar en tu teléfono (Android / iPhone)

1. Instala **Expo Go** en el teléfono.
2. Conecta computadora y teléfono a la misma red Wi-Fi.
3. `npm run start:lan` y escanea el QR (usa `npm run start:tunnel` si la red
   bloquea la conexión directa).
4. Sigue la guía completa de escenarios en
   [docs/DEVICE-ACCEPTANCE.md](docs/DEVICE-ACCEPTANCE.md).

### Probar el build web/PWA localmente

```bash
npm run build:web
npx serve dist
```

Abre la URL indicada; en un navegador compatible (Chrome/Edge) aparecerá la
opción de **instalar Locavo** como aplicación (manifest + service worker con
shell offline básico).

## Estructura principal

```
src/
  app/          Pantallas (Expo Router): tabs Inicio/Explorar/Ajustes, detalle
  components/   Sistema de diseño (AppButton, PlaceCard, StatusBadge, …)
  domain/       Lógica pura: horarios, distancia, búsqueda, recomendación
  data/         Datos simulados + MockPlaceRepository
  features/map/ MapSurface (Leaflet: WebView en nativo, DOM en web)
  hooks/        usePlacesQuery (carga + filtrado + ranking)
  services/     Analítica local, navegación externa, ubicación, contenedor
  state/        Contexto de ubicación
  theme/        Tokens de diseño y tema claro/oscuro/sistema
  utils/        Normalización de texto y formato
public/         manifest.webmanifest, sw.js, iconos PWA
```

## Rutas públicas

La versión web expone páginas informativas que funcionan por URL directa,
con refresco del navegador y desde el build estático:

- `/privacy` — cómo se maneja la ubicación y los datos (fase demo).
- `/terms` — condiciones de la fase de demostración.
- `/support` — preguntas frecuentes (ubicación, mapa, Google Maps, PWA).

También son accesibles dentro de la app desde **Ajustes → Información**.

## Datos simulados

Los 24 lugares son **sintéticos**: llevan prefijo `Demo`, `isDemo: true` y
fuente `demo-seed`. No representan negocios reales verificados. Cubren las 8
categorías del MVP: Comida, Cerveza, Café, Hospedaje, Farmacias, Gasolineras,
Tiendas y Vida nocturna.

## Privacidad

- La ubicación se lee **una sola vez** cuando el usuario lo pide.
- Sin rastreo continuo, sin ubicación en segundo plano, sin historial de
  recorridos, sin geofencing.
- Si el permiso se rechaza, se usa una zona manual de Culiacán (configurable
  en Ajustes).
- La analítica de demostración se guarda **solo en el dispositivo**
  (AsyncStorage, tope de 200 eventos) y no incluye coordenadas del usuario.
  En desarrollo puede inspeccionarse con `globalThis.locavoAnalytics.getEvents()`.

## Navegación externa (Google Maps)

El botón **"Cómo llegar"** abre el enlace universal:

```
https://www.google.com/maps/dir/?api=1&destination={lat},{lng}
```

Funciona aunque Google Maps no esté instalado (abre el navegador). Antes de
abrirlo se registra localmente el evento `navigation_requested`
(proveedor `google_maps`). Abrir la ruta representa **intención** de navegar,
nunca una visita confirmada. La abstracción `NavigationProvider` permite
agregar Waze o Apple Maps en el futuro (no implementados).

## Mapa interno

`MapSurface` muestra contexto con Leaflet + teselas de OpenStreetMap
(circle markers, sin claves de API): WebView en Android/iOS y DOM en web.
El mapa interno no usa Google Maps ni implica integración comercial alguna.
Requiere conexión para las teselas (el mapa **no** funciona offline).

Si el mapa no puede cargar (sin red, error del proveedor o timeout), se
muestra un aviso con **"Reintentar mapa"** y la lista de lugares, la búsqueda
y la recomendación siguen funcionando. Los mensajes entre el WebView y la app
se validan contra una allowlist y las coordenadas se sanean antes de pintarse.

## Pruebas

Las pruebas unitarias cubren: evaluador de horarios (incluye cruces de
medianoche y días sin horario, zona fija UTC-7 de Culiacán), Haversine y
estimación de tiempo, normalización de texto y búsqueda sin acentos, motor de
recomendación con desempates deterministas y explicaciones, repositorio
simulado, analítica local y construcción/validación del enlace de Google Maps.

```bash
npm test
```

## Limitaciones actuales (deliberadas)

- Datos simulados: no hay negocios reales ni verificación externa.
- El tiempo estimado de traslado es una aproximación urbana determinista;
  **no** hay tráfico en tiempo real.
- El mapa requiere internet (teselas OSM; en nativo, Leaflet vía CDN).
- Horarios y hora local usan el desfase fijo UTC-7 de Culiacán (México ya no
  aplica horario de verano).
- Sin backend, cuentas, reseñas, notificaciones, pagos, delivery ni panel de
  negocios.
- Solo Culiacán; la arquitectura permite más ciudades en fases futuras.
- No publicado en App Store / Google Play.

## No incluido a propósito en Fase 1

Backend de producción, autenticación, base de datos remota, IA, chat, red
social, publicidad, reservaciones, navegación paso a paso propia,
integraciones con Waze/Apple Maps, scraping, rastreo continuo, confirmación
automática de visitas y sistema comunitario.
