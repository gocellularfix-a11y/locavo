/**
 * PROYECCIÓN de conocimiento por lugar (PKE-0).
 *
 * `PlaceKnowledge` NO es la fuente de verdad: es la proyección determinista y
 * recomputable del log de fragmentos de un lugar tras aplicar la precedencia.
 * Cada campo resuelto conserva la cadena completa de trazabilidad:
 * valor → fragmento ganador → evidencia → fuente → licencia.
 *
 * El PKE no recomienda, no rankea y no toca la UI: los motores congelados
 * siguen consumiendo únicamente `LocavoPlace`.
 */
import type { KnowledgeConfidence } from './confidence';
import type { KnowledgeCoverage } from './coverage';
import type { KnowledgeFieldKey, KnowledgeFieldValueMap } from './knowledgeField';

export interface KnowledgeFieldState<K extends KnowledgeFieldKey = KnowledgeFieldKey> {
  readonly value: KnowledgeFieldValueMap[K];
  readonly confidence: KnowledgeConfidence;
  /** Fragmento que ganó la precedencia para este campo. */
  readonly winningFragmentId: string;
  /** Fragmentos que perdieron la precedencia (conflictos PRESERVADOS, jamás borrados). */
  readonly conflictingFragmentIds: readonly string[];
}

export interface PlaceKnowledge {
  readonly schemaVersion: number;
  /** locavoPlaceId del lugar descrito. */
  readonly placeId: string;
  /** Revisión monotónica derivada: total de fragmentos aplicados en la proyección. */
  readonly revision: number;
  /** Máximo `retrievedAt` entre los fragmentos aplicados (derivado, nunca reloj). */
  readonly updatedAt: string;
  readonly fields: { readonly [K in KnowledgeFieldKey]?: KnowledgeFieldState<K> };
  readonly coverage: KnowledgeCoverage;
}
