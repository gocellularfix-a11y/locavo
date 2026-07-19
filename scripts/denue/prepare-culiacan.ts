/**
 * DENUE — Preparación del city pack real de Culiacán (V4C).
 *
 * Deriva, desde el archivo oficial DENUE 05_2026 (descarga masiva INEGI,
 * NUNCA versionado en git), un pack canónico de Culiacán fuera del
 * repositorio. Reutiliza el parser, el mapper y el mapeo SCIAN aprobados
 * en V4B: una sola interpretación de DENUE.
 *
 * Uso:
 *   npm run denue:prepare:culiacan -- --data-root "D:\GeoData"
 *   (o variable de entorno LOCAVO_GEODATA_DIR)
 *
 * Entrada esperada bajo la raíz:
 *   <root>\INEGI\DENUE\05_2026\extracted\**\denue_inegi_25_.csv
 *   (si solo existe raw\denue_25_csv.zip, en Windows se extrae solo)
 *
 * Salidas (deterministas; el reporte lleva la marca de tiempo):
 *   <root>\INEGI\DENUE\05_2026\derived\culiacan\culiacan.pack.json
 *   <root>\INEGI\DENUE\05_2026\derived\culiacan\culiacan.quarantine.json
 *   <root>\INEGI\DENUE\05_2026\derived\culiacan\culiacan.report.json
 *
 * Sin red: este script solo lee archivos locales ya descargados.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  buildCityPack,
  serializeCityPack,
  serializeQuarantine,
  type CityPackMeta,
} from '../../src/data/import/denue/CityPackBuilder';
import { mapDenueRow, type DenueImportCandidate, type DenueRejection } from '../../src/data/import/denue/DenueCandidateMapper';
import { parseDenueCsv } from '../../src/data/import/denue/DenueCsvParser';
import { DENUE_IMPORT_DEFAULTS } from '../../src/data/import/denue/DenueImportService';
import { decodeDenueBytes } from '../../src/data/import/denue/encoding';
import { resolveGeoDataRoot } from '../../src/data/import/denue/geodataRoot';

const EDITION_DIR = ['INEGI', 'DENUE', '05_2026'];
const SOURCE_CSV_NAME = 'denue_inegi_25_.csv';
const SOURCE_ZIP_NAME = 'denue_25_csv.zip';

function findFileRecursive(dir: string, fileName: string): string | null {
  if (!existsSync(dir)) {
    return null;
  }
  const entries = readdirSync(dir, { withFileTypes: true }).sort((a, b) =>
    a.name < b.name ? -1 : 1,
  );
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isFile() && entry.name === fileName) {
      return full;
    }
    if (entry.isDirectory()) {
      const found = findFileRecursive(full, fileName);
      if (found) {
        return found;
      }
    }
  }
  return null;
}

function locateSourceCsv(editionRoot: string): string {
  const extractedDir = join(editionRoot, 'extracted');
  const existing = findFileRecursive(extractedDir, SOURCE_CSV_NAME);
  if (existing) {
    return existing;
  }

  const zip = join(editionRoot, 'raw', SOURCE_ZIP_NAME);
  if (existsSync(zip)) {
    if (process.platform !== 'win32') {
      throw new Error(
        `Existe ${SOURCE_ZIP_NAME} pero no está extraído. Extrae el zip en ${extractedDir} y reintenta.`,
      );
    }
    const dest = join(extractedDir, 'denue_25_csv');
    console.log(`Extrayendo ${SOURCE_ZIP_NAME} → ${dest}`);
    execFileSync('powershell', [
      '-NoProfile',
      '-Command',
      `Expand-Archive -LiteralPath '${zip.replace(/'/g, "''")}' -DestinationPath '${dest.replace(/'/g, "''")}' -Force`,
    ]);
    const extracted = findFileRecursive(dest, SOURCE_CSV_NAME);
    if (extracted) {
      return extracted;
    }
  }

  throw new Error(
    `No se encontró ${SOURCE_CSV_NAME} bajo ${extractedDir} ni ${SOURCE_ZIP_NAME} en raw\\. ` +
      'Descarga el archivo oficial de Sinaloa (INEGI, descarga masiva) primero.',
  );
}

/** Escritura atómica: nunca queda una salida parcial tras una interrupción. */
function writeAtomic(path: string, content: string): void {
  const tmp = `${path}.tmp`;
  writeFileSync(tmp, content, 'utf8');
  renameSync(tmp, path);
}

