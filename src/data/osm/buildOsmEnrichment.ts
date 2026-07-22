/**
 * Pipeline determinista de enriquecimiento OSM (V4F-0) — función pura.
 *
 * Entrada: lugares DENUE canónicos + POIs OSM (del snapshot congelado) + config.
 * Salida: el sidecar (solo AUTO-SAFE con campos ingeridos) + un reporte de
 * métricas y diagnósticos. Mismas entradas → mismos bytes.
 */
import { haversineKm } from '../../domain/distance';
import type { LocavoPlace } from '../../domain/places/LocavoPlace';
import {
  normalizedDigits,
  websiteDomain,
  type PlaceMatchReason,
} from '../../services/places/PlaceMergeService';
import {
  indexEnrichmentSidecar,
  type OsmEnrichmentEntry,
  type OsmEnrichmentFields,
  type OsmEnrichmentIndex,
  type OsmEnrichmentSidecar,
  type OsmPoi,
} from './OsmEnrichment';
import { buildCandidates, type OsmCandidate } from './osmCandidates';
import { categoryCompatible } from './osmCategoryMap';
import { classifyDenuePlace, type AmbiguityReason } from './classifyOsmMatch';
import { configFingerprint, OSM_MATCH_CONFIG, type OsmMatchConfig } from './osmMatchConfig';
import {
  extractPhone,
  extractWebsite,
  parseDelivery,
  parseOpeningHours,
  parseWheelchair,
  parseYesNo,
} from './osmSignals';

export interface AmbiguousCandidateView {
  osmId: string;
  name: string;
  distanceMeters: number;
  confidence: number;
  reasons: PlaceMatchReason[];
  categoryCompatible: boolean;
}

export interface AmbiguousReportEntry {
  locavoPlaceId: string;
  denueName: string;
  category: string;
  latitude: number;
  longitude: number;
  reason: AmbiguityReason;
  candidates: AmbiguousCandidateView[];
}

export interface ContentionRecord {
  osmId: string;
  winner: string;
  losers: string[];
}

export interface OsmEnrichmentReport {
  totals: { denue: number; autoSafe: number; ambiguous: number; noMatch: number };
  autoSafeByReason: Record<string, number>;
  candidateStats: {
    placesWithCandidates: number;
    totalCandidatesEvaluated: number;
    maxCandidatesForAPlace: number;
  };
  coverage: Record<string, number>;
  conflicts: {
    phoneDiffers: number;
    websiteDiffers: number;
    wheelchairNo: number;
    wheelchairLimited: number;
    hoursUnsupported: number;
  };
  distanceStats: {
    autoSafeMedianMeters: number;
    p90Meters: number;
    p95Meters: number;
    over100m: number;
    over250m: number;
  };
  ambiguous: AmbiguousReportEntry[];
  contention: ContentionRecord[];
}

export interface OsmEnrichmentBuildResult {
  sidecar: OsmEnrichmentSidecar;
  index: OsmEnrichmentIndex;
  report: OsmEnrichmentReport;
}

export interface BuildOsmEnrichmentOptions {
  city?: string;
  snapshotSource?: string;
  pipelineVersion?: number;
  config?: OsmMatchConfig;
}

const COVERAGE_TAGS = [
  'phone',
  'website',
  'opening_hours',
  'wheelchair',
  'outdoor_seating',
  'parking',
  'delivery',
  'internet_access',
  'cuisine',
] as const;

function hasCoverageTag(poi: OsmPoi, key: string): boolean {
  if (key === 'phone') {
    return poi.tags.phone !== undefined || poi.tags['contact:phone'] !== undefined;
  }
  if (key === 'website') {
    return poi.tags.website !== undefined || poi.tags['contact:website'] !== undefined;
  }
  return poi.tags[key] !== undefined;
}

function percentile(sortedAsc: number[], p: number): number {
  if (sortedAsc.length === 0) {
    return 0;
  }
  const idx = Math.min(sortedAsc.length - 1, Math.max(0, Math.ceil(p * sortedAsc.length) - 1));
  return sortedAsc[idx];
}

interface FieldIngestionOutcome {
  fields: OsmEnrichmentFields;
  ingestedCount: number;
  conflicts: {
    phoneDiffers: boolean;
    websiteDiffers: boolean;
    wheelchairNo: boolean;
    wheelchairLimited: boolean;
    hoursUnsupported: boolean;
  };
}

