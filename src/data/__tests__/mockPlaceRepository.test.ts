import { isValidCoordinates } from '../../domain/distance';
import { CATEGORIES } from '../../domain/categories';
import { evaluateOpenStatus } from '../../domain/openingHours';
import { MockPlaceRepository } from '../mockPlaceRepository';
import { CULIACAN_CENTER, MOCK_PLACES } from '../places.mock';

describe('datos simulados', () => {
  it('hay al menos 24 lugares', () => {
    expect(MOCK_PLACES.length).toBeGreaterThanOrEqual(24);
  });

  it('todos están marcados claramente como demostración', () => {
    for (const place of MOCK_PLACES) {
      expect(place.isDemo).toBe(true);
      expect(place.name.startsWith('Demo ')).toBe(true);
      expect(place.source).toBe('demo-seed');
    }
  });

  it('los ids son únicos', () => {
    const ids = new Set(MOCK_PLACES.map((p) => p.id));
    expect(ids.size).toBe(MOCK_PLACES.length);
  });

  it('cubre las 8 categorías con al menos 3 lugares cada una', () => {
    for (const category of CATEGORIES) {
      const count = MOCK_PLACES.filter((p) => p.category === category.id).length;
      expect(count).toBeGreaterThanOrEqual(3);
    }
  });

  it('coordenadas válidas y cercanas a Culiacán', () => {
    for (const place of MOCK_PLACES) {
      expect(isValidCoordinates(place)).toBe(true);
      expect(Math.abs(place.latitude - CULIACAN_CENTER.latitude)).toBeLessThan(0.1);
      expect(Math.abs(place.longitude - CULIACAN_CENTER.longitude)).toBeLessThan(0.1);
    }
  });

  it('los horarios definidos son evaluables sin errores', () => {
    const now = new Date('2026-07-15T19:30:00Z');
    for (const place of MOCK_PLACES) {
      expect(() => evaluateOpenStatus(place.openingHours, now)).not.toThrow();
    }
  });
});

describe('MockPlaceRepository', () => {
  it('listPlaces devuelve todos los lugares', async () => {
    const repo = new MockPlaceRepository();
    await expect(repo.listPlaces()).resolves.toHaveLength(MOCK_PLACES.length);
  });

  it('listPlaces devuelve una copia (mutarla no afecta al repositorio)', async () => {
    const repo = new MockPlaceRepository();
    const first = await repo.listPlaces();
    first.pop();
    await expect(repo.listPlaces()).resolves.toHaveLength(MOCK_PLACES.length);
  });

  it('getPlaceById encuentra un lugar existente', async () => {
    const repo = new MockPlaceRepository();
    const place = await repo.getPlaceById('food-centro-01');
    expect(place?.name).toBe('Demo Taquería Centro');
  });

  it('getPlaceById devuelve undefined si no existe', async () => {
    const repo = new MockPlaceRepository();
    await expect(repo.getPlaceById('no-existe')).resolves.toBeUndefined();
  });
});
