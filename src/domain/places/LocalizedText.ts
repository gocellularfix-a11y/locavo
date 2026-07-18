import type { PlaceSource } from './LocavoPlace';
import type { SupportedLocale } from '../../i18n/types';

/**
 * Contenido localizado de negocios (V3 — preparado, sin uso visible aún).
 *
 * Regla central: el TEXTO ORIGINAL nunca se sobrescribe. Las traducciones
 * son campos separados que se agregan junto al original con su propia
 * fecha y fuente. Los nombres oficiales, calles, colonias y nombres
 * comerciales NO se traducen jamás ("Mariscos El Güero" permanece igual).
 */

export interface OriginalText {
  text: string;
  /** Idioma original (BCP-47, p. ej. 'es-MX'). */
  language: string;
  source: PlaceSource;
  capturedAt: string;
}

export interface TranslatedText {
  text: string;
  translatedAt: string;
  /** Origen de la traducción (p. ej. 'owner', 'community', 'locavo'). */
  source: PlaceSource;
}

export interface LocalizedText {
  original: OriginalText;
  translations?: Partial<Record<SupportedLocale, TranslatedText>>;
}

/**
 * Texto a mostrar para un locale: traducción si existe, si no el original.
 * Nunca modifica la estructura.
 */
export function localizedTextFor(content: LocalizedText, locale: SupportedLocale): string {
  return content.translations?.[locale]?.text ?? content.original.text;
}

/**
 * Agrega/reemplaza una traducción devolviendo una copia; el original queda
 * intacto por construcción.
 */
export function withTranslation(
  content: LocalizedText,
  locale: SupportedLocale,
  translation: TranslatedText,
): LocalizedText {
  return {
    original: content.original,
    translations: { ...content.translations, [locale]: translation },
  };
}
