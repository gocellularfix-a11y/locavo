/**
 * City pack de runtime — generación (V4D).
 *
 * Lee el pack fuente derivado (culiacan.pack.json, FUERA del repo) y
 * genera el paquete de runtime troceado con índices y manifiesto:
 *
 *   <root>\INEGI\DENUE\05_2026\derived\culiacan\runtime\
 *     manifest.json
 *     index\place-id-index.json
 *     index\compact-search-index.json
 *     categories\<categoria>\chunk-NNN.json
 *
 * Uso:
 *   npm run citypack:build:culiacan -- --data-root "D:\GeoData"
 *   (o variable de entorno LOCAVO_GEODATA_DIR)
 *
 * Determinista, sin red, escrituras atómicas (tmp + rename) y manifiesto
 * al final: una generación interrumpida nunca deja un paquete "válido" a
 * medias.
 */
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import type { CityPackV1 } from '../../src/data/import/denue/CityPackBuilder';
import { resolveGeoDataRoot } from '../../src/data/import/denue/geodataRoot';
import { buildRuntimePack } from '../../src/data/places/citypack/buildRuntimePack';

function main(): void {
  const root = resolveGeoDataRoot(process.argv.slice(2), process.env);
  const derivedDir = join(root, 'INEGI', 'DENUE', '05_2026', 'derived', 'culiacan');
  const sourcePath = join(derivedDir, 'culiacan.pack.json');
  if (!existsSync(sourcePath)) {
    throw new Error(
      `No existe el pack fuente: ${sourcePath}. Ejecuta primero: npm run denue:prepare:culiacan -- --data-root "<ruta>"`,
    );
  }

  const pack = JSON.parse(readFileSync(sourcePath, 'utf8')) as CityPackV1;
  const { manifest, files } = buildRuntimePack(pack);

  const outDir = join(derivedDir, 'runtime');
  // Regeneración limpia: se elimina SOLO el paquete de runtime anterior;
  // jamás se toca el pack fuente ni el archivo oficial.
  rmSync(outDir, { recursive: true, force: true });

  let totalBytes = 0;
  for (const file of files) {
    const target = join(outDir, file.path);
    mkdirSync(dirname(target), { recursive: true });
    const tmp = `${target}.tmp`;
    writeFileSync(tmp, file.content, 'utf8');
    renameSync(tmp, target);
    totalBytes += Buffer.byteLength(file.content, 'utf8');
  }

  console.log('— City pack de runtime generado —');
  console.log(`ciudad:        ${manifest.city} (${manifest.dataset})`);
  console.log(`lugares:       ${manifest.totalPlaces}`);
  console.log(`trozos:        ${manifest.chunks.length}`);
  console.log(`índice ids:    ${(manifest.indexes.placeId.bytes / 1024).toFixed(1)} KB`);
  const shards = Object.values(manifest.indexes.searchShards);
  const shardBytes = shards.reduce((sum, s) => sum + s.bytes, 0);
  console.log(
    `índice búsq.:  ${shards.length} fragmentos, ${(shardBytes / 1024).toFixed(1)} KB total ` +
      `(máx ${(Math.max(...shards.map((s) => s.bytes)) / 1024).toFixed(1)} KB)`,
  );
  const chunkBytes = manifest.chunks.reduce((sum, c) => sum + c.bytes, 0);
  console.log(`trozos total:  ${(chunkBytes / 1024 / 1024).toFixed(2)} MB`);
  console.log(`paquete total: ${(totalBytes / 1024 / 1024).toFixed(2)} MB`);
  for (const [category, count] of Object.entries(manifest.byCategory)) {
    const bytes = manifest.chunks
      .filter((c) => c.category === category)
      .reduce((sum, c) => sum + c.bytes, 0);
    const chunks = manifest.chunks.filter((c) => c.category === category).length;
    console.log(`  ${category}: ${count} lugares, ${chunks} trozos, ${(bytes / 1024).toFixed(0)} KB`);
  }
  console.log(`salida: ${outDir}`);
}

main();
