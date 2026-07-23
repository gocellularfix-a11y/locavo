import type { CityPackPlace } from '../../import/denue/CityPackBuilder';
import type {
  LocavoPlace,
  PlaceSource,
  PlaceSourceRefs,
} from '../../../domain/places/LocavoPlace';
import { providerRegistry } from '../../pipeline/providerRegistry';

/**
 * Hidratación CityPackPlace (DTO canónico del pack) → LocavoPlace (modelo
 * de runtime). Neutral al proveedor: la verificación y las ranuras de
 * `sourceRefs` se derivan del REGISTRO de proveedores (City Pipeline V1) según
 * la procedencia declarada en sources[], nunca de lógica DENUE incrustada.
 *
 * No se inventa nada: sin horarios, sin precios, sin calificaciones. Las
 * marcas de tiempo derivan de la edición oficial del dato (deterministas).
 */

function editionTimestamp(edition: string): string {
  // La edición llega como fecha oficial (p. ej. 2026-07-01).
  return /^\d{4}-\d{2}-\d{2}$/.test(edition) ? `${edition}T00:00:00.000Z` : edition;
}

export function cityPackPlaceToLocavoPlace(place: CityPackPlace): LocavoPlace {
  const primary = place.sources[0];

  // Ranuras de referencia por proveedor desde el registro (primera fuente gana).
  const sourceRefs: PlaceSourceRefs = {};
  const refs = sourceRefs as Record<string, string>;
  for (const source of place.sources) {
    const slots = providerRegistry.sourceRefSlotsOf(source.provider);
    if (slots.externalId && refs[slots.externalId] === undefined) {
      refs[slots.externalId] = source.externalId;
    }
    if (slots.clee && source.clee && refs[slots.clee] === undefined) {
      refs[slots.clee] = source.clee;
    }
  }

  const verification = providerRegistry.verificationOf(primary?.provider);
  const timestamp = editionTimestamp(primary?.edition ?? '');

  const hydrated: LocavoPlace = {
    id: place.id,
    sourceRefs,
    name: place.name,
    normalizedName: place.normalizedName,
    category: place.category,
    coordinates: { latitude: place.latitude, longitude: place.longitude },
    verification: {
      status: verification.status,
      confidence: verification.confidence,
      // Fecha de la EDICIÓN del dataset, nunca verificación individual:
      // el directorio oficial no confirma cada negocio uno por uno.
      sourceDatasetUpdatedAt: timestamp,
    },
    provenance: place.sources.map((source) => ({
      // `provider` es ProviderId (abierto); los proveedores registrados hoy
      // (denue/openstreetmap) son valores válidos de PlaceSource. Migración:
      // al añadir proveedores fuera de PlaceSource (Overture/GeoNames), ampliar
      // `PlaceProvenanceEntry.source` a ProviderId (cambio de dominio aislado).
      source: source.provider as PlaceSource,
      importedAt: editionTimestamp(source.edition),
      updatedAt: editionTimestamp(source.edition),
    })),
    status: { active: true },
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  if (place.address) {
    hydrated.address = place.address;
  }
  if (place.contact) {
    hydrated.contact = place.contact;
  }
  if (place.searchTerms.length > 0) {
    hydrated.searchTerms = place.searchTerms;
  }
  return hydrated;
}
