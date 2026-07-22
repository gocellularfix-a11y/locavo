/**
 * ORQUESTADOR de inteligencia (V5.0).
 *
 * `evaluateRecommendations(context, places, config)` es una función PURA:
 * valida contexto → evidencia → confianza → elegibilidad → score → explicación
 * → orden determinista → límite → diagnósticos. No lee del repositorio, red,
 * almacenamiento ni React, y NO muta el arreglo de entrada ni los `Place`.
 */
import type { LocavoPlace } from '../domain/places/LocavoPlace';
import { DEFAULT_INTELLIGENCE_CONFIG, type IntelligenceConfig } from './config';
import type { EvidenceConfidence } from './confidence';
import { normalizeContext, type RecommendationContext } from './context';
import { evaluateEligibility, type EligibilityReasonCode } from './eligibility';
import { gatherEvidence, type EvidenceDimension } from './evidence';
import { buildExplanation } from './explanation';
import { isRecommendationIntent } from './intent';
import type {
  RecommendationDiagnostics,
  RecommendationOutput,
  RecommendationResult,
} from './result';
import { scoreCandidate } from './scoring';
import { surpriseKey } from './surprise';

const EMPTY_DISTRIBUTION: Readonly<Record<EvidenceConfidence, number>> = Object.freeze({
  unknown: 0,
  low: 0,
  medium: 0,
  high: 0,
});

interface Evaluated {
  result: RecommendationResult;
  sortKey: number;
}

export function evaluateRecommendations(
  context: RecommendationContext,
  places: readonly LocavoPlace[],
  config: IntelligenceConfig = DEFAULT_INTELLIGENCE_CONFIG,
): RecommendationOutput {
  // Intención no soportada → resultado vacío diagnosticable (no lanza).
  if (!isRecommendationIntent(context.intent)) {
    return {
      results: [],
      diagnostics: {
        candidatesReceived: places.length,
        candidatesEligible: 0,
        candidatesRejected: places.length,
        rejectionReasons: {},
        unknownEvidenceCounts: {},
        conflicts: 0,
        ties: 0,
        confidenceDistribution: { ...EMPTY_DISTRIBUTION },
        unsupportedIntent: true,
      },
    };
  }

  const normalized = normalizeContext(context, config);
  const isSurprise = normalized.intent === 'surprise';

  const rejectionReasons: Partial<Record<EligibilityReasonCode, number>> = {};
  const unknownEvidenceCounts: Partial<Record<EvidenceDimension, number>> = {};
  const confidenceDistribution: Record<EvidenceConfidence, number> = { ...EMPTY_DISTRIBUTION };
  let rejected = 0;
  let conflicts = 0;

  const evaluated: Evaluated[] = [];

  // Copia defensiva: nunca se muta el arreglo de entrada.
  for (const place of [...places]) {
    const evidence = gatherEvidence(place, normalized);

    for (const item of evidence.items) {
      if (item.status === 'unknown') {
        unknownEvidenceCounts[item.dimension] = (unknownEvidenceCounts[item.dimension] ?? 0) + 1;
      } else if (item.status === 'conflict') {
        conflicts += 1;
      }
    }

    const eligibility = evaluateEligibility(place, normalized, evidence);
    if (!eligibility.eligible) {
      rejected += 1;
      for (const reason of eligibility.reasons) {
        rejectionReasons[reason] = (rejectionReasons[reason] ?? 0) + 1;
      }
      continue;
    }

    confidenceDistribution[evidence.overallConfidence] += 1;

    const score = scoreCandidate(evidence, normalized, config);
    const explanation = buildExplanation(evidence, normalized);

    evaluated.push({
      sortKey: isSurprise ? surpriseKey(normalized.seed, place.id) : score.total,
      result: {
        placeId: place.id,
        category: evidence.category,
        rank: 0,
        score: { total: score.total, components: score.components },
        confidence: { overall: evidence.overallConfidence, byDimension: evidence.byDimension },
        reasons: explanation.positive,
        warnings: explanation.warnings,
        provenance: { primarySource: evidence.sources[0] ?? 'locavo', sources: evidence.sources },
      },
    });
  }

  // Orden determinista: surprise ascendente por clave sembrada; el resto
  // descendente por score. Desempate estable SIEMPRE por id ascendente.
  evaluated.sort((a, b) => {
    if (a.sortKey !== b.sortKey) {
      return isSurprise ? a.sortKey - b.sortKey : b.sortKey - a.sortKey;
    }
    return a.result.placeId < b.result.placeId ? -1 : a.result.placeId > b.result.placeId ? 1 : 0;
  });

  // Empates: candidatos consecutivos con misma clave primaria (desempatados por id).
  let ties = 0;
  for (let i = 1; i < evaluated.length; i++) {
    if (evaluated[i].sortKey === evaluated[i - 1].sortKey) {
      ties += 1;
    }
  }

  const limited = evaluated.slice(0, normalized.maxResults);
  const results: RecommendationResult[] = limited.map((e, i) => ({ ...e.result, rank: i + 1 }));

  const diagnostics: RecommendationDiagnostics = {
    candidatesReceived: places.length,
    candidatesEligible: evaluated.length,
    candidatesRejected: rejected,
    rejectionReasons,
    unknownEvidenceCounts,
    conflicts,
    ties,
    confidenceDistribution,
    unsupportedIntent: false,
  };

  return { results, diagnostics };
}