function ingestFields(denue: LocavoPlace, poi: OsmPoi): FieldIngestionOutcome {
  const fields: OsmEnrichmentFields = {};
  const conflicts = {
    phoneDiffers: false,
    websiteDiffers: false,
    wheelchairNo: false,
    wheelchairLimited: false,
    hoursUnsupported: false,
  };
  let ingestedCount = 0;

  const osmPhone = extractPhone(poi.tags);
  if (osmPhone) {
    const denuePhone = normalizedDigits(denue.contact?.phone);
    if (denuePhone === null) {
      fields.phone = { value: osmPhone, ingested: true };
      ingestedCount++;
    } else {
      const differs = normalizedDigits(osmPhone) !== denuePhone;
      fields.phone = { value: osmPhone, ingested: false, reason: differs ? 'conflict' : 'denue-present' };
      conflicts.phoneDiffers = differs;
    }
  }

  const osmWebsite = extractWebsite(poi.tags);
  if (osmWebsite) {
    const denueSite = websiteDomain(denue.contact?.website);
    if (denueSite === null) {
      fields.website = { value: osmWebsite, ingested: true };
      ingestedCount++;
    } else {
      const differs = websiteDomain(osmWebsite) !== denueSite;
      fields.website = { value: osmWebsite, ingested: false, reason: differs ? 'conflict' : 'denue-present' };
      conflicts.websiteDiffers = differs;
    }
  }

  const rawHours = poi.tags.opening_hours;
  if (rawHours !== undefined) {
    const parsed = parseOpeningHours(rawHours);
    if (parsed) {
      fields.hours = { ingested: true, supported: true, raw: rawHours, value: parsed };
      ingestedCount++;
    } else {
      fields.hours = { ingested: false, supported: false, raw: rawHours };
      conflicts.hoursUnsupported = true;
    }
  }

  const wheelchair = parseWheelchair(poi.tags.wheelchair);
  if (wheelchair.value === true) {
    fields.wheelchairAccessible = { value: true, ingested: true };
    ingestedCount++;
  } else if (wheelchair.diagnostic === 'no') {
    conflicts.wheelchairNo = true;
  } else if (wheelchair.diagnostic === 'limited') {
    conflicts.wheelchairLimited = true;
  }

  const outdoor = parseYesNo(poi.tags.outdoor_seating);
  if (outdoor !== undefined) {
    fields.outdoorSeating = { value: outdoor, ingested: true };
    ingestedCount++;
  }
  const parking = parseYesNo(poi.tags.parking);
  if (parking !== undefined) {
    fields.parking = { value: parking, ingested: true };
    ingestedCount++;
  }
  const delivery = parseDelivery(poi.tags.delivery);
  if (delivery !== undefined) {
    fields.delivery = { value: delivery, ingested: true };
    ingestedCount++;
  }

  return { fields, ingestedCount, conflicts };
}

