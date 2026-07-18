import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import type { ShouldStartLoadRequest } from 'react-native-webview/lib/WebViewTypes';

import { buildLeafletHtml } from './leafletHtml';
import { MapFallback } from './MapFallback';
import { sanitizeMarkers, safeCenter, safeUserLocation } from './markers';
import { parseMapMessage } from './messages';
import { DEFAULT_MAP_HEIGHT, type MapSurfaceProps, type MapUpdatePayload } from './types';
import { LoadingState } from '../../components/FeedbackStates';
import { useAppTheme } from '../../theme/ThemeContext';
import { radii } from '../../theme/tokens';

/** Tiempo máximo para que Leaflet reporte `ready` antes de mostrar fallback. */
export const MAP_READY_TIMEOUT_MS = 15_000;

type MapStatus = 'loading' | 'ready' | 'failed';

/**
 * Implementación nativa (Android/iOS): Leaflet dentro de un WebView.
 * Requiere conexión a internet para teselas y librería. Si el mapa falla,
 * se muestra un aviso con reintento y la lista de lugares sigue disponible.
 */
export function MapSurface({
  center,
  markers,
  selectedId,
  userLocation,
  onSelectMarker,
  height = DEFAULT_MAP_HEIGHT,
}: MapSurfaceProps) {
  const { colors } = useAppTheme();
  const webviewRef = useRef<WebView>(null);
  const [status, setStatus] = useState<MapStatus>('loading');
  const [attempt, setAttempt] = useState(0);

  const payload = useMemo<MapUpdatePayload>(
    () => ({
      center: safeCenter(center),
      markers: sanitizeMarkers(markers),
      selectedId,
      userLocation: safeUserLocation(userLocation),
      palette: {
        marker: colors.brand,
        markerSelected: colors.accent,
        user: colors.success,
      },
    }),
    [center, markers, selectedId, userLocation, colors],
  );

  // El HTML inicial se genera por intento; las actualizaciones van por script
  // inyectado para no recargar el documento (ni las teselas) en cada render.
  const initialHtml = useMemo(
    () => buildLeafletHtml(payload),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [attempt],
  );

  useEffect(() => {
    if (status === 'ready') {
      webviewRef.current?.injectJavaScript(
        `if (window.__locavoUpdate) { window.__locavoUpdate(${JSON.stringify(payload)}); } true;`,
      );
    }
  }, [payload, status]);

  // Timeout: si Leaflet nunca reporta `ready`, no dejamos un spinner infinito.
  useEffect(() => {
    if (status !== 'loading') {
      return;
    }
    const timer = setTimeout(() => setStatus('failed'), MAP_READY_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [status, attempt]);

  const handleMessage = (event: WebViewMessageEvent) => {
    const message = parseMapMessage(event.nativeEvent.data);
    if (!message) {
      return;
    }
    if (message.type === 'ready') {
      setStatus('ready');
    } else if (message.type === 'error') {
      setStatus('failed');
    } else if (message.type === 'select') {
      onSelectMarker?.(message.id);
    }
  };

  // El WebView solo muestra el documento local; se bloquea cualquier
  // navegación de página (los recursos como teselas no pasan por aquí).
  const handleShouldStartLoad = useCallback((request: ShouldStartLoadRequest): boolean => {
    return request.url === 'about:blank' || request.url.startsWith('data:');
  }, []);

  const retry = () => {
    setStatus('loading');
    setAttempt((n) => n + 1);
  };

  if (status === 'failed') {
    return <MapFallback height={height} onRetry={retry} />;
  }

  return (
    <View
      accessible
      accessibilityLabel="Mapa de resultados"
      style={{
        height,
        borderRadius: radii.card,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: colors.border,
      }}
    >
      <WebView
        key={attempt}
        ref={webviewRef}
        originWhitelist={['about:blank']}
        source={{ html: initialHtml }}
        onMessage={handleMessage}
        onError={() => setStatus('failed')}
        onShouldStartLoadWithRequest={handleShouldStartLoad}
        javaScriptEnabled
        domStorageEnabled={false}
        setSupportMultipleWindows={false}
        style={{ flex: 1, backgroundColor: colors.neutralSoft }}
      />
      {status === 'loading' ? (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.mapOverlay,
          }}
        >
          <LoadingState message="Cargando mapa…" />
        </View>
      ) : null}
    </View>
  );
}
