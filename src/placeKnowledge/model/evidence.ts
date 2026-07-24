/**
 * EVIDENCIA (PKE-0) — el respaldo auditable de cada fragmento de conocimiento.
 *
 * El nivel de evidencia describe CÓMO se conoce el hecho (observación directa,
 * dicho del propietario, publicación oficial, registro de dataset…), separado
 * de QUIÉN lo afirma (la fuente). Ambos ejes participan en la precedencia:
 * autoridad de fuente primero, evidencia después.
 */
import type { EvidenceSpan } from './evidenceSpan';

export type EvidenceLevel =
  | 'observed'
  | 'owner_stated'
  | 'official_publication'
  | 'dataset_record'
  | 'community_report'
  | 'inferred';

/** Rango determinista de evidencia (mayor = más fuerte; validado por test). */
export const EVIDENCE_LEVEL_RANK: Readonly<Record<EvidenceLevel, number>> = {
  observed: 6,
  owner_stated: 5,
  official_publication: 4,
  dataset_record: 3,
  community_report: 2,
  inferred: 1,
};

export interface Evidence {
  readonly level: EvidenceLevel;
  /** Método concreto de obtención (p. ej. 'denue-2026-import', 'site-visit'). */
  readonly method: string;
  /**
   * Fecha del hecho según la FUENTE (ISO-8601, comparable lexicográficamente).
   * Jamás un reloj de ejecución.
   */
  readonly capturedAt: string;
  /** Referencia auditable: URL, id de documento o id de registro del dataset. */
  readonly reference?: string;
  readonly note?: string;
  /**
   * Cita literal dentro del documento fuente que respalda el hecho.
   *
   * OPCIONAL en el modelo porque hay evidencia legítima sin documento que
   * citar: una observación en campo o una captura manual no tienen span. Qué
   * campos EXIGEN span —y con qué severidad— lo decide el validador de la
   * Fase B; el modelo no impone esa política.
   */
  readonly span?: EvidenceSpan;
}

export function evidenceRankOf(evidence: Evidence): number {
  return EVIDENCE_LEVEL_RANK[evidence.level];
}
