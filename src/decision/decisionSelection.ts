/**
 * Motor de SELECCIÓN de decisión (V5.6) — función pura y determinista.
 *
 * Consume modelos ya rankeados (V5.5) y construye un set de decisión conciso:
 * un primario (BEST_MATCH) y hasta dos alternativas significativamente
 * distintas. No recupera lugares, no evalúa V5.0/contexto/preferencias, no
 * analiza intención y no persiste. Papeles por prioridad; un lugar ocupa a lo
 * sumo un papel visible; sin diferenciación suficiente → menos opciones (nunca
 * relleno). Desempates deterministas por rango de origen y luego por placeId.
 */
import { confidenceRank } from '../intelligence';
import type { LocavoPlace } from '../domain/places/LocavoPlace';
import {
  ALTERNATIVE_ROLE_PRIORITY,
  ROLE_REASON,
  type DecisionCandidateSnapshot,
  type DecisionOption,
  type DecisionRole,
  type DecisionSelectionDiagnostics,
  type DecisionSet,
  type DecisionTradeoffCode,
} from './decisionModel';
import {
  ALTERNATIVE_MIN_SCORE_RATIO,
  hasLimitedEvidence,
  hasStrongerConfidence,
  hasStrongerIntent,
  hasStrongerPreference,
  hasWeakerConfidence,
  isCategoryCompatible,
  isMateriallyCloser,
  isMateriallyFarther,
  type ActiveIntentScope,
} from './decisionDifferentiation';
import { buildDecisionSnapshots, type RankedDecisionModel } from './decisionSnapshot';

export interface BuildDecisionSetInput {
  readonly rankedModels: readonly RankedDecisionModel[];
  readonly placesById: ReadonlyMap<string, LocavoPlace>;
  readonly activeIntent?: ActiveIntentScope | null;
  /** Máximo de opciones visibles (primario + alternativas). Acotado a [1, 3]. */
  readonly maximumOptions?: number;
}

const HARD_MAX_ALTERNATIVES = 2;

interface MutableDiagnostics {
  received: number;
  eligible: number;
  selected: number;
  duplicatePlacesRejected: number;
  duplicateRolesRejected: number;
  insufficientDifferentiationRejected: number;
  missingEvidenceRejected: number;
  roleCandidatesEvaluated: number;
}

type Qualification = 'ok' | 'missing_evidence' | 'insufficient' | 'no';

function isValidCandidate(s: DecisionCandidateSnapshot): boolean {
  return typeof s.placeId === 'string' && s.placeId.length > 0 && Number.isFinite(s.finalScore);
}

/** ¿El papel aporta valor nuevo dado el primario? (cortes a nivel de papel). */
function roleAddsValue(
  role: DecisionRole,
  primary: DecisionCandidateSnapshot,
  activeIntent: ActiveIntentScope | null | undefined,
): boolean {
  switch (role) {
    case 'BEST_INTENT_FIT':
      return activeIntent != null;
    case 'OPEN_NOW':
      return primary.openState !== 'open';
    case 'ACCESSIBLE':
      return primary.accessible !== true;
    case 'FAMILY_PICK':
      return primary.familyFriendly !== true;
    default:
      return true;
  }
}

