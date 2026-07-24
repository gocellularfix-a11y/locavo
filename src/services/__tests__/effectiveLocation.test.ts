import { CULIACAN_CENTER } from '../../data/places.mock';
import { haversineKm } from '../../domain/distance';
import type { Coordinates } from '../../domain/place';
import { buildExplanation, gatherEvidence, normalizeContext } from '../../intelligence';
import { ALWAYS_OPEN, makePlace } from '../../intelligence/__tests__/helpers';
import {
  ACTIVE_CITY,
  distanceOriginOf,
  MANUAL_LOCATIONS,
  resolveEffectiveLocation,
  resolveManualLocation,
  type ManualLocation,
} from '../effectiveLocation';

/** Usuario real de prueba: Santa Bárbara, California. */
const SANTA_BARBARA: Coordinates = { latitude: 34.4208, longitude: -119.6982 };
/** Lugar real del pack: Culiacán, Sinaloa. */
const CULIACAN_PLACE: Coordinates = { latitude: 24.8069, longitude: -107.394 };

const TRES_RIOS = MANUAL_LOCATIONS.find((l) => l.id === 'tres-rios') as ManualLocation;

describe('resolución canónica de ubicación efectiva', () => {
  it('1. usuario en Santa Bárbara + lugar en Culiacán → distancia real de larga distancia', () => {
    const effective = resolveEffectiveLocation({ gps: SANTA_BARBARA });
    expect(effective.source).toBe('gps');
    expect(effective.coords).toEqual(SANTA_BARBARA);

    const km = haversineKm(effective.coords, CULIACAN_PLACE);
    // ~1,600 km reales: jamás la distancia desde el centro de la ciudad.
    expect(km).toBeGreaterThan(1400);
    expect(km).toBeLessThan(1900);
    expect(km).not.toBeCloseTo(haversineKm(CULIACAN_CENTER, CULIACAN_PLACE), 1);
  });

  it('2. GPS válido prevalece sobre ubicación manual y centro de ciudad', () => {
    const effective = resolveEffectiveLocation({
      gps: SANTA_BARBARA,
      manual: TRES_RIOS,
    });
    expect(effective.source).toBe('gps');
    expect(effective.coords).toEqual(SANTA_BARBARA);
    expect(effective.coords).not.toEqual(ACTIVE_CITY.coords);
  });

  it('3. la ubicación manual prevalece sobre el centro de ciudad cuando no hay GPS', () => {
    const effective = resolveEffectiveLocation({ gps: null, manual: TRES_RIOS });
    expect(effective.source).toBe('manual');
    expect(effective.coords).toEqual(TRES_RIOS.coords);
    expect(effective.label).toBe(TRES_RIOS.label);
  });

  it('4. el centro de ciudad se usa SOLO sin GPS y sin ubicación manual', () => {
    const effective = resolveEffectiveLocation({ gps: null, manual: null });
    expect(effective.source).toBe('city');
    expect(effective.coords).toEqual(ACTIVE_CITY.coords);

    // Cualquier escalón superior desplaza al respaldo.
    expect(resolveEffectiveLocation({ manual: TRES_RIOS }).source).toBe('manual');
    expect(resolveEffectiveLocation({ gps: SANTA_BARBARA }).source).toBe('gps');
  });

  it('un GPS inválido no gana: degrada al siguiente escalón sin fingir lectura', () => {
    const invalid = { latitude: Number.NaN, longitude: -107.4 };
    expect(resolveEffectiveLocation({ gps: invalid, manual: TRES_RIOS }).source).toBe('manual');
    expect(resolveEffectiveLocation({ gps: invalid }).source).toBe('city');
    expect(resolveEffectiveLocation({ gps: { latitude: 91, longitude: 0 } }).source).toBe('city');
  });

  it('7. las mismas coordenadas producen resultados deterministas', () => {
    const inputs = { gps: SANTA_BARBARA, manual: TRES_RIOS };
    expect(resolveEffectiveLocation(inputs)).toEqual(resolveEffectiveLocation(inputs));

    const noGps = { gps: null, manual: TRES_RIOS };
    expect(resolveEffectiveLocation(noGps)).toEqual(resolveEffectiveLocation(noGps));

    const km = haversineKm(SANTA_BARBARA, CULIACAN_PLACE);
    expect(haversineKm(SANTA_BARBARA, CULIACAN_PLACE)).toBe(km);
  });
});

