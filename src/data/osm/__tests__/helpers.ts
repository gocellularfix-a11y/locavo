import type { LocavoCategory, LocavoPlace } from '../../../domain/places/LocavoPlace';
import type { OsmPoi } from '../OsmEnrichment';

/** ~metros → grados de latitud (para controlar distancias en pruebas). */
export function metersToLatOffset(meters: number): number {
  return meters / 111320;
}

export interface DenueOverrides {
  id?: string;
  name?: string;
  category?: LocavoCategory;
  latitude?: number;
  longitude?: number;
  phone?: string;
  website?: string;
}

export function makeDenue(o: DenueOverrides = {}): LocavoPlace {
  const place: LocavoPlace = {
    id: o.id ?? 'denue-1',
    sourceRefs: { denueId: (o.id ?? 'denue-1').replace('denue-', '') },
    name: o.name ?? 'Farmacia Alfa',
    normalizedName: (o.name ?? 'Farmacia Alfa').toLowerCase(),
    category: o.category ?? 'pharmacy',
    coordinates: { latitude: o.latitude ?? 24.8, longitude: o.longitude ?? -107.4 },
    verification: { status: 'source_verified', confidence: 0.6 },
    provenance: [{ source: 'denue', importedAt: '2026-07-01T00:00:00.000Z' }],
    status: { active: true },
    createdAt: '2026-07-01T00:00:00.000Z',
    updatedAt: '2026-07-01T00:00:00.000Z',
  };
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

export function makePoi(osmId: string, lat: number, lon: number, tags: Record<string, string>): OsmPoi {
  return { osmId, lat, lon, tags };
}
