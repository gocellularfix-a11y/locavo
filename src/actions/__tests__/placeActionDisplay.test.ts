import { placeActionDisplay } from '../../app/place/placeActionLabels';
import { buildPlaceActions } from '../buildActions';

const CULIACAN = { latitude: 24.8069, longitude: -107.394 };

describe('placeActionDisplay — política de presentación (V5.7.1)', () => {
  it('acción válida → accionable', () => {
    const a = buildPlaceActions({ coordinates: CULIACAN, contact: { website: 'https://example.com' } });
    expect(placeActionDisplay(a.website)).toEqual({ kind: 'actionable' });
  });

  it('acción ausente → oculta (no se muestra)', () => {
    const a = buildPlaceActions({ coordinates: CULIACAN, contact: {} });
    expect(placeActionDisplay(a.website).kind).toBe('hidden');
    expect(placeActionDisplay(a.call).kind).toBe('hidden');
  });

  it('acción inválida → no accionable, con razón localizada (jamás el texto crudo)', () => {
    const a = buildPlaceActions({ coordinates: CULIACAN, contact: { website: 'javascript:alert(1)', phone: '667 CALL' } });
    const w = placeActionDisplay(a.website);
    const c = placeActionDisplay(a.call);
    expect(w).toEqual({ kind: 'invalid', reasonKey: 'place.action.unsupportedScheme' });
    expect(c).toEqual({ kind: 'invalid', reasonKey: 'place.action.invalidPhone' });
  });

  it('dominio desnudo válido → el valor a mostrar es el destino NORMALIZADO (sin desajuste con lo ejecutado)', () => {
    const a = buildPlaceActions({ coordinates: CULIACAN, contact: { website: 'example.com' } });
    expect(placeActionDisplay(a.website)).toEqual({ kind: 'actionable' });
    // La UI muestra y ejecuta el mismo destino normalizado, nunca el crudo.
    expect(a.website.target).toBe('https://example.com');
    expect(a.website.target).not.toBe('example.com');
  });

  it('determinista', () => {
    const a = buildPlaceActions({ coordinates: CULIACAN, contact: { website: 'https://example.com' } });
    expect(placeActionDisplay(a.website)).toEqual(placeActionDisplay(a.website));
  });
});
