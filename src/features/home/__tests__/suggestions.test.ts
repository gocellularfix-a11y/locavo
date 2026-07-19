import { getContextualSuggestions } from '../suggestions';
import { CATALOGS } from '../../../i18n/I18nContext';
import { SUPPORTED_LOCALES } from '../../../i18n/types';

const ALL_TIMES = ['morning', 'lunch', 'afternoon', 'evening', 'lateNight'] as const;

describe('getContextualSuggestions', () => {
  it('la primera sugerencia visible es la específica de cada franja', () => {
    expect(getContextualSuggestions('morning')[0]).toBe('suggest.morning.1');
    expect(getContextualSuggestions('lunch')[0]).toBe('suggest.lunch.1');
    expect(getContextualSuggestions('afternoon')[0]).toBe('suggest.afternoon.1');
    expect(getContextualSuggestions('evening')[0]).toBe('suggest.evening.1');
    expect(getContextualSuggestions('lateNight')[0]).toBe('suggest.lateNight.1');
  });

  it('cada rotación tiene al menos 3 sugerencias sin claves repetidas', () => {
    for (const timeOfDay of ALL_TIMES) {
      const keys = getContextualSuggestions(timeOfDay);
      expect(keys.length).toBeGreaterThanOrEqual(3);
      expect(new Set(keys).size).toBe(keys.length);
    }
  });

  it('todas las claves existen en los 7 idiomas y nunca se muestra una clave cruda', () => {
    expect(SUPPORTED_LOCALES.length).toBe(7);
    for (const timeOfDay of ALL_TIMES) {
      for (const key of getContextualSuggestions(timeOfDay)) {
        for (const locale of SUPPORTED_LOCALES) {
          const text = (CATALOGS[locale] as Record<string, string>)[key];
          expect(typeof text).toBe('string');
          expect(text.length).toBeGreaterThan(0);
          // Una clave cruda visible se vería como "suggest.…"
          expect(text.startsWith('suggest.')).toBe(false);
        }
      }
    }
  });

  it('las claves nuevas del hero existen en los 7 idiomas', () => {
    const heroKeys = [
      'home.surprise',
      'home.surpriseHint',
      'home.surpriseEmpty',
      'home.searchPlaceholder',
      'home.searchExamples',
      'home.tagline',
      'home.heroTitle',
    ];
    for (const key of heroKeys) {
      for (const locale of SUPPORTED_LOCALES) {
        const text = (CATALOGS[locale] as Record<string, string>)[key];
        expect(typeof text).toBe('string');
        expect(text.length).toBeGreaterThan(0);
      }
    }
  });
});
