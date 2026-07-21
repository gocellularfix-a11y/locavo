import { LocalPlaceRepository } from '../../../data/places/LocalPlaceRepository';
import type { PlaceRepository } from '../../../data/places/PlaceRepository';
import type { TextPlaceQuery } from '../../../data/places/PlaceQuery';
import type { PlaceSearchResult } from '../../../data/places/PlaceSearchResult';
import { CULIACAN_CENTER } from '../../../data/places.mock';
import type { CategoryId } from '../../../domain/place';
import type { LocavoPlace } from '../../../domain/places/LocavoPlace';
import { normalizeText } from '../../../utils/text';
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

/**
 * Regresión V4D.1 — RANKING GLOBAL ANTES DE PAGINACIÓN.
 *
 * Defecto: el repositorio devuelve una página acotada por CERCANÍA (los 50
 * más próximos) ANTES de que el ranking de búsqueda vea los candidatos, de
 * modo que una coincidencia de nombre (exacta o de prefijo) más lejana que
 * esos 50 genéricos nunca llega a la primera página. El contrato de V4D exige
 * que el nombre supere a la distancia: la corrección debe reunir todos los
 * candidatos válidos, rankear globalmente y paginar DESPUÉS.
 *
 * Un único bloque parametrizado protege exacta y prefijo (misma ruta de
 * producción) más la integridad de paginación y el determinismo; no se
 * duplican escenarios ya cubiertos (acentos, ñ, 7 idiomas, open-now, fallback).
 */
function synthPlace(opts: {
  id: string;
  name: string;
  km: number;
  category?: CategoryId;
  terms?: string[];
}): LocavoPlace {
  const latOffset = opts.km / 111.32; // desplazamiento norte aproximado en km
  return {
    id: opts.id,
    sourceRefs: { denueId: `denue-${opts.id}` },
    name: opts.name,
    normalizedName: normalizeText(opts.name),
    category: opts.category ?? 'food',
    coordinates: { latitude: ORIGIN.latitude + latOffset, longitude: ORIGIN.longitude },
    verification: { status: 'source_verified', confidence: 0.6 },
    provenance: [{ source: 'denue' }],
    status: { active: true },
    ...(opts.terms ? { searchTerms: opts.terms } : {}),
    createdAt: '2026-07-01T00:00:00.000Z',
    updatedAt: '2026-07-01T00:00:00.000Z',
  };
}

/**
 * 50 genéricos que coinciden con "taco" SOLO por término (searchTerms), muy
 * cercanos, + 1 coincidencia por NOMBRE deliberadamente lejana (51.ª por
 * cercanía). Bajo el defecto, la coincidencia de nombre queda fuera de los 50
 * más cercanos y no puede aparecer primera en la página 1.
 */
function corpusWithFarNameMatch(far: LocavoPlace): LocavoPlace[] {
  const generic = Array.from({ length: 50 }, (_, i) =>
    synthPlace({
      id: `generic-${String(i).padStart(2, '0')}`,
      name: `COCINA ${String(i).padStart(2, '0')}`, // el nombre NO contiene "taco"
      km: 0.1 + i * 0.02, // 0.10 .. 1.08 km → los 50 más cercanos
      terms: ['taco'], // coincide por término, no por nombre
    }),
  );
  return [far, ...generic]; // orden de inserción irrelevante (se comprueba determinismo)
}

/**
 * Repositorio que pagina un conjunto de coincidencias en páginas de `limit` y
 * cuenta las llamadas a `searchText`. Modela el contrato real de paginación por
 * cursor para probar que `collectAllTextCandidates` recorre TODAS las páginas.
 * Todos los lugares dados coinciden con la consulta por construcción.
 */
