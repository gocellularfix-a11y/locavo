import * as L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import React, { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';

import { MapFallback } from './MapFallback';
import { sanitizeMarkers, safeCenter, safeUserLocation } from './markers';
import { DEFAULT_MAP_HEIGHT, DEFAULT_ZOOM, type MapSurfaceProps } from './types';
import { useI18n } from '../../i18n/I18nContext';
import { useAppTheme } from '../../theme/ThemeContext';
import { radii } from '../../theme/tokens';

/**
 * Implementación web: Leaflet directo sobre el DOM con teselas de
 * OpenStreetMap. Sin claves de API. Si la inicialización falla, se muestra
 * un aviso con reintento y la lista sigue funcionando.
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
  const { t } = useI18n();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerLayerRef = useRef<L.LayerGroup | null>(null);
  const userLayerRef = useRef<L.LayerGroup | null>(null);
  const onSelectRef = useRef(onSelectMarker);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  const centerSafe = safeCenter(center);

  useEffect(() => {
    onSelectRef.current = onSelectMarker;
  }, [onSelectMarker]);

  useEffect(() => {
    // Guarda SSR/export estático: Leaflet solo se inicializa en navegador.
    if (typeof window === 'undefined' || !containerRef.current || mapRef.current) {
      return;
    }
    let map: L.Map | null = null;
    let observer: ResizeObserver | null = null;
    try {
      map = L.map(containerRef.current, {
        zoomControl: true,
        attributionControl: true,
      }).setView([centerSafe.latitude, centerSafe.longitude], DEFAULT_ZOOM);
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap',
      }).addTo(map);
      mapRef.current = map;
      markerLayerRef.current = L.layerGroup().addTo(map);
      userLayerRef.current = L.layerGroup().addTo(map);

      // Mantiene el mapa correcto al cambiar el tamaño del contenedor
      // (rotación, panel dividido, redimensionar la ventana).
      if (typeof ResizeObserver !== 'undefined') {
        observer = new ResizeObserver(() => {
          mapRef.current?.invalidateSize();
        });
        observer.observe(containerRef.current);
      }
    } catch {
      // Diferido: evita setState síncrono dentro del cuerpo del efecto.
      queueMicrotask(() => setFailed(true));
    }

    return () => {
      observer?.disconnect();
      map?.remove();
      mapRef.current = null;
      markerLayerRef.current = null;
      userLayerRef.current = null;
    };
    // Solo montaje/desmontaje (o reintento): el centro se actualiza aparte.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt]);

  useEffect(() => {
    mapRef.current?.setView([centerSafe.latitude, centerSafe.longitude], mapRef.current.getZoom());
  }, [centerSafe.latitude, centerSafe.longitude]);

  useEffect(() => {
    const layer = markerLayerRef.current;
    if (!layer) {
      return;
    }
    layer.clearLayers();
    for (const m of sanitizeMarkers(markers)) {
      const selected = m.id === selectedId;
      const marker = L.circleMarker([m.latitude, m.longitude], {
        radius: selected ? 11 : 7,
        color: selected ? colors.accent : colors.brand,
        fillColor: selected ? colors.accent : colors.brand,
        fillOpacity: selected ? 0.95 : 0.75,
        weight: selected ? 3 : 2,
      });
      marker.bindTooltip(m.label);
      marker.on('click', () => onSelectRef.current?.(m.id));
      marker.addTo(layer);
    }
  }, [markers, selectedId, colors, attempt]);

  useEffect(() => {
    const layer = userLayerRef.current;
    if (!layer) {
      return;
    }
    layer.clearLayers();
    const user = safeUserLocation(userLocation);
    if (user) {
      L.circleMarker([user.latitude, user.longitude], {
        radius: 6,
        color: colors.success,
        fillColor: colors.success,
        fillOpacity: 1,
        weight: 2,
      })
        .bindTooltip(t('map.yourLocation'))
        .addTo(layer);
    }
  }, [userLocation, colors, attempt, t]);

  if (failed) {
    return (
      <MapFallback
        height={height}
        onRetry={() => {
          setFailed(false);
          setAttempt((n) => n + 1);
        }}
      />
    );
  }

  return (
    <View
      accessibilityLabel={t('map.a11y')}
      style={{
        height,
        borderRadius: radii.card,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: colors.border,
      }}
    >
      <div
        key={attempt}
        ref={containerRef}
        role="application"
        aria-label={t('map.a11y')}
        style={{ width: '100%', height: '100%' }}
      />
    </View>
  );
}
