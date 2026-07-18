import { ScrollViewStyleReset } from 'expo-router/html';
import React, { type PropsWithChildren } from 'react';

import { APP_CONFIG } from '../config/appConfig';

/**
 * Shell HTML de la versión web (solo se ejecuta en build web estático).
 * Declara la metadata PWA/SEO y registra el service worker.
 */

const SERVICE_WORKER_REGISTRATION = `
if ('serviceWorker' in navigator) {
  window.addEventListener('load', function () {
    navigator.serviceWorker.register('/sw.js').catch(function () {});
  });
}
`;

export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang={APP_CONFIG.locale}>
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover"
        />
        <title>{APP_CONFIG.name}</title>
        <meta name="description" content={APP_CONFIG.description} />
        <link rel="canonical" href={APP_CONFIG.canonicalUrl} />
        <meta name="theme-color" content={APP_CONFIG.themeColor} />
        <meta name="application-name" content={APP_CONFIG.name} />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-title" content={APP_CONFIG.name} />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content={APP_CONFIG.name} />
        <meta property="og:title" content={APP_CONFIG.name} />
        <meta property="og:description" content={APP_CONFIG.description} />
        <meta property="og:url" content={APP_CONFIG.canonicalUrl} />
        <meta property="og:locale" content={APP_CONFIG.locale.replace('-', '_')} />
        <link rel="manifest" href="/manifest.webmanifest" />
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
        <ScrollViewStyleReset />
        <script dangerouslySetInnerHTML={{ __html: SERVICE_WORKER_REGISTRATION }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
