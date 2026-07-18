import { estimateTravelMinutes, haversineKm, isValidCoordinates } from '../distance';

const CENTER = { latitude: 24.8069, longitude: -107.394 };

describe('haversineKm', () => {
  it('distancia cero entre el mismo punto', () => {
    expect(haversineKm(CENTER, CENTER)).toBe(0);
  });

  it('aprox. 1.11 km por 0.01° de latitud', () => {
    const north = { latitude: 24.8169, longitude: -107.394 };
    const km = haversineKm(CENTER, north);
    expect(km).toBeGreaterThan(1.0);
    expect(km).toBeLessThan(1.2);
  });

  it('es simétrica', () => {
    const other = { latitude: 24.82, longitude: -107.38 };
    expect(haversineKm(CENTER, other)).toBeCloseTo(haversineKm(other, CENTER), 10);
  });

  it('rechaza coordenadas inválidas', () => {
    expect(() => haversineKm({ latitude: NaN, longitude: 0 }, CENTER)).toThrow();
    expect(() => haversineKm({ latitude: 91, longitude: 0 }, CENTER)).toThrow();
    expect(() => haversineKm(CENTER, { latitude: 0, longitude: 181 })).toThrow();
  });
});

describe('isValidCoordinates', () => {
  it('acepta rangos válidos y rechaza inválidos', () => {
    expect(isValidCoordinates(CENTER)).toBe(true);
    expect(isValidCoordinates({ latitude: -90, longitude: 180 })).toBe(true);
    expect(isValidCoordinates({ latitude: 90.1, longitude: 0 })).toBe(false);
    expect(isValidCoordinates({ latitude: 0, longitude: Infinity })).toBe(false);
    expect(isValidCoordinates({ latitude: NaN, longitude: 0 })).toBe(false);
  });
});

describe('estimateTravelMinutes (aproximación urbana, sin tráfico real)', () => {
  it('es determinista y con mínimo de 1 minuto', () => {
    expect(estimateTravelMinutes(0)).toBe(1);
    expect(estimateTravelMinutes(1.4)).toBe(5); // 1 + 3.8 ≈ 5
    expect(estimateTravelMinutes(2.2)).toBe(7); // 1 + 6 = 7
  });

  it('rechaza distancias inválidas', () => {
    expect(() => estimateTravelMinutes(-1)).toThrow();
    expect(() => estimateTravelMinutes(NaN)).toThrow();
  });
});

// El formato visible de distancia/tiempo se prueba en i18n/__tests__/format.test.ts.
