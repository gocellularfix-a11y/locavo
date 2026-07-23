/**
 * Identidad ABIERTA de proveedor (City Pipeline V1).
 *
 * `ProviderId` es una cadena libre validada por el REGISTRO, no un enum cerrado:
 * agregar un proveedor nuevo (Overture, GeoNames, datos municipales) es
 * registrarlo, jamás editar una unión de tipos ni tocar el pipeline. Las
 * constantes canónicas evitan literales sueltos dentro del pipeline.
 */
export type ProviderId = string;

/** Constantes canónicas de los proveedores ya conocidos (evita literales crudos). */
export const PROVIDER_DENUE: ProviderId = 'denue';
export const PROVIDER_OSM: ProviderId = 'openstreetmap';
export const PROVIDER_OVERTURE: ProviderId = 'overture';
export const PROVIDER_GEONAMES: ProviderId = 'geonames';
export const PROVIDER_WIKIDATA: ProviderId = 'wikidata';
