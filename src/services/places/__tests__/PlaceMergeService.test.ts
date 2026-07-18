import type { LocavoPlace } from '../../../domain/places/LocavoPlace';
import { matchPlaces, nameSimilarity } from '../PlaceMergeService';

function makePlace(overrides: Partial<LocavoPlace> & { id: string }): LocavoPlace {
  return {
    sourceRefs: {},
    name: 'Demo Lugar',
    normalizedName: 'demo lugar',
    category: 'food',
    coordinates: { latitude: 24.8069, longitude: -107.394 },
    address: { formatted: 'Av. Obregón 210, Centro', countryCode: 'MX' },
    contact: {},
    verification: { status: 'unverified', confidence: 0.5 },
    provenance: [{ source: 'mock' }],
    status: { active: true },
    createdAt: '2026-07-01T00:00:00Z',
    updatedAt: '2026-07-01T00:00:00Z',
    ...overrides,
  };
}

describe('matchPlaces', () => {
  it('coincidencia fuerte: mismo teléfono + cerca + nombre similar', () => {
    const a = makePlace({
      id: 'a',
      name: 'Tacos El Compa',
      contact: { phone: '+52 667 123 4567' },
    });
    const b = makePlace({
      id: 'b',
      name: 'Taquería El Compa',
      contact: { phone: '6671234567' },
      coordinates: { latitude: 24.80695, longitude: -107.39402 },
    });
    const result = matchPlaces(a, b);
    expect(result.likelySamePlace).toBe(true);
    expect(result.confidence).toBeGreaterThanOrEqual(0.75);
    expect(result.reasons).toContain('same_phone');
    expect(result.reasons).toContain('nearby_coordinates');
  });

  it('mismo dominio web pesa mucho', () => {
    const a = makePlace({ id: 'a', contact: { website: 'https://www.elcompa.mx/menu' } });
    const b = makePlace({
      id: 'b',
      contact: { website: 'http://elcompa.mx' },
      coordinates: { latitude: 24.8069, longitude: -107.3941 },
    });
    const result = matchPlaces(a, b);
    expect(result.reasons).toContain('same_website');
    expect(result.likelySamePlace).toBe(true);
  });

  it('nombres parecidos pero ubicaciones lejanas NO son el mismo lugar', () => {
    const a = makePlace({ id: 'a', name: 'Farmacia Guadalajara' });
    const b = makePlace({
      id: 'b',
      name: 'Farmacia Guadalajara',
      address: { formatted: 'Otra colonia 500', countryCode: 'MX' },
      coordinates: { latitude: 24.83, longitude: -107.42 }, // ~3.5 km
    });
    const result = matchPlaces(a, b);
    expect(result.likelySamePlace).toBe(false);
  });

  it('sucursales distintas de una cadena: cerca-ish pero no idénticas', () => {
    const a = makePlace({
      id: 'a',
      name: 'Demo Súper Norte Sucursal Centro',
      normalizedName: 'demo super norte sucursal centro',
    });
    const b = makePlace({
      id: 'b',
      name: 'Demo Súper Norte Sucursal Aeropuerto',
      normalizedName: 'demo super norte sucursal aeropuerto',
      address: { formatted: 'Carr. al Aeropuerto 45', countryCode: 'MX' },
      coordinates: { latitude: 24.7788, longitude: -107.4147 },
    });
    expect(matchPlaces(a, b).likelySamePlace).toBe(false);
  });

  it('coordenadas cercanas sin nombre similar NO bastan (locales vecinos)', () => {
    const a = makePlace({ id: 'a', name: 'Demo Café Río' });
    const b = makePlace({
      id: 'b',
      name: 'Demo Farmacia del Parque',
      category: 'pharmacy',
      address: { formatted: 'Av. Obregón 212, Centro', countryCode: 'MX' },
      coordinates: { latitude: 24.80691, longitude: -107.39401 },
    });
    expect(matchPlaces(a, b).likelySamePlace).toBe(false);
  });

  it('mismo lugar con variantes de escritura (acentos/orden)', () => {
    const a = makePlace({ id: 'a', name: 'Mariscos El Güero' });
    const b = makePlace({
      id: 'b',
      name: 'MARISCOS EL GUERO',
      coordinates: { latitude: 24.80693, longitude: -107.39398 },
    });
    const result = matchPlaces(a, b);
    expect(result.likelySamePlace).toBe(true);
    expect(result.reasons).toContain('similar_name');
  });

  it('confianza dudosa no fusiona automáticamente', () => {
    const a = makePlace({ id: 'a', name: 'Demo Taquería Centro' });
    const b = makePlace({
      id: 'b',
      name: 'Demo Taquería del Centro Histórico',
      address: { formatted: 'Otra calle 99', countryCode: 'MX' },
      coordinates: { latitude: 24.8095, longitude: -107.3965 }, // ~380 m
    });
    const result = matchPlaces(a, b);
    expect(result.likelySamePlace).toBe(false);
    expect(result.confidence).toBeLessThan(0.75);
  });
});

describe('nameSimilarity', () => {
  it('es determinista y simétrica', () => {
    expect(nameSimilarity('Tacos El Compa', 'tacos el compa')).toBe(1);
    expect(nameSimilarity('Tacos El Compa', 'El Compa')).toBe(0.85);
    const ab = nameSimilarity('Café Río', 'Rio Café Centro');
    const ba = nameSimilarity('Rio Café Centro', 'Café Río');
    expect(ab).toBe(ba);
  });
});
