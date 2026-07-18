import type { MapUpdatePayload } from './types';
import { DEFAULT_ZOOM } from './types';

/**
 * Documento HTML autocontenido para el WebView nativo.
 * Carga Leaflet desde CDN (requiere red, igual que las teselas del mapa)
 * y expone `window.__locavoUpdate(payload)` para actualizaciones sin
 * recargar el documento.
 *
 * Protocolo hacia la app (ver messages.ts): {type:'ready'} cuando el mapa
 * queda inicializado, {type:'error'} si Leaflet no pudo cargarse y
 * {type:'select', id} al tocar un marcador.
 */
export function buildLeafletHtml(initial: MapUpdatePayload): string {
  const initialJson = JSON.stringify(initial).replace(/</g, '\\u003c');
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
<style>
  html, body, #map { margin: 0; padding: 0; height: 100%; width: 100%; background: #dddddd; }
</style>
</head>
<body>
<div id="map" role="application" aria-label="Mapa de resultados"></div>
<script>
  function locavoPost(message) {
    if (window.ReactNativeWebView) {
      window.ReactNativeWebView.postMessage(JSON.stringify(message));
    }
  }
  window.addEventListener('error', function () {
    if (!window.L) { locavoPost({ type: 'error' }); }
  });
</script>
<script
  src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"
  onerror="locavoPost({ type: 'error' })"
></script>
<script>
  (function () {
    if (!window.L) {
      locavoPost({ type: 'error' });
      return;
    }
    try {
      var state = ${initialJson};
      var map = L.map('map', { zoomControl: true, attributionControl: true })
        .setView([state.center.latitude, state.center.longitude], ${DEFAULT_ZOOM});
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap'
      }).addTo(map);

      var markerLayer = L.layerGroup().addTo(map);
      var userLayer = L.layerGroup().addTo(map);

      function render() {
        markerLayer.clearLayers();
        state.markers.forEach(function (m) {
          var selected = m.id === state.selectedId;
          var marker = L.circleMarker([m.latitude, m.longitude], {
            radius: selected ? 11 : 7,
            color: selected ? state.palette.markerSelected : state.palette.marker,
            fillColor: selected ? state.palette.markerSelected : state.palette.marker,
            fillOpacity: selected ? 0.95 : 0.75,
            weight: selected ? 3 : 2
          });
          marker.bindTooltip(m.label);
          marker.on('click', function () { locavoPost({ type: 'select', id: m.id }); });
          marker.addTo(markerLayer);
        });

        userLayer.clearLayers();
        if (state.userLocation) {
          L.circleMarker([state.userLocation.latitude, state.userLocation.longitude], {
            radius: 6,
            color: state.palette.user,
            fillColor: state.palette.user,
            fillOpacity: 1,
            weight: 2
          }).bindTooltip('Tu ubicación').addTo(userLayer);
        }
      }

      window.__locavoUpdate = function (next) {
        var centerChanged = next.center.latitude !== state.center.latitude ||
          next.center.longitude !== state.center.longitude;
        state = next;
        render();
        if (centerChanged) {
          map.setView([state.center.latitude, state.center.longitude], map.getZoom());
        }
      };

      render();
      locavoPost({ type: 'ready' });
    } catch (e) {
      locavoPost({ type: 'error' });
    }
  })();
</script>
</body>
</html>`;
}
