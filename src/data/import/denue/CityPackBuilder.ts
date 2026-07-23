import type {
  DenueImportCandidate,
  DenueMunicipalityFilter,
  DenueRejection,
} from './DenueCandidateMapper';
import { locavoPlaceIdFromDenue } from '../../../domain/places/locavoPlaceId';
import type { LocavoCategory, PlaceAddress, PlaceContact } from '../../../domain/places/LocavoPlace';
import { PROVIDER_DENUE, type ProviderId } from '../../pipeline/providerId';

/**
 * Constructor del "city pack" canónico de Culiacán (V4C).
 *
 * El pack es el DTO de importación neutral al proveedor que consumirán
 * integraciones futuras: cada lugar usa el vocabulario canónico de Locavo
 * y lleva su procedencia en `sources[]`, de modo que un pack futuro pueda
 * combinar DENUE, OpenStreetMap, datos de propietarios y comunidad sin que
 * el runtime dependa de nombres de campo específicos de DENUE.
 *
 * Determinismo: mismas entradas → mismos bytes de salida. El pack NO
 * contiene marcas de tiempo de ejecución (esas viven en el reporte de
 * corrida, que es diagnóstico y no forma parte del pack).
 */

export interface CityPackSourceRef {
  /** Id de proveedor del REGISTRO (abierto). Culiacán sigue usando `PROVIDER_DENUE`. */
  provider: ProviderId;
  /** Id de establecimiento del proveedor (denue_id). */
  externalId: string;
  /** Clave Estadística Empresarial cuando existe. */
  clee?: string;
  /** Identificador oficial del dataset (p. ej. MEX-INEGI.EEC2.05-DENUE-2026). */
  dataset: string;
  /** Versión/corrección oficial (campo Modified de los metadatos INEGI). */
  edition: string;
  /** Nombre del archivo fuente (sin rutas de máquina). */
  sourceFile: string;
  /** Código SCIAN crudo de la actividad. */
  rawActivityCode: string;
  /** Nombre oficial de la actividad SCIAN. */
  rawActivityName?: string;
}

export interface CityPackPlace {
  /**
   * Identidad canónica de Locavo (locavoPlaceId): UUID v5 DETERMINISTA
   * derivado del registro de proveedor. NUNCA un id de proveedor con prefijo;
   * el denue_id se preserva APARTE en `sources[].externalId`.
   */
  id: string;
  name: string;
  normalizedName: string;
  category: LocavoCategory;
  latitude: number;
  longitude: number;
  address?: PlaceAddress;
  contact?: PlaceContact;
  searchTerms: string[];
  sources: CityPackSourceRef[];
}

export interface CityPackMeta {
  city: string;
  municipality: DenueMunicipalityFilter;
  dataset: string;
  /** Versión oficial del dataset (fecha de corrección/modificación). */
  sourceVersion: string;
  /** Archivo CSV oficial del que se derivó (solo nombre, sin rutas). */
  sourceFile: string;
  license: string;
}

export interface CityPackV1 {
  format: 'locavo-city-pack';
  formatVersion: 1;
  city: string;
  municipality: DenueMunicipalityFilter;
  dataset: string;
  sourceVersion: string;
  sourceFile: string;
  license: string;
  count: number;
  byCategory: Record<string, number>;
  places: CityPackPlace[];
}

export interface UnmappedActivity {
  code: string;
  label: string;
  count: number;
}

export interface CityPackStats {
  /** Filas leídas del CSV fuente (sin cabecera). */
  read: number;
  /** Filas pertenecientes al municipio objetivo. */
  municipalityRows: number;
  accepted: number;
  rejected: number;
  duplicates: number;
  rejectedReasons: Record<string, number>;
  byCategory: Record<string, number>;
  missingPhone: number;
  missingWebsite: number;
  /** Registros aceptados (todos con coordenadas validadas). */
  validCoordinates: number;
  /** Registros del municipio en cuarentena por coordenadas inutilizables. */
  quarantinedInvalidCoordinates: number;
  /** Actividades SCIAN del municipio sin categoría Locavo (para ampliar cobertura). */
  unmappedActivities: UnmappedActivity[];
}

export interface CityPackQuarantineEntry {
  row: number;
  denueId?: string;
  reason: string;
}

export interface CityPackBuildResult {
  pack: CityPackV1;
  stats: CityPackStats;
  /** Registros rechazados por datos inutilizables (nunca se inventan datos). */
  quarantine: CityPackQuarantineEntry[];
}

