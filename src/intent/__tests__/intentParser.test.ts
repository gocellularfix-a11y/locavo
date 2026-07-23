import { parseIntentText } from '../intentParser';

const ids = (input: string, locale: string) => parseIntentText(input, locale).matches.map((m) => m.intent);

describe('parseIntentText', () => {
  it('una intención exacta', () => {
    expect(ids('desayuno', 'es')).toEqual(['BREAKFAST']);
    expect(ids('pharmacy', 'en')).toEqual(['PHARMACY']);
  });

  it('frase multi-palabra', () => {
    expect(ids('algo para desayunar', 'es')).toEqual(['BREAKFAST']);
    expect(ids('gas station', 'en')).toEqual(['FUEL']);
  });

  it('múltiples intenciones compatibles, ordenadas por posición', () => {
    expect(ids('cerca café', 'es')).toEqual(['NEARBY', 'COFFEE']);
    expect(ids('coffee nearby', 'en')).toEqual(['COFFEE', 'NEARBY']);
  });

  it('frase más larga gana (sin solapamiento)', () => {
    expect(ids('abierto tarde', 'es')).toEqual(['OPEN_LATE']); // no OPEN_NOW via "abierto"
    expect(ids('open late', 'en')).toEqual(['OPEN_LATE']);
  });

  it('alias resuelve a la intención canónica', () => {
    expect(ids('gasolinera', 'es')).toEqual(['FUEL']);
    expect(ids('drugstore', 'en')).toEqual(['PHARMACY']);
  });

  it('tokens no resueltos', () => {
    const r = parseIntentText('café xyz', 'es');
    expect(r.matches.map((m) => m.intent)).toEqual(['COFFEE']);
    expect(r.unresolvedTokens).toContain('xyz');
  });

  it('solicitud no soportada → sin coincidencias', () => {
    expect(ids('reparar mi laptop', 'es')).toEqual([]);
  });

  it('entrada vacía/malformada no lanza', () => {
    expect(parseIntentText('', 'es').matches).toEqual([]);
    expect(parseIntentText(null, 'es').matches).toEqual([]);
  });

  it('chino: coincidencia por subcadena del catálogo', () => {
    expect(ids('附近的咖啡', 'zh-CN').sort()).toEqual(['COFFEE', 'NEARBY']);
  });

  it('aislamiento de idioma', () => {
    expect(ids('breakfast', 'es')).toEqual([]); // "breakfast" es inglés
  });

  it('idioma desconocido → fallback al idioma por defecto (es)', () => {
    expect(ids('café', 'xx')).toEqual(['COFFEE']);
  });

  it('orden de coincidencias determinista', () => {
    expect(parseIntentText('café cerca', 'es')).toEqual(parseIntentText('café cerca', 'es'));
  });
});
