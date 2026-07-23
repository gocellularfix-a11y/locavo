/**
 * Inteligencia de Lugar (V5.8) — API pública. Motor local, offline, determinista
 * y explicable que responde: ¿qué tipo de experiencia ofrece este lugar? Sin
 * LLM, sin red, sin persistencia, sin UI. Consume solo dato estructurado ya
 * presente en `LocavoPlace`.
 */
export { buildPlaceIntelligence } from './placeIntelligenceEngine';
export {
  PLACE_INTELLIGENCE_SCHEMA_VERSION,
  type PlaceIntelligenceReport,
  type IntelligenceAttribute,
  type IntelligenceConfidence,
  type EvidenceQuality,
  type PlaceIntelligenceEvidence,
  type PlaceIntelligenceEvidenceSource,
  type PlaceIntelligenceEvidenceCode,
  type PlacePersonality,
  type VisitExperience,
  type PlaceAudience,
  type BestVisitTime,
  type NoiseLevel,
  type VisitDuration,
  type AccessibilityTrait,
  type ExperienceTag,
  type PlaceSpecialty,
} from './placeIntelligenceTypes';
export {
  PERSONALITY_ORDER,
  VISIT_EXPERIENCE_ORDER,
  AUDIENCE_ORDER,
  BEST_TIME_ORDER,
  NOISE_ORDER,
  VISIT_DURATION_ORDER,
  ACCESSIBILITY_ORDER,
  EXPERIENCE_TAG_ORDER,
  SPECIALTY_ORDER,
} from './placeIntelligenceCatalogs';
