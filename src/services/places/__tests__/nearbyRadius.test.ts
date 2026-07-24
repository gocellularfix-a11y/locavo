import { LocalPlaceRepository } from '../../../data/places/LocalPlaceRepository';
import { CULIACAN_CENTER } from '../../../data/places.mock';
import { haversineKm } from '../../../domain/distance';
import type { Coordinates } from '../../../domain/place';
import type { LocavoPlace } from '../../../domain/places/LocavoPlace';
import type { AnalyticsEvent, AnalyticsEventInput, AnalyticsService } from '../../analytics';
import {
  DEFAULT_NEARBY_RADIUS_M,
  decodeNearbyCursor,
  encodeNearbyCursor,
  GLOBAL_RADIUS_M,
  isExpandedRadius,
  NEARBY_RADIUS_LADDER_M,
  plainCursorOf,
  searchWithExpandingRadius,
} from '../nearbyRadius';
import { PlaceSearchService } from '../PlaceSearchService';

/** Usuario a ~1,600 km del pack de Culiacán. */
const SANTA_BARBARA: Coordinates = { latitude: 34.4208, longitude: -119.6982 };

class SilentAnalytics implements AnalyticsService {
  async track(_event: AnalyticsEventInput): Promise<void> {}
  async getEvents(): Promise<AnalyticsEvent[]> {
    return [];
  }
  async clear(): Promise<void> {}
}

function makeService(places?: LocavoPlace[]) {
  return new PlaceSearchService(new LocalPlaceRepository(places), new SilentAnalytics());
}

/** Lugares reales de Culiacán, suficientes para exigir más de una página. */
function culiacanPlaces(count: number): LocavoPlace[] {
  return Array.from({ length: count }, (_unused, i) => ({
    id: `culiacan-${String(i).padStart(3, '0')}`,
    sourceRefs: { denueId: `D${i}` },
    name: `Lugar ${i}`,
    normalizedName: `lugar ${i}`,
    category: 'food' as const,
    coordinates: {
      latitude: CULIACAN_CENTER.latitude + i * 0.001,
      longitude: CULIACAN_CENTER.longitude,
    },
    verification: { status: 'source_verified' as const, confidence: 0.6 },
    provenance: [{ source: 'denue' as const, importedAt: '2026-07-01T00:00:00.000Z' }],
    status: { active: true },
    createdAt: '2026-07-01T00:00:00.000Z',
    updatedAt: '2026-07-01T00:00:00.000Z',
  }));
}

describe('escalera de radio', () => {
  it('es creciente, empieza en el entorno inmediato y termina cubriendo la Tierra', () => {
    expect(NEARBY_RADIUS_LADDER_M[0]).toBe(DEFAULT_NEARBY_RADIUS_M);
    expect(NEARBY_RADIUS_LADDER_M[NEARBY_RADIUS_LADDER_M.length - 1]).toBe(GLOBAL_RADIUS_M);
    for (let i = 1; i < NEARBY_RADIUS_LADDER_M.length; i++) {
      expect(NEARBY_RADIUS_LADDER_M[i]).toBeGreaterThan(NEARBY_RADIUS_LADDER_M[i - 1]);
    }
    // El último escalón alcanza cualquier distancia real del planeta.
    expect(GLOBAL_RADIUS_M / 1000).toBeGreaterThan(20_015);
  });

  it('solo el radio base cuenta como "entorno inmediato"', () => {
    expect(isExpandedRadius(DEFAULT_NEARBY_RADIUS_M)).toBe(false);
    expect(isExpandedRadius(DEFAULT_NEARBY_RADIUS_M + 1)).toBe(true);
  });

  it('se detiene en el PRIMER escalón con resultados', async () => {
    const probed: number[] = [];
    const outcome = await searchWithExpandingRadius(
      async (radiusMeters) => {
        probed.push(radiusMeters);
        return radiusMeters >= 500_000 ? ['algo'] : [];
      },
      (value) => value.length > 0,
    );
    expect(outcome.radiusMeters).toBe(500_000);
    expect(outcome.expanded).toBe(true);
    expect(probed).toEqual([20_000, 100_000, 500_000]);
  });

  it('no amplía cuando el radio base ya tiene resultados', async () => {
    const probed: number[] = [];
    const outcome = await searchWithExpandingRadius(
      async (radiusMeters) => {
        probed.push(radiusMeters);
        return ['algo'];
      },
      (value) => value.length > 0,
    );
    expect(probed).toEqual([DEFAULT_NEARBY_RADIUS_M]);
    expect(outcome.expanded).toBe(false);
  });

  it('sin resultados en ningún escalón devuelve vacío honesto, no candidatos inventados', async () => {
    const outcome = await searchWithExpandingRadius(
      async () => [] as string[],
      (value) => value.length > 0,
    );
    expect(outcome.value).toEqual([]);
    expect(outcome.radiusMeters).toBe(GLOBAL_RADIUS_M);
  });

  it('es determinista: la misma sonda produce el mismo escalón', async () => {
    const probe = async (radiusMeters: number) => (radiusMeters >= 100_000 ? ['x'] : []);
    const a = await searchWithExpandingRadius(probe, (v) => v.length > 0);
    const b = await searchWithExpandingRadius(probe, (v) => v.length > 0);
    expect(b).toEqual(a);
  });
});

