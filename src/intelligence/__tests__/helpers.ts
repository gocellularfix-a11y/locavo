import type { OpeningHours } from '../../domain/place';
import type { LocavoPlace, PlaceFeatures, PlaceVerification } from '../../domain/places/LocavoPlace';

export const ORIGIN = { latitude: 24.8, longitude: -107.4 };
export const NOW = new Date('2026-07-22T18:00:00.000Z');

/** Horario abierto 24 h (open === close ⇒ siempre abierto). */
export const ALWAYS_OPEN: OpeningHours = {
  weekly: Array.from({ length: 7 }, () => [{ open: '00:00', close: '00:00' }]),
};
/** Horario cerrado todos los días. */
export const ALWAYS_CLOSED: OpeningHours = { weekly: Array.from({ length: 7 }, () => []) };

export interface PlaceOverrides {
  id: string;
  category?: LocavoPlace['category'];
  latitude?: number;
  longitude?: number;
  hours?: OpeningHours;
  features?: PlaceFeatures;
  verification?: Partial<PlaceVerification>;
  provenance?: LocavoPlace['provenance'];
  phone?: string;
  website?: string;
  active?: boolean;
  permanentlyClosed?: boolean;
}

export function makePlace(o: PlaceOverrides): LocavoPlace {
  const place: LocavoPlace = {
    id: o.id,
    sourceRefs: { denueId: o.id },
    name: `Place ${o.id}`,
    normalizedName: `place ${o.id}`,
    category: o.category ?? 'food',
    coordinates: {
      latitude: o.latitude ?? ORIGIN.latitude,
      longitude: o.longitude ?? ORIGIN.longitude,
    },
    verification: {
      status: 'source_verified',
      confidence: 0.6,
      sourceDatasetUpdatedAt: '2026-07-01T00:00:00.000Z',
      ...o.verification,
    },
    provenance: o.provenance ?? [{ source: 'denue', importedAt: '2026-07-01T00:00:00.000Z' }],
    status: {
      active: o.active ?? true,
      permanentlyClosed: o.permanentlyClosed,
    },
    createdAt: '2026-07-01T00:00:00.000Z',
    updatedAt: '2026-07-01T00:00:00.000Z',
  };
  if (o.hours) {
    place.hours = o.hours;
  }
  if (o.features) {
    place.features = o.features;
  }
  if (o.phone || o.website) {
    place.contact = {};
    if (o.phone) {
      place.contact.phone = o.phone;
    }
    if (o.website) {
      place.contact.website = o.website;
    }
  }
  return place;
}
