/**
 * Cálculo de CONFIANZA (V5.8) — determinista, derivado solo de la fuerza de la
 * evidencia. NO es popularidad, calidad, ranking ni certeza de que el negocio
 * sea bueno. Modelo documentado:
 *  - HIGH:   evidencia estructurada explícita (fuerza 3); o ≥2 señales
 *            independientes que apoyan directamente (fuerza 2 con ≥2 evidencias).
 *  - MEDIUM: una señal derivada fuerte (fuerza 2, una evidencia); o varias
 *            señales débiles consistentes (fuerza 1 con ≥2 evidencias).
 *  - LOW:    una única señal indirecta conservadora (fuerza 1, una evidencia).
 * Ensamblado de atributos: deduplica evidencia, ordena de forma canónica y
 * calcula la confianza a partir del conjunto combinado.
 */
import {
  compareEvidence,
  evidenceStrengthOf,
  orderIndexOf,
} from './placeIntelligenceCatalogs';
import type {
  IntelligenceAttribute,
  IntelligenceConfidence,
  PlaceIntelligenceEvidence,
} from './placeIntelligenceTypes';

/** Clave de identidad de una evidencia para deduplicar. */
function evidenceKey(e: PlaceIntelligenceEvidence): string {
  return `${e.source}|${e.code}|${e.value === undefined ? '' : String(e.value)}`;
}

/** Deduplica y ordena evidencia de forma canónica. */
export function normalizeEvidence(evidence: readonly PlaceIntelligenceEvidence[]): PlaceIntelligenceEvidence[] {
  const seen = new Map<string, PlaceIntelligenceEvidence>();
  for (const e of evidence) {
    const key = evidenceKey(e);
    if (!seen.has(key)) {
      seen.set(key, e);
    }
  }
  return [...seen.values()].sort(compareEvidence);
}

/** Confianza determinista a partir de un conjunto de evidencia ya deduplicado. */
export function computeConfidence(evidence: readonly PlaceIntelligenceEvidence[]): IntelligenceConfidence {
  const distinct = evidence.length;
  let top = 0;
  for (const e of evidence) {
    const s = evidenceStrengthOf(e.code);
    if (s > top) {
      top = s;
    }
  }
  if (top >= 3) {
    return 'HIGH';
  }
  if (top === 2) {
    return distinct >= 2 ? 'HIGH' : 'MEDIUM';
  }
  return distinct >= 2 ? 'MEDIUM' : 'LOW';
}

/**
 * Fusiona candidatos por código (uniendo su evidencia), calcula confianza,
 * descarta los que no tienen evidencia y ordena por el orden canónico del
 * catálogo. Determinista e inmutable.
 */
export function assembleAttributes<TCode extends string>(
  candidates: readonly { readonly code: TCode; readonly evidence: readonly PlaceIntelligenceEvidence[] }[],
  order: readonly TCode[],
): IntelligenceAttribute<TCode>[] {
  const byCode = new Map<TCode, PlaceIntelligenceEvidence[]>();
  for (const c of candidates) {
    const bucket = byCode.get(c.code) ?? [];
    bucket.push(...c.evidence);
    byCode.set(c.code, bucket);
  }
  const attributes: IntelligenceAttribute<TCode>[] = [];
  for (const [code, rawEvidence] of byCode) {
    const evidence = normalizeEvidence(rawEvidence);
    if (evidence.length === 0) {
      continue; // todo atributo emitido debe tener evidencia
    }
    attributes.push({ code, confidence: computeConfidence(evidence), evidence });
  }
  attributes.sort((a, b) => orderIndexOf(order, a.code) - orderIndexOf(order, b.code));
  return attributes;
}

/** Selecciona un único atributo (el de mayor prioridad canónica) o `null`. */
export function assembleSingle<TCode extends string>(
  candidates: readonly { readonly code: TCode; readonly evidence: readonly PlaceIntelligenceEvidence[] }[],
  order: readonly TCode[],
): IntelligenceAttribute<TCode> | null {
  const all = assembleAttributes(candidates, order);
  return all.length > 0 ? all[0] : null;
}