describe('cursor compuesto del entorno', () => {
  it('conserva el radio elegido entre páginas', () => {
    const cursor = encodeNearbyCursor(500_000, '50');
    expect(decodeNearbyCursor(cursor)).toEqual({ radiusMeters: 500_000, cursor: '50' });
  });

  it('un cursor plano de otra rama se respeta con el radio base', () => {
    expect(decodeNearbyCursor('50')).toEqual({ radiusMeters: null, cursor: '50' });
    expect(decodeNearbyCursor(undefined)).toEqual({ radiusMeters: null });
  });

  it('el repositorio siempre recibe el cursor que entiende', () => {
    expect(plainCursorOf(encodeNearbyCursor(2_500_000, '20'))).toBe('20');
    expect(plainCursorOf('20')).toBe('20');
    expect(plainCursorOf(undefined)).toBeUndefined();
  });
});

describe('exploración desde muy lejos (Santa Bárbara → Culiacán)', () => {
  it('amplía el radio en vez de devolver una lista vacía', async () => {
    const service = makeService();
    const nearUser = await service.search({ origin: SANTA_BARBARA });

    expect(nearUser.results.length).toBeGreaterThan(0);
    expect(nearUser.notice).toBe('NO_NEARBY_RESULTS');
  });

  it('las distancias mostradas son las reales, no las del centro de la ciudad', async () => {
    const service = makeService();
    const { results } = await service.search({ origin: SANTA_BARBARA });

    for (const scored of results) {
      const real = haversineKm(SANTA_BARBARA, scored.place.coordinates);
      expect(scored.distanceKm).toBeCloseTo(real, 3);
      // ~1,600 km: jamás la distancia desde el centro de Culiacán.
      expect(scored.distanceKm).toBeGreaterThan(1400);
    }
  });

  it('cerca de la ciudad NO se amplía ni se avisa', async () => {
    const service = makeService();
    const { results, notice } = await service.search({ origin: CULIACAN_CENTER });
    expect(results.length).toBeGreaterThan(0);
    expect(notice).toBeUndefined();
  });

  it('la paginación mantiene el mismo radio ampliado y no repite lugares', async () => {
    // Más lugares que el tamaño de página del repositorio → hay segunda página.
    const service = makeService(culiacanPlaces(60));
    const first = await service.search({ origin: SANTA_BARBARA });
    expect(first.nextCursor).toBeDefined();
    // El cursor fija el radio ampliado para las páginas siguientes.
    expect(decodeNearbyCursor(first.nextCursor).radiusMeters).toBeGreaterThan(
      DEFAULT_NEARBY_RADIUS_M,
    );

    const second = await service.search({ origin: SANTA_BARBARA, cursor: first.nextCursor });
    expect(second.results.length).toBeGreaterThan(0);
    const firstIds = first.results.map((r) => r.place.id);
    const secondIds = second.results.map((r) => r.place.id);
    expect(secondIds.some((id) => firstIds.includes(id))).toBe(false);
    expect(second.notice).toBe('NO_NEARBY_RESULTS');
  });

  it('los resultados son deterministas para el mismo origen', async () => {
    const service = makeService();
    const a = await service.search({ origin: SANTA_BARBARA });
    const b = await service.search({ origin: SANTA_BARBARA });
    expect(b.results.map((r) => r.place.id)).toEqual(a.results.map((r) => r.place.id));
  });
});
