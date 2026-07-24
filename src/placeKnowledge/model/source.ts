/**
 * FUENTE de conocimiento (PKE-0).
 *
 * Una fuente es cualquier origen capaz de afirmar hechos sobre un lugar:
 * datasets gubernamentales (DENUE), sitios web oficiales, propietarios,
 * visitas de campo, comunidad. Identidad ABIERTA validada por registro (misma
 * doctrina que `ProviderId` del City Pipeline): agregar una fuente =
 * registrarla, jamás editar una unión de tipos ni tocar el modelo.
 *
 * La autoridad de la fuente reutiliza la escala ÚNICA del pipeline
 * (`VerificationLevel` + rango de `sourceTrust`): una sola doctrina de
 * confianza en todo Locavo, sin segunda calibración.
 */
import type { ProviderLicense } from '../../data/pipeline/licenseTier';
import type { ProviderId } from '../../data/pipeline/providerId';
import type { VerificationLevel } from '../../data/pipeline/providerMetadata';
import { trustRankOfLevel } from '../../data/pipeline/sourceTrust';

export type KnowledgeSourceId = string;

/** Naturaleza de la fuente: describe el MECANISMO de origen, no al proveedor. */
export type KnowledgeSourceKind =
  | 'government_dataset'
  | 'community_dataset'
  | 'official_website'
  | 'social_profile'
  | 'owner'
  | 'field_observation'
  | 'locavo_curation';

export interface KnowledgeSource {
  readonly id: KnowledgeSourceId;
  readonly kind: KnowledgeSourceKind;
  readonly name: string;
  /** Licencia efectiva de los datos (misma arquitectura legal del pipeline). */
  readonly license: ProviderLicense;
  /** Autoridad del dato en la escala única de Locavo. */
  readonly verificationLevel: VerificationLevel;
  /** Proveedor del City Pipeline correspondiente, si la fuente deriva de uno. */
  readonly providerId?: ProviderId;
  /** URL raíz auditable de la fuente, si existe. */
  readonly url?: string;
}

/**
 * Registro de fuentes: el agregador resuelve `sourceId` aquí, nunca con
 * literales incrustados (misma doctrina que `providerRegistry`).
 */
export type KnowledgeSourceRegistry = ReadonlyMap<KnowledgeSourceId, KnowledgeSource>;

/** Rango de autoridad de la fuente (delegado a la escala única del pipeline). */
export function knowledgeSourceTrustRankOf(source: KnowledgeSource): number {
  return trustRankOfLevel(source.verificationLevel);
}
