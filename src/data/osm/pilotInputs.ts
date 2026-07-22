/**
 * Entradas del pilot OSM (V4F-0), puras y reutilizadas por el script de build y
 * las pruebas: los 500 lugares DENUE canónicos y los POIs OSM del snapshot.
 */
import type { LocavoPlace } from '../../domain/places/LocavoPlace';
import { buildBundledCuliacanPack } from '../places/citypack/buildBundledPack';
import { cityPackPlaceToLocavoPlace } from '../places/citypack/CityPackPlaceMapper';
import type { OsmPoi, OsmPoiDocument } from './OsmEnrichment';

/** Los 500 lugares DENUE canónicos, hidratados a LocavoPlace (determinista). */
export function denuePlacesFromCsv(csvText: string): LocavoPlace[] {
  const { build } = buildBundledCuliacanPack(csvText);
  return build.pack.places.map(cityPackPlaceToLocavoPlace);
}

/** Parsea y valida el documento de POIs OSM (data/osm/culiacan/osm-pois.json). */
export function parseOsmPoiDocument(json: string): OsmPoi[] {
  const doc = JSON.parse(json) as OsmPoiDocument;
  if (
    typeof doc !== 'object' ||
    doc === null ||
    doc.format !== 'locavo-osm-pois' ||
    !Array.isArray(doc.pois)
  ) {
    throw new Error('Documento de POIs OSM inválido');
  }
  return doc.pois;
}