function qualifies(
  role: DecisionRole,
  cand: DecisionCandidateSnapshot,
  primary: DecisionCandidateSnapshot,
  activeIntent: ActiveIntentScope | null | undefined,
): Qualification {
  switch (role) {
    case 'CLOSEST':
      if (cand.distanceKm === null || primary.distanceKm === null) {
        return 'missing_evidence';
      }
      return isMateriallyCloser(cand, primary) ? 'ok' : 'insufficient';
    case 'MOST_RELIABLE':
      return hasStrongerConfidence(cand, primary) ? 'ok' : 'insufficient';
    case 'BEST_INTENT_FIT':
      if (activeIntent == null) {
        return 'no';
      }
      return hasStrongerIntent(cand, primary) ? 'ok' : 'insufficient';
    case 'BEST_PREFERENCE_FIT':
      return hasStrongerPreference(cand, primary) ? 'ok' : 'insufficient';
    case 'OPEN_NOW':
      if (cand.openState === 'unknown') {
        return 'missing_evidence';
      }
      return cand.openState === 'open' ? 'ok' : 'insufficient';
    case 'ACCESSIBLE':
      if (cand.accessible === undefined) {
        return 'missing_evidence';
      }
      return cand.accessible === true ? 'ok' : 'no';
    case 'FAMILY_PICK':
      if (cand.familyFriendly === undefined) {
        return 'missing_evidence';
      }
      return cand.familyFriendly === true ? 'ok' : 'no';
    case 'ALTERNATIVE':
      if (!isCategoryCompatible(cand, activeIntent)) {
        return 'no';
      }
      if (cand.category === primary.category) {
        return 'insufficient';
      }
      return cand.finalScore >= primary.finalScore * ALTERNATIVE_MIN_SCORE_RATIO ? 'ok' : 'insufficient';
    default:
      return 'no';
  }
}

/** Métrica por papel: MAYOR es mejor. Garantías de datos las asegura `qualifies`. */
function roleMetric(role: DecisionRole, cand: DecisionCandidateSnapshot): number {
  switch (role) {
    case 'CLOSEST':
      return -(cand.distanceKm ?? Number.POSITIVE_INFINITY);
    case 'MOST_RELIABLE':
      return confidenceRank(cand.recommendationConfidence);
    case 'BEST_INTENT_FIT':
      return cand.intentStrength;
    case 'BEST_PREFERENCE_FIT':
      return cand.preferenceStrength;
    case 'ALTERNATIVE':
      return cand.finalScore;
    case 'OPEN_NOW':
    case 'ACCESSIBLE':
    case 'FAMILY_PICK':
      return -cand.sourceRank;
    default:
      return 0;
  }
}

/** ¿`cand` es estrictamente mejor que `best` para el papel? Desempate estable. */
function preferOver(role: DecisionRole, cand: DecisionCandidateSnapshot, best: DecisionCandidateSnapshot): boolean {
  const mc = roleMetric(role, cand);
  const mb = roleMetric(role, best);
  if (mc !== mb) {
    return mc > mb;
  }
  if (cand.sourceRank !== best.sourceRank) {
    return cand.sourceRank < best.sourceRank;
  }
  return cand.placeId < best.placeId;
}

function selectForRole(
  role: DecisionRole,
  pool: readonly DecisionCandidateSnapshot[],
  primary: DecisionCandidateSnapshot,
  usedPlaceIds: ReadonlySet<string>,
  activeIntent: ActiveIntentScope | null | undefined,
  diag: MutableDiagnostics,
): DecisionCandidateSnapshot | null {
  if (!roleAddsValue(role, primary, activeIntent)) {
    return null;
  }
  let best: DecisionCandidateSnapshot | null = null;
  for (const cand of pool) {
    diag.roleCandidatesEvaluated += 1;
    const q = qualifies(role, cand, primary, activeIntent);
    if (q === 'missing_evidence') {
      diag.missingEvidenceRejected += 1;
      continue;
    }
    if (q === 'insufficient') {
      diag.insufficientDifferentiationRejected += 1;
      continue;
    }
    if (q === 'no') {
      continue;
    }
    if (usedPlaceIds.has(cand.placeId)) {
      diag.duplicatePlacesRejected += 1;
      continue;
    }
    if (best === null || preferOver(role, cand, best)) {
      best = cand;
    }
  }
  return best;
}

