-- ============================================================================
-- Locavo — Migración fundacional (V4A)
--
-- Implementa el esquema real derivado de la propuesta de V3
-- (docs/cloud/SUPABASE_SCHEMA_PROPOSAL.sql), auditada y alineada al modelo
-- canónico LocavoPlace:
--   * identidad propia (UUID locavoPlaceId; nunca IDs de proveedores)
--   * referencias externas separadas y sin duplicados por fuente
--   * procedencia, verificación/confianza y contenido localizado
--   * PostGIS para búsquedas geográficas + pg_trgm para nombres
--   * separación public (lectura limitada por RLS) / private (interno)
--   * soft-delete por estado + auditoría + preparación de sincronización
--
-- Decisiones vs. la propuesta V3 (auditoría):
--   * address/contact/hours/price/features viven como jsonb en `places`
--     espejando 1:1 los subobjetos de LocavoPlace: el mapper no pierde
--     información y la lectura pública es de una sola fila por lugar.
--   * verificación vigente inline en `places` (histórico auditable en
--     private.place_change_history); media queda para fases futuras.
-- ============================================================================

-- ── Extensiones ─────────────────────────────────────────────────────────────
create extension if not exists postgis;
create extension if not exists pg_trgm;
create extension if not exists pgcrypto;

-- ── Esquema interno (no expuesto por la API) ────────────────────────────────
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

-- ── Utilidad: updated_at automático ─────────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ============================================================================
-- NÚCLEO PÚBLICO
-- ============================================================================

