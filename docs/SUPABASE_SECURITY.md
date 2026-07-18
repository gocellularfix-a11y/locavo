# Locavo — Seguridad Supabase (V4A)

## Publishable key vs. secretos de servidor

- **Publishable key** (`EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`): diseñada
  para embeberse en el cliente. No otorga permisos por sí misma: todo lo
  que puede hacer está limitado por Row Level Security y los grants de la
  base. Es la ÚNICA credencial que puede existir en la app.
- **Secretos de servidor** (rol administrativo/"service role", contraseña
  de la base, access tokens personales del CLI, tokens de INEGI): otorgan
  acceso TOTAL saltándose RLS. Exponerlos en la app equivale a publicar la
  base completa: cualquiera podría leer tablas internas, escribir, borrar
  o exfiltrar datos. Viven solo en backend/CI, jamás en este repositorio.
  La suite incluye un escáner estático que falla si aparecen en `src/`.

## Row Level Security (estado V4A)

RLS está habilitado en TODAS las tablas (públicas y privadas):

| Superficie | anon/publishable |
| --- | --- |
| `public.places` | SELECT solo `published AND status='active'` |
| `public.place_source_refs` | SELECT solo de lugares publicados/activos |
| `public.place_provenance` | SELECT solo de lugares publicados/activos |
| `public.place_localized_content` | SELECT solo contenido publicado de lugares publicados |
| INSERT/UPDATE/DELETE en cualquier tabla | ❌ bloqueado (sin políticas de escritura) |
| `private.*` (snapshots, sync, historial) | ❌ sin políticas (deny-all) + esquema revocado y no expuesto por la API |

Principios aplicados:

- Ninguna política `using (true)` en tablas internas (verificado por prueba).
- No se abren escrituras públicas "temporalmente": la ausencia de cuentas
  no justifica permisos abiertos.
- Los lugares no publicados o eliminados (soft delete por `status`) son
  invisibles para el cliente; el seed incluye un lugar no publicado para
  poder demostrarlo con el stack local.
- Las columnas internas no se exponen: el cliente consume el jsonb
  construido por `place_json` (solo campos del modelo canónico).

## Escrituras futuras

Toda escritura llegará por rutas con privilegios de servidor, nunca desde
el cliente público:

- **Importadores (DENUE/OSM, V4B)**: backend con secretos de servidor;
  escriben `places`, snapshots y sync en `private.*`.
- **Portal de propietarios / comunidad (fases posteriores)**: requerirán
  autenticación + políticas RLS específicas + moderación; las
  contribuciones no moderadas vivirán en tablas internas.
- **Administración**: solo backend; queda auditada en
  `private.place_change_history`.

## Riesgo de exponer el rol administrativo

Si esa clave llegara al bundle: lectura de payloads crudos de proveedores,
escritura/borrado arbitrario de lugares, manipulación del historial y
costo económico (abuso de la base). Por eso el escáner estático, el
`.gitignore` de `.env*` y la regla de que `src/` solo conozca la
publishable key.