describe('honestidad del origen mostrado', () => {
  it('solo el GPS se presenta como "tu ubicación"', () => {
    expect(distanceOriginOf(resolveEffectiveLocation({ gps: SANTA_BARBARA }))).toEqual({
      type: 'gps',
    });
  });

  it('el respaldo de ciudad se nombra como ciudad, nunca como GPS ni como selección', () => {
    const origin = distanceOriginOf(resolveEffectiveLocation({}));
    expect(origin).toEqual({ type: 'city', label: ACTIVE_CITY.label });
  });

  it('la zona manual conserva su etiqueta', () => {
    const origin = distanceOriginOf(resolveEffectiveLocation({ manual: TRES_RIOS }));
    expect(origin).toEqual({ type: 'manual', label: TRES_RIOS.label });
  });

  it('una zona manual sin etiqueta no inventa texto', () => {
    const unlabeled: ManualLocation = { id: 'x', label: '   ', coords: CULIACAN_CENTER };
    expect(distanceOriginOf(resolveEffectiveLocation({ manual: unlabeled }))).toEqual({
      type: 'manual',
      label: undefined,
    });
  });
});

describe('seguridad semántica: NEARBY solo con cercanía real', () => {
  const NOW = new Date('2026-07-22T18:00:00.000Z');

  /** Explica un lugar de Culiacán desde el origen efectivo dado (motor V5.0). */
  function explainFrom(origin: Coordinates) {
    const place = makePlace({
      id: 'culiacan-1',
      latitude: CULIACAN_PLACE.latitude,
      longitude: CULIACAN_PLACE.longitude,
      hours: ALWAYS_OPEN,
    });
    const context = normalizeContext({ now: NOW, intent: 'food', origin });
    return buildExplanation(gatherEvidence(place, context), context);
  }

  it('5. un lugar de Culiacán visto desde Santa Bárbara nunca es NEARBY', () => {
    const effective = resolveEffectiveLocation({ gps: SANTA_BARBARA });
    const explanation = explainFrom(effective.coords);
    const codes = [...explanation.positive, ...explanation.warnings].map((item) => item.code);
    expect(codes).not.toContain('NEARBY');
    expect(codes).toContain('FAR');
  });

  it('la cercanía real sí produce NEARBY (el umbral canónico no cambió)', () => {
    const explanation = explainFrom(CULIACAN_PLACE);
    expect(explanation.positive.map((item) => item.code)).toContain('NEARBY');
  });
});

describe('zona manual persistida', () => {
  it('resuelve un id válido', () => {
    expect(resolveManualLocation('tres-rios')?.id).toBe('tres-rios');
  });

  it('un id desconocido o corrupto NO inventa una selección manual', () => {
    expect(resolveManualLocation('zona-que-ya-no-existe')).toBeNull();
    expect(resolveManualLocation(null)).toBeNull();
    expect(resolveManualLocation(42)).toBeNull();
    expect(resolveManualLocation({ id: 'centro' })).toBeNull();
    // Sin selección válida la cadena cae al respaldo explícito de ciudad.
    expect(resolveEffectiveLocation({ manual: resolveManualLocation('basura') }).source).toBe(
      'city',
    );
  });

  it('todas las zonas manuales están en Culiacán con coordenadas válidas', () => {
    for (const manual of MANUAL_LOCATIONS) {
      expect(Math.abs(manual.coords.latitude - 24.8)).toBeLessThan(0.2);
      expect(Math.abs(manual.coords.longitude - -107.4)).toBeLessThan(0.2);
    }
  });
});
