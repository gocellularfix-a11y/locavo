/**
 * RESOLUCIÓN DE ENTIDAD (GEN-1 · Fase D) — conservadora y auditable.
 *
 * Decide si dos registros hablan del MISMO lugar, y jamás fusiona nada:
 * produce un veredicto con las señales que lo sustentan. La ambigüedad se
 * declara como ambigüedad, no se resuelve a la fuerza.
 *
 * Determinista y explicable: cada veredicto enumera qué señales coincidieron
 * y cuáles se contradijeron. Sin magia difusa sin rastro.
 */
import { haversineKm, isValidCoordinates } from '../../domain/distance';
import type { Coordinates } from '../../domain/place';

export interface EntityRecord {
  /** Identidad canónica interna; si ambas existen, manda. */
  readonly placeId?: string;
  /** Id del lugar en la fuente (denue_id, osm node/way…). */
  readonly sourceNativeId?: string;
  readonly normalizedName?: string;
  readonly phones?: readonly string[];
  readonly websiteDomain?: string;
  readonly coordinates?: Coordinates;
  readonly aliases?: readonly string[];
}

export type EntityOutcome =
  | 'confirmed_same'
  | 'probable_same'
  | 'ambiguous'
  | 'conflicting'
  | 'confirmed_different';

export type EntitySignalName =
  | 'canonical_place_id'
  | 'source_native_id'
  | 'phone'
  | 'website_domain'
  | 'normalized_name'
  | 'alias'
  | 'proximity';

export interface EntitySignal {
  readonly signal: EntitySignalName;
  readonly agrees: boolean;
  readonly weight: 'strong' | 'medium';
  readonly detail?: string;
}

export interface EntityResolution {
  readonly outcome: EntityOutcome;
  /** Señales evaluadas, en orden canónico y estable. */
  readonly signals: readonly EntitySignal[];
}

/** Metros a partir de los cuales la proximidad contradice la identidad. */
const FAR_APART_METERS = 500;
/** Metros por debajo de los cuales la proximidad apoya la identidad. */
const NEAR_METERS = 75;

const SIGNAL_ORDER: readonly EntitySignalName[] = [
  'canonical_place_id',
  'source_native_id',
  'phone',
  'website_domain',
  'normalized_name',
  'alias',
  'proximity',
];

function intersects(a: readonly string[] = [], b: readonly string[] = []): boolean {
  const left = new Set(a.map((value) => value.trim().toLowerCase()));
  return b.some((value) => left.has(value.trim().toLowerCase()));
}

/**
 * Resuelve la relación entre dos registros. La identidad canónica, cuando
 * ambas partes la declaran, es decisiva y ninguna otra señal la discute.
 */
export function resolveEntity(a: EntityRecord, b: EntityRecord): EntityResolution {
  const signals: EntitySignal[] = [];

  if (a.placeId && b.placeId) {
    const agrees = a.placeId === b.placeId;
    signals.push({ signal: 'canonical_place_id', agrees, weight: 'strong' });
    return { outcome: agrees ? 'confirmed_same' : 'confirmed_different', signals };
  }

  if (a.sourceNativeId && b.sourceNativeId) {
    signals.push({
      signal: 'source_native_id',
      agrees: a.sourceNativeId === b.sourceNativeId,
      weight: 'strong',
    });
  }
  if (a.phones?.length && b.phones?.length) {
    signals.push({ signal: 'phone', agrees: intersects(a.phones, b.phones), weight: 'strong' });
  }
  if (a.websiteDomain && b.websiteDomain) {
    signals.push({
      signal: 'website_domain',
      agrees: a.websiteDomain.toLowerCase() === b.websiteDomain.toLowerCase(),
      weight: 'strong',
    });
  }
  if (a.normalizedName && b.normalizedName) {
    signals.push({
      signal: 'normalized_name',
      agrees: a.normalizedName === b.normalizedName,
      weight: 'medium',
    });
  }
  if (a.aliases?.length && b.aliases?.length) {
    signals.push({ signal: 'alias', agrees: intersects(a.aliases, b.aliases), weight: 'medium' });
  }
  if (
    a.coordinates &&
    b.coordinates &&
    isValidCoordinates(a.coordinates) &&
    isValidCoordinates(b.coordinates)
  ) {
    const meters = haversineKm(a.coordinates, b.coordinates) * 1000;
    if (meters <= NEAR_METERS) {
      signals.push({ signal: 'proximity', agrees: true, weight: 'medium', detail: 'near' });
    } else if (meters > FAR_APART_METERS) {
      signals.push({ signal: 'proximity', agrees: false, weight: 'strong', detail: 'far' });
    } else {
      signals.push({ signal: 'proximity', agrees: false, weight: 'medium', detail: 'between' });
    }
  }

  signals.sort(
    (x, y) => SIGNAL_ORDER.indexOf(x.signal) - SIGNAL_ORDER.indexOf(y.signal),
  );

  const strongAgree = signals.filter((s) => s.agrees && s.weight === 'strong').length;
  const strongDisagree = signals.filter((s) => !s.agrees && s.weight === 'strong').length;
  const mediumAgree = signals.filter((s) => s.agrees && s.weight === 'medium').length;

  let outcome: EntityOutcome;
  if (strongAgree > 0 && strongDisagree > 0) {
    // Señales fuertes en ambos sentidos: nadie decide, se reporta el conflicto.
    outcome = 'conflicting';
  } else if (strongDisagree > 0 && strongAgree === 0 && mediumAgree === 0) {
    outcome = 'confirmed_different';
  } else if (strongAgree >= 2 && strongDisagree === 0) {
    outcome = 'probable_same';
  } else if (strongAgree === 1 && mediumAgree >= 1 && strongDisagree === 0) {
    outcome = 'probable_same';
  } else if (signals.length === 0) {
    outcome = 'ambiguous';
  } else {
    outcome = 'ambiguous';
  }

  return { outcome, signals };
}
