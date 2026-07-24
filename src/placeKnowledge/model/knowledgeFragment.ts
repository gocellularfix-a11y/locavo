/**
 * FRAGMENTO de conocimiento (PKE-0) — la unidad atómica e INMUTABLE del motor.
 *
 * Un fragmento afirma UN campo de UN lugar según UNA fuente, con evidencia y
 * licencia. Los fragmentos son append-only: jamás se editan ni se borran; una
 * corrección es un fragmento NUEVO que `supersedes` al anterior. El log de
 * fragmentos es la fuente de verdad; `PlaceKnowledge` es una proyección
 * recomputable.
 */
import type { LicenseTier } from '../../data/pipeline/licenseTier';
import type { AcquisitionMetadata } from './acquisition';
import type { Evidence } from './evidence';
import type { ReviewHistory } from './review';
import type { KnowledgeFieldKey, KnowledgeFieldValueMap } from './knowledgeField';
import type { KnowledgeSourceId } from './source';

/**
 * Versión del esquema de conocimiento (fragmentos y proyecciones la portan).
 *
 * v2 (GEN-1 · Fase A): incorpora `acquisition`, `validatorVersion`,
 * `reviewHistory` y el span de evidencia. El crecimiento aditivo del catálogo
 * de campos NO sube esta versión; cambiar el significado de un campo, un rango
 * o la regla de precedencia, sí.
 */
export const KNOWLEDGE_SCHEMA_VERSION = 2;

export interface KnowledgeFragment<K extends KnowledgeFieldKey = KnowledgeFieldKey> {
  /** Id determinista del fragmento: ver `knowledgeFragmentIdOf`. */
  readonly id: string;
  readonly schemaVersion: number;
  /** locavoPlaceId del lugar descrito (identidad interna, nunca de proveedor). */
  readonly placeId: string;
  readonly field: K;
  readonly value: KnowledgeFieldValueMap[K];
  readonly sourceId: KnowledgeSourceId;
  readonly evidence: Evidence;
  /**
   * Fecha de la corrida de obtención (YYYY-MM-DD): dato del proceso de
   * ingesta, registrado como insumo; nunca un reloj de ejecución.
   */
  readonly retrievedAt: string;
  /** Nivel de licencia del dato (separación legal heredada del pipeline). */
  readonly licenseTier: LicenseTier;
  /** Id del fragmento que este corrige/reemplaza (cadena de versiones auditable). */
  readonly supersedes?: string;

  /** CÓMO se obtuvo el hecho, con independencia de la tecnología usada. */
  readonly acquisition: AcquisitionMetadata;
  /**
   * Versión del validador que admitió el fragmento. Permite reevaluar en
   * bloque lo aceptado por una versión concreta. El validador se implementa en
   * la Fase B; aquí solo se registra el campo.
   */
  readonly validatorVersion: string;
  /** Secuencia inmutable de decisiones humanas; vacía = aún sin revisar. */
  readonly reviewHistory: ReviewHistory;
}

/**
 * Id determinista de fragmento: mismos insumos → mismo id. Permite dedupe
 * exacto y auditoría sin generadores de ids ni aleatoriedad.
 */
export function knowledgeFragmentIdOf(
  placeId: string,
  field: KnowledgeFieldKey,
  sourceId: KnowledgeSourceId,
  capturedAt: string,
): string {
  return `${placeId}::${field}::${sourceId}::${capturedAt}`;
}
