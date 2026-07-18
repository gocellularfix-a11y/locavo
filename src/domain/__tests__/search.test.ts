import { MOCK_PLACES } from '../../data/places.mock';
import { seedToLocavoPlace } from '../../data/places/PlaceMapper';
import { searchPlaces } from '../search';

const PLACES = MOCK_PLACES.map(seedToLocavoPlace);

describe('searchPlaces (modelo canónico)', () => {
  it('consulta vacía devuelve todos los lugares', () => {
    expect(searchPlaces(PLACES, '')).toHaveLength(PLACES.length);
    expect(searchPlaces(PLACES, '   ')).toHaveLength(PLACES.length);
  });

  it('busca por nombre sin acentos ni mayúsculas', () => {
    const results = searchPlaces(PLACES, 'cafe rio');
    expect(results.map((p) => p.id)).toContain('locavo-coffee-rio-01');
  });

  it('busca por palabra clave (tacos)', () => {
    const results = searchPlaces(PLACES, 'TACOS');
    expect(results.map((p) => p.id)).toContain('locavo-food-centro-01');
  });

  it('busca por término de categoría en español', () => {
    expect(searchPlaces(PLACES, 'cerveza').every((p) => p.category === 'beer')).toBe(true);
    expect(searchPlaces(PLACES, 'farmacia').some((p) => p.category === 'pharmacy')).toBe(true);
    expect(searchPlaces(PLACES, 'hotel').some((p) => p.category === 'lodging')).toBe(true);
  });

  it('búsqueda multilenguaje vía alias: en, zh-CN, de, fr', () => {
    expect(searchPlaces(PLACES, 'beer').every((p) => p.category === 'beer')).toBe(true);
    expect(searchPlaces(PLACES, 'beer').length).toBeGreaterThan(0);
    expect(searchPlaces(PLACES, '啤酒').every((p) => p.category === 'beer')).toBe(true);
    expect(searchPlaces(PLACES, '啤酒').length).toBeGreaterThan(0);
    expect(searchPlaces(PLACES, '咖啡').some((p) => p.category === 'coffee')).toBe(true);
    expect(searchPlaces(PLACES, 'apotheke').some((p) => p.category === 'pharmacy')).toBe(true);
    expect(searchPlaces(PLACES, 'gas station').some((p) => p.category === 'gas')).toBe(true);
    expect(searchPlaces(PLACES, 'pharmacie').some((p) => p.category === 'pharmacy')).toBe(true);
    expect(searchPlaces(PLACES, '酒店').some((p) => p.category === 'lodging')).toBe(true);
  });

  it('restaurant/restaurante/餐厅 mapean al mismo concepto (food)', () => {
    const en = searchPlaces(PLACES, 'restaurant').map((p) => p.id);
    const es = searchPlaces(PLACES, 'restaurante').map((p) => p.id);
    const zh = searchPlaces(PLACES, '餐厅').map((p) => p.id);
    expect(en.length).toBeGreaterThan(0);
    // Los tres idiomas encuentran al menos los mismos lugares de comida.
    const foodIds = PLACES.filter((p) => p.category === 'food').map((p) => p.id);
    for (const id of foodIds) {
      expect(en).toContain(id);
      expect(es).toContain(id);
      expect(zh).toContain(id);
    }
  });

  it('busca por dirección', () => {
    const results = searchPlaces(PLACES, 'obregon');
    expect(results.length).toBeGreaterThan(0);
    expect(
      results.every((p) => (p.address?.formatted ?? '').toLowerCase().includes('obregón')),
    ).toBe(true);
  });

  it('tolera espacios adicionales entre tokens', () => {
    const a = searchPlaces(PLACES, 'cafe   rio');
    const b = searchPlaces(PLACES, 'cafe rio');
    expect(a.map((p) => p.id)).toEqual(b.map((p) => p.id));
  });

  it('sin coincidencias → lista vacía', () => {
    expect(searchPlaces(PLACES, 'sushi vegano intergaláctico')).toHaveLength(0);
  });

  it('los nombres comerciales no se traducen: se buscan tal cual', () => {
    const results = searchPlaces(PLACES, 'taqueria centro');
    expect(results.map((p) => p.name)).toContain('Demo Taquería Centro');
  });
});
