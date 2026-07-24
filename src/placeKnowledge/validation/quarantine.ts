/**
 * CUARENTENA (GEN-1 · Fase B) — la memoria de lo rechazado.
 *
 * Un fragmento que no pasa la validación NO se descarta: se conserva con sus
 * motivos. Sin esta memoria la misma propuesta defectuosa se vuelve a proponer
 * y a revisar en cada corrida, y el proceso de revisión nunca converge.
 *
 * Reutiliza la doctrina de cuarentena ya probada en la importación DENUE
 * (`CityPackBuilder` → `serializeQuarantine`): artefacto aparte, determinista
 * y auditable.
 */
import { toCanonicalFragmentRecord } from '../model/serialization';
import type { KnowledgeFragment } from '../model/knowledgeFragment';
import type { ValidationIssue, ValidationOutcome } from './validationModel';

export interface QuarantineEntry {
  readonly fragmentId: string;
  readonly placeId: string;
  readonly field: string;
  readonly sourceId: string;
  /** Motivos exactos del rechazo, en orden canónico. */
  readonly issues: readonly ValidationIssue[];
  /** El fragmento íntegro, para poder reevaluarlo si cambian las reglas. */
  readonly fragment: KnowledgeFragment;
}

export function buildQuarantineEntry(
  fragment: KnowledgeFragment,
  outcome: ValidationOutcome,
): QuarantineEntry {
  return {
    fragmentId: outcome.fragmentId,
    placeId: fragment.placeId,
    field: String(fragment.field),
    sourceId: fragment.sourceId,
    issues: outcome.issues,
    fragment,
  };
}

/** Índice de ids en cuarentena: alimenta `previouslyRejected` de la siguiente corrida. */
export function quarantineIndex(entries: readonly QuarantineEntry[]): ReadonlySet<string> {
  return new Set(entries.map((entry) => entry.fragmentId));
}

function orderedIssue(issue: ValidationIssue): Record<string, unknown> {
  const ordered: Record<string, unknown> = {
    code: issue.code,
    severity: issue.severity,
    path: issue.path,
  };
  if (issue.detail !== undefined) {
    const keys = Object.keys(issue.detail).sort();
    const detail: Record<string, unknown> = {};
    for (const key of keys) {
      detail[key] = issue.detail[key];
    }
    ordered.detail = detail;
  }
  return ordered;
}

function orderedEntry(entry: QuarantineEntry): Record<string, unknown> {
  return {
    fragmentId: entry.fragmentId,
    placeId: entry.placeId,
    field: entry.field,
    sourceId: entry.sourceId,
    issues: entry.issues.map(orderedIssue),
    fragment: toCanonicalFragmentRecord(entry.fragment),
  };
}

/**
 * Serializa la cuarentena con orden estable: entradas por `fragmentId` y
 * claves explícitas. Dos corridas equivalentes producen los mismos bytes.
 */
export function serializeQuarantine(entries: readonly QuarantineEntry[]): string {
  const sorted = [...entries].sort((a, b) => (a.fragmentId < b.fragmentId ? -1 : a.fragmentId > b.fragmentId ? 1 : 0));
  return JSON.stringify(sorted.map(orderedEntry));
}
