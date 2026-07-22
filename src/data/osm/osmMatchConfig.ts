/**
 * ÚNICA fuente de configuración de matching del pilot OSM (V4F-0).
 *
 * Reutiliza las constantes canónicas del motor `PlaceMergeService` (umbral de
 * confianza, banda fuerte de cercanía, similitud fuerte de nombre) — NO las
 * redefine — y añade solo los controles específicos del pilot. No existe
 * ninguna otra constante de matching OSM en el código.
 */
import {
  MERGE_CONFIDENCE_THRESHOLD,
  NEARBY_STRONG_M,
  STRONG_NAME_SIMILARITY,
} from '../../services/places/PlaceMergeService';

export interface OsmMatchConfig {
  /** Radio de generación de candidatos (m). */
  candidateRadiusMeters: number;
  /** Piso de confianza para clasificar AMBIGUOUS. */
  ambiguousConfidenceFloor: number;
  /** Delta de confianza que define "candidatos competitivos". */
  competitiveConfidenceDelta: number;
  /** Canónicos reutilizados (solo referencia; el motor sigue siendo la verdad). */
  mergeConfidenceThreshold: number;
  strongNameSimilarity: number;
  strongProximityMeters: number;
}

export const OSM_MATCH_CONFIG: Readonly<OsmMatchConfig> = Object.freeze({
  candidateRadiusMeters: 150,
  ambiguousConfidenceFloor: 0.5,
  competitiveConfidenceDelta: 0.08,
  mergeConfidenceThreshold: MERGE_CONFIDENCE_THRESHOLD,
  strongNameSimilarity: STRONG_NAME_SIMILARITY,
  strongProximityMeters: NEARBY_STRONG_M,
});

/**
 * Huella determinista de la config (FNV-1a de 32 bits sobre el JSON con claves
 * ordenadas). Sin `node:crypto` para no arrastrar dependencias al bundle.
 */
export function configFingerprint(config: OsmMatchConfig = OSM_MATCH_CONFIG): string {
  const ordered = Object.keys(config)
    .sort()
    .map((k) => `${k}:${String((config as unknown as Record<string, unknown>)[k])}`)
    .join('|');
  let hash = 0x811c9dc5;
  for (let i = 0; i < ordered.length; i++) {
    hash ^= ordered.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}
