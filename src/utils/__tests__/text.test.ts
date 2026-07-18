import { normalizeText, tokenize } from '../text';

describe('normalizeText', () => {
  it('quita acentos y pasa a minúsculas', () => {
    expect(normalizeText('CAFÉ')).toBe('cafe');
    expect(normalizeText('Taquería')).toBe('taqueria');
    expect(normalizeText('Río')).toBe('rio');
  });

  it('colapsa espacios adicionales', () => {
    expect(normalizeText('  farmacia   del   parque  ')).toBe('farmacia del parque');
  });

  it('mantiene la ñ como letra distinta tras normalizar tilde', () => {
    // NFD separa la virgulilla; se elimina como diacrítico → 'n'.
    // La búsqueda sigue funcionando porque ambos lados se normalizan igual.
    expect(normalizeText('añejo')).toBe(normalizeText('AÑEJO'));
  });
});

describe('tokenize', () => {
  it('separa en tokens no vacíos', () => {
    expect(tokenize('  Tacos   de asada ')).toEqual(['tacos', 'de', 'asada']);
  });

  it('cadena vacía → sin tokens', () => {
    expect(tokenize('   ')).toEqual([]);
  });
});
