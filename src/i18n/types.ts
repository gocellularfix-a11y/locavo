/**
 * Núcleo de internacionalización de Locavo (requisito fundacional).
 *
 * - 7 idiomas soportados desde V3; catálogos empaquetados en el bundle,
 *   por lo que la interfaz traducida funciona completamente sin internet.
 * - Las claves están tipadas contra el catálogo base (español): si a un
 *   idioma le falta una clave, el proyecto no compila.
 * - La interfaz se traduce; los DATOS no: nombres comerciales, calles,
 *   colonias y ciudades se muestran siempre en su forma original.
 */

export const SUPPORTED_LOCALES = ['es', 'en', 'pt', 'fr', 'it', 'de', 'zh-CN'] as const;

export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: SupportedLocale = 'es';

/** Autónimos para el selector de idioma (iguales en todos los catálogos). */
export const LOCALE_NAMES: Record<SupportedLocale, string> = {
  es: 'Español',
  en: 'English',
  pt: 'Português',
  fr: 'Français',
  it: 'Italiano',
  de: 'Deutsch',
  'zh-CN': '中文（简体）',
};

export function isSupportedLocale(value: unknown): value is SupportedLocale {
  return typeof value === 'string' && (SUPPORTED_LOCALES as readonly string[]).includes(value);
}

/**
 * Resuelve el idioma inicial a partir de las preferencias del dispositivo.
 * Regla: coincidencia exacta → coincidencia por idioma base (pt-BR → pt,
 * zh-Hans/zh → zh-CN) → español si el dispositivo está en español →
 * inglés como lengua franca para el resto (visión turista-primero).
 */
export function resolveInitialLocale(deviceTags: string[]): SupportedLocale {
  for (const tag of deviceTags) {
    if (isSupportedLocale(tag)) {
      return tag;
    }
    const base = tag.toLowerCase().split('-')[0];
    if (base === 'zh') {
      return 'zh-CN';
    }
    const match = SUPPORTED_LOCALES.find((locale) => locale.toLowerCase().split('-')[0] === base);
    if (match) {
      return match;
    }
  }
  return 'en';
}
