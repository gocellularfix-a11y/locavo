import { CULIACAN_CENTER } from '../../../data/places.mock';
import { safeCenter, safeUserLocation, sanitizeMarkers } from '../markers';

const VALID = { id: 'a', latitude: 24.81, longitude: -107.39, label: 'Demo A' };

describe('sanitizeMarkers', () => {
  it('conserva marcadores válidos', () => {
    expect(sanitizeMarkers([VALID])).toEqual([VALID]);
  });

  it('filtra coordenadas inválidas', () => {
    const bad = [
      { ...VALID, id: 'nan', latitude: NaN },
      { ...VALID, id: 'inf', longitude: Infinity },
      { ...VALID, id: 'range', latitude: 120 },
    ];
    expect(sanitizeMarkers([VALID, ...bad])).toEqual([VALID]);
  });

  it('filtra ids y labels malformados', () => {
    const bad = [
      { ...VALID, id: '' },
      { ...VALID, id: 123 as unknown as string },
      { ...VALID, label: undefined as unknown as string },
    ];
    expect(sanitizeMarkers(bad)).toEqual([]);
  });
});

describe('safeCenter', () => {
  it('conserva un centro válido', () => {
    expect(safeCenter({ latitude: 24.9, longitude: -107.5 })).toEqual({
      latitude: 24.9,
      longitude: -107.5,
    });
  });

  it('centro inválido → centro de Culiacán', () => {
    expect(safeCenter({ latitude: NaN, longitude: -107.5 })).toEqual(CULIACAN_CENTER);
    expect(safeCenter({ latitude: 91, longitude: 0 })).toEqual(CULIACAN_CENTER);
  });
});

describe('safeUserLocation', () => {
  it('null pasa como null', () => {
    expect(safeUserLocation(null)).toBeNull();
  });

  it('coordenadas inválidas → null (no se pintan)', () => {
    expect(safeUserLocation({ latitude: Infinity, longitude: 0 })).toBeNull();
  });

  it('coordenadas válidas pasan', () => {
    expect(safeUserLocation({ latitude: 24.8, longitude: -107.4 })).toEqual({
      latitude: 24.8,
      longitude: -107.4,
    });
  });
});
