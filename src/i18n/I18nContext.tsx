import AsyncStorage from '@react-native-async-storage/async-storage';
import { getLocales } from 'expo-localization';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { de } from './locales/de';
import { en } from './locales/en';
import { es, type TranslationCatalog, type TranslationKey } from './locales/es';
import { fr } from './locales/fr';
import { it } from './locales/it';
import { pt } from './locales/pt';
import { zhCN } from './locales/zh-CN';
import {
  DEFAULT_LOCALE,
  isSupportedLocale,
  resolveInitialLocale,
  type SupportedLocale,
} from './types';

export const CATALOGS: Record<SupportedLocale, TranslationCatalog> = {
  es,
  en,
  pt,
  fr,
  it,
  de,
  'zh-CN': zhCN,
};

export type TranslateParams = Record<string, string | number>;
export type Translate = (key: TranslationKey, params?: TranslateParams) => string;

/** Sustituye {param} en la plantilla. Parámetros ausentes se dejan visibles. */
export function interpolate(template: string, params?: TranslateParams): string {
  if (!params) {
    return template;
  }
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    params[name] !== undefined ? String(params[name]) : match,
  );
}

/** Traducción pura (usable fuera de React). Fallback: catálogo base (es). */
export function translateIn(
  locale: SupportedLocale,
  key: TranslationKey,
  params?: TranslateParams,
): string {
  const catalog = CATALOGS[locale] ?? CATALOGS[DEFAULT_LOCALE];
  return interpolate(catalog[key] ?? CATALOGS[DEFAULT_LOCALE][key], params);
}

interface I18nState {
  locale: SupportedLocale;
  setLocale: (locale: SupportedLocale) => void;
  t: Translate;
}

const STORAGE_KEY = 'locavo.locale.v1';

const I18nContext = createContext<I18nState | null>(null);

function deviceLocale(): SupportedLocale {
  // Render estático (SSR/export web): idioma base; el cliente ajusta al
  // idioma del dispositivo o al persistido durante la hidratación.
  if (typeof window === 'undefined') {
    return DEFAULT_LOCALE;
  }
  try {
    const tags = getLocales()
      .map((l) => l.languageTag)
      .filter((tag): tag is string => typeof tag === 'string');
    return resolveInitialLocale(tags);
  } catch {
    return DEFAULT_LOCALE;
  }
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<SupportedLocale>(deviceLocale);

  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((stored) => {
        if (!cancelled && isSupportedLocale(stored)) {
          setLocaleState(stored);
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const setLocale = useCallback((next: SupportedLocale) => {
    setLocaleState(next);
    AsyncStorage.setItem(STORAGE_KEY, next).catch(() => undefined);
  }, []);

  const value = useMemo<I18nState>(
    () => ({
      locale,
      setLocale,
      t: (key, params) => translateIn(locale, key, params),
    }),
    [locale, setLocale],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nState {
  const state = useContext(I18nContext);
  if (!state) {
    throw new Error('useI18n debe usarse dentro de I18nProvider');
  }
  return state;
}
