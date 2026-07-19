/**
 * DENUE — Manifiesto verificable del archivo oficial descargado (V4C).
 *
 * Recorre <root>\INEGI\DENUE\05_2026\ y produce
 * manifests\denue-05-2026-manifest.json con: fuente oficial, nombre
 * original, bytes, SHA-256, validación estructural del ZIP, estado y
 * listado de extracción y codificación detectada de los CSV extraídos.
 *
 * El manifiesto es LOCAL (contiene rutas de esta máquina) y vive dentro de
 * GeoData, fuera del repositorio. En el repo solo se versiona un esquema
 * de ejemplo saneado (docs/denue-archive-manifest.example.json).
 *
 * Con --extract, extrae los ZIP que aún no tengan carpeta en extracted\
 * (Windows: Expand-Archive). Nunca borra el archivo original.
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';

import { detectDenueEncoding } from '../../src/data/import/denue/encoding';
import { resolveGeoDataRoot } from '../../src/data/import/denue/geodataRoot';

const OFFICIAL_BASE = 'https://www.inegi.org.mx/contenidos/masiva/denue';
const SOURCE_PAGE = 'https://www.inegi.org.mx/app/descarga/?ti=6';
const EDITION = '05_2026';
const DATASET = 'MEX-INEGI.EEC2.05-DENUE-2026';

interface ManifestFileEntry {
  originalFilename: string;
  officialSource: string;
  byteSize: number;
  sha256: string;
  downloadedAt: string;
  zipStructureValid: boolean | null;
  extractionStatus: 'extracted' | 'not-extracted' | 'not-applicable';
  extractedFiles: { path: string; byteSize: number; detectedEncoding?: string }[];
}

function sha256Of(path: string): string {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

/** Validación estructural: firma local PK y firma de fin de directorio central. */
function isZipStructureValid(path: string): boolean {
  const bytes = readFileSync(path);
  if (bytes.length < 22) {
    return false;
  }
  if (!(bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04)) {
    return false;
  }
  const tail = bytes.subarray(Math.max(0, bytes.length - 65_557));
  for (let i = tail.length - 22; i >= 0; i--) {
    if (tail[i] === 0x50 && tail[i + 1] === 0x4b && tail[i + 2] === 0x05 && tail[i + 3] === 0x06) {
      return true;
    }
  }
  return false;
}

function listFilesRecursive(dir: string): string[] {
  const out: string[] = [];
  if (!existsSync(dir)) {
    return out;
  }
  for (const entry of readdirSync(dir, { withFileTypes: true }).sort((a, b) =>
    a.name < b.name ? -1 : 1,
  )) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...listFilesRecursive(full));
    } else {
      out.push(full);
    }
  }
  return out;
}

function main(): void {
  const root = resolveGeoDataRoot(process.argv.slice(2), process.env);
  const doExtract = process.argv.includes('--extract');
  const editionRoot = join(root, 'INEGI', 'DENUE', EDITION);
  const rawDir = join(editionRoot, 'raw');
  const docsDir = join(editionRoot, 'docs');
  const extractedDir = join(editionRoot, 'extracted');
  const manifestsDir = join(editionRoot, 'manifests');
  mkdirSync(manifestsDir, { recursive: true });

  const files: ManifestFileEntry[] = [];
  const sourceDirs: { dir: string; isZipDir: boolean }[] = [
    { dir: rawDir, isZipDir: true },
    { dir: docsDir, isZipDir: false },
  ];

  for (const { dir, isZipDir } of sourceDirs) {
    if (!existsSync(dir)) {
      continue;
    }
    for (const name of readdirSync(dir).sort()) {
      const full = join(dir, name);
      if (!statSync(full).isFile() || name.endsWith('.part')) {
        continue;
      }
      const isZip = name.toLowerCase().endsWith('.zip');
      const zipValid = isZip ? isZipStructureValid(full) : null;
      const extractTarget = join(extractedDir, name.replace(/\.zip$/i, ''));

      if (doExtract && isZip && zipValid && !existsSync(extractTarget)) {
        console.log(`Extrayendo ${name}…`);
        execFileSync('powershell', [
          '-NoProfile',
          '-Command',
          `Expand-Archive -LiteralPath '${full.replace(/'/g, "''")}' -DestinationPath '${extractTarget.replace(/'/g, "''")}' -Force`,
        ]);
      }

      const extractedFiles = isZip
        ? listFilesRecursive(extractTarget).map((f) => {
            const entry: ManifestFileEntry['extractedFiles'][number] = {
              path: relative(editionRoot, f).replace(/\\/g, '/'),
              byteSize: statSync(f).size,
            };
            if (f.toLowerCase().endsWith('.csv')) {
              const sample = readFileSync(f).subarray(0, 1_048_576);
              entry.detectedEncoding = detectDenueEncoding(sample);
            }
            return entry;
          })
        : [];

      files.push({
        originalFilename: name,
        officialSource: isZipDir ? `${OFFICIAL_BASE}/${name}` : '(documentación oficial INEGI)',
        byteSize: statSync(full).size,
        sha256: sha256Of(full),
        downloadedAt: statSync(full).mtime.toISOString(),
        zipStructureValid: zipValid,
        extractionStatus: !isZip
          ? 'not-applicable'
          : extractedFiles.length > 0
            ? 'extracted'
            : 'not-extracted',
        extractedFiles,
      });
      console.log(`OK ${name}`);
    }
  }

  const manifest = {
    edition: EDITION,
    dataset: DATASET,
    officialSourcePage: SOURCE_PAGE,
    officialDistributionBase: OFFICIAL_BASE,
    license: 'Términos de Libre Uso de la Información del INEGI',
    correctionNote:
      'Publicado 2026-05-20; correcciones oficiales 2026-05-29 y 2026-07-01 (ver nota técnica en docs/).',
    generatedAt: new Date().toISOString(),
    archiveRoot: editionRoot,
    fileCount: files.length,
    totalBytes: files.reduce((sum, f) => sum + f.byteSize, 0),
    files,
  };

  const outPath = join(manifestsDir, 'denue-05-2026-manifest.json');
  writeFileSync(outPath, JSON.stringify(manifest, null, 2), 'utf8');
  console.log(`Manifiesto: ${outPath} (${files.length} archivos, ${(manifest.totalBytes / 1024 / 1024).toFixed(0)} MB)`);
  const invalid = files.filter((f) => f.zipStructureValid === false);
  if (invalid.length > 0) {
    console.error(`ZIPs con estructura inválida: ${invalid.map((f) => f.originalFilename).join(', ')}`);
    process.exitCode = 1;
  }
}

main();