function main(): void {
  const root = resolveGeoDataRoot(process.argv.slice(2), process.env);
  const editionRoot = join(root, ...EDITION_DIR);
  const sourceCsv = locateSourceCsv(editionRoot);
  const sourceBytes = readFileSync(sourceCsv);
  console.log(`Fuente: ${sourceCsv} (${(statSync(sourceCsv).size / 1024 / 1024).toFixed(1)} MB)`);

  const { text, encoding } = decodeDenueBytes(sourceBytes);
  console.log(`Codificación detectada: ${encoding}`);

  const rows = parseDenueCsv(text);
  const candidates: DenueImportCandidate[] = [];
  const rejections: DenueRejection[] = [];
  for (const parsed of rows) {
    const result = mapDenueRow(parsed, DENUE_IMPORT_DEFAULTS.municipality);
    if ('candidate' in result) {
      candidates.push(result.candidate);
    } else {
      rejections.push(result.rejection);
    }
  }

  const meta: CityPackMeta = {
    city: 'culiacan',
    municipality: DENUE_IMPORT_DEFAULTS.municipality,
    dataset: DENUE_IMPORT_DEFAULTS.dataset,
    sourceVersion: DENUE_IMPORT_DEFAULTS.sourceVersion,
    sourceFile: SOURCE_CSV_NAME,
    license: 'Términos de Libre Uso de la Información del INEGI',
  };
  const { pack, stats, quarantine } = buildCityPack(candidates, rejections, rows.length, meta);

  const outDir = join(editionRoot, 'derived', 'culiacan');
  mkdirSync(outDir, { recursive: true });
  const packPath = join(outDir, 'culiacan.pack.json');
  const quarantinePath = join(outDir, 'culiacan.quarantine.json');
  const reportPath = join(outDir, 'culiacan.report.json');

  const packJson = serializeCityPack(pack);
  writeAtomic(packPath, packJson);
  writeAtomic(quarantinePath, serializeQuarantine(quarantine));
  writeAtomic(
    reportPath,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        sourceEncoding: encoding,
        sourceBytes: sourceBytes.length,
        packBytes: Buffer.byteLength(packJson, 'utf8'),
        stats,
      },
      null,
      2,
    ),
  );

  console.log('— Resumen —');
  console.log(`filas leídas:           ${stats.read}`);
  console.log(`filas de Culiacán:      ${stats.municipalityRows}`);
  console.log(`aceptados:              ${stats.accepted}`);
  console.log(`rechazados:             ${stats.rejected}`);
  console.log(`duplicados:             ${stats.duplicates}`);
  console.log(`sin teléfono:           ${stats.missingPhone}`);
  console.log(`sin sitio web:          ${stats.missingWebsite}`);
  console.log(`coords en cuarentena:   ${stats.quarantinedInvalidCoordinates}`);
  console.log('por categoría:');
  for (const [category, count] of Object.entries(stats.byCategory)) {
    console.log(`  ${category}: ${count}`);
  }
  console.log(`actividades sin mapear: ${stats.unmappedActivities.length} códigos SCIAN`);
  for (const activity of stats.unmappedActivities.slice(0, 10)) {
    console.log(`  ${activity.code} (${activity.count}) ${activity.label.slice(0, 60)}`);
  }
  console.log(`pack:       ${packPath} (${(Buffer.byteLength(packJson, 'utf8') / 1024 / 1024).toFixed(2)} MB)`);
  console.log(`cuarentena: ${quarantinePath} (${quarantine.length} registros)`);
  console.log(`reporte:    ${reportPath}`);
}

main();
