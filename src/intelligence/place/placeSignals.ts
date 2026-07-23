/**
 * Recolector de SEÑALES (V5.8) — puro. Extrae UNA sola vez las señales
 * estructuradas ya presentes en `LocavoPlace` (categoría, subcategorías,
 * amenidades explícitas, nivel de precio, ventanas de horario, léxico de nombre,
 * presencia de contacto). No inventa nada; la ausencia queda como ausencia.
 */
import type { CategoryId } from '../../domain/place';
import type { LocavoPlace, PlaceFeatures } from '../../domain/places/LocavoPlace';
import { deriveHoursWindows, type HoursWindows } from './hoursWindows';
import { matchNameLexicon, type LexiconMatch } from './nameLexicon';

export interface PlaceSignals {
  readonly category: CategoryId;
  readonly secondaryCategories: readonly CategoryId[];
  readonly features: PlaceFeatures;
  readonly priceLevel: number | null;
  readonly hours: HoursWindows;
  readonly lexicon: readonly LexiconMatch[];
  readonly hasPhone: boolean;
  readonly hasWebsite: boolean;
}

export function collectPlaceSignals(place: LocavoPlace): PlaceSignals {
  return {
    category: place.category,
    secondaryCategories: place.secondaryCategories ?? [],
    features: place.features ?? {},
    priceLevel: place.price?.level ?? null,
    hours: deriveHoursWindows(place.hours),
    lexicon: matchNameLexicon(place.name),
    hasPhone: typeof place.contact?.phone === 'string' && place.contact.phone.trim().length > 0,
    hasWebsite: typeof place.contact?.website === 'string' && place.contact.website.trim().length > 0,
  };
}
