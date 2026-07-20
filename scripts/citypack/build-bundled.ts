/**
 * City pack de runtime BUNDLED (V4C) — empaquetado reproducible desde el
 * extracto DETERMINISTA versionado en el repositorio:
 *
 *   data/denue/denue_culiacan_pilot.csv   (500 establecimientos aprobados)
 *   data/denue/scian-category-map.json    (mapeo SCIAN → categoría Locavo)
 *
 * NO necesita el archivo nacional DENUE de 67 MB ni la raíz GeoData: un
 * clon limpio + `npm install` + este comando produce el pack de runtime y
 * lo empaqueta en los assets de la app. La lógica de construcción vive en
 * `src/data/places/citypack/buildBundledPack.ts` (compartida con las
 * pruebas): mismas entradas → mismos bytes.
 *
 * Destinos:
 *   public/citypack/                          → web/PWA (estático same-origin)
 *   android/app/src/main/assets/citypack/     → APK (si android/ existe)
 *
 * Determinista, sin red, escritura del manifiesto AL FINAL (un staging
 * interrumpido no deja un pack aparentemente válido: el runtime cae al
 * respaldo local). Verifica el SHA-256 de cada archivo contra el manifiesto.
 *
 * Uso:
 *   npm run citypack:bundle
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import { decodeDenueBytes } from '../../src/data/import/denue/encoding';
import {
  buildBundledCuliacanPack,
  BUNDLED_SOURCE_FILE,
} from '../../src/data/places/citypack/buildBundledPack';
import {
  assertRuntimeManifest,
  MANIFEST_PATH,
} from '../../src/data/places/citypack/RuntimePackFormat';

const REPO_ROOT = join(__dirname, '..', '..');
const PILOT_CSV = join(REPO_ROOT, 'data', 'denue', BUNDLED_SOURCE_FILE);

function sha256Hex(content: string): string {
  return createHash('sha256').update(Buffer.from(content, 'utf8')).digest('hex');
}

function main(): void {
  if (!existsSync(PILOT_CSV)) {
    throw new Error(`No existe el extracto versionado: ${PILOT_CSV}`);
  }

  const { text, encoding } = decodeDenueBytes(readFileSync(PILOT_CSV));
  const { manifest, files, build } = buildBundledCuliacanPack(text);
  const stats = build.stats;

  // Validación de esquema del manifiesto ANTES de tocar los assets.
  assertRuntimeManifest(manifest);

  const targets: string[] = [join(REPO_ROOT, 'public', 'citypack')];
  if (existsSync(join(REPO_ROOT, 'android'))) {
    targets.push(join(REPO_ROOT, 'android', 'app', 'src', 'main', 'assets', 'citypack'));
  } else {
    console.log('android/ no existe (proyecto no prebuild): se omite el staging Android.');
  }

  let totalBytes = 0;
  for (const target of targets) {
    // Limpieza del staging anterior: SOLO el directorio citypack destino.
    rmSync(target, { recursive: true, force: true });
    mkdirSync(target, { recursive: true });
    totalBytes = 0;
    // `files` llega con el manifiesto AL FINAL (garantía de buildRuntimePack).
    for (const file of files) {
      const dest = join(target, file.path);
      mkdirSync(dirname(dest), { recursive: true });
      writeFileSync(dest, file.content, 'utf8');
      totalBytes += Buffer.byteLength(file.content, 'utf8');
      // Integridad contra el manifiesto (excepto el propio manifiesto, que
      // es el índice de hashes).
      if (file.path !== MANIFEST_PATH) {
        const info =
          file.path === manifest.indexes.placeId.name
            ? manifest.indexes.placeId
            : (Object.values(manifest.indexes.searchShards).find((s) => s.name === file.path) ??
              manifest.chunks.find((c) => c.name === file.path));
        if (info && sha256Hex(file.content) !== info.sha256) {
          throw new Error(`SHA-256 no coincide para ${file.path}`);
        }
      }
    }
    console.log(`Staged: ${target} (${files.length} archivos)`);
  }

  console.log('— City pack BUNDLED de runtime —');
  console.log(`fuente:        ${BUNDLED_SOURCE_FILE} (${encoding})`);
  console.log(`ciudad:        ${manifest.city} (${manifest.dataset} v${manifest.packVersion})`);
  console.log(`filas leídas:  ${stats.read}`);
  console.log(`aceptados:     ${stats.accepted}`);
  console.log(
    `rechazados:    ${stats.rejected} (duplicados ${stats.duplicates}, cuarentena ${stats.quarantinedInvalidCoordinates})`,
  );
  console.log(`lugares:       ${manifest.totalPlaces}`);
  console.log(`trozos:        ${manifest.chunks.length}`);
  console.log(`fragmentos:    ${Object.keys(manifest.indexes.searchShards).length}`);
  console.log(`paquete total: ${(totalBytes / 1024).toFixed(1)} KB`);
  for (const [category, count] of Object.entries(manifest.byCategory)) {
    console.log(`  ${category}: ${count}`);
  }
}

main();
