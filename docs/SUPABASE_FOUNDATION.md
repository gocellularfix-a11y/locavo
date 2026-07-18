# Locavo — Supabase Foundation (V4A)

## Qué es

Base local, versionada y reproducible para el backend de datos de Locavo
(Supabase = PostgreSQL + PostGIS), **sin proyecto remoto y sin datos
reales**. La app instalada sigue usando `LocalPlaceRepository` (dataMode
`mock`); el repositorio cloud existe, está probado con transporte simulado
y permanece apagado por feature flag.

## Arquitectura

```
Screens / Hooks
  → PlaceSearchService                 (sin cambios; no conoce SQL)
    → PlaceRepository (contrato)
      → createPlaceRepository(flags, config)   ← composición única
          flag OFF                → LocalPlaceRepository (default)
          flag ON + config válida → SupabasePlaceRepository
          flag ON + config mala   → CloudRepositoryError (diagnóstico claro)
            → CloudRpcTransport (client.ts, supabase-js aislado)
              → RPCs públicas (place_by_id / places_nearby /
                 places_search_text / places_by_category)
```

Reglas de aislamiento: UI y hooks jamás importan supabase-js; solo
`src/data/supabase/*` conoce el cliente; el mapper es puro y probado.

## Estructura de carpetas

```
supabase/
  config.toml                      # proyecto local (supabase init)
  migrations/
    20260718120000_locavo_foundation.sql
  seed.sql                         # SOLO desarrollo local (demo)
src/config/supabaseConfig.ts       # lectura/validación de variables
src/data/supabase/
  client.ts                        # cliente + transporte estrecho
  database.types.ts                # tipos de BD (regenerables)
  SupabasePlaceMapper.ts           # fila jsonb → LocavoPlace (puro)
  SupabasePlaceRepository.ts       # implementa PlaceRepository
  errors.ts                        # códigos neutrales
src/data/places/createPlaceRepository.ts  # factory de composición
```

## Variables de entorno

Solo variables públicas de cliente (ver `.env.example`):

```
EXPO_PUBLIC_SUPABASE_URL
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY
```

`readSupabaseConfig()` clasifica la configuración en
`missing | invalid | valid` sin lanzar durante el arranque y sin imprimir
claves. La existencia de variables NO activa la nube.

## Migraciones y desarrollo local

Requiere Docker (no instalado en la máquina actual — ver limitación):

```bash
npx supabase start      # levanta el stack local
npx supabase db reset   # aplica migraciones desde cero + seed.sql
npm run db:types        # regenera src/data/supabase/database.types.ts
npx supabase stop       # no dejar contenedores corriendo
```

`database.types.ts` está escrito a mano espejando la migración mientras no
haya Docker; al regenerarlo, comparar contra la versión versionada.

## Esquema

- `public.places` — lugar canónico: UUID propio (locavoPlaceId), nombre y
  nombre normalizado (trigram), categoría (check de las 8), `location`
  geography(Point,4326) con índice GiST, subobjetos jsonb espejo de
  LocavoPlace (address/contact/hours/price/features), verificación vigente
  (status + confidence 0–1), `status` (soft delete) y `published`.
- `public.place_source_refs` — referencias externas (denue_id, clee,
  osm_id, owner_id) con unicidad por (source, ref_type, external_id).
  El nombre del negocio NO es único (homónimos/sucursales legítimos).
- `public.place_provenance` — historial de fuentes.
- `public.place_localized_content` — original + traducciones separadas
  (el original nunca se sobrescribe); solo lo publicado es visible.
- `private.*` — data_sources, sync_runs, sync_items, provider_snapshots,
  place_change_history: preparación de importadores/sincronización (V4B),
  inaccesible para el cliente.

## RLS y superficie pública

Ver `docs/SUPABASE_SECURITY.md`. Resumen: RLS en todas las tablas; el
cliente público solo lee lugares `published AND status='active'` (y datos
relacionados de esos lugares); cero escrituras públicas; `private.*` sin
políticas (deny-all) y con el esquema revocado.

Las 4 RPCs de lectura son `security invoker` (RLS aplica), validan
parámetros (rangos de coordenadas, radio 100–30 000 m, límite ≤ 50, texto
no vacío, categoría del catálogo) y devuelven el jsonb canónico + distancia
PostGIS + total para paginación estable. El ranking explicable sigue
viviendo en `PlaceRankingService` (TypeScript), no en SQL.

## Seed

`supabase/seed.sql`: 8 lugares demo (uno por categoría) con UUIDs fijos y
`source='mock'`, más un lugar **no publicado** para probar RLS. Solo para
desarrollo local; nunca desplegarse en producción ni confundirse con datos
reales.

## Activación futura (V4B+)

1. Crear el proyecto remoto de Supabase (manual, por el propietario).
2. `supabase link` + `supabase db push` desde un entorno autorizado.
3. Llenar `.env` con URL y publishable key del proyecto.
4. Encender `useCloudPlaceRepository` en `src/config/featureFlags.ts`.
5. Los importadores (DENUE) correrán en backend con secretos de servidor.

## Qué JAMÁS debe incluirse en el cliente

Claves administrativas de Supabase, contraseñas de base de datos, access
tokens personales, tokens de INEGI/DENUE, credenciales de proveedores.
Todo eso vive exclusivamente en backend/CI. El escáner estático de la
suite (`security.static.test.ts`) falla si aparecen en `src/`.
