import {
  isLocavoPlaceId,
  LOCAVO_PLACE_NAMESPACE,
  locavoPlaceIdFromDenue,
  locavoPlaceIdFromProvider,
  uuidV5,
} from '../locavoPlaceId';

/**
 * V4C.1 — Identidad canónica de lugar: UUID v5 DETERMINISTA (RFC 4122).
 * La corrección de la implementación se ancla en los vectores oficiales del
 * estándar; el resto valida las propiedades de identidad que exige la
 * arquitectura (propia de Locavo, estable, separada del id de proveedor).
 */

// Namespace canónico DNS del RFC 4122 (solo para verificar la implementación).
const NS_DNS = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';

describe('uuidV5 (RFC 4122)', () => {
  it('reproduce los vectores oficiales del estándar', () => {
    expect(uuidV5('www.example.com', NS_DNS)).toBe('2ed6657d-e927-568b-95e1-2665a8aea6a2');
    expect(uuidV5('python.org', NS_DNS)).toBe('886313e1-3b8a-5372-9b90-0c9aee199e5d');
  });

  it('fija versión 5 y variante RFC 4122', () => {
    const id = uuidV5('cualquier-cosa', NS_DNS);
    expect(id[14]).toBe('5'); // dígito de versión
    expect(['8', '9', 'a', 'b']).toContain(id[19]); // variante
    expect(isLocavoPlaceId(id)).toBe(true);
  });

  it('maneja acentos y ñ (UTF-8) de forma determinista', () => {
    expect(uuidV5('CAFÉ DOÑA ÑOÑA', NS_DNS)).toBe(uuidV5('CAFÉ DOÑA ÑOÑA', NS_DNS));
    expect(uuidV5('cafe', NS_DNS)).not.toBe(uuidV5('café', NS_DNS));
  });
});

describe('identidad canónica de Locavo', () => {
  it('usa un namespace propio de Locavo (constante, no un namespace del RFC)', () => {
    expect(isLocavoPlaceId(uuidV5('x', LOCAVO_PLACE_NAMESPACE))).toBe(true);
    expect(LOCAVO_PLACE_NAMESPACE).toBe('9e6a7b40-2d5c-4c8b-9f3a-1e2d3c4b5a60');
  });

  it('el mismo denue_id produce SIEMPRE el mismo UUID (determinista)', () => {
    expect(locavoPlaceIdFromDenue('3763998')).toBe(locavoPlaceIdFromDenue('3763998'));
  });

  it('denue_ids distintos producen UUIDs distintos', () => {
    const ids = new Set(['1', '2', '3763998', '3763999', '10', '100'].map(locavoPlaceIdFromDenue));
    expect(ids.size).toBe(6);
  });

  it('el UUID canónico NUNCA es el denue_id ni lleva prefijo de proveedor', () => {
    const id = locavoPlaceIdFromDenue('3763998');
    expect(id).not.toBe('3763998');
    expect(id.startsWith('denue-')).toBe(false);
    expect(isLocavoPlaceId(id)).toBe(true);
  });

  it('el proveedor forma parte del nombre v5: mismo externalId, distinto proveedor → distinto UUID', () => {
    expect(locavoPlaceIdFromProvider('denue', '123')).not.toBe(
      locavoPlaceIdFromProvider('openstreetmap', '123'),
    );
    expect(locavoPlaceIdFromProvider('denue', '123')).toBe(locavoPlaceIdFromDenue('123'));
  });

  it('isLocavoPlaceId rechaza formatos no canónicos', () => {
    expect(isLocavoPlaceId('denue-123')).toBe(false);
    expect(isLocavoPlaceId('3763998')).toBe(false);
    expect(isLocavoPlaceId('not-a-uuid')).toBe(false);
    // v4 (dígito de versión 4) no es una identidad v5 de Locavo.
    expect(isLocavoPlaceId('2ed6657d-e927-468b-95e1-2665a8aea6a2')).toBe(false);
  });
});
