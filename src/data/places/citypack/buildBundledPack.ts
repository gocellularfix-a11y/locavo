import { buildCityPack, type CityPackBuildResult, type CityPackMeta } from '../../import/denue/CityPackBuilder';
import {
  mapDenueRow,
  type DenueImportCandidate,
  type DenueRejection,
} from '../../import/denue/DenueCandidateMapper';
import { parseDenueCsv } from '../../import/denue/DenueCsvParser';
import { DENUE_IMPORT_DEFAULTS } from '../../import/denue/DenueImportService';
import { buildRuntimePack, type RuntimePackFile } from './buildRuntimePack';
import type { RuntimePackManifest } from './RuntimePackFormat';

/**
 * Pack BUNDLED de Culiacán (V4C) — construcción reproducible en memoria.
 *
 * Una sola función pura que transforma el TEXTO del extracto DETERMINISTA
 * versionado (`data/denue/denue_culiacan_pilot.csv`, los 500 establecimientos
 * aprobados) en el pack de runtime troceado, reutilizando EXACTAMENTE el
 * parser, el mapper, el mapeo SCIAN y el CityPackBuilder aprobados en V4B.
 *
 * La comparte el script de empaquetado (`scripts/citypack/build-bundled.ts`)
 * y las pruebas: mismas entradas → mismos bytes → mismo pack, sin archivo
 * nacional DENUE de 67 MB ni raíz GeoData. Sin red, determinista.
 */

/** Nombre del extracto fuente (solo nombre, nunca ruta de máquina). */
export const BUNDLED_SOURCE_FILE = 'denue_culiacan_pilot.csv';

/** Metadatos canónicos del pack bundled (idénticos a la derivación nacional). */
export const BUNDLED_PACK_META: CityPackMeta = {
  city: 'culiacan',
  municipality: DENUE_IMPORT_DEFAULTS.municipality,
  dataset: DENUE_IMPORT_DEFAULTS.dataset,
  sourceVersion: DENUE_IMPORT_DEFAULTS.sourceVersion,
  sourceFile: BUNDLED_SOURCE_FILE,
  license: 'Términos de Libre Uso de la Información del INEGI',
};

export interface BundledPackResult {
  manifest: RuntimePackManifest;
  files: RuntimePackFile[];
  build: CityPackBuildResult;
}

/** Construye el pack de runtime bundled a partir del CSV del extracto. */
export function buildBundledCuliacanPack(csvText: string): BundledPackResult {
  const rows = parseDenueCsv(csvText);
  const candidates: DenueImportCandidate[] = [];
  const rejections: DenueRejection[] = [];
  for (const parsed of rows) {
    const result = mapDenueRow(parsed, BUNDLED_PACK_META.municipality);
    if ('candidate' in result) {
      candidates.push(result.candidate);
    } else {
      rejections.push(result.rejection);
    }
  }
  const build = buildCityPack(candidates, rejections, rows.length, BUNDLED_PACK_META);
  const { manifest, files } = buildRuntimePack(build.pack);
  return { manifest, files, build };
}
