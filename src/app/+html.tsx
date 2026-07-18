import { ScrollViewStyleReset } from 'expo-router/html';
import React, { type PropsWithChildren } from 'react';

/**
 * Shell HTML de la versión web (solo se ejecuta en build web estático).
 * Declara la metadata PWA y registra el service worker.
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
    <html lang="es-MX">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover"
        />
        <title>Locavo</title>
        <meta
          name="description"
          content="Locavo te ayuda a decidir a dónde ir ahora en Culiacán. No busques. Decide."
        />
        <meta name="theme-color" content="#FF5A36" />
        <meta name="application-name" content="Locavo" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-title" content="Locavo" />
        <meta name="mobile-web-app-capable" content="yes" />
        <link rel="manifest" href="/manifest.webmanifest" />
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
        <ScrollViewStyleReset />
        <script dangerouslySetInnerHTML={{ __html: SERVICE_WORKER_REGISTRATION }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
