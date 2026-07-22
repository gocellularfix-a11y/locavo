/**
 * Construye el sidecar de enriquecimiento OSM y su reporte (V4F-0).
 *
 *   npm run osm:enrichment:build
 *
 * Determinista y sin red: consume el extracto DENUE versionado y los POIs OSM
 * del snapshot congelado (data/osm/culiacan/osm-pois.json), reutiliza el motor
 * canónico `matchPlaces` y escribe:
 *   data/osm/culiacan/osm-enrichment.json          (sidecar, solo AUTO-SAFE)
 *   data/osm/culiacan/osm-enrichment-report.json   (métricas + diagnósticos)
 * Mismas entradas → mismos bytes. No activa el runtime (flag OFF).
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { buildOsmEnrichment } from '../../src/data/osm/buildOsmEnrichment';
import { denuePlacesFromCsv, parseOsmPoiDocument } from '../../src/data/osm/pilotInputs';
import { decodeDenueBytes } from '../../src/data/import/denue/encoding';
import { BUNDLED_SOURCE_FILE } from '../../src/data/places/citypack/buildBundledPack';

const REPO_ROOT = join(__dirname, '..', '..');
const CSV = join(REPO_ROOT, 'data', 'denue', BUNDLED_SOURCE_FILE);
const POIS = join(REPO_ROOT, 'data', 'osm', 'culiacan', 'osm-pois.json');
const SIDECAR = join(REPO_ROOT, 'data', 'osm', 'culiacan', 'osm-enrichment.json');
const REPORT = join(REPO_ROOT, 'data', 'osm', 'culiacan', 'osm-enrichment-report.json');

function stringify(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function main(): void {
  for (const path of [CSV, POIS]) {
    if (!existsSync(path)) {
      throw new Error(`Entrada ausente: ${path}`);
    }
  }

  const { text } = decodeDenueBytes(readFileSync(CSV));
  const denue = denuePlacesFromCsv(text);
  const pois = parseOsmPoiDocument(readFileSync(POIS, 'utf8'));

  const { sidecar, report } = buildOsmEnrichment(denue, pois, {
    city: 'culiacan',
    snapshotSource: 'data/osm/culiacan/culiacan-osm-pilot.osm.pbf',
  });

  writeFileSync(SIDECAR, stringify(sidecar), 'utf8');
  writeFileSync(REPORT, stringify(report), 'utf8');

  const t = report.totals;
  console.log('OSM enrichment pilot — resultado:');
  console.log(`  DENUE: ${t.denue}  AUTO-SAFE: ${t.autoSafe}  AMBIGUOUS: ${t.ambiguous}  NO-MATCH: ${t.noMatch}`);
  console.log(`  entradas de sidecar: ${sidecar.entries.length}`);
  console.log(`  contención resuelta: ${report.contention.length}`);
  console.log(`  conflictos phone/website: ${report.conflicts.phoneDiffers}/${report.conflicts.websiteDiffers}`);
  console.log(`  horarios no soportados: ${report.conflicts.hoursUnsupported}`);
  console.log(
    `  distancia AUTO-SAFE (m): mediana ${report.distanceStats.autoSafeMedianMeters.toFixed(1)} · P90 ${report.distanceStats.p90Meters.toFixed(1)} · P95 ${report.distanceStats.p95Meters.toFixed(1)}`,
  );

  // Condiciones de parada (calibración): se anuncian, no se cambian solas.
  const warnings: string[] = [];
  if (t.ambiguous > 50) {
    warnings.push(`AMBIGUOUS ${t.ambiguous} > 50 (carga de revisión manual)`);
  }
  const conflictTotal = report.conflicts.phoneDiffers + report.conflicts.websiteDiffers;
  if (t.autoSafe > 0 && conflictTotal / t.autoSafe > 0.05) {
    warnings.push(`tasa de conflicto AUTO-SAFE ${(conflictTotal / t.autoSafe * 100).toFixed(1)}% > 5%`);
  }
  if (t.autoSafe > 0 && report.distanceStats.over250m / t.autoSafe > 0.15) {
    warnings.push(`>15% de AUTO-SAFE con distancia > 250 m`);
  }
  if (t.autoSafe < t.denue * 0.2) {
    warnings.push(`AUTO-SAFE ${t.autoSafe} < 20% de ${t.denue} (OSM escaso)`);
  }
  if (warnings.length > 0) {
    console.warn('\n⚠ Condiciones de parada superadas (requiere recalibración antes de producción):');
    for (const w of warnings) {
      console.warn(`  - ${w}`);
    }
  }
}

main();
