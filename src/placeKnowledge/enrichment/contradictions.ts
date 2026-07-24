/**
 * DIAGNÓSTICO DE CONTRADICCIONES (GEN-1 · Fase D).
 *
 * Detecta y REPORTA desacuerdos entre hechos del mismo lugar y campo. No los
 * resuelve: la precedencia tiene su propio motor aprobado y este módulo no lo
 * sustituye ni lo duplica. Aquí solo se hace visible el problema.
 */
import { serializeKnowledgeFragment } from '../model/serialization';
import type { KnowledgeFragment } from '../model/knowledgeFragment';
import type { EnrichmentDiagnostic } from './enrichmentModel';

export type ContradictionCode =
  | 'DUPLICATE_EQUIVALENT'
  | 'SAME_SOURCE_SELF_CONTRADICTION'
  | 'SOURCE_DISAGREEMENT'
  | 'POTENTIAL_SUPERSESSION'
  | 'VALUE_INCOMPATIBILITY'
  | 'OVERLAPPING_SCHEDULE';

function valueKey(fragment: KnowledgeFragment): string {
  return JSON.stringify(fragment.value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Atributos booleanos que no pueden ser verdaderos y falsos a la vez. */
function incompatibleBooleans(a: KnowledgeFragment, b: KnowledgeFragment): string | null {
  if (!isRecord(a.value) || !isRecord(b.value)) {
    return null;
  }
  for (const key of Object.keys(a.value)) {
    const left = a.value[key];
    const right = b.value[key];
    if (typeof left === 'boolean' && typeof right === 'boolean' && left !== right) {
      return key;
    }
  }
  return null;
}

function rangesOverlap(a: KnowledgeFragment, b: KnowledgeFragment): boolean {
  if (a.field !== 'hoursExceptions' || !Array.isArray(a.value) || !Array.isArray(b.value)) {
    return false;
  }
  for (const left of a.value) {
    for (const right of b.value) {
      if (!isRecord(left) || !isRecord(right)) {
        continue;
      }
      const overlap =
        String(left.startDate) <= String(right.endDate) &&
        String(right.startDate) <= String(left.endDate);
      if (overlap && left.kind !== right.kind) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Compara los hechos de un lugar campo por campo. La salida está ordenada y no
 * depende del orden de entrada.
 */
export function detectContradictions(
  fragments: readonly KnowledgeFragment[],
): readonly EnrichmentDiagnostic[] {
  const diagnostics: EnrichmentDiagnostic[] = [];
  const byField = new Map<string, KnowledgeFragment[]>();

  for (const fragment of fragments) {
    const key = `${fragment.placeId}::${fragment.field}`;
    const bucket = byField.get(key);
    if (bucket) {
      bucket.push(fragment);
    } else {
      byField.set(key, [fragment]);
    }
  }

  for (const bucket of byField.values()) {
    const ordered = [...bucket].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    for (let i = 0; i < ordered.length; i++) {
      for (let j = i + 1; j < ordered.length; j++) {
        const a = ordered[i];
        const b = ordered[j];
        const sameValue = valueKey(a) === valueKey(b);
        const detail = { other: b.id, field: String(a.field) };

        if (sameValue) {
          diagnostics.push({
            code: 'DUPLICATE_EQUIVALENT',
            severity: 'info',
            targetId: a.id,
            detail,
          });
          continue;
        }

        if (a.sourceId === b.sourceId) {
          if (a.evidence.capturedAt === b.evidence.capturedAt) {
            diagnostics.push({
              code: 'SAME_SOURCE_SELF_CONTRADICTION',
              severity: 'error',
              targetId: a.id,
              detail,
            });
          } else {
            diagnostics.push({
              code: 'POTENTIAL_SUPERSESSION',
              severity: 'info',
              targetId: a.id,
              detail: { ...detail, newer: a.evidence.capturedAt > b.evidence.capturedAt ? a.id : b.id },
            });
          }
        } else {
          diagnostics.push({
            code: 'SOURCE_DISAGREEMENT',
            severity: 'warning',
            targetId: a.id,
            detail: { ...detail, otherSource: b.sourceId },
          });
        }

        const incompatible = incompatibleBooleans(a, b);
        if (incompatible) {
          diagnostics.push({
            code: 'VALUE_INCOMPATIBILITY',
            severity: 'warning',
            targetId: a.id,
            detail: { ...detail, attribute: incompatible },
          });
        }
        if (rangesOverlap(a, b)) {
          diagnostics.push({
            code: 'OVERLAPPING_SCHEDULE',
            severity: 'warning',
            targetId: a.id,
            detail,
          });
        }
      }
    }
  }

  diagnostics.sort((a, b) => {
    if (a.targetId !== b.targetId) {
      return a.targetId < b.targetId ? -1 : 1;
    }
    return a.code < b.code ? -1 : a.code > b.code ? 1 : 0;
  });
  return diagnostics;
}

/** Detección de hechos idénticos byte a byte (ingesta repetida). */
export function detectDuplicateFragments(
  fragments: readonly KnowledgeFragment[],
): readonly string[] {
  const seen = new Map<string, string>();
  const duplicates: string[] = [];
  for (const fragment of fragments) {
    const key = serializeKnowledgeFragment(fragment);
    const owner = seen.get(key);
    if (owner) {
      duplicates.push(fragment.id);
    } else {
      seen.set(key, fragment.id);
    }
  }
  return duplicates.sort();
}
