/**
 * Modelo de CONFIANZA (V5.0).
 *
 * La confianza responde SOLO: ¿qué tan fiable es la evidencia disponible? No
 * significa calidad, ranking, preferencia ni popularidad. Es determinista y
 * está centralizada aquí. Soporta confianza a nivel de dimensión y un resumen
 * agregado por candidato.
 */
import type { PlaceSource, PlaceVerification } from '../domain/places/LocavoPlace';

export type EvidenceConfidence = 'unknown' | 'low' | 'medium' | 'high';

const RANK: Readonly<Record<EvidenceConfidence, number>> = {
  unknown: 0,
  low: 1,
  medium: 2,
  high: 3,
};

const BY_RANK: readonly EvidenceConfidence[] = ['unknown', 'low', 'medium', 'high'];

export function confidenceRank(c: EvidenceConfidence): number {
  return RANK[c];
}

/** El más BAJO de un conjunto (agregación conservadora; unknown si vacío). */
export function weakestConfidence(values: readonly EvidenceConfidence[]): EvidenceConfidence {
  if (values.length === 0) {
    return 'unknown';
  }
  return values.reduce((min, c) => (RANK[c] < RANK[min] ? c : min), values[0]);
}

/**
 * Confianza base por fuente/verificación de un lugar canónico.
 * - Datos oficiales (DENUE / source_verified) → media.
 * - Verificación individual (owner/community/canonical) → alta.
 * - Sin verificar → baja. Sin dato → unknown (lo decide el emisor de evidencia).
 */
export function baseConfidenceOf(
  source: PlaceSource,
  verification: PlaceVerification,
): EvidenceConfidence {
  switch (verification.status) {
    case 'locavo_verified':
    case 'owner_verified':
    case 'community_verified':
      return 'high';
    case 'source_verified':
      return source === 'mock' ? 'low' : 'medium';
    case 'unverified':
    default:
      return source === 'mock' ? 'unknown' : 'low';
  }
}

/**
 * Ajuste por ACUERDO/CONFLICTO entre fuentes:
 * - conflicto → baja un nivel (nunca por debajo de `low`);
 * - dos o más fuentes concordantes → sube un nivel (tope `high`).
 */
export function adjustForAgreement(
  base: EvidenceConfidence,
  opts: { conflict?: boolean; agreeingSources?: number },
): EvidenceConfidence {
  let rank = RANK[base];
  if (opts.conflict) {
    rank = Math.max(RANK.low, rank - 1);
  } else if ((opts.agreeingSources ?? 0) >= 2) {
    rank = Math.min(RANK.high, rank + 1);
  }
  return BY_RANK[rank];
}
