import { CULIACAN_CENTER, MOCK_PLACES } from '../../places.mock';
import { haversineKm } from '../../../domain/distance';
import { CATEGORIES } from '../../../domain/categories';
import { LocalPlaceRepository } from '../LocalPlaceRepository';
import { InvalidPlaceQueryError } from '../PlaceQuery';

const repo = new LocalPlaceRepository();
const ORIGIN = CULIACAN_CENTER;

describe('LocalPlaceRepository', () => {
  it('getById encuentra por locavoPlaceId y devuelve null si no existe', async () => {
    const place = await repo.getById('locavo-food-centro-01');
    expect(place?.name).toBe('Demo Taquería Centro');
    await expect(repo.getById('no-existe')).resolves.toBeNull();
  });

  it('searchNearby respeta el radio y ordena por distancia', async () => {
    const near = await repo.searchNearby({ ...ORIGIN, radiusMeters: 1000, limit: 50 });
    expect(near.places.length).toBeGreaterThan(0);
    for (const place of near.places) {
      expect(haversineKm(ORIGIN, place.coordinates) * 1000).toBeLessThanOrEqual(1000);
    }
    const distances = near.places.map((p) => haversineKm(ORIGIN, p.coordinates));
    expect(distances).toEqual([...distances].sort((a, b) => a - b));
  });

  it('searchNearby filtra por categorías y openNow sin lanzar', async () => {
    const beers = await repo.searchNearby({
      ...ORIGIN,
      radiusMeters: 20_000,
      categories: ['beer'],
    });
    expect(beers.places.every((p) => p.category === 'beer')).toBe(true);
    const open = await repo.searchNearby({ ...ORIGIN, radiusMeters: 20_000, openNow: true });
    expect(open.places.length).toBeLessThanOrEqual(MOCK_PLACES.length);
  });

  it('searchNearby con consulta inválida lanza InvalidPlaceQueryError', async () => {
    await expect(
      repo.searchNearby({ latitude: NaN, longitude: 0, radiusMeters: 1000 }),
    ).rejects.toThrow(InvalidPlaceQueryError);
  });

  it('searchText encuentra por texto y ordena por distancia al origen', async () => {
    const result = await repo.searchText({ text: 'cafe', ...ORIGIN });
    expect(result.places.length).toBeGreaterThan(0);
    const distances = result.places.map((p) => haversineKm(ORIGIN, p.coordinates));
    expect(distances).toEqual([...distances].sort((a, b) => a - b));
  });

  it('searchText sin coincidencias → resultado vacío estable', async () => {
    const result = await repo.searchText({ text: 'zzz-inexistente' });
    expect(result).toEqual({ places: [], total: 0, nextCursor: undefined });
  });

  it('listByCategory cubre las 8 categorías', async () => {
    for (const category of CATEGORIES) {
      const result = await repo.listByCategory(category.id);
      expect(result.places.length).toBeGreaterThanOrEqual(3);
      expect(result.places.every((p) => p.category === category.id)).toBe(true);
    }
  });

  it('paginación por cursor recorre todo sin duplicados', async () => {
    const page1 = await repo.searchNearby({ ...ORIGIN, radiusMeters: 30_000, limit: 10 });
    expect(page1.places).toHaveLength(10);
    expect(page1.nextCursor).toBeDefined();
    const page2 = await repo.searchNearby({
      ...ORIGIN,
      radiusMeters: 30_000,
      limit: 10,
      cursor: page1.nextCursor,
    });
    const ids = new Set([...page1.places, ...page2.places].map((p) => p.id));
    expect(ids.size).toBe(page1.places.length + page2.places.length);
    expect(page1.total).toBe(MOCK_PLACES.length);
  });
});
