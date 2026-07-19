import { isEligiblePlace, selectSurprisePlace, SurprisePlaceService } from '../surprise';
import { LocalPlaceRepository } from '../../../data/places/LocalPlaceRepository';
import type { CategoryId } from '../../../domain/place';
import type { LocavoPlace } from '../../../domain/places/LocavoPlace';

/**
 * Horario 24 h (open === close cruza medianoche → siempre abierto) y
 * "cerrado todos los días" ([]): ambos son independientes de la zona horaria
 * de la máquina de pruebas.
 */
const ALWAYS_OPEN = { weekly: Array(7).fill([{ open: '00:00', close: '00:00' }]) };
const ALWAYS_CLOSED = { weekly: Array(7).fill([]) };

/** 09:00 hora LOCAL del dispositivo → franja 'morning' (café/comida/farmacia). */
const MORNING = new Date(2026, 6, 15, 9, 0, 0, 0);

const CULIACAN = { latitude: 24.8069, longitude: -107.394 };

let counter = 0;

function makePlace(overrides: Partial<LocavoPlace> & { category?: CategoryId } = {}): LocavoPlace {
  counter += 1;
  const id = overrides.id ?? `place-${counter}`;
  return {
    id,
    sourceRefs: {},
    name: `Demo ${id}`,
    normalizedName: `demo ${id}`,
    category: 'food',
    coordinates: { latitude: 24.8069, longitude: -107.394 },
    verification: { status: 'unverified', confidence: 0.5 },
    provenance: [{ source: 'mock' }],
    status: { active: true },
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

/** Fuente aleatoria determinista (LCG) para pruebas reproducibles. */
function seededRandom(seed: number): () => number {
  let s = seed % 2147483647;
  if (s <= 0) {
    s += 2147483646;
  }
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

describe('isEligiblePlace (modelo canónico)', () => {
  it('excluye inactivos y cerrados temporal o permanentemente', () => {
    expect(isEligiblePlace(makePlace())).toBe(true);
    expect(isEligiblePlace(makePlace({ status: { active: false } }))).toBe(false);
    expect(
      isEligiblePlace(makePlace({ status: { active: true, temporarilyClosed: true } })),
    ).toBe(false);
    expect(
      isEligiblePlace(makePlace({ status: { active: true, permanentlyClosed: true } })),
    ).toBe(false);
  });
});

describe('selectSurprisePlace (selector puro)', () => {
  it('solo elige lugares elegibles; sin elegibles devuelve null', () => {
    const hidden = [
      makePlace({ id: 'inactive', status: { active: false } }),
      makePlace({ id: 'temp', status: { active: true, temporarilyClosed: true } }),
      makePlace({ id: 'perm', status: { active: true, permanentlyClosed: true } }),
    ];
    expect(selectSurprisePlace(hidden, { now: MORNING, random: seededRandom(1) })).toBeNull();

    const eligible = makePlace({ id: 'ok' });
    const result = selectSurprisePlace([...hidden, eligible], {
      now: MORNING,
      random: seededRandom(1),
    });
    expect(result?.id).toBe('ok');
  });

  it('respeta las categorías preferidas de la franja (mañana → café antes que tienda)', () => {
    const coffee = makePlace({ id: 'coffee', category: 'coffee' });
    const store = makePlace({ id: 'store', category: 'store' });
    for (let seed = 1; seed <= 20; seed += 1) {
      const result = selectSurprisePlace([store, coffee], {
        now: MORNING,
        random: seededRandom(seed),
      });
      expect(result?.id).toBe('coffee');
    }
  });

  it('funciona sin ubicación (permiso denegado → origen nulo)', () => {
    const places = [makePlace({ id: 'a', category: 'coffee' }), makePlace({ id: 'b', category: 'food' })];
    const result = selectSurprisePlace(places, {
      now: MORNING,
      origin: null,
      random: seededRandom(7),
    });
    expect(result).not.toBeNull();
    expect(['a', 'b']).toContain(result?.id);
  });

  it('funciona sin datos de horario (no exige "abierto" inventado)', () => {
    const noHours = makePlace({ id: 'no-hours', category: 'food', hours: undefined });
    const result = selectSurprisePlace([noHours], { now: MORNING, random: seededRandom(3) });
    expect(result?.id).toBe('no-hours');
  });

  it('prefiere abiertos SOLO cuando hay horarios reales que lo confirman', () => {
    const open = makePlace({ id: 'open', category: 'coffee', hours: ALWAYS_OPEN });
    const closed = makePlace({ id: 'closed', category: 'coffee', hours: ALWAYS_CLOSED });
    for (let seed = 1; seed <= 20; seed += 1) {
      const result = selectSurprisePlace([closed, open], {
        now: MORNING,
        random: seededRandom(seed),
      });
      expect(result?.id).toBe('open');
    }
  });

  it('categoría preferida vacía → usa el resto de lugares elegibles (fallback)', () => {
    // Mañana prefiere café/comida/farmacia; solo hay tiendas.
    const stores = [makePlace({ id: 's1', category: 'store' }), makePlace({ id: 's2', category: 'store' })];
    const result = selectSurprisePlace(stores, { now: MORNING, random: seededRandom(5) });
    expect(result).not.toBeNull();
    expect(result?.category).toBe('store');
  });

  it('no repite el resultado anterior de inmediato cuando hay alternativas', () => {
    const a = makePlace({ id: 'a', category: 'coffee' });
    const b = makePlace({ id: 'b', category: 'coffee' });
    for (let seed = 1; seed <= 20; seed += 1) {
      const result = selectSurprisePlace([a, b], {
        now: MORNING,
        previousPlaceId: 'a',
        random: seededRandom(seed),
      });
      expect(result?.id).toBe('b');
    }
    // Con una sola opción sí puede repetir (mejor que fallar).
    const only = selectSurprisePlace([a], {
      now: MORNING,
      previousPlaceId: 'a',
      random: seededRandom(1),
    });
    expect(only?.id).toBe('a');
  });

  it('no exige calificaciones: un lugar mínimo del modelo canónico es elegible', () => {
    // Sin hours, sin contact, sin price, sin features: nada inventado.
    const minimal = makePlace({ id: 'minimal', category: 'food' });
    expect((minimal as unknown as Record<string, unknown>).rating).toBeUndefined();
    const result = selectSurprisePlace([minimal], { now: MORNING, random: seededRandom(2) });
    expect(result?.id).toBe('minimal');
  });

  it('es determinista con una fuente aleatoria sembrada', () => {
    const places = [
      makePlace({ id: 'p1', category: 'coffee', coordinates: { latitude: 24.81, longitude: -107.39 } }),
      makePlace({ id: 'p2', category: 'food', coordinates: { latitude: 24.79, longitude: -107.4 } }),
      makePlace({ id: 'p3', category: 'pharmacy', coordinates: { latitude: 24.82, longitude: -107.41 } }),
    ];
    const pick = () =>
      selectSurprisePlace(places, { now: MORNING, origin: CULIACAN, random: seededRandom(42) })?.id;
    const first = pick();
    for (let i = 0; i < 10; i += 1) {
      expect(pick()).toBe(first);
    }
  });
});

describe('SurprisePlaceService (repositorio local activo)', () => {
  it('usa el repositorio y evita repetir el último resultado de la sesión', async () => {
    const a = makePlace({ id: 'a', category: 'coffee' });
    const b = makePlace({ id: 'b', category: 'coffee' });
    const service = new SurprisePlaceService(new LocalPlaceRepository([a, b]));

    const first = await service.surprise({ origin: CULIACAN, now: MORNING, random: seededRandom(9) });
    const second = await service.surprise({ origin: CULIACAN, now: MORNING, random: seededRandom(9) });
    expect(first).not.toBeNull();
    expect(second).not.toBeNull();
    expect(second?.id).not.toBe(first?.id);
  });

  it('sin resultados en categorías de la franja → busca en el entorno (fallback)', async () => {
    // Mañana prefiere café/comida/farmacia; el repositorio solo tiene tiendas.
    const store = makePlace({ id: 'only-store', category: 'store' });
    const service = new SurprisePlaceService(new LocalPlaceRepository([store]));
    const result = await service.surprise({ origin: CULIACAN, now: MORNING, random: seededRandom(4) });
    expect(result?.id).toBe('only-store');
  });

  it('repositorio vacío → null (la UI ofrece el fallback localizado hacia Explorar)', async () => {
    const service = new SurprisePlaceService(new LocalPlaceRepository([]));
    const result = await service.surprise({ origin: CULIACAN, now: MORNING, random: seededRandom(4) });
    expect(result).toBeNull();
  });

  it('funciona con la semilla real del repositorio local por defecto', async () => {
    const service = new SurprisePlaceService(new LocalPlaceRepository());
    const result = await service.surprise({ origin: CULIACAN, now: MORNING, random: seededRandom(11) });
    expect(result).not.toBeNull();
    expect(result?.status.active).toBe(true);
  });
});
