/**
 * City pack de runtime — staging reproducible (V4D).
 *
 * Copia SOLO el paquete de runtime generado (manifiesto + índices +
 * trozos) a los directorios de assets de la app, verificando el SHA-256
 * de cada archivo contra el manifiesto antes de copiar:
 *
 *   public/citypack/                          → web/PWA (estático same-origin,
 *                                               fuera del bundle de JS; ignorado por git)
 *   android/app/src/main/assets/citypack/     → APK (si existe android/, que es generado)
 *
 * Nunca copia archivos DENUE crudos ni el pack fuente completo. Limpia el
 * staging anterior sin tocar los datos fuente. El manifiesto se copia AL
 * FINAL: un staging interrumpido no deja un pack aparentemente válido (el
 * runtime cae al respaldo local).
 *
 * Uso:
 *   npm run citypack:stage -- --data-root "D:\GeoData"
 */
import { createHash } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';

import { resolveGeoDataRoot } from '../../src/data/import/denue/geodataRoot';
import {
  assertRuntimeManifest,
  MANIFEST_PATH,
  type RuntimeFileInfo,
} from '../../src/data/places/citypack/RuntimePackFormat';

const REPO_ROOT = join(__dirname, '..', '..');

function sha256Of(path: string): string {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

function main(): void {
  const root = resolveGeoDataRoot(process.argv.slice(2), process.env);
  const runtimeDir = join(root, 'INEGI', 'DENUE', '05_2026', 'derived', 'culiacan', 'runtime');
  const manifestPath = join(runtimeDir, MANIFEST_PATH);
  if (!existsSync(manifestPath)) {
    throw new Error(
      `No existe el paquete de runtime (${manifestPath}). Ejecuta primero: npm run citypack:build:culiacan -- --data-root "<ruta>"`,
    );
  }

  // Validación de esquema + verificación de hashes ANTES de copiar nada.
  const manifest = assertRuntimeManifest(JSON.parse(readFileSync(manifestPath, 'utf8')));
  const filesToStage: RuntimeFileInfo[] = [
    manifest.indexes.placeId,
    manifest.indexes.search,
    ...manifest.chunks,
  ];
  for (const file of filesToStage) {
    const full = join(runtimeDir, file.name);
    if (!existsSync(full)) {
      throw new Error(`Paquete incompleto: falta ${file.name}`);
    }
    const actual = sha256Of(full);
    if (actual !== file.sha256) {
      throw new Error(`Paquete corrupto: SHA-256 no coincide en ${file.name}`);
    }
  }
  console.log(`Verificados ${filesToStage.length} archivos (SHA-256 correcto).`);

  const targets = [join(REPO_ROOT, 'public', 'citypack')];
  const androidAssets = join(REPO_ROOT, 'android', 'app', 'src', 'main', 'assets', 'citypack');
  if (existsSync(join(REPO_ROOT, 'android'))) {
    targets.push(androidAssets);
  } else {
    console.log('android/ no existe (proyecto no prebuild): se omite el staging Android.');
  }

  for (const target of targets) {
    // Limpieza del staging anterior: SOLO el directorio citypack destino.
    rmSync(target, { recursive: true, force: true });
    mkdirSync(target, { recursive: true });
    for (const file of filesToStage) {
      const dest = join(target, file.name);
      mkdirSync(dirname(dest), { recursive: true });
      cpSync(join(runtimeDir, file.name), dest);
    }
    // Manifiesto al final: staging parcial → sin manifiesto → fallback.
    cpSync(manifestPath, join(target, MANIFEST_PATH));
    console.log(`Staged: ${target} (${filesToStage.length + 1} archivos)`);
  }

  console.log(
    `Pack ${manifest.city} v${manifest.packVersion}: ${manifest.totalPlaces} lugares, ${manifest.chunks.length} trozos.`,
  );
}

main();
