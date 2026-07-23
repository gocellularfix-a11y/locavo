import { parseDirectionsTarget, validateDirections } from '../coordinatePolicy';

const c = (latitude: number, longitude: number) => ({ latitude, longitude });

describe('validateDirections (V5.7)', () => {
  it('coordenadas válidas de Culiacán', () => {
    expect(validateDirections(c(24.8069, -107.394))).toEqual({ valid: true, target: '24.8069,-107.394', reasonCode: 'ACTION_AVAILABLE' });
  });

  it('latitud < -90 → inválida', () => {
    expect(validateDirections(c(-91, 0)).valid).toBe(false);
  });
  it('latitud > 90 → inválida', () => {
    expect(validateDirections(c(91, 0)).valid).toBe(false);
  });
  it('longitud < -180 → inválida', () => {
    expect(validateDirections(c(0, -181)).valid).toBe(false);
  });
  it('longitud > 180 → inválida', () => {
    expect(validateDirections(c(0, 181)).valid).toBe(false);
  });
  it('NaN → inválida', () => {
    expect(validateDirections(c(NaN, 0)).valid).toBe(false);
    expect(validateDirections(c(0, NaN)).valid).toBe(false);
  });
  it('Infinity → inválida', () => {
    expect(validateDirections(c(Infinity, 0)).valid).toBe(false);
    expect(validateDirections(c(0, -Infinity)).valid).toBe(false);
  });
  it('coordenadas ausentes → inválida', () => {
    expect(validateDirections(undefined).reasonCode).toBe('ACTION_INVALID_COORDINATES');
    expect(validateDirections(null).reasonCode).toBe('ACTION_INVALID_COORDINATES');
  });
  it('(0,0) es canónicamente válido (no se asume ausente)', () => {
    expect(validateDirections(c(0, 0))).toEqual({ valid: true, target: '0,0', reasonCode: 'ACTION_AVAILABLE' });
  });
  it('determinista', () => {
    expect(validateDirections(c(24.8, -107.4))).toEqual(validateDirections(c(24.8, -107.4)));
  });
});

describe('parseDirectionsTarget (V5.7)', () => {
  it('reconstruye coordenadas válidas', () => {
    expect(parseDirectionsTarget('24.8069,-107.394')).toEqual(c(24.8069, -107.394));
  });
  it('rechaza formato o rango inválido', () => {
    expect(parseDirectionsTarget('abc')).toBeNull();
    expect(parseDirectionsTarget('24.8')).toBeNull();
    expect(parseDirectionsTarget('91,0')).toBeNull();
  });
});
