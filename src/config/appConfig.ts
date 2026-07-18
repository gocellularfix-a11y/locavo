/**
 * Identidad central del producto.
 *
 * El dominio oficial es locavoapp.com, pero el producto se llama "Locavo"
 * (nunca "Locavo App" fuera del propio dominio). En Fase 1 el dominio aún
 * no apunta a la aplicación: solo se deja la configuración preparada para
 * cuando se publique el build web.
 */
export const APP_CONFIG = {
  name: 'Locavo',
  shortName: 'Locavo',
  domain: 'locavoapp.com',
  canonicalUrl: 'https://locavoapp.com',
  description:
    'Locavo te ayuda a decidir a dónde ir ahora en Culiacán. No busques. Decide.',
  themeColor: '#FF5A36',
  backgroundColor: '#F7F7F5',
  locale: 'es-MX',
} as const;
