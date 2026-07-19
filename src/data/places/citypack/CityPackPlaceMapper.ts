import type { CityPackPlace } from '../../import/denue/CityPackBuilder';
import type {
  LocavoPlace,
  PlaceSourceRefs,
  PlaceVerification,
} from '../../../domain/places/LocavoPlace';

/**
 * Hidratación CityPackPlace (DTO canónico del pack) → LocavoPlace (modelo
 * de runtime). Neutral al proveedor: la verificación se deriva de la
 * procedencia declarada en sources[], nunca de lógica DENUE incrustada.
 *
 * No se inventa nada: sin horarios, sin precios, sin calificaciones. Las
 * marcas de tiempo derivan de la edición oficial del dato (deterministas).
 */

const PROVIDER_VERIFICATION: Record<string, Pick<PlaceVerification, 'status' | 'confidence'>> = {
  // Mismos valores que la importación V4B (fuente oficial → source_verified).
  denue: { status: 'source_verified', confidence: 0.6 },
};

const DEFAULT_VERIFICATION: Pick<PlaceVerification, 'status' | 'confidence'> = {
  status: 'unverified',
  confidence: 0.3,
};

function editionTimestamp(edition: string): string {
  // La edición llega como fecha oficial (p. ej. 2026-07-01).
  return /^\d{4}-\d{2}-\d{2}$/.test(edition) ? `${edition}T00:00:00.000Z` : edition;
}

export function cityPackPlaceToLocavoPlace(place: CityPackPlace): LocavoPlace {
  const primary = place.sources[0];
  const denue = place.sources.find((s) => s.provider === 'denue');

  const sourceRefs: PlaceSourceRefs = {};
  if (denue) {
    sourceRefs.denueId = denue.externalId;
    if (denue.clee) {
      sourceRefs.clee = denue.clee;
    }
  }

  const verification = PROVIDER_VERIFICATION[primary?.provider ?? ''] ?? DEFAULT_VERIFICATION;
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
      source: source.provider,
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