class PagingRepository implements PlaceRepository {
  calls = 0;
  constructor(private readonly matches: LocavoPlace[]) {}
  async getById(): Promise<LocavoPlace | null> {
    return null;
  }
  async searchNearby(): Promise<PlaceSearchResult> {
    return { places: [], total: 0 };
  }
  async listByCategory(): Promise<PlaceSearchResult> {
    return { places: [], total: 0 };
  }
  async searchText(query: TextPlaceQuery): Promise<PlaceSearchResult> {
    this.calls += 1;
    const limit = query.limit ?? 50;
    const offset = query.cursor ? Number.parseInt(query.cursor, 10) || 0 : 0;
    const page = this.matches.slice(offset, offset + limit);
    const nextOffset = offset + page.length;
    return {
      places: page,
      total: this.matches.length,
      nextCursor: nextOffset < this.matches.length ? String(nextOffset) : undefined,
    };
  }
}

describe('ranking global antes de paginación (regresión V4D.1)', () => {
  const FAR_KM = 6; // más lejos que cualquier genérico (máx 1.08 km)
  const nameMatchCases = [
    { kind: 'exacta', far: synthPlace({ id: 'far', name: 'TACO', km: FAR_KM }) },
    { kind: 'prefijo', far: synthPlace({ id: 'far', name: 'TACO PALACE', km: FAR_KM }) },
  ];

  it.each(nameMatchCases)(
    'coincidencia de nombre $kind más lejana que los 50 más cercanos aparece primera en la página 1',
    async ({ far }) => {
      const service = new PlaceSearchService(
        new LocalPlaceRepository(corpusWithFarNameMatch(far)),
        new FakeAnalytics(),
      );
      const { results } = await service.search({ origin: ORIGIN, text: 'taco' });
      expect(results[0]?.place.id).toBe('far');
      expect(results.length).toBeLessThanOrEqual(50);
    },
  );

  it('pagina resultados YA ordenados: página 1 llena, sin duplicados ni pérdidas', async () => {
    const service = new PlaceSearchService(
      new LocalPlaceRepository(corpusWithFarNameMatch(synthPlace({ id: 'far', name: 'TACO', km: FAR_KM }))),
      new FakeAnalytics(),
    );
    const p1 = await service.search({ origin: ORIGIN, text: 'taco' });
    expect(p1.results.length).toBe(50);
    expect(p1.results[0]?.place.id).toBe('far'); // el nombre supera la distancia
    expect(p1.nextCursor).toBeDefined();

    const p2 = await service.search({ origin: ORIGIN, text: 'taco', cursor: p1.nextCursor });
    const ids1 = p1.results.map((r) => r.place.id);
    const ids2 = p2.results.map((r) => r.place.id);
    expect(new Set([...ids1, ...ids2]).size).toBe(51); // 51 únicos: nada perdido ni duplicado
    expect(p2.nextCursor).toBeUndefined();
  });

  it('orden determinista entre ejecuciones', async () => {
    const run = async () =>
      (
        await new PlaceSearchService(
          new LocalPlaceRepository(
            corpusWithFarNameMatch(synthPlace({ id: 'far', name: 'TACO', km: FAR_KM })),
          ),
          new FakeAnalytics(),
        ).search({ origin: ORIGIN, text: 'taco' })
      ).results.map((r) => r.place.id);
    expect(await run()).toEqual(await run());
  });

  // Requerido por la auditoría independiente: prueba que la reunión de
  // candidatos recorre TODAS las páginas del repositorio (no solo la primera),
  // condición necesaria para que el ranking global sea completo.
  it('reúne todos los candidatos a través de múltiples páginas del repositorio (50/50/10 → 110)', async () => {
    const matches = Array.from({ length: 110 }, (_, i) =>
      synthPlace({
        id: `p-${String(i).padStart(3, '0')}`,
        name: `COCINA ${String(i).padStart(3, '0')}`,
        km: 0.1 + i * 0.01,
        terms: ['taco'],
      }),
    );
    const repo = new PagingRepository(matches);
    const service = new PlaceSearchService(repo, new FakeAnalytics());
    // pageSize amplio para observar el conjunto reunido completo en una respuesta.
    const { results } = await service.search({ origin: ORIGIN, text: 'taco', limit: 200 });
    expect(repo.calls).toBe(3); // 50 + 50 + 10: recorrió las tres páginas
    expect(results).toHaveLength(110); // ninguno perdido
    expect(new Set(results.map((r) => r.place.id)).size).toBe(110); // sin duplicados
  });
});
