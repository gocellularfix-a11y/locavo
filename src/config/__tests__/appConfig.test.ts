import { APP_CONFIG } from '../appConfig';

describe('APP_CONFIG', () => {
  it('el producto se llama Locavo (no "Locavo App")', () => {
    expect(APP_CONFIG.name).toBe('Locavo');
    expect(APP_CONFIG.shortName).toBe('Locavo');
    expect(APP_CONFIG.name).not.toMatch(/app/i);
  });

  it('dominio y URL canónica oficiales', () => {
    expect(APP_CONFIG.domain).toBe('locavoapp.com');
    expect(APP_CONFIG.canonicalUrl).toBe('https://locavoapp.com');
  });

  it('las URLs públicas derivan del dominio canónico y usan https', () => {
    for (const url of [
      APP_CONFIG.canonicalUrl,
      APP_CONFIG.privacyUrl,
      APP_CONFIG.termsUrl,
      APP_CONFIG.supportUrl,
    ]) {
      expect(url.startsWith('https://locavoapp.com')).toBe(true);
    }
    expect(APP_CONFIG.privacyUrl).toBe('https://locavoapp.com/privacy');
    expect(APP_CONFIG.termsUrl).toBe('https://locavoapp.com/terms');
    expect(APP_CONFIG.supportUrl).toBe('https://locavoapp.com/support');
  });

  it('slug e idioma esperados', () => {
    expect(APP_CONFIG.slug).toBe('locavo');
    expect(APP_CONFIG.locale).toBe('es-MX');
  });
});
