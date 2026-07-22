/**
 * Adaptación de un POI OSM a la forma `LocavoPlace` que consume el motor
 * canónico `matchPlaces`. No se inventa identidad canónica: estos objetos son
 * solo candidatos de matching, nunca lugares canónicos.
 */
import type { LocavoCategory, LocavoPlace } from '../../domain/places/LocavoPlace';
import { normalizeText } from '../../utils/text';
import type { OsmPoi } from './OsmEnrichment';
import { osmCategoryOf } from './osmCategoryMap';
import { extractPhone, extractWebsite } from './osmSignals';

export interface OsmCandidate {
  poi: OsmPoi;
  osmCategory: LocavoCategory;
  /** Objeto con forma LocavoPlace para `matchPlaces` (no es un lugar canónico). */
  place: LocavoPlace;
}

/** Construye un candidato desde un POI, o `null` si no mapea a una categoría del pilot. */
export function osmPoiToCandidate(poi: OsmPoi): OsmCandidate | null {
  const osmCategory = osmCategoryOf(poi.tags);
  if (osmCategory === null) {
    return null;
  }
  const name = poi.tags.name ?? '';
  const place: LocavoPlace = {
    id: poi.osmId,
    sourceRefs: { osmId: poi.osmId },
    name,
    normalizedName: normalizeText(name),
    category: osmCategory,
    coordinates: { latitude: poi.lat, longitude: poi.lon },
    verification: { status: 'unverified', confidence: 0 },
    provenance: [{ source: 'openstreetmap' }],
    status: { active: true },
    createdAt: '',
    updatedAt: '',
  };
  const phone = extractPhone(poi.tags);
  const website = extractWebsite(poi.tags);
  if (phone || website) {
    place.contact = {};
    if (phone) {
      place.contact.phone = phone;
    }
    if (website) {
      place.contact.website = website;
    }
  }
  return { poi, osmCategory, place };
}

/** Todos los candidatos válidos (con categoría del pilot) desde la lista de POIs. */
export function buildCandidates(pois: readonly OsmPoi[]): OsmCandidate[] {
  const out: OsmCandidate[] = [];
  for (const poi of pois) {
    const candidate = osmPoiToCandidate(poi);
    if (candidate) {
      out.push(candidate);
    }
  }
  return out;
}
