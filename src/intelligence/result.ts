/**
 * Formas de RESULTADO y DIAGNÓSTICO (V5.0).
 *
 * El resultado NO copia el `LocavoPlace` completo: lleva `placeId` y el mínimo
 * necesario; el llamador reasocia por id. Score y confianza son canales
 * separados.
 */
import type { CategoryId } from '../domain/place';
import type { PlaceSource } from '../domain/places/LocavoPlace';
import type { EvidenceConfidence } from './confidence';
import type { EvidenceDimension } from './evidence';
import type { EligibilityReasonCode } from './eligibility';
import type { ExplanationItem } from './explanation';
import type { ScoreComponent } from './scoring';

export interface RecommendationResult {
  placeId: string;
  category: CategoryId;
  /** Rango estable 1..N (1 = mejor). */
  rank: number;
  score: {
    total: number;
    components: readonly ScoreComponent[];
  };
  confidence: {
    overall: EvidenceConfidence;
    byDimension: Readonly<Partial<Record<EvidenceDimension, EvidenceConfidence>>>;
  };
  reasons: readonly ExplanationItem[];
  warnings: readonly ExplanationItem[];
  provenance: {
    primarySource: PlaceSource;
    sources: readonly PlaceSource[];
  };
}

export interface RecommendationDiagnostics {
  candidatesReceived: number;
  candidatesEligible: number;
  candidatesRejected: number;
  rejectionReasons: Readonly<Partial<Record<EligibilityReasonCode, number>>>;
  unknownEvidenceCounts: Readonly<Partial<Record<EvidenceDimension, number>>>;
  conflicts: number;
  ties: number;
  confidenceDistribution: Readonly<Record<EvidenceConfidence, number>>;
  unsupportedIntent: boolean;
}

export interface RecommendationOutput {
  results: readonly RecommendationResult[];
  diagnostics: RecommendationDiagnostics;
}