function toPackPlace(candidate: DenueImportCandidate, meta: CityPackMeta): CityPackPlace {
  const source: CityPackSourceRef = {
    provider: PROVIDER_DENUE,
    externalId: candidate.denueId,
    dataset: meta.dataset,
    edition: meta.sourceVersion,
    sourceFile: meta.sourceFile,
    rawActivityCode: candidate.raw.codigo_act.trim(),
  };
  if (candidate.clee) {
    source.clee = candidate.clee;
  }
  const rawActivityName = candidate.raw.nombre_act.replace(/\s+/g, ' ').trim();
  if (rawActivityName) {
    source.rawActivityName = rawActivityName;
  }

  const place: CityPackPlace = {
    // Identidad canónica propia de Locavo (UUID v5 determinista); el denue_id
    // queda como referencia de proveedor en `sources[]`, jamás como identidad.
    id: locavoPlaceIdFromDenue(candidate.denueId),
    name: candidate.name,
    normalizedName: candidate.normalizedName,
    category: candidate.category,
    latitude: candidate.latitude,
    longitude: candidate.longitude,
    address: candidate.address,
    searchTerms: candidate.searchTerms,
    sources: [source],
  };
  if (candidate.contact) {
    place.contact = candidate.contact;
  }
  return place;
}

/**
 * Construye el pack, las estadísticas y la cuarentena a partir del
 * resultado del mapper V4B. Determinista:
 * - duplicados de denue_id: se conserva la PRIMERA aparición en el orden
 *   del archivo fuente; el resto se cuenta como duplicado;
 * - orden final: denue_id numérico ascendente (desempate lexicográfico).
 */
export function buildCityPack(
  candidates: readonly DenueImportCandidate[],
  rejections: readonly DenueRejection[],
  totalRowsRead: number,
  meta: CityPackMeta,
): CityPackBuildResult {
  const seen = new Set<string>();
  const unique: DenueImportCandidate[] = [];
  let duplicates = 0;
  for (const candidate of candidates) {
    if (seen.has(candidate.denueId)) {
      duplicates += 1;
      continue;
    }
    seen.add(candidate.denueId);
    unique.push(candidate);
  }

  const ordered = [...unique].sort((a, b) => {
    const na = Number(a.denueId);
    const nb = Number(b.denueId);
    if (Number.isFinite(na) && Number.isFinite(nb) && na !== nb) {
      return na - nb;
    }
    return a.denueId < b.denueId ? -1 : a.denueId > b.denueId ? 1 : 0;
  });

  const byCategory: Record<string, number> = {};
  let missingPhone = 0;
  let missingWebsite = 0;
  for (const candidate of ordered) {
    byCategory[candidate.category] = (byCategory[candidate.category] ?? 0) + 1;
    if (!candidate.contact?.phone) {
      missingPhone += 1;
    }
    if (!candidate.contact?.website) {
      missingWebsite += 1;
    }
  }

  const rejectedReasons: Record<string, number> = {};
  const unmappedByCode = new Map<string, UnmappedActivity>();
  const quarantine: CityPackQuarantineEntry[] = [];
  let outsideMunicipality = 0;
  for (const rejection of rejections) {
    rejectedReasons[rejection.reason] = (rejectedReasons[rejection.reason] ?? 0) + 1;
    if (rejection.reason === 'outside_pilot_municipality') {
      outsideMunicipality += 1;
      continue;
    }
    if (rejection.reason === 'unmapped_category') {
      const code = rejection.codigoAct ?? '(sin código)';
      const entry = unmappedByCode.get(code);
      if (entry) {
        entry.count += 1;
      } else {
        unmappedByCode.set(code, {
          code,
          label: rejection.nombreAct ?? '',
          count: 1,
        });
      }
      continue;
    }
    // Datos inutilizables (id/nombre/coordenadas): cuarentena, nunca inventar.
    const entry: CityPackQuarantineEntry = { row: rejection.row, reason: rejection.reason };
    if (rejection.denueId) {
      entry.denueId = rejection.denueId;
    }
    quarantine.push(entry);
  }
  quarantine.sort((a, b) => a.row - b.row);

  const unmappedActivities = [...unmappedByCode.values()].sort(
    (a, b) => b.count - a.count || (a.code < b.code ? -1 : 1),
  );

  const pack: CityPackV1 = {
    format: 'locavo-city-pack',
    formatVersion: 1,
    city: meta.city,
    municipality: meta.municipality,
    dataset: meta.dataset,
    sourceVersion: meta.sourceVersion,
    sourceFile: meta.sourceFile,
    license: meta.license,
    count: ordered.length,
    byCategory,
    places: ordered.map((candidate) => toPackPlace(candidate, meta)),
  };

  const stats: CityPackStats = {
    read: totalRowsRead,
    municipalityRows: totalRowsRead - outsideMunicipality,
    accepted: ordered.length,
    rejected: rejections.length,
    duplicates,
    rejectedReasons,
    byCategory,
    missingPhone,
    missingWebsite,
    validCoordinates: ordered.length,
    quarantinedInvalidCoordinates: rejectedReasons['invalid_coordinates'] ?? 0,
    unmappedActivities,
  };

  return { pack, stats, quarantine };
}

/** Serialización determinista y compacta del pack (mismos bytes por corrida). */
export function serializeCityPack(pack: CityPackV1): string {
  return JSON.stringify(pack);
}

/** Serialización determinista de la cuarentena (legible para revisión). */
export function serializeQuarantine(quarantine: readonly CityPackQuarantineEntry[]): string {
  return JSON.stringify(quarantine, null, 2);
}
