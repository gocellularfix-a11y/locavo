/**
 * Calidad de EVIDENCIA a nivel de reporte (V5.8, recalibrado en V5.8.1) — mide la
 * COBERTURA de dato estructurado disponible para V5.8. NO es calidad del negocio,
 * confianza de los atributos inferidos, confianza de recomendación, popularidad
 * ni fuerza de ranking. Un lugar con metadatos escasos puede producir
 * legítimamente INSUFFICIENT y un reporte casi vacío.
 *
 * Puntaje por cobertura de señales REALMENTE usables:
 *   horas con ≥1 intervalo válido .......... +1
 *   ≥1 amenidad reconocida explícitamente true +1
 *   nivel de precio presente ................ +1
 *   coincidencia acotada del léxico de nombre  +0.5
 * El CONTACTO (teléfono/sitio) NO cuenta: no describe la experiencia.
 * Horas vacías/malformadas y amenidades ausentes o en `false` NO cuentan.
 *
 * Umbrales (máx 3.5):  ≥2.5 HIGH · ≥1.5 MEDIUM · ≥0.5 LOW · resto INSUFFICIENT.
 */
import type { PlaceFeatures } from '../../domain/places/LocavoPlace';
import type { EvidenceQuality } from './placeIntelligenceTypes';
import type { PlaceSignals } from './placeSignals';

/** Amenidades reconocidas relevantes para la experiencia. */
const RECOGNIZED_FEATURES: readonly (keyof PlaceFeatures)[] = [
  'wheelchairAccessible', 'familyFriendly', 'parking', 'outdoorSeating', 'reservations', 'delivery',
];

/** Cobertura de amenidad solo cuando alguna reconocida es EXPLÍCITAMENTE true. */
function hasPositiveFeature(features: PlaceFeatures): boolean {
  return RECOGNIZED_FEATURES.some((k) => features[k] === true);
}

export function computeEvidenceQuality(s: PlaceSignals): EvidenceQuality {
  let score = 0;
  if (s.hours.hasUsableInterval) {
    score += 1;
  }
  if (hasPositiveFeature(s.features)) {
    score += 1;
  }
  if (s.priceLevel !== null) {
    score += 1;
  }
  if (s.lexicon.length > 0) {
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
