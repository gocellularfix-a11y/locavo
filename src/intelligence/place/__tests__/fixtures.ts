/** Fábrica de lugares para pruebas de inteligencia (V5.8). No es una suite. */
import type { CategoryId, OpeningHours } from '../../../domain/place';
import type { LocavoPlace } from '../../../domain/places/LocavoPlace';

export function makePlace(over: Partial<LocavoPlace> & { id?: string; name?: string; category?: CategoryId } = {}): LocavoPlace {
  const name = over.name ?? 'Demo Place';
  return {
    id: 'p1',
    sourceRefs: {},
    name,
    normalizedName: name.toLowerCase(),
    category: 'food',
    coordinates: { latitude: 24.8069, longitude: -107.394 },
    verification: { status: 'unverified', confidence: 0.3 },
    provenance: [],
    status: { active: true },
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...over,
  } as LocavoPlace;
}

export function daily(open: string, close: string): OpeningHours {
  const day = [{ open, close }];
  return { weekly: [day, day, day, day, day, day, day] };
}

/** Horario semanal explícito (índice 0 = domingo). */
export function weekly(...days: OpeningHours['weekly']): OpeningHours {
  if (days.length !== 7) {
    throw new Error('weekly() requiere 7 días');
  }
  return { weekly: days };
}
