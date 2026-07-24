import {
  formatDistanceLocalized,
  formatDistanceWithOriginLocalized,
  formatTravelTimeLocalized,
} from '../format';
import {
  ACTIVE_CITY,
  distanceOriginOf,
  resolveEffectiveLocation,
  type DistanceOrigin,
  type ManualLocation,
} from '../../services/effectiveLocation';

const GPS: DistanceOrigin = { type: 'gps' };
const KM_0_4_MI = 0.643; // ≈ 0.4 mi
const ml = (label: string): ManualLocation => ({ id: 'z', label, coords: { latitude: 24.8, longitude: -107.4 } });

describe('formatDistanceWithOriginLocalized — referencia de distancia (V UX fix)', () => {
  it('(1) origen GPS → "0.4 mi from your location"', () => {
    expect(formatDistanceWithOriginLocalized(KM_0_4_MI, GPS, 'en')).toBe('0.4 mi from your location');
  });

  it('(2) origen manual con nombre → "0.4 mi from {name}"', () => {
    const origin: DistanceOrigin = { type: 'manual', label: 'Downtown Culiacán' };
    expect(formatDistanceWithOriginLocalized(KM_0_4_MI, origin, 'en')).toBe('0.4 mi from Downtown Culiacán');
  });

  it('(3) origen manual SIN nombre usable → "from selected location"', () => {
    expect(formatDistanceWithOriginLocalized(KM_0_4_MI, { type: 'manual' }, 'en')).toBe('0.4 mi from selected location');
    expect(formatDistanceWithOriginLocalized(KM_0_4_MI, { type: 'manual', label: '   ' }, 'en')).toBe('0.4 mi from selected location');
  });

  it('(4) ubicación guardada por nombre → "0.4 mi from Home"', () => {
    expect(formatDistanceWithOriginLocalized(KM_0_4_MI, { type: 'manual', label: 'Home' }, 'en')).toBe('0.4 mi from Home');
  });

  it('(5) fallback de centro de ciudad NUNCA dice "from your location"', () => {
    // El respaldo es su propia fuente: se nombra la ciudad, no una selección.
    const cityOrigin = distanceOriginOf(resolveEffectiveLocation({}));
    const out = formatDistanceWithOriginLocalized(KM_0_4_MI, cityOrigin, 'en');
    expect(cityOrigin.type).toBe('city');
    expect(out).toBe(`0.4 mi from ${ACTIVE_CITY.label}`);
    expect(out).not.toContain('from your location');
    expect(out).not.toContain('from selected location');
    // Sin etiqueta usable se nombra el centro de la ciudad, jamás "seleccionada".
    expect(formatDistanceWithOriginLocalized(KM_0_4_MI, { type: 'city', label: '  ' }, 'en')).toBe(
      '0.4 mi from the city center',
    );
  });

  it('(6) traducciones en español (métrico: "1.2 km desde ...")', () => {
    expect(formatDistanceWithOriginLocalized(KM_0_4_MI, GPS, 'es')).toContain('desde tu ubicación');
    expect(formatDistanceWithOriginLocalized(1.2, { type: 'manual', label: 'Tres Ríos' }, 'es')).toBe('1.2 km desde Tres Ríos');
    expect(formatDistanceWithOriginLocalized(KM_0_4_MI, { type: 'manual' }, 'es')).toContain('desde la ubicación seleccionada');
  });

  it('(7) traducciones en portugués', () => {
    expect(formatDistanceWithOriginLocalized(KM_0_4_MI, GPS, 'pt')).toContain('da sua localização');
    expect(formatDistanceWithOriginLocalized(1.2, { type: 'manual', label: 'Centro' }, 'pt')).toBe('1.2 km de Centro');
    expect(formatDistanceWithOriginLocalized(KM_0_4_MI, { type: 'manual' }, 'pt')).toContain('do local selecionado');
  });

  it('(8) el origen mostrado corresponde a la MISMA ubicación cuyas coordenadas dan la distancia', () => {
    const manual = ml('Zona Universitaria');
    // Manual: la etiqueta del origen sale de la misma ubicación efectiva.
    expect(distanceOriginOf(resolveEffectiveLocation({ manual }))).toEqual({
      type: 'manual',
      label: 'Zona Universitaria',
    });
    // GPS: sin etiqueta (usa las coords vivas del usuario) y gana a la zona manual.
    const gps = { latitude: 34.4208, longitude: -119.6982 };
    expect(distanceOriginOf(resolveEffectiveLocation({ gps, manual }))).toEqual({ type: 'gps' });
    // Etiqueta en blanco no inventa nombre.
    expect(distanceOriginOf(resolveEffectiveLocation({ manual: ml('   ') }))).toEqual({
      type: 'manual',
      label: undefined,
    });
  });

  it('(9) el valor de distancia y el tiempo de viaje no cambian', () => {
    expect(formatDistanceLocalized(KM_0_4_MI, 'en')).toBe('0.4 mi'); // número/unidad intactos (sin "away")
    expect(formatDistanceLocalized(1.2, 'es')).toBe('1.2 km');
    expect(formatDistanceLocalized(0.3, 'es')).toBe('300 m');
    expect(formatTravelTimeLocalized(3, 'en')).toBe('About 3 min');
    expect(formatTravelTimeLocalized(3, 'es')).toBe('Aprox. 3 min');
  });

  it('(10) etiquetas de origen largas no rompen la composición (una sola cadena)', () => {
    const longLabel = 'Fraccionamiento Residencial Las Quintas del Valle Norte';
    const out = formatDistanceWithOriginLocalized(KM_0_4_MI, { type: 'manual', label: longLabel }, 'en');
    expect(out.includes('\n')).toBe(false);
    expect(out).toContain(longLabel);
    expect(out.startsWith('0.4 mi from ')).toBe(true);
  });
});
