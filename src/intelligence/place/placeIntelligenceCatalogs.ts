/**
 * Catálogos cerrados y ORDEN CANÓNICO (V5.8). El orden de cada arreglo define la
 * prioridad determinista de salida; los atributos emitidos se ordenan por él.
 * También define la fuerza intrínseca de cada código de evidencia y el orden
 * canónico de evidencias, para que la salida sea profundamente estable.
 */
import type {
  AccessibilityTrait,
  BestVisitTime,
  ExperienceTag,
  NoiseLevel,
  PlaceAudience,
  PlaceIntelligenceEvidence,
  PlaceIntelligenceEvidenceCode,
  PlaceIntelligenceEvidenceSource,
  PlacePersonality,
  PlaceSpecialty,
  VisitDuration,
  VisitExperience,
} from './placeIntelligenceTypes';

export const PERSONALITY_ORDER: readonly PlacePersonality[] = [
  'FAMILY_FRIENDLY', 'ROMANTIC', 'CASUAL', 'TRADITIONAL', 'TRENDY', 'PREMIUM',
  'BUDGET_FRIENDLY', 'FAST_SERVICE', 'BUSINESS_FRIENDLY', 'LOCAL_FAVORITE',
  'TOURIST_ORIENTED', 'COMMUNITY_ORIENTED',
];

export const VISIT_EXPERIENCE_ORDER: readonly VisitExperience[] = [
  'QUICK_STOP', 'RELAXED_VISIT', 'FULL_MEAL', 'SHOPPING_TRIP', 'ENTERTAINMENT',
  'NIGHTLIFE', 'FAMILY_ACTIVITY', 'PERSONAL_SERVICE', 'PROFESSIONAL_SERVICE',
  'ERRAND', 'OUTDOOR_ACTIVITY',
];

export const AUDIENCE_ORDER: readonly PlaceAudience[] = [
  'FAMILIES', 'COUPLES', 'CHILDREN', 'STUDENTS', 'PROFESSIONALS', 'TOURISTS',
  'LOCALS', 'SENIORS', 'SOLO_VISITORS', 'GROUPS',
];

export const BEST_TIME_ORDER: readonly BestVisitTime[] = [
  'EARLY_MORNING', 'MORNING', 'BREAKFAST', 'LUNCH', 'AFTERNOON', 'SUNSET',
  'DINNER', 'EVENING', 'LATE_NIGHT', 'WEEKDAY', 'WEEKEND',
];

export const NOISE_ORDER: readonly NoiseLevel[] = ['QUIET', 'MODERATE', 'BUSY', 'LOUD'];

export const VISIT_DURATION_ORDER: readonly VisitDuration[] = [
  'UNDER_15_MIN', 'MIN_15_TO_30', 'MIN_30_TO_60', 'HOUR_1_TO_2', 'HALF_DAY', 'FULL_DAY',
];

export const ACCESSIBILITY_ORDER: readonly AccessibilityTrait[] = [
  'WHEELCHAIR_ACCESSIBLE', 'ACCESSIBLE_PARKING', 'GENERAL_PARKING', 'KID_FRIENDLY',
  'PET_FRIENDLY', 'OUTDOOR_ACCESS',
];

export const EXPERIENCE_TAG_ORDER: readonly ExperienceTag[] = [
  'GOOD_FOR_DATES', 'GOOD_FOR_GROUPS', 'GOOD_FOR_FAMILIES', 'GOOD_FOR_SOLO_VISITS',
  'WORK_FRIENDLY', 'QUICK_SERVICE', 'LONG_STAY', 'OUTDOOR_SEATING', 'SCENIC',
  'HIDDEN_GEM', 'CELEBRATION', 'LATE_NIGHT',
];

export const SPECIALTY_ORDER: readonly PlaceSpecialty[] = [
  'COFFEE', 'ESPRESSO', 'PASTRIES', 'BREAKFAST', 'TACOS', 'SEAFOOD', 'GRILLED_MEAT',
  'DESSERTS', 'PHARMACY', 'MOBILE_PHONES', 'PHONE_REPAIR', 'CLOTHING', 'GROCERIES',
  'LODGING', 'LIVE_MUSIC',
];

/** Índice de orden canónico; los códigos desconocidos van al final de forma estable. */
export function orderIndexOf<T extends string>(order: readonly T[], code: T): number {
  const i = order.indexOf(code);
  return i === -1 ? order.length : i;
}

// ── Fuerza intrínseca de evidencia (base del cálculo de confianza) ──
// 3 = atributo estructurado explícito; 2 = una señal derivada fuerte;
// 1 = una señal indirecta conservadora.
const EVIDENCE_STRENGTH: Readonly<Record<PlaceIntelligenceEvidenceCode, 1 | 2 | 3>> = {
  FEATURE_WHEELCHAIR_ACCESSIBLE: 3,
  FEATURE_FAMILY_FRIENDLY: 3,
  FEATURE_PARKING: 3,
  FEATURE_OUTDOOR_SEATING: 3,
  FEATURE_RESERVATIONS: 3,
  FEATURE_DELIVERY: 3,
  PRICE_LEVEL: 3,
  CATEGORY_PRIMARY: 2,
  HOURS_OPEN_WINDOW: 2,
  HOURS_OPEN_WEEKDAY: 2,
  HOURS_OPEN_WEEKEND: 2,
  CATEGORY_SECONDARY: 1,
  NAME_TOKEN: 1,
};

export function evidenceStrengthOf(code: PlaceIntelligenceEvidenceCode): 1 | 2 | 3 {
  return EVIDENCE_STRENGTH[code];
}

// ── Orden canónico de evidencia (para estabilidad profunda) ──
const EVIDENCE_SOURCE_ORDER: readonly PlaceIntelligenceEvidenceSource[] = [
  'CATEGORY', 'SECONDARY_CATEGORY', 'FEATURE', 'PRICE', 'HOURS', 'NAME_LEXICON',
];
const EVIDENCE_CODE_ORDER: readonly PlaceIntelligenceEvidenceCode[] = [
  'CATEGORY_PRIMARY', 'CATEGORY_SECONDARY', 'FEATURE_WHEELCHAIR_ACCESSIBLE',
  'FEATURE_FAMILY_FRIENDLY', 'FEATURE_PARKING', 'FEATURE_OUTDOOR_SEATING',
  'FEATURE_RESERVATIONS', 'FEATURE_DELIVERY', 'PRICE_LEVEL', 'HOURS_OPEN_WINDOW',
  'HOURS_OPEN_WEEKDAY', 'HOURS_OPEN_WEEKEND', 'NAME_TOKEN',
];

/** Comparador determinista de evidencia: fuente → código → valor. */
export function compareEvidence(a: PlaceIntelligenceEvidence, b: PlaceIntelligenceEvidence): number {
  const s = EVIDENCE_SOURCE_ORDER.indexOf(a.source) - EVIDENCE_SOURCE_ORDER.indexOf(b.source);
  if (s !== 0) {
    return s;
  }
  const c = EVIDENCE_CODE_ORDER.indexOf(a.code) - EVIDENCE_CODE_ORDER.indexOf(b.code);
  if (c !== 0) {
    return c;
  }
  const av = a.value === undefined ? '' : String(a.value);
  const bv = b.value === undefined ? '' : String(b.value);
  return av < bv ? -1 : av > bv ? 1 : 0;
}
