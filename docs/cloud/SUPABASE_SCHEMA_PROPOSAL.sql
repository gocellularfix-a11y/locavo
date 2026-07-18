-- ============================================================================
-- Locavo — PROPUESTA de esquema (V3). NO EJECUTADO. NO hay recursos cloud.
-- Destino previsto: Supabase (PostgreSQL + PostGIS + Storage).
-- Principios: PK UUID, identidad propia de Locavo, multi-fuente con
-- procedencia, timestamps, soft-delete por estado y auditabilidad.
-- ============================================================================

-- create extension if not exists postgis;
-- create extension if not exists pgcrypto; -- gen_random_uuid()

-- ── Núcleo ──────────────────────────────────────────────────────────────────
create table places (
  id               uuid primary key default gen_random_uuid(), -- locavoPlaceId
  name             text not null,
  normalized_name  text not null,
  category         text not null,          -- food|beer|coffee|lodging|pharmacy|gas|store|nightlife
  secondary_categories text[] not null default '{}',
  location         geography(point, 4326) not null,  -- índice GiST abajo
  status           text not null default 'active',   -- active|temporarily_closed|permanently_closed|deleted (soft delete)
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index places_location_gix on places using gist (location);
create index places_category_idx on places (category) where status = 'active';
create index places_normalized_name_trgm on places using gin (normalized_name gin_trgm_ops);

-- Referencias a fuentes externas (nunca PK).
create table place_source_refs (
  id          uuid primary key default gen_random_uuid(),
  place_id    uuid not null references places(id),
  source      text not null,               -- locavo|denue|openstreetmap|owner|community|mock
  external_id text not null,               -- denueId, osmId, clee, ownerId…
  ref_type    text not null,               -- denue_id|clee|osm_id|owner_id…
  created_at  timestamptz not null default now(),
  unique (source, ref_type, external_id)
);

create table place_addresses (
  place_id        uuid primary key references places(id),
  formatted       text,
  street          text,
  exterior_number text,
  neighborhood    text,
  postal_code     text,
  locality        text,
  municipality    text,
  state           text,
  country_code    text not null default 'MX',
  updated_at      timestamptz not null default now()
);

create table place_contacts (
  place_id   uuid primary key references places(id),
  phone      text,
  email      text,
  website    text,
  updated_at timestamptz not null default now()
);

-- Horario semanal: 0=domingo…6=sábado; intervalos HH:mm; cierre <= apertura
-- cruza medianoche. day_hours null = no confirmado ese día.
create table place_hours (
  id         uuid primary key default gen_random_uuid(),
  place_id   uuid not null references places(id),
  weekday    smallint not null check (weekday between 0 and 6),
  open_time  time,
  close_time time,
  unknown    boolean not null default false,
  updated_at timestamptz not null default now()
);
create index place_hours_place_idx on place_hours (place_id);

create table place_features (
  place_id              uuid primary key references places(id),
  wheelchair_accessible boolean,
  family_friendly       boolean,
  parking               boolean,
  delivery              boolean,
  outdoor_seating       boolean,
  reservations          boolean,
  price_level           smallint check (price_level between 1 and 4),
  price_min             numeric(10,2),
  price_max             numeric(10,2),
  currency              text default 'MXN',
  updated_at            timestamptz not null default now()
);

create table place_verifications (
  id               uuid primary key default gen_random_uuid(),
  place_id         uuid not null references places(id),
  status           text not null,          -- unverified|source_verified|community_verified|owner_verified|locavo_verified
  confidence       numeric(3,2) not null check (confidence between 0 and 1),
  verified_by      text,                   -- fuente o actor
  last_verified_at timestamptz,
  created_at       timestamptz not null default now()
);
create index place_verifications_place_idx on place_verifications (place_id);

-- Contenido localizado: el original NUNCA se sobrescribe; las traducciones
-- son filas separadas referenciando el original.
create table place_localized_content (
  id            uuid primary key default gen_random_uuid(),
  place_id      uuid not null references places(id),
  field         text not null,             -- description|…
  language      text not null,             -- es-MX, en, pt, fr, it, de, zh-CN…
  text_value    text not null,
  is_original   boolean not null default false,
  source        text not null,             -- owner|community|locavo|denue|openstreetmap
  captured_at   timestamptz not null default now(),
  original_id   uuid references place_localized_content(id), -- null si es el original
  unique (place_id, field, language)
);

create table place_media (
  id         uuid primary key default gen_random_uuid(),
  place_id   uuid not null references places(id),
  storage_path text not null,              -- Supabase Storage
  kind       text not null default 'photo',
  source     text not null,
  created_at timestamptz not null default now()
);

-- Snapshot crudo por proveedor (auditar qué entregó cada fuente y cuándo).
create table place_provider_snapshots (
  id          uuid primary key default gen_random_uuid(),
  place_id    uuid references places(id), -- null hasta resolver el merge
  source      text not null,
  external_id text not null,
  payload     jsonb not null,
  imported_at timestamptz not null default now()
);
create index provider_snapshots_source_idx on place_provider_snapshots (source, external_id);

-- Historial de cambios (auditabilidad completa).
create table place_change_history (
  id         uuid primary key default gen_random_uuid(),
  place_id   uuid not null references places(id),
  changed_by text not null,                -- import:denue|merge|owner:<id>|admin…
  change     jsonb not null,               -- diff aplicado
  reason     text,
  created_at timestamptz not null default now()
);
create index place_change_history_place_idx on place_change_history (place_id);

-- Nota: RLS (row level security), políticas de lectura pública y roles de
-- escritura se definirán al crear el proyecto Supabase real (V4), junto con
-- la función RPC de búsqueda por radio (ST_DWithin sobre places.location).
