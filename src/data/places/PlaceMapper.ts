import type { CategoryId, DayHours, OpeningHours, TimeInterval } from '../../domain/place';
import type {
  ConfidenceLevel,
  LocavoPlace,
  PriceLevel,
} from '../../domain/places/LocavoPlace';
import { normalizeText } from '../../utils/text';

/**
 * Mapper de la semilla local (formato Fase 1) al modelo canónico V3.
 *
 * La semilla actúa como un "proveedor" más: igual que DENUE u OSM en el
 * futuro, sus registros se transforman a `LocavoPlace` con procedencia y
 * confianza explícitas. Ningún consumidor usa el formato de la semilla.
 */

export interface LegacySeedPlace {
  id: string;
  name: string;
  category: CategoryId;
  latitude: number;
  longitude: number;
  address: string;
  openingHours: OpeningHours | null;
  phone: string | null;
  website: string | null;
  priceLevel: 1 | 2 | 3 | null;
  source: string;
  lastVerifiedAt: string;
  confidence: ConfidenceLevel;
  keywords: string[];
  isDemo: boolean;
}

export type { DayHours, OpeningHours, TimeInterval };

/** Fecha fija de importación de la semilla (determinista para pruebas). */
export const SEED_IMPORTED_AT = '2026-07-01T00:00:00Z';

const CONFIDENCE_BY_LEVEL: Record<ConfidenceLevel, number> = {
  high: 0.9,
  medium: 0.6,
  low: 0.3,
};

export function seedToLocavoPlace(seed: LegacySeedPlace): LocavoPlace {
  return {
    id: `locavo-${seed.id}`,
    sourceRefs: {
      locavoId: seed.id,
    },
    name: seed.name,
    normalizedName: normalizeText(seed.name),
    category: seed.category,
    coordinates: {
      latitude: seed.latitude,
      longitude: seed.longitude,
    },
    address: {
      formatted: seed.address,
      locality: 'Culiacán',
      municipality: 'Culiacán',
      state: 'Sinaloa',
      countryCode: 'MX',
    },
    contact: {
      phone: seed.phone ?? undefined,
      website: seed.website ?? undefined,
    },
    hours: seed.openingHours ?? undefined,
    price: seed.priceLevel ? { level: seed.priceLevel as PriceLevel, currency: 'MXN' } : undefined,
    verification: {
      // La semilla es demostrativa: nunca se presenta como verificada.
      status: 'unverified',
      confidence: CONFIDENCE_BY_LEVEL[seed.confidence],
      lastVerifiedAt: seed.lastVerifiedAt,
    },
    provenance: [
      {
        source: 'mock',
        importedAt: SEED_IMPORTED_AT,
        updatedAt: seed.lastVerifiedAt,
      },
    ],
    status: { active: true },
    searchTerms: seed.keywords,
    createdAt: SEED_IMPORTED_AT,
    updatedAt: seed.lastVerifiedAt,
  };
}
