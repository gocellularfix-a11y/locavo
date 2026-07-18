import * as L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import React, { useEffect, useRef } from 'react';
import { View } from 'react-native';

import { DEFAULT_MAP_HEIGHT, DEFAULT_ZOOM, type MapSurfaceProps } from './types';
import { useAppTheme } from '../../theme/ThemeContext';
import { radii } from '../../theme/tokens';

/**
 * Implementación web: Leaflet directo sobre el DOM con teselas de
 * OpenStreetMap. Sin claves de API.
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
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerLayerRef = useRef<L.LayerGroup | null>(null);
  const userLayerRef = useRef<L.LayerGroup | null>(null);
  const onSelectRef = useRef(onSelectMarker);

  useEffect(() => {
    onSelectRef.current = onSelectMarker;
  }, [onSelectMarker]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) {
      return;
    }
    const map = L.map(containerRef.current, {
      zoomControl: true,
      attributionControl: true,
    }).setView([center.latitude, center.longitude], DEFAULT_ZOOM);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap',
    }).addTo(map);
    mapRef.current = map;
    markerLayerRef.current = L.layerGroup().addTo(map);
    userLayerRef.current = L.layerGroup().addTo(map);

    return () => {
      map.remove();
      mapRef.current = null;
      markerLayerRef.current = null;
      userLayerRef.current = null;
    };
    // Solo montaje/desmontaje: el centro se actualiza en otro efecto.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    mapRef.current?.setView([center.latitude, center.longitude], mapRef.current.getZoom());
  }, [center.latitude, center.longitude]);

  useEffect(() => {
    const layer = markerLayerRef.current;
    if (!layer) {
      return;
    }
    layer.clearLayers();
    for (const m of markers) {
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
  }, [markers, selectedId, colors]);

  useEffect(() => {
    const layer = userLayerRef.current;
    if (!layer) {
      return;
    }
    layer.clearLayers();
    if (userLocation) {
      L.circleMarker([userLocation.latitude, userLocation.longitude], {
        radius: 6,
        color: colors.success,
        fillColor: colors.success,
        fillOpacity: 1,
        weight: 2,
      })
        .bindTooltip('Tu ubicación')
        .addTo(layer);
    }
  }, [userLocation, colors]);

  return (
    <View
      accessibilityLabel="Mapa de resultados"
      style={{
        height,
        borderRadius: radii.card,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: colors.border,
      }}
    >
      <div
        ref={containerRef}
        role="application"
        aria-label="Mapa de resultados"
        style={{ width: '100%', height: '100%' }}
      />
    </View>
  );
}
