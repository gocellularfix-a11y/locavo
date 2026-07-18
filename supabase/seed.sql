-- ============================================================================
-- Locavo — SEED SOLO PARA DESARROLLO LOCAL (V4A)
--
--   * Muestra pequeña y determinista basada en los lugares demo de la app.
--   * UUIDs fijos y reproducibles; source = 'mock' en procedencia y refs.
--   * NO es información oficial, NO contiene datos personales.
--   * NO debe desplegarse en producción ni confundirse con datos reales.
--   * Se recrea con `npx supabase db reset` (requiere Docker).
--
-- La app instalada sigue usando LocalPlaceRepository por defecto; este seed
-- solo alimenta el stack local para probar RPCs y RLS.
-- ============================================================================

insert into public.places
  (id, name, normalized_name, category, location, address, contact, hours, price, search_terms,
   verification_status, confidence, last_verified_at, status, published)
values
  ('00000000-0000-4000-8000-000000000001', 'Demo Taquería Centro', 'demo taqueria centro', 'food',
   ST_SetSRID(ST_MakePoint(-107.3958, 24.8079), 4326)::geography,
   '{"formatted":"Av. Obregón 210, Centro","locality":"Culiacán","municipality":"Culiacán","state":"Sinaloa","countryCode":"MX"}',
   '{"phone":"+52 667 000 0001","website":"https://example.com/demo-taqueria-centro"}',
   '{"weekly":[[{"open":"12:00","close":"23:00"}],[{"open":"12:00","close":"23:00"}],[{"open":"12:00","close":"23:00"}],[{"open":"12:00","close":"23:00"}],[{"open":"12:00","close":"23:00"}],[{"open":"12:00","close":"23:00"}],[{"open":"12:00","close":"23:00"}]]}',
   '{"level":1,"currency":"MXN"}', '{tacos,asada,pastor,quesadillas}',
   'unverified', 0.90, '2026-07-10T18:00:00Z', 'active', true),

  ('00000000-0000-4000-8000-000000000002', 'Demo Expendio Norte', 'demo expendio norte', 'beer',
   ST_SetSRID(ST_MakePoint(-107.4012, 24.8265), 4326)::geography,
   '{"formatted":"Blvd. Universitarios 501, Col. Universitaria","locality":"Culiacán","municipality":"Culiacán","state":"Sinaloa","countryCode":"MX"}',
   '{"phone":"+52 667 000 0011"}',
   '{"weekly":[[{"open":"10:00","close":"22:00"}],[{"open":"10:00","close":"22:00"}],[{"open":"10:00","close":"22:00"}],[{"open":"10:00","close":"22:00"}],[{"open":"10:00","close":"22:00"}],[{"open":"10:00","close":"22:00"}],[{"open":"10:00","close":"22:00"}]]}',
   '{"level":1,"currency":"MXN"}', '{expendio,six,caguama,hielo}',
   'unverified', 0.90, '2026-07-12T21:00:00Z', 'active', true),

  ('00000000-0000-4000-8000-000000000003', 'Demo Café Río', 'demo cafe rio', 'coffee',
   ST_SetSRID(ST_MakePoint(-107.3921, 24.8145), 4326)::geography,
   '{"formatted":"Malecón Nuevo 300, Col. Miguel Alemán","locality":"Culiacán","municipality":"Culiacán","state":"Sinaloa","countryCode":"MX"}',
   '{"phone":"+52 667 000 0021","website":"https://example.com/demo-cafe-rio"}',
   '{"weekly":[[{"open":"07:00","close":"21:00"}],[{"open":"07:00","close":"21:00"}],[{"open":"07:00","close":"21:00"}],[{"open":"07:00","close":"21:00"}],[{"open":"07:00","close":"21:00"}],[{"open":"07:00","close":"21:00"}],[{"open":"07:00","close":"21:00"}]]}',
   '{"level":2,"currency":"MXN"}', '{espresso,capuchino,"pan dulce",wifi}',
   'unverified', 0.90, '2026-07-14T15:00:00Z', 'active', true),

  ('00000000-0000-4000-8000-000000000004', 'Demo Hotel Ejecutivo Centro', 'demo hotel ejecutivo centro', 'lodging',
   ST_SetSRID(ST_MakePoint(-107.3912, 24.8055), 4326)::geography,
   '{"formatted":"Blvd. Francisco I. Madero 350, Centro","locality":"Culiacán","municipality":"Culiacán","state":"Sinaloa","countryCode":"MX"}',
   '{"phone":"+52 667 000 0031","website":"https://example.com/demo-hotel-ejecutivo"}',
   '{"weekly":[[{"open":"00:00","close":"00:00"}],[{"open":"00:00","close":"00:00"}],[{"open":"00:00","close":"00:00"}],[{"open":"00:00","close":"00:00"}],[{"open":"00:00","close":"00:00"}],[{"open":"00:00","close":"00:00"}],[{"open":"00:00","close":"00:00"}]]}',
   '{"level":2,"currency":"MXN"}', '{hotel,"recepcion 24 horas",estacionamiento}',
   'unverified', 0.90, '2026-07-08T12:00:00Z', 'active', true),

  ('00000000-0000-4000-8000-000000000005', 'Demo Farmacia del Parque', 'demo farmacia del parque', 'pharmacy',
   ST_SetSRID(ST_MakePoint(-107.3931, 24.8087), 4326)::geography,
   '{"formatted":"Av. Obregón 88, Centro","locality":"Culiacán","municipality":"Culiacán","state":"Sinaloa","countryCode":"MX"}',
   '{"phone":"+52 667 000 0041","website":"https://example.com/demo-farmacia-parque"}',
   '{"weekly":[[{"open":"00:00","close":"00:00"}],[{"open":"00:00","close":"00:00"}],[{"open":"00:00","close":"00:00"}],[{"open":"00:00","close":"00:00"}],[{"open":"00:00","close":"00:00"}],[{"open":"00:00","close":"00:00"}],[{"open":"00:00","close":"00:00"}]]}',
   '{"level":1,"currency":"MXN"}', '{"24 horas",medicamentos,consultorio}',
   'unverified', 0.90, '2026-07-15T09:00:00Z', 'active', true),

  ('00000000-0000-4000-8000-000000000006', 'Demo Gasolinera Madero', 'demo gasolinera madero', 'gas',
   ST_SetSRID(ST_MakePoint(-107.3987, 24.8033), 4326)::geography,
   '{"formatted":"Blvd. Madero 980, Centro","locality":"Culiacán","municipality":"Culiacán","state":"Sinaloa","countryCode":"MX"}',
   '{"phone":"+52 667 000 0051"}',
   '{"weekly":[[{"open":"00:00","close":"00:00"}],[{"open":"00:00","close":"00:00"}],[{"open":"00:00","close":"00:00"}],[{"open":"00:00","close":"00:00"}],[{"open":"00:00","close":"00:00"}],[{"open":"00:00","close":"00:00"}],[{"open":"00:00","close":"00:00"}]]}',
   '{"level":2,"currency":"MXN"}', '{magna,premium,diesel,"24 horas"}',
   'unverified', 0.90, '2026-07-16T08:00:00Z', 'active', true),

  ('00000000-0000-4000-8000-000000000007', 'Demo Abarrotes El Mercadito', 'demo abarrotes el mercadito', 'store',
   ST_SetSRID(ST_MakePoint(-107.3902, 24.8071), 4326)::geography,
   '{"formatted":"Mercado Garmendia local 4, Centro","locality":"Culiacán","municipality":"Culiacán","state":"Sinaloa","countryCode":"MX"}',
   '{"phone":"+52 667 000 0061"}',
   '{"weekly":[[{"open":"07:00","close":"20:00"}],[{"open":"07:00","close":"20:00"}],[{"open":"07:00","close":"20:00"}],[{"open":"07:00","close":"20:00"}],[{"open":"07:00","close":"20:00"}],[{"open":"07:00","close":"20:00"}],[{"open":"07:00","close":"20:00"}]]}',
   '{"level":1,"currency":"MXN"}', '{abarrotes,frutas,verduras,recargas}',
   'unverified', 0.90, '2026-07-11T13:00:00Z', 'active', true),

  ('00000000-0000-4000-8000-000000000008', 'Demo Bar La Ochenta', 'demo bar la ochenta', 'nightlife',
   ST_SetSRID(ST_MakePoint(-107.3969, 24.8091), 4326)::geography,
   '{"formatted":"Calle Rosales 80, Centro","locality":"Culiacán","municipality":"Culiacán","state":"Sinaloa","countryCode":"MX"}',
   '{"phone":"+52 667 000 0071","website":"https://example.com/demo-la-ochenta"}',
   '{"weekly":[[],[],[],[{"open":"19:00","close":"01:00"}],[{"open":"19:00","close":"02:00"}],[{"open":"19:00","close":"03:00"}],[{"open":"19:00","close":"03:00"}]]}',
   '{"level":2,"currency":"MXN"}', '{bar,"musica en vivo",banda,cocteles}',
   'unverified', 0.90, '2026-07-13T04:00:00Z', 'active', true),

  -- Lugar NO publicado: debe ser invisible para el cliente público (prueba RLS).
  ('00000000-0000-4000-8000-000000000099', 'Demo Lugar Interno No Publicado', 'demo lugar interno no publicado', 'food',
   ST_SetSRID(ST_MakePoint(-107.3940, 24.8069), 4326)::geography,
   null, null, null, null, '{}',
   'unverified', 0.10, null, 'active', false);

insert into public.place_source_refs (place_id, source, ref_type, external_id)
select id, 'mock', 'locavo_id', 'demo-' || right(id::text, 2)
from public.places;

insert into public.place_provenance (place_id, source, imported_at, updated_at)
select id, 'mock', '2026-07-01T00:00:00Z', last_verified_at
from public.places;
