/**
 * PRECEDENCIA de fragmentos (PKE-0) — la regla NORMATIVA de resolución de
 * conflictos, expresada como comparador puro y total.
 *
 * Cuando varias fuentes afirman el mismo campo, gana el fragmento con:
 *   1. mayor autoridad de fuente (escala única del pipeline),
 *   2. mayor nivel de evidencia,
 *   3. `capturedAt` más reciente (ISO-8601, comparación lexicográfica),
 *   4. desempate estable por `sourceId` y luego `fragmentId` (ascendente).
 *
 * Evidencia más débil JAMÁS reemplaza evidencia más fuerte, sin importar el
 * orden de llegada: el resultado es independiente del orden de entrada
 * (verificado por test). Los perdedores no se descartan: quedan preservados
 * como conflicto en la proyección.
 */
import type { VerificationLevel } from '../../data/pipeline/providerMetadata';
import { trustRankOfLevel } from '../../data/pipeline/sourceTrust';
import { EVIDENCE_LEVEL_RANK, type EvidenceLevel } from './evidence';

/** Vista resuelta de un fragmento para efectos de precedencia. */
export interface FragmentPrecedence {
  readonly fragmentId: string;
  readonly sourceId: string;
  /** Autoridad de la fuente emisora (resuelta vía registro de fuentes). */
  readonly verificationLevel: VerificationLevel;
  readonly evidenceLevel: EvidenceLevel;
  /** `evidence.capturedAt` (ISO-8601). */
  readonly capturedAt: string;
}

/**
 * Comparador total y determinista: negativo si `a` precede (gana) a `b`.
 * Ordenar con él produce SIEMPRE la misma lista, sin importar el orden inicial.
 */
export function compareFragmentPrecedence(
  a: FragmentPrecedence,
  b: FragmentPrecedence,
): number {
  const trust = trustRankOfLevel(b.verificationLevel) - trustRankOfLevel(a.verificationLevel);
  if (trust !== 0) {
    return trust;
  }
  const evidence = EVIDENCE_LEVEL_RANK[b.evidenceLevel] - EVIDENCE_LEVEL_RANK[a.evidenceLevel];
  if (evidence !== 0) {
    return evidence;
  }
  if (a.capturedAt !== b.capturedAt) {
    return a.capturedAt > b.capturedAt ? -1 : 1;
  }
  if (a.sourceId !== b.sourceId) {
    return a.sourceId < b.sourceId ? -1 : 1;
  }
  if (a.fragmentId !== b.fragmentId) {
    return a.fragmentId < b.fragmentId ? -1 : 1;
  }
  return 0;
}
