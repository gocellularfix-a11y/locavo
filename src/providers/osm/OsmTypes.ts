/**
 * Tipos mínimos de OpenStreetMap (elementos de Overpass API).
 * Complemento abierto previsto; NO conectado en V3.
 */
export interface OsmElement {
  type: 'node' | 'way' | 'relation';
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

export interface OverpassResponse {
  elements: OsmElement[];
}
