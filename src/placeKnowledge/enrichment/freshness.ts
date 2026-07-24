/**
 * FRESCURA Y RAZONAMIENTO TEMPORAL (GEN-1 · Fase D).
 *
 * La plataforma NUNCA lee el reloj: la fecha de evaluación se inyecta en la
 * política. Sin ella no hay veredicto temporal —se devuelve `unknown`— para
 * que dos corridas del mismo lote produzcan siempre lo mismo.
 *
 * Lo añejo no se borra ni se degrada en silencio: se diagnostica.
 */
import type { KnowledgeFieldKey } from '../model/knowledgeField';
import type { KnowledgeFragment } from '../model/knowledgeFragment';
import { isIsoInstant } from '../validation/temporal';
import type { EnrichmentPolicy } from './enrichmentModel';

export type FreshnessVerdict = 'fresh' | 'stale' | 'unknown' | 'superseded';

export interface FreshnessAssessment {
  readonly fragmentId: string;
  readonly field: KnowledgeFieldKey;
  readonly verdict: FreshnessVerdict;
  /** Días transcurridos desde la captura; null si no se pudo calcular. */
  readonly ageDays: number | null;
  /** Umbral aplicado, si lo hubo. */
  readonly thresholdDays: number | null;
}

const MS_PER_DAY = 86_400_000;

/** Días entre dos fechas ISO; null si alguna no es válida. */
export function daysBetween(from: string, to: string): number | null {
  if (!isIsoInstant(from) || !isIsoInstant(to)) {
    return null;
  }
  const start = Date.parse(from.length === 10 ? `${from}T00:00:00.000Z` : from);
  const end = Date.parse(to.length === 10 ? `${to}T00:00:00.000Z` : to);
  if (Number.isNaN(start) || Number.isNaN(end)) {
    return null;
  }
  return Math.floor((end - start) / MS_PER_DAY);
}

/**
 * Evalúa la frescura de un hecho. Sin fecha de evaluación inyectada o sin
 * umbral para el campo, el veredicto es `unknown`: no se inventa criterio.
 */
export function assessFreshness(
  fragment: KnowledgeFragment,
  policy: EnrichmentPolicy,
): FreshnessAssessment {
  const threshold = policy.freshnessDays?.[fragment.field] ?? null;
  const evaluationDate = policy.evaluationDate;

  if (!evaluationDate || threshold === null) {
    return {
      fragmentId: fragment.id,
      field: fragment.field,
      verdict: 'unknown',
      ageDays: null,
      thresholdDays: threshold,
    };
  }

  const ageDays = daysBetween(fragment.evidence.capturedAt, evaluationDate);
  if (ageDays === null) {
    return {
      fragmentId: fragment.id,
      field: fragment.field,
      verdict: 'unknown',
      ageDays: null,
      thresholdDays: threshold,
    };
  }

  return {
    fragmentId: fragment.id,
    field: fragment.field,
    verdict: ageDays > threshold ? 'stale' : 'fresh',
    ageDays,
    thresholdDays: threshold,
  };
}

/**
 * Marca como `superseded` los hechos del mismo lugar y campo que otro más
 * reciente de la MISMA fuente los reemplaza. Entre fuentes distintas no se
 * decide nada: eso es precedencia y su motor ya existe.
 */
export function assessSupersession(
  fragments: readonly KnowledgeFragment[],
  policy: EnrichmentPolicy,
): readonly FreshnessAssessment[] {
  const latestBySourceField = new Map<string, KnowledgeFragment>();
  for (const fragment of fragments) {
    const key = `${fragment.placeId}::${fragment.field}::${fragment.sourceId}`;
    const current = latestBySourceField.get(key);
    if (!current || fragment.evidence.capturedAt > current.evidence.capturedAt) {
      latestBySourceField.set(key, fragment);
    }
  }

  return [...fragments]
    .map((fragment) => {
      const key = `${fragment.placeId}::${fragment.field}::${fragment.sourceId}`;
      const latest = latestBySourceField.get(key);
      if (latest && latest.id !== fragment.id) {
        return {
          fragmentId: fragment.id,
          field: fragment.field,
          verdict: 'superseded' as const,
          ageDays: null,
          thresholdDays: null,
        };
      }
      return assessFreshness(fragment, policy);
    })
    .sort((a, b) => (a.fragmentId < b.fragmentId ? -1 : a.fragmentId > b.fragmentId ? 1 : 0));
}
