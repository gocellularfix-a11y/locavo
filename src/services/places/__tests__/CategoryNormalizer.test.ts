import { normalizeCategory } from '../CategoryNormalizer';

describe('normalizeCategory', () => {
  it('códigos SCIAN de DENUE → categorías canónicas', () => {
    expect(normalizeCategory({ scianCode: '722511' })).toEqual({
      category: 'food',
      confidence: 0.94,
      matchedBy: 'scian_code',
    });
    expect(normalizeCategory({ scianCode: '722412' })?.category).toBe('nightlife');
    expect(normalizeCategory({ scianCode: '461212' })?.category).toBe('beer');
    expect(normalizeCategory({ scianCode: '464111' })?.category).toBe('pharmacy');
    expect(normalizeCategory({ scianCode: '468411' })?.category).toBe('gas');
    expect(normalizeCategory({ scianCode: '721111' })?.category).toBe('lodging');
  });

  it('el prefijo SCIAN más específico gana', () => {
    // 7224 → nightlife en general, pero 722412 es más específico.
    expect(normalizeCategory({ scianCode: '722412' })?.confidence).toBe(0.95);
  });

  it('tags de OpenStreetMap → categorías canónicas', () => {
    expect(normalizeCategory({ osmTags: { amenity: 'restaurant' } })).toEqual({
      category: 'food',
      confidence: 0.95,
      matchedBy: 'osm_tag',
    });
    expect(normalizeCategory({ osmTags: { amenity: 'cafe' } })?.category).toBe('coffee');
    expect(normalizeCategory({ osmTags: { amenity: 'fuel' } })?.category).toBe('gas');
    expect(normalizeCategory({ osmTags: { shop: 'supermarket' } })?.category).toBe('store');
    expect(normalizeCategory({ osmTags: { tourism: 'hotel' } })?.category).toBe('lodging');
    expect(normalizeCategory({ osmTags: { amenity: 'nightclub' } })?.category).toBe('nightlife');
  });

  it('palabras del nombre como último recurso, con confianza menor', () => {
    const result = normalizeCategory({ name: 'Cafetería La Espiga' });
    expect(result?.category).toBe('coffee');
    expect(result?.matchedBy).toBe('name_keyword');
    expect(result?.confidence).toBeLessThan(0.7);
  });

  it('SCIAN tiene prioridad sobre tags y nombre', () => {
    const result = normalizeCategory({
      scianCode: '722511',
      osmTags: { amenity: 'cafe' },
      name: 'Farmacia equivocada',
    });
    expect(result?.matchedBy).toBe('scian_code');
    expect(result?.category).toBe('food');
  });

  it('sin señales reconocibles → null (no inventa categoría)', () => {
    expect(normalizeCategory({})).toBeNull();
    expect(normalizeCategory({ scianCode: '999999' })).toBeNull();
    expect(normalizeCategory({ name: 'Servicios Industriales XYZ' })).toBeNull();
  });

  it('nombre ambiguo entre categorías → null en vez de adivinar', () => {
    // "bar restaurante" mapea a nightlife Y food → no decide.
    expect(normalizeCategory({ name: 'bar restaurante' })).toBeNull();
  });
});
