import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';

import { buildPlaceActions, type PlaceActionInput } from '../buildActions';

const CULIACAN = { latitude: 24.8069, longitude: -107.394 };

const place = (over: Partial<PlaceActionInput> = {}): PlaceActionInput => ({
  coordinates: CULIACAN,
  contact: { phone: '(667) 123-4567', website: 'https://example.com' },
  ...over,
});

describe('buildPlaceActions (V5.7)', () => {
  it('datos válidos → tres acciones AVAILABLE con destino canónico', () => {
    const a = buildPlaceActions(place());
    expect(a.directions).toMatchObject({ type: 'DIRECTIONS', availability: 'AVAILABLE', target: '24.8069,-107.394' });
    expect(a.call).toMatchObject({ type: 'CALL', availability: 'AVAILABLE', target: 'tel:6671234567' });
    expect(a.website).toMatchObject({ type: 'WEBSITE', availability: 'AVAILABLE', target: 'https://example.com' });
  });

  it('teléfono ausente no crea acción de llamada', () => {
    const a = buildPlaceActions(place({ contact: { website: 'https://example.com' } }));
    expect(a.call.availability).toBe('UNAVAILABLE');
    expect(a.call.target).toBeNull();
    expect(a.call.reasonCode).toBe('ACTION_MISSING_VALUE');
  });

  it('sitio web malformado no crea acción habilitada', () => {
    const a = buildPlaceActions(place({ contact: { website: 'javascript:alert(1)' } }));
    expect(a.website.availability).toBe('INVALID');
    expect(a.website.target).toBeNull();
  });

  it('coordenadas inválidas no crean direcciones', () => {
    const a = buildPlaceActions(place({ coordinates: { latitude: NaN, longitude: 0 } }));
    expect(a.directions.availability).toBe('INVALID');
    expect(a.directions.target).toBeNull();
  });

  it('una acción inválida no suprime las demás válidas', () => {
    const a = buildPlaceActions(place({ contact: { phone: '(667) 123-4567', website: 'notaurl///' } }));
    expect(a.website.availability).toBe('INVALID');
    expect(a.call.availability).toBe('AVAILABLE');
    expect(a.directions.availability).toBe('AVAILABLE');
  });

  it('salida determinista para la misma entrada', () => {
    expect(buildPlaceActions(place())).toEqual(buildPlaceActions(place()));
  });

  it('no muta la entrada (sin efectos secundarios)', () => {
    const input = place();
    Object.freeze(input);
    if (input.contact) {
      Object.freeze(input.contact);
    }
    if (input.coordinates) {
      Object.freeze(input.coordinates);
    }
    expect(() => buildPlaceActions(input)).not.toThrow();
    expect(input.contact?.phone).toBe('(667) 123-4567');
  });
});

describe('pureza del dominio de acciones', () => {
  it('ningún archivo de src/actions importa react, react-native ni Linking', () => {
    const dir = join(__dirname, '..');
    const files = readdirSync(dir).filter((f) => f.endsWith('.ts'));
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      const src = readFileSync(join(dir, file), 'utf8');
      expect(src).not.toMatch(/from ['"]react['"]/);
      expect(src).not.toMatch(/from ['"]react-native['"]/);
      // Uso real de Linking (no la palabra en comentarios de documentación).
      expect(src).not.toMatch(/Linking\s*\./);
    }
  });
});
