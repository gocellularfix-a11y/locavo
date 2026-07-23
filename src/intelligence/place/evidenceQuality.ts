/**
 * Calidad de EVIDENCIA a nivel de reporte (V5.8) — mide la COBERTURA y calidad
 * del dato disponible para V5.8, NO la calidad del negocio, su desempeño, la
 * satisfacción del usuario ni la fuerza de recomendación. Un lugar con metadatos
 * escasos puede legítimamente producir INSUFFICIENT y un reporte casi vacío.
 *
 * Puntaje determinista por cobertura de campos estructurados:
 *   horas +1 · amenidades +1 · precio +1 · léxico de nombre +0.5 · contacto +0.5
 *   ≥2.5 HIGH · ≥1.5 MEDIUM · ≥0.5 LOW · resto INSUFFICIENT.
 */
import type { EvidenceQuality } from './placeIntelligenceTypes';
import type { PlaceSignals } from './placeSignals';

function hasAnyFeature(features: PlaceSignals['features']): boolean {
  return (Object.keys(features) as (keyof typeof features)[]).some((k) => features[k] !== undefined);
}

export function computeEvidenceQuality(s: PlaceSignals): EvidenceQuality {
  let score = 0;
  if (s.hours.hasHours) {
    score += 1;
  }
  if (hasAnyFeature(s.features)) {
    score += 1;
  }
  if (s.priceLevel !== null) {
    score += 1;
  }
  if (s.lexicon.length > 0) {
    score += 0.5;
  }
  if (s.hasPhone || s.hasWebsite) {
    score += 0.5;
  }
  if (score >= 2.5) {
    return 'HIGH';
  }
  if (score >= 1.5) {
    return 'MEDIUM';
  }
  if (score >= 0.5) {
    return 'LOW';
  }
  return 'INSUFFICIENT';
}
