/**
 * Metadatos de una CORRIDA de ingesta (City Pipeline V1). Viajan con el City
 * Pack para trazabilidad y atribución legal. Describen la EDICIÓN concreta de la
 * fuente usada, no al proveedor en abstracto (eso vive en el descriptor).
 *
 * Determinista: sin marcas de tiempo de ejecución; `downloadDate`/`edition` son
 * datos de la fuente (fecha oficial), no `Date.now()`.
 */
import type { ProviderId } from './providerId';

export type VerificationLevel = 'unverified' | 'source_verified' | 'curated' | 'official';

export interface ProviderMetadata {
  readonly providerId: ProviderId;
  /** Nombre legible del proveedor/dataset. */
  readonly name: string;
  /** Identificador oficial del dataset (p. ej. MEX-INEGI.EEC2.05-DENUE-2026). */
  readonly datasetVersion: string;
  /** Nombre de la licencia efectiva de esta edición. */
  readonly license: string;
  /** Fecha oficial de la edición/corrección de la fuente (YYYY-MM-DD). */
  readonly edition: string;
  /** Fecha de descarga del insumo, si se registró (YYYY-MM-DD). */
  readonly downloadDate?: string;
  /** Cobertura declarada (país/ciudad/municipio). */
  readonly coverage?: string;
  /** URL de origen del dataset. */
  readonly sourceUrl?: string;
  /** Nivel de verificación que aporta esta fuente. */
  readonly verificationLevel: VerificationLevel;
}
