/**
 * CONFIANZA de conocimiento (PKE-0) — derivada, jamás subjetiva.
 *
 * La confianza de un campo NO se almacena como opinión: se DERIVA
 * determinísticamente de (autoridad de la fuente, nivel de evidencia) con la
 * única fórmula de abajo. Mismos insumos → mismo resultado, auditable. Los
 * umbrales legibles reutilizan `confidenceLevelOf` del modelo canónico.
 */
import type { VerificationLevel } from '../../data/pipeline/providerMetadata';
import { confidenceLevelOf, type ConfidenceLevel } from '../../domain/places/LocavoPlace';
import type { EvidenceLevel } from './evidence';

/**
 * Base por autoridad de fuente, alineada a las confianzas históricas del
 * registro de proveedores (DENUE `source_verified`/0.6, OSM `unverified`/0.3).
 */
export const SOURCE_CONFIDENCE_BASE: Readonly<Record<VerificationLevel, number>> = {
  official: 0.9,
  curated: 0.75,
  source_verified: 0.6,
  unverified: 0.3,
};

/** Ajuste por nivel de evidencia (la suma se acota a [0, 1]). */
export const EVIDENCE_CONFIDENCE_DELTA: Readonly<Record<EvidenceLevel, number>> = {
  observed: 0.1,
  owner_stated: 0.08,
  official_publication: 0.06,
  dataset_record: 0,
  community_report: -0.05,
  inferred: -0.15,
};

export interface KnowledgeConfidenceInputs {
  readonly verificationLevel: VerificationLevel;
  readonly evidenceLevel: EvidenceLevel;
}

export interface KnowledgeConfidence {
  /** Puntaje 0–1 derivado (base de fuente + delta de evidencia, acotado). */
  readonly score: number;
  /** Nivel legible para humanos (mismos umbrales del modelo canónico). */
  readonly level: ConfidenceLevel;
  /** Insumos exactos de la derivación (trazabilidad de la fórmula). */
  readonly inputs: KnowledgeConfidenceInputs;
}

/** Derivación determinista de confianza. Única fórmula del PKE. */
export function deriveKnowledgeConfidence(
  inputs: KnowledgeConfidenceInputs,
): KnowledgeConfidence {
  const raw =
    SOURCE_CONFIDENCE_BASE[inputs.verificationLevel] +
    EVIDENCE_CONFIDENCE_DELTA[inputs.evidenceLevel];
  const score = Math.min(1, Math.max(0, Math.round(raw * 100) / 100));
  return { score, level: confidenceLevelOf(score), inputs };
}
