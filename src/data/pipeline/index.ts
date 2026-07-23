/**
 * City Pipeline V1 — plataforma de ingesta NEUTRAL AL PROVEEDOR. API pública.
 *
 * Permite ingerir datos de cualquier proveedor (DENUE, OSM, Overture, datos
 * abiertos de gobierno, turismo…) hacia el modelo canónico de Locavo SIN cambiar
 * los motores de inteligencia. Agregar un proveedor = registrar su descriptor +
 * implementar su adaptador. Nada específico de proveedor vive fuera de un
 * adaptador/descriptor.
 */
export type { ProviderId } from './providerId';
export {
  PROVIDER_DENUE,
  PROVIDER_OSM,
  PROVIDER_OVERTURE,
  PROVIDER_GEONAMES,
  PROVIDER_WIKIDATA,
} from './providerId';
export {
  type LicenseTier,
  type ProviderLicense,
  isPermissiveBase,
  requiresSidecar,
  isExcluded,
} from './licenseTier';
export type { ProviderMetadata, VerificationLevel } from './providerMetadata';
export type { CanonicalFragment, FragmentProvenance } from './canonicalFragment';
export type { ProviderAdapter } from './providerAdapter';
export type {
  ProviderDescriptor,
  ProviderCapabilities,
  ProviderSourceRefSlots,
} from './providerDescriptor';
export { ProviderRegistry, providerRegistry, DEFAULT_VERIFICATION } from './providerRegistry';
export { trustRankOf } from './sourceTrust';
export {
  mergeFragments,
  type MergedPlace,
  type MergeConfig,
} from './mergeEngine';
export { DENUE_DESCRIPTOR, denueAdapter, denueCandidateToFragment } from './providers/denue';
export { OSM_DESCRIPTOR } from './providers/osm';
