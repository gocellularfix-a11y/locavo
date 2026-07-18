import React, { useEffect, useMemo, useRef } from 'react';
import { View } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';

import { buildLeafletHtml } from './leafletHtml';
import { DEFAULT_MAP_HEIGHT, type MapSurfaceProps, type MapUpdatePayload } from './types';
import { useAppTheme } from '../../theme/ThemeContext';
import { radii } from '../../theme/tokens';

/**
 * Implementación nativa (Android/iOS): Leaflet dentro de un WebView.
 * Requiere conexión a internet para teselas y librería, igual que
 * cualquier mapa en línea.
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

  const payload = useMemo<MapUpdatePayload>(
    () => ({
      center,
      markers,
      selectedId,
      userLocation,
      palette: {
        marker: colors.brand,
        markerSelected: colors.accent,
        user: colors.success,
      },
    }),
    [center, markers, selectedId, userLocation, colors],
  );

  // El HTML inicial se genera una sola vez; después se actualiza por script.
  const initialHtml = useMemo(
    () => buildLeafletHtml(payload),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  useEffect(() => {
    webviewRef.current?.injectJavaScript(
      `if (window.__locavoUpdate) { window.__locavoUpdate(${JSON.stringify(payload)}); } true;`,
    );
  }, [payload]);

  const handleMessage = (event: WebViewMessageEvent) => {
    try {
      const data: unknown = JSON.parse(event.nativeEvent.data);
      if (
        typeof data === 'object' &&
        data !== null &&
        (data as { type?: string }).type === 'select' &&
        typeof (data as { id?: string }).id === 'string'
      ) {
        onSelectMarker?.((data as { id: string }).id);
      }
    } catch {
      // Mensaje no reconocido: se ignora.
    }
  };

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
        ref={webviewRef}
        originWhitelist={['*']}
        source={{ html: initialHtml }}
        onMessage={handleMessage}
        javaScriptEnabled
        domStorageEnabled={false}
        setSupportMultipleWindows={false}
        style={{ flex: 1, backgroundColor: colors.neutralSoft }}
      />
    </View>
  );
}
