import { parseDirectionsTarget, validateDirections } from '../coordinatePolicy';

describe('parseDirectionsTarget — gramática estricta (V5.7.1)', () => {
  it('coordenadas canónicas válidas aceptadas', () => {
    expect(parseDirectionsTarget('24.8069,-107.394')).toEqual({ latitude: 24.8069, longitude: -107.394 });
  });
  it('(0,0) aceptado', () => {
    expect(parseDirectionsTarget('0,0')).toEqual({ latitude: 0, longitude: 0 });
  });
  it('coma sola rechazada', () => {
    expect(parseDirectionsTarget(',')).toBeNull();
  });
  it('latitud vacía rechazada', () => {
    expect(parseDirectionsTarget(',107')).toBeNull();
  });
  it('longitud vacía rechazada', () => {
    expect(parseDirectionsTarget('24.8,')).toBeNull();
  });
  it('hexadecimal rechazado', () => {
    expect(parseDirectionsTarget('0x10,0x20')).toBeNull();
  });
  it('componentes/comas extra rechazados', () => {
    expect(parseDirectionsTarget('24.8,-107.4,5')).toBeNull();
    expect(parseDirectionsTarget('24.8')).toBeNull();
  });
  it('espacios en blanco rechazados', () => {
    expect(parseDirectionsTarget('24.8 ,-107')).toBeNull();
    expect(parseDirectionsTarget(' 24.8,-107')).toBeNull();
    expect(parseDirectionsTarget('24.8, -107')).toBeNull();
  });
  it('NaN e Infinity rechazados', () => {
    expect(parseDirectionsTarget('NaN,0')).toBeNull();
    expect(parseDirectionsTarget('Infinity,0')).toBeNull();
    expect(parseDirectionsTarget('0,-Infinity')).toBeNull();
  });
  it('fuera de rango rechazado', () => {
    expect(parseDirectionsTarget('91,0')).toBeNull();
    expect(parseDirectionsTarget('0,181')).toBeNull();
  });
  it('sintaxis numérica no canónica rechazada (signo/ceros sobrantes)', () => {
    expect(parseDirectionsTarget('+24,0')).toBeNull();
    expect(parseDirectionsTarget('24.80,0')).toBeNull();
    expect(parseDirectionsTarget('-0,0')).toBeNull();
  });
  it('round-trip con la salida del constructor validado', () => {
    const target = validateDirections({ latitude: 24.8069, longitude: -107.394 }).target as string;
    expect(parseDirectionsTarget(target)).toEqual({ latitude: 24.8069, longitude: -107.394 });
  });
});
