/**
 * Merge de runtime del enriquecimiento OSM sobre un `LocavoPlace` ya hidratado.
 *
 * Invariantes (V4F-0):
 * - DENUE permanece canónico: id, nombre, categoría, coordenadas y verificación
 *   NUNCA se tocan.
 * - Solo se rellenan campos aprobados vacíos (phone/website), horarios y
 *   features booleanas; nunca se sobrescribe un valor DENUE válido.
 * - La procedencia OSM se AGREGA al final (append-only); jamás en el índice 0.
 * - OSM es source-imported, no owner-confirmed: no altera `verification`.
 */
import type { LocavoPlace, PlaceContact, PlaceFeatures } from '../../domain/places/LocavoPlace';
import { normalizedDigits, websiteDomain } from '../../services/places/PlaceMergeService';
import type { OsmEnrichmentEntry } from './OsmEnrichment';

function phoneIsEmpty(phone: string | undefined): boolean {
  return normalizedDigits(phone) === null;
}

function websiteIsEmpty(website: string | undefined): boolean {
  return websiteDomain(website) === null;
}

/** Devuelve una copia enriquecida; no muta el `place` original. */
export function applyOsmEnrichment(place: LocavoPlace, entry: OsmEnrichmentEntry): LocavoPlace {
  const fields = entry.fields;

  const contact: PlaceContact = { ...place.contact };
  let contactTouched = false;
  if (fields.phone?.ingested && phoneIsEmpty(contact.phone)) {
    contact.phone = fields.phone.value;
    contactTouched = true;
  }
  if (fields.website?.ingested && websiteIsEmpty(contact.website)) {
    contact.website = fields.website.value;
    contactTouched = true;
  }

  const features: PlaceFeatures = { ...place.features };
  let featuresTouched = false;
  const boolFields = [
    ['wheelchairAccessible', fields.wheelchairAccessible],
    ['outdoorSeating', fields.outdoorSeating],
    ['parking', fields.parking],
    ['delivery', fields.delivery],
  ] as const;
  for (const [key, ingestion] of boolFields) {
    if (ingestion?.ingested) {
      features[key] = ingestion.value;
      featuresTouched = true;
    }
  }

  const enriched: LocavoPlace = {
    ...place,
    // Append-only: la procedencia DENUE (índice 0) permanece intacta.
    provenance: [...place.provenance, { source: 'openstreetmap' }],
  };
  if (contactTouched) {
    enriched.contact = contact;
  }
  if (featuresTouched) {
    enriched.features = features;
  }
  if (fields.hours?.ingested && fields.hours.value) {
    enriched.hours = fields.hours.value;
  }
  return enriched;
}
