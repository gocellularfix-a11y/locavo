/**
 * Identidad central del producto (única fuente de verdad).
 *
 * El dominio oficial es locavoapp.com, pero el producto se llama "Locavo"
 * (nunca "Locavo App" fuera del propio dominio). En Fase 1.x el dominio aún
 * no apunta a la aplicación: no hay deploy ni DNS configurado; las URLs
 * quedan preparadas para cuando se publique el build web.
 */

const CANONICAL_URL = 'https://locavoapp.com';

export const APP_CONFIG = {
  name: 'Locavo',
  shortName: 'Locavo',
  slug: 'locavo',
  domain: 'locavoapp.com',
  canonicalUrl: CANONICAL_URL,
  privacyUrl: `${CANONICAL_URL}/privacy`,
  termsUrl: `${CANONICAL_URL}/terms`,
  supportUrl: `${CANONICAL_URL}/support`,
  description:
    'Locavo te ayuda a decidir rápidamente dónde comer, tomar café, comprar o salir cerca de ti.',
  themeColor: '#FF5A36',
  backgroundColor: '#F7F7F5',
  locale: 'es-MX',
} as const;

export type AppConfig = typeof APP_CONFIG;
