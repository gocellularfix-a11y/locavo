/**
 * PROPAGACIÓN DE CONFIANZA (GEN-1 · Fase D).
 *
 * NO es un sistema de confianza nuevo: la base sale de `deriveKnowledgeConfidence`
 * del modelo aprobado. Aquí solo se decide qué le pasa a esa confianza cuando
 * un hecho se deriva en una propuesta.
 *
 * Protecciones que el cálculo garantiza:
 *   · una inferencia no se vuelve verificada por repetirse;
 *   · copias de la MISMA evidencia no son corroboración independiente;
 *   · duplicar fuentes no infla nada;
 *   · evidencia más débil no sobrescribe a la más fuerte;
 *   · lo añejo nunca sube de confianza;
 *   · la autoconfianza que declare un proveedor es irrelevante.
 *
 * Todo resultado es reproducible y explicable por su código de regla.
 */
import { deriveKnowledgeConfidence } from '../model/confidence';
import type { EvidenceLevel } from '../model/evidence';
import type { VerificationLevel } from '../../data/pipeline/providerMetadata';
import type { ConfidenceCalculation, DerivationType } from './enrichmentModel';

/** Penalización de las derivaciones que no aportan evidencia nueva. */
const GENERATIVE_PENALTY = 0.1;

/** Derivaciones que conservan la confianza porque no cambian el hecho. */
const VALUE_PRESERVING: readonly DerivationType[] = [
  'normalization',
  'alias_resolution',
  'equivalence',
  'temporal_annotation',
];

/** Testigo de evidencia: identifica si dos apoyos son realmente independientes. */
export interface EvidenceWitness {
  readonly sourceId: string;
  /** Documento citado; dos citas del mismo documento no son independientes. */
  readonly documentId: string;
  readonly verificationLevel: VerificationLevel;
  readonly evidenceLevel: EvidenceLevel;
}

/** Clave de independencia: misma fuente Y mismo documento ⇒ no independiente. */
function witnessKey(witness: EvidenceWitness): string {
  return `${witness.sourceId}::${witness.documentId}`;
}

export function basisConfidenceOf(witness: EvidenceWitness): number {
  return deriveKnowledgeConfidence({
    verificationLevel: witness.verificationLevel,
    evidenceLevel: witness.evidenceLevel,
  }).score;
}

export interface PropagationInput {
  readonly witnesses: readonly EvidenceWitness[];
  readonly derivation: DerivationType;
  /** Marcado por el evaluador temporal; nunca calculado con el reloj aquí. */
  readonly stale?: boolean;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Calcula la confianza de una propuesta. Nunca sube por encima de la
 * evidencia individual más fuerte disponible.
 */
export function propagateConfidence(input: PropagationInput): ConfidenceCalculation {
  const witnesses = input.witnesses;
  if (witnesses.length === 0) {
    return { basis: 0, result: 0, rule: 'NO_EVIDENCE' };
  }

  const scores = witnesses.map(basisConfidenceOf);
  const strongest = Math.max(...scores);
  const independent = new Set(witnesses.map(witnessKey));

  let result = strongest;
  let rule: string;

  if (independent.size > 1) {
    // Corroboración real: distinta fuente Y distinto documento. Aun así el
    // resultado se topa en la evidencia individual más fuerte — corroborar no
    // fabrica certeza que ninguna fuente aporta.
    rule = 'CORROBORATED_INDEPENDENT';
  } else if (witnesses.length > 1) {
    // Varias citas del mismo origen: repetición, no corroboración.
    rule = 'DUPLICATE_NOT_INDEPENDENT';
  } else {
    rule = 'SINGLE_WITNESS';
  }

  if (!VALUE_PRESERVING.includes(input.derivation)) {
    // Clasificar o proponer generativamente no añade evidencia: baja.
    result = Math.max(0, result - GENERATIVE_PENALTY);
    rule = `${rule}+DERIVATION_PENALTY`;
  }

  if (input.stale) {
    result = Math.min(result, strongest);
    rule = `${rule}+STALE_NO_INCREASE`;
  }

  return { basis: round2(strongest), result: round2(Math.min(result, strongest)), rule };
}