-- Lugar canónico. `id` ES el locavoPlaceId; jamás un id de proveedor.
create table public.places (
  id                   uuid primary key default gen_random_uuid(),
  name                 text not null check (length(name) between 1 and 300),
  normalized_name      text not null check (length(normalized_name) between 1 and 300),
  category             text not null check (category in
                         ('food','beer','coffee','lodging','pharmacy','gas','store','nightlife')),
  secondary_categories text[] not null default '{}',
  location             geography(point, 4326) not null,
  -- Subobjetos canónicos (espejo de LocavoPlace; claves camelCase del dominio)
  address              jsonb,
  contact              jsonb,
  hours                jsonb,
  price                jsonb,
  features             jsonb,
  search_terms         text[] not null default '{}',
  -- Verificación vigente
  verification_status  text not null default 'unverified' check (verification_status in
                         ('unverified','source_verified','community_verified','owner_verified','locavo_verified')),
  confidence           numeric(3,2) not null default 0 check (confidence >= 0 and confidence <= 1),
  last_verified_at     timestamptz,
  -- Soft delete / estado del negocio (nunca borrado físico desde el cliente)
  status               text not null default 'active' check (status in
                         ('active','temporarily_closed','permanently_closed','deleted')),
  published            boolean not null default false,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
-- El nombre NO es único: homónimos, sucursales y vecinos son legítimos.

create index places_location_gix on public.places using gist (location);
create index places_category_idx on public.places (category) where published and status = 'active';
create index places_normalized_name_trgm on public.places using gin (normalized_name gin_trgm_ops);
create index places_status_idx on public.places (status, published);

create trigger places_set_updated_at
  before update on public.places
  for each row execute function public.set_updated_at();

-- Referencias a fuentes externas (denueId, clee, osmId, ownerId, futuras).
create table public.place_source_refs (
  id          uuid primary key default gen_random_uuid(),
  place_id    uuid not null references public.places(id) on delete cascade,
  source      text not null check (source in ('locavo','denue','openstreetmap','owner','community','mock')),
  ref_type    text not null check (ref_type in ('locavo_id','denue_id','clee','osm_id','owner_id','other')),
  external_id text not null check (length(external_id) between 1 and 200),
  created_at  timestamptz not null default now(),
  -- Un identificador externo no puede pertenecer a dos lugares.
  constraint place_source_refs_unique_external unique (source, ref_type, external_id)
);
create index place_source_refs_place_idx on public.place_source_refs (place_id);

-- Procedencia (historial de fuentes que aportaron/actualizaron el registro).
create table public.place_provenance (
  id          uuid primary key default gen_random_uuid(),
  place_id    uuid not null references public.places(id) on delete cascade,
  source      text not null check (source in ('locavo','denue','openstreetmap','owner','community','mock')),
  imported_at timestamptz,
  updated_at  timestamptz
);
create index place_provenance_place_idx on public.place_provenance (place_id);

-- Contenido localizado publicado. El texto ORIGINAL nunca se sobrescribe:
-- original y traducciones son filas separadas.
create table public.place_localized_content (
  id           uuid primary key default gen_random_uuid(),
  place_id     uuid not null references public.places(id) on delete cascade,
  field        text not null check (field in ('description')),
  language     text not null check (length(language) between 2 and 10),
  text_value   text not null,
  is_original  boolean not null default false,
  source       text not null check (source in ('locavo','denue','openstreetmap','owner','community','mock')),
  captured_at  timestamptz not null default now(),
  is_published boolean not null default false,
  constraint place_localized_content_unique unique (place_id, field, language)
);
create index place_localized_content_place_idx on public.place_localized_content (place_id);

-- ============================================================================
-- ESQUEMA PRIVADO (importadores/sincronización; solo backend/service role)
-- ============================================================================

create table private.data_sources (
  id          text primary key,             -- 'denue' | 'openstreetmap' | …
  display_name text not null,
  enabled     boolean not null default false,
  notes       text,
  created_at  timestamptz not null default now()
);

create table private.sync_runs (
  id           uuid primary key default gen_random_uuid(),
  source_id    text not null references private.data_sources(id),
  started_at   timestamptz not null default now(),
  finished_at  timestamptz,
  status       text not null default 'running' check (status in ('running','succeeded','failed','cancelled')),
  stats        jsonb,
  error_detail text
);

create table private.sync_items (
  id           uuid primary key default gen_random_uuid(),
  sync_run_id  uuid not null references private.sync_runs(id) on delete cascade,
  external_id  text not null,
  action       text not null check (action in ('created','updated','skipped','merged','failed')),
  place_id     uuid references public.places(id),
  detail       jsonb,
  created_at   timestamptz not null default now()
);

-- Payload crudo tal como lo entregó la fuente (auditoría de importaciones).
create table private.provider_snapshots (
  id          uuid primary key default gen_random_uuid(),
  source_id   text not null,
  external_id text not null,
  place_id    uuid references public.places(id),
  payload     jsonb not null,
  imported_at timestamptz not null default now()
);
create index provider_snapshots_source_idx on private.provider_snapshots (source_id, external_id);

-- Auditoría de cambios sobre lugares (merge, importaciones, admin).
create table private.place_change_history (
  id         uuid primary key default gen_random_uuid(),
  place_id   uuid not null references public.places(id),
  changed_by text not null,                -- 'import:denue' | 'merge' | 'admin' | …
  change     jsonb not null,
  reason     text,
  created_at timestamptz not null default now()
);
create index place_change_history_place_idx on private.place_change_history (place_id);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================
-- Política V4A: el cliente público SOLO lee lugares publicados y activos y
-- su información pública relacionada. Cero escrituras públicas. Las tablas
-- internas no tienen NINGUNA política (deny-all) y además viven en un
-- esquema no expuesto por la API.

alter table public.places enable row level security;
alter table public.place_source_refs enable row level security;
alter table public.place_provenance enable row level security;
alter table public.place_localized_content enable row level security;

alter table private.data_sources enable row level security;
alter table private.sync_runs enable row level security;
alter table private.sync_items enable row level security;
alter table private.provider_snapshots enable row level security;
alter table private.place_change_history enable row level security;
-- (sin políticas en private.*: deny-all incluso si el esquema se expusiera)

create policy places_public_read
  on public.places
  for select
  to anon, authenticated
  using (published and status = 'active');
-- Sin políticas de insert/update/delete → escritura pública bloqueada.

create policy place_source_refs_public_read
  on public.place_source_refs
  for select
  to anon, authenticated
  using (exists (
    select 1 from public.places p
    where p.id = place_id and p.published and p.status = 'active'
  ));

create policy place_provenance_public_read
  on public.place_provenance
  for select
  to anon, authenticated
  using (exists (
    select 1 from public.places p
    where p.id = place_id and p.published and p.status = 'active'
  ));

create policy place_localized_content_public_read
  on public.place_localized_content
  for select
  to anon, authenticated
  using (
    is_published
    and exists (
      select 1 from public.places p
      where p.id = place_id and p.published and p.status = 'active'
    )
  );

-- ============================================================================
-- SUPERFICIE DE LECTURA (RPCs seguras, security invoker → RLS aplica)
-- ============================================================================

-- Construye el jsonb canónico (espejo de LocavoPlace) de un lugar.
create or replace function public.place_json(p public.places)
returns jsonb
language sql
stable
as $$
  select jsonb_build_object(
    'id', p.id,
    'name', p.name,
    'normalizedName', p.normalized_name,
    'category', p.category,
    'secondaryCategories', to_jsonb(p.secondary_categories),
    'coordinates', jsonb_build_object(
      'latitude',  ST_Y(p.location::geometry),
      'longitude', ST_X(p.location::geometry)
    ),
    'address', p.address,
    'contact', p.contact,
    'hours', p.hours,
    'price', p.price,
    'features', p.features,
    'searchTerms', to_jsonb(p.search_terms),
    'verification', jsonb_build_object(
      'status', p.verification_status,
      'confidence', p.confidence,
      'lastVerifiedAt', p.last_verified_at
    ),
    'sourceRefs', coalesce((
      select jsonb_object_agg(
        case r.ref_type
          when 'locavo_id' then 'locavoId'
          when 'denue_id'  then 'denueId'
          when 'clee'      then 'clee'
          when 'osm_id'    then 'osmId'
          when 'owner_id'  then 'ownerId'
          else r.ref_type
        end,
        r.external_id)
      from public.place_source_refs r
      where r.place_id = p.id
    ), '{}'::jsonb),
    'provenance', coalesce((
      select jsonb_agg(jsonb_build_object(
        'source', v.source,
        'importedAt', v.imported_at,
        'updatedAt', v.updated_at))
      from public.place_provenance v
      where v.place_id = p.id
    ), '[]'::jsonb),
    'status', jsonb_build_object(
      'active', p.status = 'active',
      'temporarilyClosed', p.status = 'temporarily_closed',
      'permanentlyClosed', p.status = 'permanently_closed'
    ),
    -- Contenido localizado publicado: original + traducciones separadas
    -- (el original nunca se sobrescribe).
    'content', (
      select case when original.value is null then null else jsonb_build_object(
        'description', jsonb_build_object(
          'original', original.value,
          'translations', (
            select jsonb_object_agg(c.language, jsonb_build_object(
              'text', c.text_value,
              'translatedAt', c.captured_at,
              'source', c.source))
            from public.place_localized_content c
            where c.place_id = p.id and c.field = 'description'
              and not c.is_original and c.is_published
          )
        )
      ) end
      from (
        select jsonb_build_object(
          'text', c.text_value,
          'language', c.language,
          'source', c.source,
          'capturedAt', c.captured_at) as value
        from public.place_localized_content c
        where c.place_id = p.id and c.field = 'description'
          and c.is_original and c.is_published
        limit 1
      ) original
    ),
    'createdAt', p.created_at,
    'updatedAt', p.updated_at
  );
$$;

-- Lugar por locavoPlaceId. Acepta texto para no fallar ante ids no-UUID.
create or replace function public.place_by_id(p_id text)
returns table (place jsonb, distance_m double precision, total bigint)
language sql
stable
set search_path = public
as $$
  select public.place_json(p), null::double precision, 1::bigint
  from public.places p
  where p.id::text = p_id
    and p.published and p.status = 'active'
  limit 1;
$$;

-- Cerca de un punto, radio en metros, categorías opcionales.
create or replace function public.places_nearby(
  p_lat double precision,
  p_lng double precision,
  p_radius_m double precision,
  p_categories text[] default null,
  p_limit int default 20,
  p_offset int default 0
)
returns table (place jsonb, distance_m double precision, total bigint)
language plpgsql
stable
set search_path = public
as $$
declare
  ref geography;
begin
  if p_lat is null or p_lng is null or p_lat < -90 or p_lat > 90 or p_lng < -180 or p_lng > 180 then
    raise exception 'INVALID_QUERY: coordenadas fuera de rango';
  end if;
  if p_radius_m is null or p_radius_m < 100 or p_radius_m > 30000 then
    raise exception 'INVALID_QUERY: radio fuera de rango (100–30000 m)';
  end if;
  if p_limit is null or p_limit < 1 or p_limit > 50 then
    raise exception 'INVALID_QUERY: límite fuera de rango (1–50)';
  end if;
  if p_offset is null or p_offset < 0 then
    raise exception 'INVALID_QUERY: offset inválido';
  end if;

  ref := ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography;

  return query
  select
    public.place_json(p),
    ST_Distance(p.location, ref),
    count(*) over ()
  from public.places p
  where p.published and p.status = 'active'
    and ST_DWithin(p.location, ref, p_radius_m)
    and (p_categories is null or p.category = any(p_categories))
  order by ST_Distance(p.location, ref) asc, p.id asc
  limit p_limit offset p_offset;
end;
$$;

-- Búsqueda de texto (el cliente envía la consulta ya normalizada; los alias
-- multilenguaje se resuelven en la app y llegan como p_categories).
create or replace function public.places_search_text(
  p_query text,
  p_lat double precision default null,
  p_lng double precision default null,
  p_categories text[] default null,
  p_limit int default 20,
  p_offset int default 0
)
returns table (place jsonb, distance_m double precision, total bigint)
language plpgsql
stable
set search_path = public
as $$
declare
  ref geography;
  q text;
begin
  q := trim(coalesce(p_query, ''));
  if q = '' then
    raise exception 'INVALID_QUERY: texto vacío';
  end if;
  if p_limit is null or p_limit < 1 or p_limit > 50 then
    raise exception 'INVALID_QUERY: límite fuera de rango (1–50)';
  end if;
  if p_offset is null or p_offset < 0 then
    raise exception 'INVALID_QUERY: offset inválido';
  end if;
  if (p_lat is not null) <> (p_lng is not null) then
    raise exception 'INVALID_QUERY: origen incompleto';
  end if;
  if p_lat is not null and (p_lat < -90 or p_lat > 90 or p_lng < -180 or p_lng > 180) then
    raise exception 'INVALID_QUERY: coordenadas fuera de rango';
  end if;

  if p_lat is not null then
    ref := ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography;
  end if;

  return query
  select
    public.place_json(p),
    case when ref is null then null else ST_Distance(p.location, ref) end,
    count(*) over ()
  from public.places p
  where p.published and p.status = 'active'
    and (
      p.normalized_name ilike '%' || q || '%'
      or exists (select 1 from unnest(p.search_terms) term where term ilike '%' || q || '%')
      or coalesce(p.address->>'formatted', '') ilike '%' || q || '%'
      or (p_categories is not null and p.category = any(p_categories))
    )
  order by
    case when ref is null then 0 else ST_Distance(p.location, ref) end asc,
    p.id asc
  limit p_limit offset p_offset;
end;
$$;

-- Listado por categoría con origen opcional para ordenar por distancia.
create or replace function public.places_by_category(
  p_category text,
  p_lat double precision default null,
  p_lng double precision default null,
  p_limit int default 20,
  p_offset int default 0
)
returns table (place jsonb, distance_m double precision, total bigint)
language plpgsql
stable
set search_path = public
as $$
declare
  ref geography;
begin
  if p_category is null or p_category not in
     ('food','beer','coffee','lodging','pharmacy','gas','store','nightlife') then
    raise exception 'INVALID_QUERY: categoría desconocida';
  end if;
  if p_limit is null or p_limit < 1 or p_limit > 50 then
    raise exception 'INVALID_QUERY: límite fuera de rango (1–50)';
  end if;
  if p_offset is null or p_offset < 0 then
    raise exception 'INVALID_QUERY: offset inválido';
  end if;
  if (p_lat is not null) <> (p_lng is not null) then
    raise exception 'INVALID_QUERY: origen incompleto';
  end if;
  if p_lat is not null and (p_lat < -90 or p_lat > 90 or p_lng < -180 or p_lng > 180) then
    raise exception 'INVALID_QUERY: coordenadas fuera de rango';
  end if;

  if p_lat is not null then
    ref := ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography;
  end if;

  return query
  select
    public.place_json(p),
    case when ref is null then null else ST_Distance(p.location, ref) end,
    count(*) over ()
  from public.places p
  where p.published and p.status = 'active'
    and p.category = p_category
  order by
    case when ref is null then 0 else ST_Distance(p.location, ref) end asc,
    p.id asc
  limit p_limit offset p_offset;
end;
$$;

-- Permisos de ejecución: solo las RPCs de lectura para clientes públicos.
grant execute on function public.place_by_id(text) to anon, authenticated;
grant execute on function public.places_nearby(double precision, double precision, double precision, text[], int, int) to anon, authenticated;
grant execute on function public.places_search_text(text, double precision, double precision, text[], int, int) to anon, authenticated;
grant execute on function public.places_by_category(text, double precision, double precision, int, int) to anon, authenticated;

-- Fuentes de datos previstas (apagadas; los importadores llegan en V4B).
insert into private.data_sources (id, display_name, enabled, notes) values
  ('denue', 'INEGI / DENUE', false, 'Fuente oficial principal para negocios en México. Importador pendiente (V4B); token SOLO en backend.'),
  ('openstreetmap', 'OpenStreetMap', false, 'Complemento abierto. ODbL: atribución obligatoria; no abusar de Overpass público.'),
  ('mock', 'Semilla de demostración', true, 'Solo desarrollo local. Nunca desplegar en producción.');
