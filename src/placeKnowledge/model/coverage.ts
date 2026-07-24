/**
 * COBERTURA de conocimiento (PKE-0) — qué se sabe y qué falta de un lugar.
 *
 * La cobertura es una proyección derivada (recomputable desde los fragmentos):
 * permite auditar la calidad del conocimiento y priorizar el enriquecimiento
 * futuro sin inspeccionar campo por campo.
 */
import type { KnowledgeFieldKey } from './knowledgeField';

export interface KnowledgeCoverage {
  /** Campos con valor resuelto, en el orden canónico del catálogo. */
  readonly knownFields: readonly KnowledgeFieldKey[];
  /** Campos sin conocimiento alguno, en el orden canónico del catálogo. */
  readonly missingFields: readonly KnowledgeFieldKey[];
  /** Proporción conocida del catálogo: conocidos / total (0–1, determinista). */
  readonly completeness: number;
  /** `capturedAt` más antiguo entre los campos conocidos (auditoría de frescura). */
  readonly oldestCapturedAt?: string;
  /** `capturedAt` más reciente entre los campos conocidos. */
  readonly newestCapturedAt?: string;
}
