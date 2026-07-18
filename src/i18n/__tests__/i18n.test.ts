import { CATALOGS, interpolate, translateIn } from '../I18nContext';
import { es } from '../locales/es';
import { isSupportedLocale, resolveInitialLocale, SUPPORTED_LOCALES } from '../types';

describe('catálogos', () => {
  it('soporta exactamente los 7 idiomas obligatorios', () => {
    expect([...SUPPORTED_LOCALES].sort()).toEqual(
      ['de', 'en', 'es', 'fr', 'it', 'pt', 'zh-CN'].sort(),
    );
  });

  it('todos los idiomas tienen todas las claves del catálogo base, sin vacíos', () => {
    const baseKeys = Object.keys(es).sort();
    for (const locale of SUPPORTED_LOCALES) {
      const catalog = CATALOGS[locale] as Record<string, string>;
      expect(Object.keys(catalog).sort()).toEqual(baseKeys);
      for (const key of baseKeys) {
        expect(catalog[key].length).toBeGreaterThan(0);
      }
    }
  });

  it('las traducciones funcionan sin red (empaquetadas en el bundle)', () => {
    // Los catálogos son objetos estáticos importados, no descargas.
    expect(typeof CATALOGS['zh-CN']['home.tagline']).toBe('string');
  });
});

describe('interpolate', () => {
  it('sustituye parámetros', () => {
    expect(interpolate('Hola {name}, {n} lugares', { name: 'Ana', n: 3 })).toBe(
      'Hola Ana, 3 lugares',
    );
  });

  it('deja visibles los parámetros ausentes', () => {
    expect(interpolate('Hola {name}', {})).toBe('Hola {name}');
  });
});

describe('translateIn', () => {
  it('traduce la misma clave en varios idiomas', () => {
    expect(translateIn('es', 'place.directions')).toBe('Cómo llegar');
    expect(translateIn('en', 'place.directions')).toBe('Directions');
    expect(translateIn('pt', 'place.directions')).toBe('Como chegar');
    expect(translateIn('zh-CN', 'place.directions')).toBe('路线');
  });

  it('los IDs de categorías no cambian, solo su presentación', () => {
    expect(translateIn('es', 'category.food')).toBe('Comida');
    expect(translateIn('en', 'category.food')).toBe('Food');
    expect(translateIn('de', 'category.food')).toBe('Essen');
  });
});

describe('resolveInitialLocale (visión turista-primero)', () => {
  it('coincidencia exacta y por idioma base', () => {
    expect(resolveInitialLocale(['es-MX'])).toBe('es');
    expect(resolveInitialLocale(['en-US'])).toBe('en');
    expect(resolveInitialLocale(['pt-BR'])).toBe('pt');
    expect(resolveInitialLocale(['fr-CA'])).toBe('fr');
    expect(resolveInitialLocale(['it-IT'])).toBe('it');
    expect(resolveInitialLocale(['de-AT'])).toBe('de');
  });

  it('variantes de chino → zh-CN', () => {
    expect(resolveInitialLocale(['zh-Hans-CN'])).toBe('zh-CN');
    expect(resolveInitialLocale(['zh-TW'])).toBe('zh-CN');
    expect(resolveInitialLocale(['zh'])).toBe('zh-CN');
  });

  it('idioma no soportado → inglés como lengua franca', () => {
    expect(resolveInitialLocale(['ja-JP'])).toBe('en');
    expect(resolveInitialLocale([])).toBe('en');
  });

  it('usa el primer idioma soportado de la lista del dispositivo', () => {
    expect(resolveInitialLocale(['ja-JP', 'pt-BR', 'en-US'])).toBe('pt');
  });
});

describe('isSupportedLocale', () => {
  it('valida valores persistidos', () => {
    expect(isSupportedLocale('es')).toBe(true);
    expect(isSupportedLocale('zh-CN')).toBe(true);
    expect(isSupportedLocale('jp')).toBe(false);
    expect(isSupportedLocale(null)).toBe(false);
  });
});
