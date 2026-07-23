import { MAX_INTENT_INPUT_LENGTH } from '../intentModel';
import { normalizeIntentInput } from '../intentNormalization';

describe('normalizeIntentInput', () => {
  it('vacío / solo espacios → vacío', () => {
    expect(normalizeIntentInput('')).toEqual({ normalized: '', tokens: [] });
    expect(normalizeIntentInput('    ')).toEqual({ normalized: '', tokens: [] });
    expect(normalizeIntentInput(null)).toEqual({ normalized: '', tokens: [] });
  });

  it('minúsculas + acentos + puntuación + espacios', () => {
    expect(normalizeIntentInput('CAFÉ').normalized).toBe('cafe');
    expect(normalizeIntentInput('¿Café?').normalized).toBe('cafe');
    expect(normalizeIntentInput('café   cerca').normalized).toBe('cafe cerca');
    expect(normalizeIntentInput('café cerca').tokens).toEqual(['cafe', 'cerca']);
  });

  it('salida estable en repeticiones', () => {
    expect(normalizeIntentInput('Café Cerca')).toEqual(normalizeIntentInput('Café Cerca'));
  });

  it('no muta la entrada', () => {
    const input = 'CAFÉ';
    normalizeIntentInput(input);
    expect(input).toBe('CAFÉ');
  });

  it('entrada acotada (anti-DoS): longitud limitada', () => {
    const long = 'a'.repeat(500);
    const r = normalizeIntentInput(long);
    expect(r.normalized.length).toBeLessThanOrEqual(MAX_INTENT_INPUT_LENGTH);
  });
});
