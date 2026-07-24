import {
  InvalidPlaceQueryError,
  MAX_LIMIT,
  MAX_RADIUS_METERS,
  validateListOptions,
  validateNearbyQuery,
  validateTextQuery,
} from '../PlaceQuery';
import { NEARBY_RADIUS_LADDER_M } from '../../../services/places/nearbyRadius';

const VALID_NEARBY = { latitude: 24.8, longitude: -107.4, radiusMeters: 2000 };

describe('validateNearbyQuery', () => {
  it('acepta consultas válidas y aplica el límite default', () => {
    expect(validateNearbyQuery(VALID_NEARBY).limit).toBe(20);
  });

  it('rechaza coordenadas fuera de rango o no numéricas', () => {
    expect(() => validateNearbyQuery({ ...VALID_NEARBY, latitude: 91 })).toThrow(
      InvalidPlaceQueryError,
    );
    expect(() => validateNearbyQuery({ ...VALID_NEARBY, longitude: -181 })).toThrow(
      InvalidPlaceQueryError,
    );
    expect(() => validateNearbyQuery({ ...VALID_NEARBY, latitude: NaN })).toThrow(
      InvalidPlaceQueryError,
    );
    expect(() =>
      validateNearbyQuery({ ...VALID_NEARBY, latitude: '24' as unknown as number }),
    ).toThrow(InvalidPlaceQueryError);
  });

  it('rechaza radios fuera del rango permitido', () => {
    expect(() => validateNearbyQuery({ ...VALID_NEARBY, radiusMeters: 50 })).toThrow(
      InvalidPlaceQueryError,
    );
    expect(() =>
      validateNearbyQuery({ ...VALID_NEARBY, radiusMeters: MAX_RADIUS_METERS + 1 }),
    ).toThrow(InvalidPlaceQueryError);
    expect(() => validateNearbyQuery({ ...VALID_NEARBY, radiusMeters: -1 })).toThrow(
      InvalidPlaceQueryError,
    );
    expect(() => validateNearbyQuery({ ...VALID_NEARBY, radiusMeters: Infinity })).toThrow(
      InvalidPlaceQueryError,
    );
  });

  it('acepta los radios ampliados de la escalera de exploración', () => {
    // La cota es estructural: la política de alcance vive en la escalera.
    for (const radiusMeters of NEARBY_RADIUS_LADDER_M) {
      expect(validateNearbyQuery({ ...VALID_NEARBY, radiusMeters }).radiusMeters).toBe(
        radiusMeters,
      );
    }
  });

  it('rechaza límites no razonables', () => {
    expect(() => validateNearbyQuery({ ...VALID_NEARBY, limit: 0 })).toThrow(
      InvalidPlaceQueryError,
    );
    expect(() => validateNearbyQuery({ ...VALID_NEARBY, limit: MAX_LIMIT + 1 })).toThrow(
      InvalidPlaceQueryError,
    );
    expect(() => validateNearbyQuery({ ...VALID_NEARBY, limit: 2.5 })).toThrow(
      InvalidPlaceQueryError,
    );
  });
});

describe('validateTextQuery', () => {
  it('rechaza texto vacío', () => {
    expect(() => validateTextQuery({ text: '   ' })).toThrow(InvalidPlaceQueryError);
  });

  it('acepta texto con origen opcional válido', () => {
    expect(validateTextQuery({ text: 'tacos', latitude: 24.8, longitude: -107.4 }).limit).toBe(20);
  });

  it('rechaza origen con coordenadas inválidas', () => {
    expect(() => validateTextQuery({ text: 'tacos', latitude: NaN, longitude: 0 })).toThrow(
      InvalidPlaceQueryError,
    );
    expect(() => validateTextQuery({ text: 'tacos', latitude: 24.8 })).toThrow(
      InvalidPlaceQueryError,
    );
  });
});

describe('validateListOptions', () => {
  it('defaults seguros sin opciones', () => {
    expect(validateListOptions().limit).toBe(20);
  });

  it('rechaza origen inválido', () => {
    expect(() => validateListOptions({ latitude: 200, longitude: 0 })).toThrow(
      InvalidPlaceQueryError,
    );
  });
});
