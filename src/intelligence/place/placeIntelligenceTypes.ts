/**
 * Tipos canónicos de INTELIGENCIA DE LUGAR (V5.8) — deterministas, inmutables,
 * sin cadenas de UI ni prosa. Responden a UNA sola pregunta: ¿qué tipo de
 * experiencia ofrece este lugar? No rankean, no recomiendan, no presentan.
 *
 * Todo atributo inferido lleva evidencia estructurada y confianza derivada de la
 * fuerza de esa evidencia. La ausencia de dato NUNCA es evidencia negativa.
 */

/** Confianza cerrada, derivada de la fuerza de la evidencia (no de calidad/ranking). */
export type IntelligenceConfidence = 'HIGH' | 'MEDIUM' | 'LOW';

/** Calidad/cobertura del dato disponible para V5.8 (no calidad del negocio). */
export type EvidenceQuality = 'HIGH' | 'MEDIUM' | 'LOW' | 'INSUFFICIENT';

/** Fuente estructurada de una evidencia (nunca texto libre generado). */
export type PlaceIntelligenceEvidenceSource =
  | 'CATEGORY'
  | 'FEATURE'
  | 'PRICE'
  | 'HOURS'
  | 'NAME_LEXICON';

/**
 * Código estructurado y cerrado de evidencia. El detalle va en `value`.
 * V5.8 usa SOLO la categoría primaria (sin categorías secundarias).
 * `CATEGORY_TIME_AFFINITY` (ventana típica de categoría) y `HOURS_TIME_WINDOW`
 * (apertura compatible) son señales DÉBILES exclusivas de `BestVisitTime`:
 * juntas dan MEDIUM, nunca HIGH; ninguna sola supera LOW.
 */
export type PlaceIntelligenceEvidenceCode =
  | 'CATEGORY_PRIMARY'
  | 'CATEGORY_TIME_AFFINITY'
  | 'FEATURE_WHEELCHAIR_ACCESSIBLE'
  | 'FEATURE_FAMILY_FRIENDLY'
  | 'FEATURE_PARKING'
  | 'FEATURE_OUTDOOR_SEATING'
  | 'FEATURE_RESERVATIONS'
  | 'FEATURE_DELIVERY'
  | 'PRICE_LEVEL'
  | 'HOURS_OPEN_WINDOW'
  | 'HOURS_TIME_WINDOW'
  | 'HOURS_OPEN_WEEKDAY'
  | 'HOURS_OPEN_WEEKEND'
  | 'NAME_TOKEN';

export interface PlaceIntelligenceEvidence {
  readonly source: PlaceIntelligenceEvidenceSource;
  readonly code: PlaceIntelligenceEvidenceCode;
  /** Valor canónico/seguro (categoría, nivel, ventana, token del léxico). Nunca texto crudo del negocio. */
  readonly value?: string | number | boolean;
}

export interface IntelligenceAttribute<TCode extends string> {
  readonly code: TCode;
  readonly confidence: IntelligenceConfidence;
  readonly evidence: readonly PlaceIntelligenceEvidence[];
}

// ── Catálogos cerrados (uniones tipadas; el orden canónico vive en catalogs.ts) ──

export type PlacePersonality =
  | 'FAMILY_FRIENDLY'
  | 'ROMANTIC'
  | 'CASUAL'
  | 'TRADITIONAL'
  | 'TRENDY'
  | 'PREMIUM'
  | 'BUDGET_FRIENDLY'
  | 'FAST_SERVICE'
  | 'BUSINESS_FRIENDLY'
  | 'LOCAL_FAVORITE'
  | 'TOURIST_ORIENTED'
  | 'COMMUNITY_ORIENTED';

export type VisitExperience =
  | 'QUICK_STOP'
  | 'RELAXED_VISIT'
  | 'FULL_MEAL'
  | 'SHOPPING_TRIP'
  | 'ENTERTAINMENT'
  | 'NIGHTLIFE'
  | 'FAMILY_ACTIVITY'
  | 'PERSONAL_SERVICE'
  | 'PROFESSIONAL_SERVICE'
  | 'ERRAND'
  | 'OUTDOOR_ACTIVITY';

export type PlaceAudience =
  | 'FAMILIES'
  | 'COUPLES'
  | 'CHILDREN'
  | 'STUDENTS'
  | 'PROFESSIONALS'
  | 'TOURISTS'
  | 'LOCALS'
  | 'SENIORS'
  | 'SOLO_VISITORS'
  | 'GROUPS';

export type BestVisitTime =
  | 'EARLY_MORNING'
  | 'MORNING'
  | 'BREAKFAST'
  | 'LUNCH'
  | 'AFTERNOON'
  | 'SUNSET'
  | 'DINNER'
  | 'EVENING'
  | 'LATE_NIGHT'
  | 'WEEKDAY'
  | 'WEEKEND';

export type NoiseLevel = 'QUIET' | 'MODERATE' | 'BUSY' | 'LOUD';

export type VisitDuration =
  | 'UNDER_15_MIN'
  | 'MIN_15_TO_30'
  | 'MIN_30_TO_60'
  | 'HOUR_1_TO_2'
  | 'HALF_DAY'
  | 'FULL_DAY';

export type AccessibilityTrait =
  | 'WHEELCHAIR_ACCESSIBLE'
  | 'ACCESSIBLE_PARKING'
  | 'GENERAL_PARKING'
  | 'KID_FRIENDLY'
  | 'PET_FRIENDLY'
  | 'OUTDOOR_ACCESS';

export type ExperienceTag =
  | 'GOOD_FOR_DATES'
  | 'GOOD_FOR_GROUPS'
  | 'GOOD_FOR_FAMILIES'
  | 'GOOD_FOR_SOLO_VISITS'
  | 'WORK_FRIENDLY'
  | 'QUICK_SERVICE'
  | 'LONG_STAY'
  | 'OUTDOOR_SEATING'
  | 'SCENIC'
  | 'HIDDEN_GEM'
  | 'CELEBRATION'
  | 'LATE_NIGHT';

export type PlaceSpecialty =
  | 'COFFEE'
  | 'ESPRESSO'
  | 'PASTRIES'
  | 'BREAKFAST'
  | 'TACOS'
  | 'SEAFOOD'
  | 'GRILLED_MEAT'
  | 'DESSERTS'
  | 'PHARMACY'
  | 'MOBILE_PHONES'
  | 'PHONE_REPAIR'
  | 'CLOTHING'
  | 'GROCERIES'
  | 'LODGING'
  | 'LIVE_MUSIC';

export interface PlaceIntelligenceReport {
  readonly placeId: string;
  readonly personalities: readonly IntelligenceAttribute<PlacePersonality>[];
  readonly visitExperiences: readonly IntelligenceAttribute<VisitExperience>[];
  readonly audiences: readonly IntelligenceAttribute<PlaceAudience>[];
  readonly bestTimes: readonly IntelligenceAttribute<BestVisitTime>[];
  readonly noiseLevel: IntelligenceAttribute<NoiseLevel> | null;
  readonly visitDuration: IntelligenceAttribute<VisitDuration> | null;
  readonly accessibility: readonly IntelligenceAttribute<AccessibilityTrait>[];
  readonly experienceTags: readonly IntelligenceAttribute<ExperienceTag>[];
  readonly specialties: readonly IntelligenceAttribute<PlaceSpecialty>[];
  readonly evidenceQuality: EvidenceQuality;
  readonly schemaVersion: string;
}

export const PLACE_INTELLIGENCE_SCHEMA_VERSION = '5.8.0';
