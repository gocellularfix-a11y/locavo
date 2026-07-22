/**
 * Modelo de EVIDENCIA (V5.0).
 *
 * Describe QUÉ se sabe de un candidato, separado de score y de confianza. La
 * presencia de un campo NO prueba que sea correcto: cada ítem declara su estado
 * (conocido/desconocido/en conflicto/no soportado), su fuente y su confianza.
 * El lugar canónico NUNCA se muta; la evidencia son estructuras aparte.
 */
import { haversineKm, isValidCoordinates } from '../domain/distance';
import { evaluateOpenStatus, type OpenState } from '../domain/openingHours';
import type { CategoryId } from '../domain/place';
import {
  primarySourceOf,
  type LocavoPlace,
  type PlaceSource,
} from '../domain/places/LocavoPlace';
import {
  adjustForAgreement,
  baseConfidenceOf,
  weakestConfidence,
  type EvidenceConfidence,
} from './confidence';
import type { NormalizedContext } from './context';
import { intentMatchesCategory } from './intent';

export type EvidenceStatus = 'known' | 'unknown' | 'conflict' | 'unsupported';

export type EvidenceDimension =
  | 'intent'
  | 'distance'
  | 'openStatus'
  | 'accessibility'
  | 'parking'
  | 'family'
  | 'contact'
  | 'freshness'
  | 'provenance';

export interface EvidenceItem {
  dimension: EvidenceDimension;
  status: EvidenceStatus;
  /** Valor observado (estructurado, nunca prosa de UI). */
  value?: number | string | boolean;
  source?: PlaceSource;
  confidence: EvidenceConfidence;
  affectsEligibility: boolean;
  affectsRanking: boolean;
  affectsConfidence: boolean;
}

export interface CandidateEvidence {
  placeId: string;
  category: CategoryId;
  intentMatch: boolean;
  distanceMeters: number | null;
  openState: OpenState;
  accessible: boolean | 'unknown';
  parking: boolean | 'unknown';
  family: boolean | 'unknown';
  items: readonly EvidenceItem[];
  byDimension: Readonly<Partial<Record<EvidenceDimension, EvidenceConfidence>>>;
  /** Confianza agregada conservadora: la más baja entre lo CONOCIDO. */
  overallConfidence: EvidenceConfidence;
  sources: readonly PlaceSource[];
}

function booleanEvidence(
  dimension: EvidenceDimension,
  value: boolean | undefined,
  source: PlaceSource,
  confidence: EvidenceConfidence,
  flags: { eligibility: boolean; ranking: boolean },
): EvidenceItem {
  if (value === undefined) {
    return {
      dimension,
      status: 'unknown',
      confidence: 'unknown',
      source,
      affectsEligibility: flags.eligibility,
      affectsRanking: flags.ranking,
      affectsConfidence: false,
    };
  }
  return {
    dimension,
    status: 'known',
    value,
    source,
    confidence,
    affectsEligibility: flags.eligibility,
    affectsRanking: flags.ranking,
    affectsConfidence: true,
  };
}

/** Construye la evidencia de un candidato a partir del lugar canónico (solo lectura). */
export function gatherEvidence(place: LocavoPlace, context: NormalizedContext): CandidateEvidence {
  const source = primarySourceOf(place);
  const sources = place.provenance.map((p) => p.source);
  const base = adjustForAgreement(baseConfidenceOf(source, place.verification), {
    agreeingSources: new Set(sources).size,
  });

  const items: EvidenceItem[] = [];

  // Intención / categoría (dato canónico).
  const intentMatch = intentMatchesCategory(context.intent, place.category);
  items.push({
    dimension: 'intent',
    status: 'known',
    value: place.category,
    source,
    confidence: 'high',
    affectsEligibility: true,
    affectsRanking: true,
    affectsConfidence: true,
  });

  // Distancia (solo con origen y coordenadas válidas).
  let distanceMeters: number | null = null;
  if (context.origin && isValidCoordinates(place.coordinates)) {
    distanceMeters = haversineKm(context.origin, place.coordinates) * 1000;
    items.push({
      dimension: 'distance',
      status: 'known',
      value: distanceMeters,
      source,
      confidence: 'high',
      affectsEligibility: true,
      affectsRanking: true,
      affectsConfidence: false,
    });
  } else {
    items.push({
      dimension: 'distance',
      status: 'unknown',
      confidence: 'unknown',
      affectsEligibility: false,
      affectsRanking: true,
      affectsConfidence: false,
    });
  }

  // Estado de apertura (desconocido si no hay horarios reales).
  const openState = evaluateOpenStatus(place.hours ?? null, context.now).state;
  items.push({
    dimension: 'openStatus',
    status: openState === 'unknown' ? 'unknown' : 'known',
    value: openState,
    source,
    confidence: openState === 'unknown' ? 'unknown' : base,
    affectsEligibility: true,
    affectsRanking: true,
    affectsConfidence: openState !== 'unknown',
  });

  // Atributos (features): accesibilidad, estacionamiento, familiar.
  const features = place.features;
  items.push(
    booleanEvidence('accessibility', features?.wheelchairAccessible, source, base, {
      eligibility: true,
      ranking: true,
    }),
    booleanEvidence('parking', features?.parking, source, base, { eligibility: false, ranking: true }),
    booleanEvidence('family', features?.familyFriendly, source, base, { eligibility: false, ranking: true }),
  );

  // Contacto: informativo. NO influye en ranking (contacto solo ≠ idoneidad).
  const hasContact = Boolean(place.contact?.phone || place.contact?.website);
  items.push({
    dimension: 'contact',
    status: hasContact ? 'known' : 'unknown',
    value: hasContact,
    source,
    confidence: hasContact ? base : 'unknown',
    affectsEligibility: false,
    affectsRanking: false,
    affectsConfidence: false,
  });

  // Frescura del dataset (fecha de edición oficial, no reloj).
  const freshness = place.verification.sourceDatasetUpdatedAt;
  items.push({
    dimension: 'freshness',
    status: freshness ? 'known' : 'unknown',
    value: freshness,
    source,
    confidence: freshness ? base : 'unknown',
    affectsEligibility: false,
    affectsRanking: false,
    affectsConfidence: Boolean(freshness),
  });

  // Procedencia.
  items.push({
    dimension: 'provenance',
    status: 'known',
    value: source,
    source,
    confidence: base,
    affectsEligibility: false,
    affectsRanking: false,
    affectsConfidence: true,
  });

  const byDimension: Partial<Record<EvidenceDimension, EvidenceConfidence>> = {};
  for (const item of items) {
    byDimension[item.dimension] = item.confidence;
  }
  const overallConfidence = weakestConfidence(
    items.filter((i) => i.status === 'known' && i.affectsConfidence).map((i) => i.confidence),
  );

  const featureValue = (v: boolean | undefined): boolean | 'unknown' =>
    v === undefined ? 'unknown' : v;

  return {
    placeId: place.id,
    category: place.category,
    intentMatch,
    distanceMeters,
    openState,
    accessible: featureValue(features?.wheelchairAccessible),
    parking: featureValue(features?.parking),
    family: featureValue(features?.familyFriendly),
    items,
    byDimension,
    overallConfidence,
    sources,
  };
}
