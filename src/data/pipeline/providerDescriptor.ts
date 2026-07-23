/**
 * DESCRIPTOR de proveedor (City Pipeline V1) — dato PURO y neutral que centraliza
 * todo el "conocimiento del proveedor" que antes vivía disperso como literales:
 * id, nombre, versión, licencia, países, capacidades, nivel de verificación que
 * aporta y a qué ranuras de `sourceRefs` mapean sus referencias. El runtime y el
 * constructor consultan el REGISTRO, nunca literales de proveedor.
 */
import type { PlaceSourceRefs, PlaceVerification } from '../../domain/places/LocavoPlace';
import type { ProviderLicense } from './licenseTier';
import type { ProviderId } from './providerId';
import type { VerificationLevel } from './providerMetadata';

/** Qué campos estructurados puede aportar el proveedor (para fusión y cobertura). */
export interface ProviderCapabilities {
  readonly coordinates: boolean;
  readonly categories: boolean;
  readonly openingHours: boolean;
  readonly contact: boolean;
  readonly accessibility: boolean;
  readonly tourism: boolean;
  readonly prices: boolean;
  readonly multilingual: boolean;
}

/**
 * Mapa de referencia del proveedor a las ranuras canónicas de `sourceRefs`.
 * Reemplaza la lógica incrustada "si es denue → denueId". DENUE:
 * `{ externalId: 'denueId', clee: 'clee' }`; OSM: `{ externalId: 'osmId' }`.
 */
export interface ProviderSourceRefSlots {
  readonly externalId?: keyof PlaceSourceRefs;
  readonly clee?: keyof PlaceSourceRefs;
}

export interface ProviderDescriptor {
  readonly id: ProviderId;
  readonly name: string;
  readonly version: string;
  readonly license: ProviderLicense;
  /** Códigos ISO-3166-1 alpha-2 soportados, o `['*']` para global. */
  readonly countries: readonly string[];
  readonly capabilities: ProviderCapabilities;
  /** Nivel de verificación que aporta la fuente (autoridad del dato). */
  readonly verificationLevel: VerificationLevel;
  /** Estado/confianza de verificación derivados (idénticos a los históricos). */
  readonly verification: Pick<PlaceVerification, 'status' | 'confidence'>;
  /** Cómo se preservan las referencias del proveedor en `sourceRefs`. */
  readonly sourceRefSlots: ProviderSourceRefSlots;
}
