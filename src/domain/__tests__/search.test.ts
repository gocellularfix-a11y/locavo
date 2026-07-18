import { MOCK_PLACES } from '../../data/places.mock';
import { searchPlaces } from '../search';

describe('searchPlaces', () => {
  it('consulta vacía devuelve todos los lugares', () => {
    expect(searchPlaces(MOCK_PLACES, '')).toHaveLength(MOCK_PLACES.length);
    expect(searchPlaces(MOCK_PLACES, '   ')).toHaveLength(MOCK_PLACES.length);
  });

  it('busca por nombre sin acentos ni mayúsculas', () => {
    const results = searchPlaces(MOCK_PLACES, 'cafe rio');
    expect(results.map((p) => p.id)).toContain('coffee-rio-01');
  });

  it('busca por palabra clave (tacos)', () => {
    const results = searchPlaces(MOCK_PLACES, 'TACOS');
    expect(results.map((p) => p.id)).toContain('food-centro-01');
  });

  it('busca por término de categoría (cerveza, farmacia, hotel)', () => {
    expect(searchPlaces(MOCK_PLACES, 'cerveza').every((p) => p.category === 'beer')).toBe(true);
    expect(searchPlaces(MOCK_PLACES, 'farmacia').some((p) => p.category === 'pharmacy')).toBe(true);
    expect(searchPlaces(MOCK_PLACES, 'hotel').some((p) => p.category === 'lodging')).toBe(true);
  });

  it('busca por dirección', () => {
    const results = searchPlaces(MOCK_PLACES, 'obregon');
    expect(results.length).toBeGreaterThan(0);
    expect(results.every((p) => p.address.toLowerCase().includes('obregón'.toLowerCase()))).toBe(
      true,
    );
  });

  it('tolera espacios adicionales entre tokens', () => {
    const a = searchPlaces(MOCK_PLACES, 'cafe   rio');
    const b = searchPlaces(MOCK_PLACES, 'cafe rio');
    expect(a.map((p) => p.id)).toEqual(b.map((p) => p.id));
  });

  it('sin coincidencias → lista vacía', () => {
    expect(searchPlaces(MOCK_PLACES, 'sushi vegano intergaláctico')).toHaveLength(0);
  });
});
