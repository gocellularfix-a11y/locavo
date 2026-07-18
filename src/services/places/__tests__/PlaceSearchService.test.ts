import { LocalPlaceRepository } from '../../../data/places/LocalPlaceRepository';
import type { PlaceRepository } from '../../../data/places/PlaceRepository';
import { CULIACAN_CENTER } from '../../../data/places.mock';
import type { AnalyticsEvent, AnalyticsEventInput, AnalyticsService } from '../../analytics';
import { PlaceSearchService } from '../PlaceSearchService';

class FakeAnalytics implements AnalyticsService {
  events: AnalyticsEventInput[] = [];
  async track(event: AnalyticsEventInput): Promise<void> {
    this.events.push(event);
  }
  async getEvents(): Promise<AnalyticsEvent[]> {
    return [];
  }
  async clear(): Promise<void> {
    this.events = [];
  }
  names(): string[] {
    return this.events.map((e) => e.eventName);
  }
}

const ORIGIN = CULIACAN_CENTER;

describe('PlaceSearchService', () => {
  it('búsqueda general devuelve resultados ordenados y registra telemetría', async () => {
    const analytics = new FakeAnalytics();
    const service = new PlaceSearchService(new LocalPlaceRepository(), analytics);
    const { results } = await service.search({ origin: ORIGIN });
    expect(results.length).toBeGreaterThan(0);
    expect(analytics.names()).toEqual(['place_search_started', 'place_search_completed']);
    // La telemetría no incluye coordenadas del usuario.
    for (const event of analytics.events) {
      expect(JSON.stringify(event)).not.toContain(String(ORIGIN.latitude));
    }
  });

  it('sin coincidencias → place_search_empty', async () => {
    const analytics = new FakeAnalytics();
    const service = new PlaceSearchService(new LocalPlaceRepository(), analytics);
    const { results } = await service.search({ origin: ORIGIN, text: 'zzz-nada' });
    expect(results).toEqual([]);
    expect(analytics.names()).toEqual(['place_search_started', 'place_search_empty']);
  });

  it('filtra por categoría y por abierto ahora', async () => {
    const analytics = new FakeAnalytics();
    const service = new PlaceSearchService(new LocalPlaceRepository(), analytics);
    const { results } = await service.search({ origin: ORIGIN, category: 'pharmacy' });
    expect(results.every((r) => r.place.category === 'pharmacy')).toBe(true);
    const open = await service.search({ origin: ORIGIN, openNow: true });
    expect(open.results.every((r) => r.status.state === 'open')).toBe(true);
  });

  it('orden por distancia cuando se pide', async () => {
    const analytics = new FakeAnalytics();
    const service = new PlaceSearchService(new LocalPlaceRepository(), analytics);
    const { results } = await service.search({ origin: ORIGIN, sort: 'distance' });
    const distances = results.map((r) => r.distanceKm);
    expect(distances).toEqual([...distances].sort((a, b) => a - b));
  });

  it('error del repositorio → repository_error y rethrow (la UI muestra su error)', async () => {
    const analytics = new FakeAnalytics();
    const broken: PlaceRepository = {
      getById: async () => {
        throw new Error('boom');
      },
      searchNearby: async () => {
        throw new Error('boom');
      },
      searchText: async () => {
        throw new Error('boom');
      },
      listByCategory: async () => {
        throw new Error('boom');
      },
    };
    const service = new PlaceSearchService(broken, analytics);
    await expect(service.search({ origin: ORIGIN })).rejects.toThrow('boom');
    expect(analytics.names()).toEqual(['place_search_started', 'repository_error']);
    await expect(service.getById('x')).rejects.toThrow('boom');
    expect(analytics.names()).toContain('repository_error');
  });
});
