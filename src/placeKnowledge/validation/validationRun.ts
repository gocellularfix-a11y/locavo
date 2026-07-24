/**
 * CORRIDA DE VALIDACIÓN (GEN-1 · Fase B) — lote completo con informe.
 *
 * Separa lo ADMITIDO de lo puesto en CUARENTENA y produce un informe
 * determinista y auditable. El orden de salida no depende del orden de
 * entrada: todo se ordena por id, igual que en el resto de la plataforma.
 *
 * Pura: sin reloj, sin red, sin disco, sin mutación de las entradas.
 */
import type { KnowledgeFragment } from '../model/knowledgeFragment';
import {
  buildQuarantineEntry,
  quarantineIndex,
  type QuarantineEntry,
} from './quarantine';
import { validateKnowledgeFragment, type ValidationContext } from './fragmentValidator';
import {
  VALIDATION_CODE_ORDER,
  VALIDATOR_VERSION,
  type ValidationErrorCode,
  type ValidationOutcome,
} from './validationModel';

export interface ValidationTotals {
  readonly evaluated: number;
  readonly accepted: number;
  readonly quarantined: number;
  /** Fragmentos admitidos que aun así generaron algún aviso. */
  readonly acceptedWithWarnings: number;
}

export interface ValidationReport {
  readonly validatorVersion: string;
  readonly totals: ValidationTotals;
  /** Conteo por código, en el orden canónico; solo códigos con incidencia. */
  readonly issueCounts: readonly { readonly code: ValidationErrorCode; readonly count: number }[];
}

export interface ValidationRunResult {
  /** Fragmentos aptos para el grafo canónico, ordenados por id. */
  readonly accepted: readonly KnowledgeFragment[];
  /** Rechazados con sus motivos, ordenados por id. */
  readonly quarantine: readonly QuarantineEntry[];
  /** Resultado individual de cada fragmento, ordenado por id. */
  readonly outcomes: readonly ValidationOutcome[];
  readonly report: ValidationReport;
}

function byId<T extends { readonly id?: string; readonly fragmentId?: string }>(
  a: T,
  b: T,
): number {
  const left = a.id ?? a.fragmentId ?? '';
  const right = b.id ?? b.fragmentId ?? '';
  return left < right ? -1 : left > right ? 1 : 0;
}

/**
 * Valida un lote. Cada fragmento se evalúa de forma independiente: uno malo
 * jamás impide admitir a los demás.
 */
export function runKnowledgeValidation(
  fragments: readonly KnowledgeFragment[],
  context: ValidationContext,
): ValidationRunResult {
  const accepted: KnowledgeFragment[] = [];
  const quarantine: QuarantineEntry[] = [];
  const outcomes: ValidationOutcome[] = [];
  const counts = new Map<ValidationErrorCode, number>();
  let acceptedWithWarnings = 0;

  for (const fragment of fragments) {
    const outcome = validateKnowledgeFragment(fragment, context);
    outcomes.push(outcome);
    for (const issue of outcome.issues) {
      counts.set(issue.code, (counts.get(issue.code) ?? 0) + 1);
    }
    if (outcome.verdict === 'accepted') {
      accepted.push(fragment);
      if (outcome.issues.length > 0) {
        acceptedWithWarnings += 1;
      }
    } else {
      quarantine.push(buildQuarantineEntry(fragment, outcome));
    }
  }

  accepted.sort(byId);
  quarantine.sort(byId);
  outcomes.sort(byId);

  return {
    accepted,
    quarantine,
    outcomes,
    report: {
      validatorVersion: context.validatorVersion ?? VALIDATOR_VERSION,
      totals: {
        evaluated: fragments.length,
        accepted: accepted.length,
        quarantined: quarantine.length,
        acceptedWithWarnings,
      },
      issueCounts: VALIDATION_CODE_ORDER.filter((code) => counts.has(code)).map((code) => ({
        code,
        count: counts.get(code) as number,
      })),
    },
  };
}

/** Serializa el informe con orden de claves estable. */
export function serializeValidationReport(report: ValidationReport): string {
  return JSON.stringify({
    validatorVersion: report.validatorVersion,
    totals: {
      evaluated: report.totals.evaluated,
      accepted: report.totals.accepted,
      quarantined: report.totals.quarantined,
      acceptedWithWarnings: report.totals.acceptedWithWarnings,
    },
    issueCounts: report.issueCounts.map((entry) => ({ code: entry.code, count: entry.count })),
  });
}

/**
 * Memoria acumulada de rechazos: une la cuarentena previa con la de esta
 * corrida para alimentar `previouslyRejected` en la siguiente.
 */
export function accumulateRejections(
  previous: ReadonlySet<string>,
  entries: readonly QuarantineEntry[],
): ReadonlySet<string> {
  const merged = new Set(previous);
  for (const id of quarantineIndex(entries)) {
    merged.add(id);
  }
  return merged;
}
