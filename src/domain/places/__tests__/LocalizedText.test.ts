import { localizedTextFor, withTranslation, type LocalizedText } from '../LocalizedText';

const ORIGINAL: LocalizedText = {
  original: {
    text: 'Mariscos estilo Sinaloa con terraza junto al río.',
    language: 'es-MX',
    source: 'owner',
    capturedAt: '2026-07-01T00:00:00Z',
  },
};

describe('LocalizedText', () => {
  it('sin traducciones devuelve siempre el original', () => {
    expect(localizedTextFor(ORIGINAL, 'en')).toBe(ORIGINAL.original.text);
    expect(localizedTextFor(ORIGINAL, 'zh-CN')).toBe(ORIGINAL.original.text);
  });

  it('con traducción devuelve la traducción del locale y conserva el original', () => {
    const translated = withTranslation(ORIGINAL, 'en', {
      text: 'Sinaloa-style seafood with a riverside terrace.',
      translatedAt: '2026-07-10T00:00:00Z',
      source: 'locavo',
    });
    expect(localizedTextFor(translated, 'en')).toBe(
      'Sinaloa-style seafood with a riverside terrace.',
    );
    // El original NUNCA se sobrescribe.
    expect(translated.original).toBe(ORIGINAL.original);
    expect(localizedTextFor(translated, 'es')).toBe(ORIGINAL.original.text);
    // La estructura original no fue mutada.
    expect(ORIGINAL.translations).toBeUndefined();
  });

  it('el original conserva idioma, fuente y fecha', () => {
    expect(ORIGINAL.original.language).toBe('es-MX');
    expect(ORIGINAL.original.source).toBe('owner');
    expect(Number.isNaN(Date.parse(ORIGINAL.original.capturedAt))).toBe(false);
  });
});
