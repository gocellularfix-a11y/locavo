/**
 * MODELO DE ENRIQUECIMIENTO (GEN-1 · Fase D).
 *
 * El enriquecimiento NUNCA escribe conocimiento canónico: produce PROPUESTAS.
 * Cada propuesta conserva la evidencia y la procedencia del hecho del que
 * nace, declara qué la derivó y con qué versión, y pasa después por la
 * validación de la Fase B como cualquier otro candidato.
 *
 * Determinista: mismas entradas, misma política y mismas salidas de proveedor
 * producen los mismos artefactos byte a byte.
 */
import type { KnowledgeFieldKey } from '../model/knowledgeField';
import type { KnowledgeFragment } from '../model/knowledgeFragment';
import type { EvidenceBinding } from '../model/evidence';

/** Qué originó la propuesta. */
export type DerivationType =
  | 'normalization'
  | 'alias_resolution'
  | 'equivalence'
  | 'classification'
  | 'temporal_annotation'
  | 'generative_proposal';

/** Motivo por el que una propuesta puede exigir revisión humana. */
export type ReviewRequirement = 'none' | 'recommended' | 'required';

export interface EnrichmentDiagnostic {
  readonly code: string;
  readonly severity: 'error' | 'warning' | 'info';
  /** Fragmento u objetivo señalado. */
  readonly targetId: string;
  readonly detail?: Readonly<Record<string, string | number | boolean>>;
}

export interface ConfidenceCalculation {
  /** Confianza del hecho de origen. */
  readonly basis: number;
  /** Confianza resultante de la propuesta. */
  readonly result: number;
  /** Regla que explica el resultado, en códigos, nunca prosa generada. */
  readonly rule: string;
}

export interface EnrichmentProposal {
  /** Id determinista de la propuesta. */
  readonly id: string;
  readonly placeId: string;
  /** Fragmentos de entrada que sustentan la propuesta. */
  readonly inputFragmentIds: readonly string[];
  readonly field: KnowledgeFieldKey;
  readonly value: unknown;
  /** Evidencia atómica heredada o recalculada; nunca inventada. */
  readonly bindings: readonly EvidenceBinding[];
  readonly derivation: DerivationType;
  /** Identidad y versión de la regla o proveedor que la produjo. */
  readonly producerId: string;
  readonly producerVersion: string;
  readonly confidence: ConfidenceCalculation;
  readonly reviewRequirement: ReviewRequirement;
  /** Explicación estructurada por códigos. */
  readonly explanation: readonly string[];
  /** Huella determinista del contenido de la propuesta. */
  readonly fingerprint: string;
}

export interface EnrichmentPolicy {
  /**
   * Fecha de evaluación INYECTADA. La plataforma nunca lee el reloj: sin esta
   * fecha no hay razonamiento temporal, para que el resultado sea reproducible.
   */
  readonly evaluationDate?: string;
  /** Días tras los cuales un hecho se considera añejo, por campo. */
  readonly freshnessDays?: Readonly<Partial<Record<KnowledgeFieldKey, number>>>;
  /** Campos que el enriquecimiento puede proponer. Vacío = todos. */
  readonly allowedFields?: readonly KnowledgeFieldKey[];
  /** Exigir revisión humana para toda propuesta generativa. */
  readonly requireReviewForGenerative?: boolean;
}

export interface EnrichmentTarget {
  readonly placeId: string;
  /** Hechos ya validados que alimentan el enriquecimiento. */
  readonly fragments: readonly KnowledgeFragment[];
}

export interface EnrichmentContext {
  readonly policy: EnrichmentPolicy;
  /** Fecha de la corrida (dato de proceso). */
  readonly retrievedAt: string;
}
