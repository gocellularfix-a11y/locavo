/**
 * Contratos del pilot de enriquecimiento OSM (V4F-0).
 *
 * El sidecar `osm-enrichment.json` es la BASE DE DATOS DERIVADA DE OSM: única,
 * separable y removible. Solo contiene entradas AUTO-SAFE con los campos
 * aprobados efectivamente ingeridos. Los casos AMBIGUOUS/NO-MATCH viven en el
 * reporte de diagnóstico, nunca en el sidecar de runtime.
 */
import type { OpeningHours } from '../../domain/place';
import type { PlaceMatchReason } from '../../services/places/PlaceMergeService';

export type OsmClassification = 'auto-safe' | 'ambiguous' | 'no-match';

/** POI OSM crudo (derivado del snapshot congelado, ver scripts/osm/extract-pois.py). */
export interface OsmPoi {
  osmId: string;
  lat: number;
  lon: number;
  tags: Record<string, string>;
}

export interface OsmPoiDocument {
  format: 'locavo-osm-pois';
  schemaVersion: number;
  pois: OsmPoi[];
}

/** Un campo escalar ingerido (o rechazado, con motivo). */
export interface OsmFieldIngestion<T> {
  value: T;
  ingested: boolean;
  reason?: string;
}

export interface OsmHoursIngestion {
  ingested: boolean;
  supported: boolean;
  raw: string;
  value?: OpeningHours;
}

export interface OsmEnrichmentFields {
  phone?: OsmFieldIngestion<string>;
  website?: OsmFieldIngestion<string>;
  hours?: OsmHoursIngestion;
  wheelchairAccessible?: OsmFieldIngestion<boolean>;
  outdoorSeating?: OsmFieldIngestion<boolean>;
  parking?: OsmFieldIngestion<boolean>;
  delivery?: OsmFieldIngestion<boolean>;
}

/** Entrada del sidecar: SOLO lugares AUTO-SAFE, keyed por locavoPlaceId. */
export interface OsmEnrichmentEntry {
  locavoPlaceId: string;
  osmId: string;
  confidence: number;
  reasons: PlaceMatchReason[];
  distanceMeters: number;
  nameSimilarity: number;
  fields: OsmEnrichmentFields;
}

export interface OsmEnrichmentSidecar {
  format: 'locavo-osm-enrichment';
  schemaVersion: number;
  pipelineVersion: number;
  city: string;
  license: string;
  attribution: string;
  snapshotSource: string;
  configFingerprint: string;
  entries: OsmEnrichmentEntry[];
}

/** Índice de runtime: locavoPlaceId → entrada (memoizado tras cargar el sidecar). */
export type OsmEnrichmentIndex = Map<string, OsmEnrichmentEntry>;

export function indexEnrichmentSidecar(sidecar: OsmEnrichmentSidecar): OsmEnrichmentIndex {
  const index: OsmEnrichmentIndex = new Map();
  for (const entry of sidecar.entries) {
    index.set(entry.locavoPlaceId, entry);
  }
  return index;
}

/** Valida forma mínima del sidecar; lanza si el formato es desconocido. */
export function assertEnrichmentSidecar(value: unknown): OsmEnrichmentSidecar {
  const s = value as OsmEnrichmentSidecar;
  if (
    typeof s !== 'object' ||
    s === null ||
    s.format !== 'locavo-osm-enrichment' ||
    !Array.isArray(s.entries)
  ) {
    throw new Error('Sidecar de enriquecimiento OSM inválido');
  }
  return s;
}