function computeTradeoffs(
  cand: DecisionCandidateSnapshot,
  primary: DecisionCandidateSnapshot,
  activeIntent: ActiveIntentScope | null | undefined,
): DecisionTradeoffCode[] {
  const codes: DecisionTradeoffCode[] = [];
  if (isMateriallyFarther(cand, primary)) {
    codes.push('TRADEOFF_FARTHER');
  }
  if (hasWeakerConfidence(cand, primary)) {
    codes.push('TRADEOFF_LOWER_CONFIDENCE');
  }
  if (activeIntent != null && cand.intentStrength < primary.intentStrength) {
    codes.push('TRADEOFF_WEAKER_INTENT_MATCH');
  }
  if (cand.preferenceStrength < primary.preferenceStrength) {
    codes.push('TRADEOFF_WEAKER_PREFERENCE_MATCH');
  }
  if (hasLimitedEvidence(cand)) {
    codes.push('TRADEOFF_LIMITED_EVIDENCE');
  }
  if (cand.category !== primary.category) {
    codes.push('TRADEOFF_DIFFERENT_CATEGORY');
  }
  return codes;
}

function toOption(
  snapshot: DecisionCandidateSnapshot,
  role: DecisionRole,
  rank: number,
  tradeoffCodes: readonly DecisionTradeoffCode[],
): DecisionOption {
  return {
    placeId: snapshot.placeId,
    role,
    rank,
    finalScore: snapshot.finalScore,
    reasonCodes: [ROLE_REASON[role]],
    tradeoffCodes,
    sourceRank: snapshot.sourceRank,
  };
}

/**
 * Construye el set de decisión. Determinista: mismas entradas → mismo set. No
 * muta modelos ni lugares. Salida acotada: 1 primario + hasta 2 alternativas.
 */
export function buildDecisionSet(input: BuildDecisionSetInput): DecisionSet {
  const { rankedModels, placesById, activeIntent = null } = input;
  const maximumOptions = input.maximumOptions ?? 3;
  const maxAlternatives = Math.max(0, Math.min(HARD_MAX_ALTERNATIVES, maximumOptions - 1));

  const diag: MutableDiagnostics = {
    received: rankedModels.length,
    eligible: 0,
    selected: 0,
    duplicatePlacesRejected: 0,
    duplicateRolesRejected: 0,
    insufficientDifferentiationRejected: 0,
    missingEvidenceRejected: 0,
    roleCandidatesEvaluated: 0,
  };

  const snapshots = buildDecisionSnapshots(rankedModels, placesById).filter(isValidCandidate);
  diag.eligible = snapshots.length;

  const finalize = (primary: DecisionOption | null, alternatives: DecisionOption[]): DecisionSet => {
    diag.selected = (primary ? 1 : 0) + alternatives.length;
    const diagnostics: DecisionSelectionDiagnostics = { ...diag };
    return { primary, alternatives, diagnostics };
  };

  if (snapshots.length === 0) {
    return finalize(null, []);
  }

  const primarySnapshot = snapshots[0]; // BEST_MATCH: cima ya ordenada de forma determinista
  const primaryOption = toOption(primarySnapshot, 'BEST_MATCH', 1, []);

  const pool = snapshots.slice(1);
  const usedPlaceIds = new Set<string>([primarySnapshot.placeId]);
  const usedRoles = new Set<DecisionRole>(['BEST_MATCH']);
  const alternatives: DecisionOption[] = [];

  for (const role of ALTERNATIVE_ROLE_PRIORITY) {
    if (alternatives.length >= maxAlternatives) {
      break;
    }
    if (usedRoles.has(role)) {
      diag.duplicateRolesRejected += 1;
      continue;
    }
    const pick = selectForRole(role, pool, primarySnapshot, usedPlaceIds, activeIntent, diag);
    if (!pick) {
      continue;
    }
    const tradeoffs = computeTradeoffs(pick, primarySnapshot, activeIntent);
    alternatives.push(toOption(pick, role, alternatives.length + 2, tradeoffs));
    usedPlaceIds.add(pick.placeId);
    usedRoles.add(role);
  }

  return finalize(primaryOption, alternatives);
}
