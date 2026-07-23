/**
 * Motor de INTELIGENCIA DE LUGAR (V5.8) — punto de entrada público, puro y
 * determinista. Convierte el dato estructurado ya existente de un `LocavoPlace`
 * en una descripción estructurada de la EXPERIENCIA que ofrece. No rankea, no
 * recomienda, no presenta, no usa hora actual, red, aleatoriedad ni estado
 * mutable. Para una misma entrada normalizada, la salida es profundamente igual.
 */
import type { LocavoPlace } from '../../domain/places/LocavoPlace';
import {
  analyzeAccessibility,
  analyzeAudiences,
  analyzeBestTimes,
  analyzeExperienceTags,
  analyzeNoiseLevel,
  analyzePersonalities,
  analyzeSpecialties,
  analyzeVisitDuration,
  analyzeVisitExperiences,
} from './analyzers';
import { assembleAttributes, assembleSingle } from './confidence';
import { computeEvidenceQuality } from './evidenceQuality';
import {
  ACCESSIBILITY_ORDER,
  AUDIENCE_ORDER,
  BEST_TIME_ORDER,
  EXPERIENCE_TAG_ORDER,
  NOISE_ORDER,
  PERSONALITY_ORDER,
  SPECIALTY_ORDER,
  VISIT_DURATION_ORDER,
  VISIT_EXPERIENCE_ORDER,
} from './placeIntelligenceCatalogs';
import { collectPlaceSignals } from './placeSignals';
import {
  PLACE_INTELLIGENCE_SCHEMA_VERSION,
  type PlaceIntelligenceReport,
} from './placeIntelligenceTypes';

export function buildPlaceIntelligence(place: LocavoPlace): PlaceIntelligenceReport {
  const signals = collectPlaceSignals(place);
  return {
    placeId: place.id,
    personalities: assembleAttributes(analyzePersonalities(signals), PERSONALITY_ORDER),
    visitExperiences: assembleAttributes(analyzeVisitExperiences(signals), VISIT_EXPERIENCE_ORDER),
    audiences: assembleAttributes(analyzeAudiences(signals), AUDIENCE_ORDER),
    bestTimes: assembleAttributes(analyzeBestTimes(signals), BEST_TIME_ORDER),
    noiseLevel: assembleSingle(analyzeNoiseLevel(signals), NOISE_ORDER),
    visitDuration: assembleSingle(analyzeVisitDuration(signals), VISIT_DURATION_ORDER),
    accessibility: assembleAttributes(analyzeAccessibility(signals), ACCESSIBILITY_ORDER),
    experienceTags: assembleAttributes(analyzeExperienceTags(signals), EXPERIENCE_TAG_ORDER),
    specialties: assembleAttributes(analyzeSpecialties(signals), SPECIALTY_ORDER),
    evidenceQuality: computeEvidenceQuality(signals),
    schemaVersion: PLACE_INTELLIGENCE_SCHEMA_VERSION,
  };
}
