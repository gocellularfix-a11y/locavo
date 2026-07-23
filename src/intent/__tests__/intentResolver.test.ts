import { parseIntentText } from '../intentParser';
import { resolveIntent } from '../intentResolver';

const resolve = (input: string, locale = 'es') => resolveIntent(parseIntentText(input, locale));

describe('resolveIntent', () => {
  it('selección explícita de UI anula el texto', () => {
    const r = resolveIntent(parseIntentText('café', 'es'), 'PHARMACY');
    expect(r?.primaryIntent).toBe('PHARMACY');
    expect(r?.confidence).toBe('EXACT');
  });

  it('primaria + secundaria compatible (coffee nearby → COFFEE / NEARBY)', () => {
    const r = resolve('coffee nearby', 'en');
    expect(r?.primaryIntent).toBe('COFFEE');
    expect(r?.secondaryIntents).toContain('NEARBY');
    expect(r?.confidence).toBe('STRONG');
  });

  it('intenciones incompatibles → AMBIGUOUS con candidatos', () => {
    const r = resolve('hotel desayuno', 'es'); // LODGING vs BREAKFAST (alcances disjuntos)
    expect(r?.confidence).toBe('AMBIGUOUS');
    expect(r?.ambiguity).toBe('INTENT_CONFLICTING_PRIMARIES');
    expect(r?.ambiguousPrimaries).toEqual(expect.arrayContaining(['LODGING', 'BREAKFAST']));
  });

  it('desconocido → null', () => {
    expect(resolve('reparar laptop', 'es')).toBeNull();
  });

  it('exacta con una sola coincidencia limpia', () => {
    expect(resolve('farmacia', 'es')?.confidence).toBe('EXACT');
  });

  it('parcial: término reconocido + tokens sin resolver', () => {
    expect(resolve('café con algo raro', 'es')?.confidence).toBe('PARTIAL');
  });

  it('prioridad determinista (misma entrada → misma resolución)', () => {
    expect(resolve('coffee nearby', 'en')).toEqual(resolve('coffee nearby', 'en'));
  });

  it('confianza es un nivel enum, nunca porcentaje', () => {
    const c = resolve('farmacia', 'es')?.confidence;
    expect(['EXACT', 'STRONG', 'PARTIAL', 'AMBIGUOUS', 'UNKNOWN']).toContain(c);
    expect(typeof c).toBe('string');
  });
});
