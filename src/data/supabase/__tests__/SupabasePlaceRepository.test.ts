import type { CloudRpcTransport } from '../client';
import { CloudRepositoryError } from '../errors';
import { SupabasePlaceRepository } from '../SupabasePlaceRepository';
import { InvalidPlaceQueryError } from '../../places/PlaceQuery';

const ORIGIN = { latitude: 24.8069, longitude: -107.394 };

function placeRow(id: string, name = 'Demo Lugar') {
  return {
    place: {
      id,
      name,
      normalizedName: name.toLowerCase(),
      category: 'food',
      coordinates: { latitude: 24.8079, longitude: -107.3958 },
      verification: { status: 'unverified', confidence: 0.5 },
      provenance: [{ source: 'mock' }],
      status: { active: true },
      createdAt: '2026-07-01T00:00:00Z',
      updatedAt: '2026-07-01T00:00:00Z',
    },
    distance_m: 100,
    total: 1,
  };
}

function fakeTransport(
  handler: (fn: string, params: Record<string, unknown>) => { data: unknown; error: { message: string } | null },
): CloudRpcTransport & { calls: { fn: string; params: Record<string, unknown> }[] } {
  const calls: { fn: string; params: Record<string, unknown> }[] = [];
  return {
    calls,
    async rpc(fn, params) {
      calls.push({ fn, params });
      return handler(fn, params);
    },
  };
}

describe('SupabasePlaceRepository', () => {
  it('getById mapea la fila y devuelve null cuando no existe', async () => {
    const transport = fakeTransport(() => ({ data: [placeRow('uuid-1')], error: null }));
    const repo = new SupabasePlaceRepository(transport);
    const place = await repo.getById('uuid-1');
    expect(place?.id).toBe('uuid-1');

    const empty = new SupabasePlaceRepository(fakeTransport(() => ({ data: [], error: null })));
    await expect(empty.getById('nope')).resolves.toBeNull();
    await expect(empty.getById('')).resolves.toBeNull();
  });

  it('searchNearby envía parámetros validados y pagina de forma estable', async () => {
    const rows = [1, 2, 3].map((n) => ({ ...placeRow(`uuid-${n}`), total: 10 }));
    const transport = fakeTransport(() => ({ data: rows, error: null }));
    const repo = new SupabasePlaceRepository(transport);
    const result = await repo.searchNearby({ ...ORIGIN, radiusMeters: 2000, limit: 3 });
    expect(result.places).toHaveLength(3);
    expect(result.total).toBe(10);
    expect(result.nextCursor).toBe('3');
    expect(transport.calls[0].fn).toBe('places_nearby');
    expect(transport.calls[0].params).toMatchObject({
      p_lat: ORIGIN.latitude,
      p_lng: ORIGIN.longitude,
      p_radius_m: 2000,
      p_limit: 3,
      p_offset: 0,
    });

    await repo.searchNearby({ ...ORIGIN, radiusMeters: 2000, limit: 3, cursor: '3' });
    expect(transport.calls[1].params).toMatchObject({ p_offset: 3 });
  });

  it('consultas inválidas fallan ANTES de tocar la red', async () => {
    const transport = fakeTransport(() => ({ data: [], error: null }));
    const repo = new SupabasePlaceRepository(transport);
    await expect(
      repo.searchNearby({ latitude: 999, longitude: 0, radiusMeters: 2000 }),
    ).rejects.toThrow(InvalidPlaceQueryError);
    await expect(repo.searchText({ text: '   ' })).rejects.toThrow(InvalidPlaceQueryError);
    expect(transport.calls).toHaveLength(0);
  });

  it('searchText normaliza la consulta (acentos/mayúsculas) antes de enviarla', async () => {
    const transport = fakeTransport(() => ({ data: [], error: null }));
    const repo = new SupabasePlaceRepository(transport);
    const result = await repo.searchText({ text: '  CAFÉ  Río ' });
    expect(result.places).toEqual([]);
    expect(transport.calls[0].params.p_query).toBe('cafe rio');
  });

  it('listByCategory valida la categoría y pasa el origen opcional', async () => {
    const transport = fakeTransport(() => ({ data: [placeRow('uuid-9')], error: null }));
    const repo = new SupabasePlaceRepository(transport);
    await repo.listByCategory('pharmacy', { ...ORIGIN });
    expect(transport.calls[0].params).toMatchObject({ p_category: 'pharmacy', p_lat: ORIGIN.latitude });
    await expect(
      repo.listByCategory('casino' as never),
    ).rejects.toThrow(CloudRepositoryError);
  });

  it('error de la RPC → CLOUD_QUERY_FAILED', async () => {
    const repo = new SupabasePlaceRepository(
      fakeTransport(() => ({ data: null, error: { message: 'INVALID_QUERY: radio' } })),
    );
    await expect(repo.searchNearby({ ...ORIGIN, radiusMeters: 2000 })).rejects.toMatchObject({
      code: 'CLOUD_QUERY_FAILED',
    });
  });

  it('falla de red → CLOUD_REPOSITORY_UNAVAILABLE', async () => {
    const transport: CloudRpcTransport = {
      rpc: async () => {
        throw new Error('network down');
      },
    };
    const repo = new SupabasePlaceRepository(transport);
    await expect(repo.searchNearby({ ...ORIGIN, radiusMeters: 2000 })).rejects.toMatchObject({
      code: 'CLOUD_REPOSITORY_UNAVAILABLE',
    });
  });

  it('respuesta malformada → INVALID_CLOUD_RESPONSE; filas corruptas se descartan', async () => {
    const bad = new SupabasePlaceRepository(
      fakeTransport(() => ({ data: { nope: true }, error: null })),
    );
    await expect(bad.searchNearby({ ...ORIGIN, radiusMeters: 2000 })).rejects.toMatchObject({
      code: 'INVALID_CLOUD_RESPONSE',
    });

    const mixed = new SupabasePlaceRepository(
      fakeTransport(() => ({
        data: [placeRow('uuid-ok'), { place: { id: 'sin-nombre' }, total: 2 }],
        error: null,
      })),
    );
    const result = await mixed.searchNearby({ ...ORIGIN, radiusMeters: 2000 });
    expect(result.places.map((p) => p.id)).toEqual(['uuid-ok']);
  });

  it('resultados vacíos → PlaceSearchResult estable sin cursor', async () => {
    const repo = new SupabasePlaceRepository(fakeTransport(() => ({ data: [], error: null })));
    const result = await repo.searchText({ text: 'nada' });
    expect(result).toEqual({ places: [], total: 0, nextCursor: undefined });
  });
});