/** Ordena lugares DENUE de forma estable por locavoPlaceId. */
function sortById(a: LocavoPlace, b: LocavoPlace): number {
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

export function buildOsmEnrichment(
  denuePlaces: readonly LocavoPlace[],
  pois: readonly OsmPoi[],
  options: BuildOsmEnrichmentOptions = {},
): OsmEnrichmentBuildResult {
  const config = options.config ?? OSM_MATCH_CONFIG;
  const candidates = buildCandidates(pois);
  const byOsmId = new Map<string, OsmCandidate>();
  for (const candidate of candidates) {
    byOsmId.set(candidate.poi.osmId, candidate);
  }

  const places = [...denuePlaces].sort(sortById);

  // Candidatos en rango por lugar (categoría compatible + <= radio).
  const inRange = new Map<string, OsmCandidate[]>();
  let totalCandidatesEvaluated = 0;
  let maxCandidatesForAPlace = 0;
  for (const place of places) {
    const list: OsmCandidate[] = [];
    for (const candidate of candidates) {
      if (!categoryCompatible(place.category, candidate.osmCategory)) {
        continue;
      }
      const meters = haversineKm(place.coordinates, candidate.place.coordinates) * 1000;
      if (meters <= config.candidateRadiusMeters) {
        list.push(candidate);
      }
    }
    inRange.set(place.id, list);
    totalCandidatesEvaluated += list.length;
    maxCandidatesForAPlace = Math.max(maxCandidatesForAPlace, list.length);
  }

  // Clasificación con resolución determinista de contención 1:1.
  const excludeByPlace = new Map<string, Set<string>>();
  for (const place of places) {
    excludeByPlace.set(place.id, new Set());
  }
  const contentionByOsm = new Map<string, ContentionRecord>();

  const classifyAll = () =>
    new Map(
      places.map((place) => [
        place.id,
        classifyDenuePlace(place, inRange.get(place.id) ?? [], config, excludeByPlace.get(place.id)),
      ]),
    );

  let results = classifyAll();
  for (let iter = 0; iter <= places.length; iter++) {
    const proposals = new Map<string, { placeId: string; confidence: number }[]>();
    for (const place of places) {
      const r = results.get(place.id);
      if (r && r.classification === 'auto-safe' && r.best) {
        const list = proposals.get(r.best.osmId) ?? [];
        list.push({ placeId: place.id, confidence: r.best.result.confidence });
        proposals.set(r.best.osmId, list);
      }
    }
    let conflict = false;
    for (const [osmId, list] of proposals) {
      if (list.length <= 1) {
        continue;
      }
      conflict = true;
      const ordered = [...list].sort((a, b) =>
        b.confidence !== a.confidence ? b.confidence - a.confidence : a.placeId < b.placeId ? -1 : 1,
      );
      const winner = ordered[0];
      const losers = ordered.slice(1);
      contentionByOsm.set(osmId, {
        osmId,
        winner: winner.placeId,
        losers: losers.map((l) => l.placeId),
      });
      for (const loser of losers) {
        excludeByPlace.get(loser.placeId)?.add(osmId);
      }
    }
    if (!conflict) {
      break;
    }
    results = classifyAll();
  }

  // Ensamblado de sidecar + métricas.
  const entries: OsmEnrichmentEntry[] = [];
  const totals = { denue: places.length, autoSafe: 0, ambiguous: 0, noMatch: 0 };
  const autoSafeByReason: Record<string, number> = {};
  const coverage: Record<string, number> = {};
  for (const tag of COVERAGE_TAGS) {
    coverage[tag] = 0;
  }
  const conflicts = {
    phoneDiffers: 0,
    websiteDiffers: 0,
    wheelchairNo: 0,
    wheelchairLimited: 0,
    hoursUnsupported: 0,
  };
  const autoSafeDistances: number[] = [];
  const ambiguous: AmbiguousReportEntry[] = [];
  let placesWithCandidates = 0;

  for (const place of places) {
    if ((inRange.get(place.id) ?? []).length > 0) {
      placesWithCandidates++;
    }
    const r = results.get(place.id);
    if (!r) {
      continue;
    }
    if (r.classification === 'auto-safe' && r.best) {
      totals.autoSafe++;
      autoSafeDistances.push(r.best.result.distanceMeters);
      const reasonKey = [...r.best.result.reasons].sort().join('+') || 'none';
      autoSafeByReason[reasonKey] = (autoSafeByReason[reasonKey] ?? 0) + 1;

      const candidate = byOsmId.get(r.best.osmId);
      if (candidate) {
        for (const tag of COVERAGE_TAGS) {
          if (hasCoverageTag(candidate.poi, tag)) {
            coverage[tag]++;
          }
        }
        const outcome = ingestFields(place, candidate.poi);
        conflicts.phoneDiffers += outcome.conflicts.phoneDiffers ? 1 : 0;
        conflicts.websiteDiffers += outcome.conflicts.websiteDiffers ? 1 : 0;
        conflicts.wheelchairNo += outcome.conflicts.wheelchairNo ? 1 : 0;
        conflicts.wheelchairLimited += outcome.conflicts.wheelchairLimited ? 1 : 0;
        conflicts.hoursUnsupported += outcome.conflicts.hoursUnsupported ? 1 : 0;
        if (outcome.ingestedCount > 0) {
          entries.push({
            locavoPlaceId: place.id,
            osmId: r.best.osmId,
            confidence: r.best.result.confidence,
            reasons: r.best.result.reasons,
            distanceMeters: r.best.result.distanceMeters,
            nameSimilarity: r.best.result.nameSimilarity,
            fields: outcome.fields,
          });
        }
      }
    } else if (r.classification === 'ambiguous') {
      totals.ambiguous++;
      ambiguous.push({
        locavoPlaceId: place.id,
        denueName: place.name,
        category: place.category,
        latitude: place.coordinates.latitude,
        longitude: place.coordinates.longitude,
        reason: r.ambiguityReason ?? 'confidence-floor',
        candidates: r.scored.slice(0, 5).map((s) => ({
          osmId: s.osmId,
          name: byOsmId.get(s.osmId)?.poi.tags.name ?? '',
          distanceMeters: s.result.distanceMeters,
          confidence: s.result.confidence,
          reasons: s.result.reasons,
          categoryCompatible: s.categoryCompatible,
        })),
      });
    } else {
      totals.noMatch++;
    }
  }

  entries.sort((a, b) => (a.locavoPlaceId < b.locavoPlaceId ? -1 : a.locavoPlaceId > b.locavoPlaceId ? 1 : 0));

  const sortedDistances = [...autoSafeDistances].sort((a, b) => a - b);
  const report: OsmEnrichmentReport = {
    totals,
    autoSafeByReason,
    candidateStats: {
      placesWithCandidates,
      totalCandidatesEvaluated,
      maxCandidatesForAPlace,
    },
    coverage,
    conflicts,
    distanceStats: {
      autoSafeMedianMeters: percentile(sortedDistances, 0.5),
      p90Meters: percentile(sortedDistances, 0.9),
      p95Meters: percentile(sortedDistances, 0.95),
      over100m: sortedDistances.filter((d) => d > 100).length,
      over250m: sortedDistances.filter((d) => d > 250).length,
    },
    ambiguous,
    contention: [...contentionByOsm.values()].sort((a, b) =>
      a.osmId < b.osmId ? -1 : a.osmId > b.osmId ? 1 : 0,
    ),
  };

  const sidecar: OsmEnrichmentSidecar = {
    format: 'locavo-osm-enrichment',
    schemaVersion: 1,
    pipelineVersion: options.pipelineVersion ?? 1,
    city: options.city ?? 'culiacan',
    license: 'ODbL 1.0',
    attribution: '© OpenStreetMap contributors',
    snapshotSource: options.snapshotSource ?? 'data/osm/culiacan/culiacan-osm-pilot.osm.pbf',
    configFingerprint: configFingerprint(config),
    entries,
  };

  return { sidecar, index: indexEnrichmentSidecar(sidecar), report };
}
