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
  readonly features: PlaceFeatures;
  readonly priceLevel: number | null;
  readonly hours: HoursWindows;
  readonly lexicon: readonly LexiconMatch[];
}

/**
 * V5.8.1: V5.8 usa intencionalmente SOLO la categoría canónica primaria. Las
 * categorías secundarias no se pueblan en el modelo de datos actual y usarlas
 * arriesgaría afirmaciones no sustentadas; se omiten de forma deliberada. El
 * contacto (teléfono/sitio) NO describe la experiencia: no entra en las señales
 * de inteligencia ni en la calidad de evidencia.
 */
export function collectPlaceSignals(place: LocavoPlace): PlaceSignals {
  return {
    category: place.category,
    features: place.features ?? {},
    priceLevel: place.price?.level ?? null,
    hours: deriveHoursWindows(place.hours),
    lexicon: matchNameLexicon(place.name),
  };
}
