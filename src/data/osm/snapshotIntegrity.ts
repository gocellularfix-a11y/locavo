/**
 * Verificación de integridad del snapshot OSM congelado (V4F-0).
 *
 * Puro y determinista: no descarga nada, no toca la red. Solo comprueba que el
 * artefacto local coincide con su metadata (`snapshot-metadata.json`):
 * existencia, SHA-256, tamaño en bytes, cordura de los límites geográficos y
 * los campos de atribución/licencia ODbL.
 *
 * La lógica vive aquí (probada por jest); el envoltorio de CLI está en
 * `scripts/osm/verify-snapshot.ts` (`npm run osm:snapshot:verify`).
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { isAbsolute, join, resolve } from 'node:path';

export interface SnapshotBounds {
  south: number;
  west: number;
  north: number;
  east: number;
  source: string;
}

export interface SnapshotMetadata {
  format: string;
  schemaVersion: number;
  snapshotPath: string;
  snapshotSha256: string;
  snapshotBytes: number;
  bounds: SnapshotBounds;
  attribution: string;
  license: string;
}

export const EXPECTED_FORMAT = 'locavo-osm-snapshot-metadata';
export const EXPECTED_ATTRIBUTION = '© OpenStreetMap contributors';

export interface VerifyResult {
  ok: boolean;
  errors: string[];
  checks: {
    metadataFormat: boolean;
    fileExists: boolean;
    sha256: boolean;
    bytes: boolean;
    bounds: boolean;
    attribution: boolean;
    license: boolean;
  };
  snapshotAbsolutePath: string;
}

export function sha256OfFile(filePath: string): string {
  return createHash('sha256').update(readFileSync(filePath)).digest('hex');
}

export function loadSnapshotMetadata(metadataPath: string): SnapshotMetadata {
  const raw = readFileSync(metadataPath, 'utf8');
  return JSON.parse(raw) as SnapshotMetadata;
}

function boundsAreSane(b: SnapshotBounds | undefined): boolean {
  if (!b) {
    return false;
  }
  const finite = [b.south, b.west, b.north, b.east].every((n) => Number.isFinite(n));
  return (
    finite &&
    b.south < b.north &&
    b.west < b.east &&
    b.south >= -90 &&
    b.north <= 90 &&
    b.west >= -180 &&
    b.east <= 180 &&
    typeof b.source === 'string' &&
    b.source.trim().length > 0
  );
}

/**
 * Verifica el snapshot descrito por `metadataPath`. `rootDir` (por defecto el
 * cwd del proceso) resuelve `snapshotPath` cuando es relativo al repositorio.
 */
export function verifySnapshot(
  metadataPath: string,
  rootDir: string = process.cwd(),
): VerifyResult {
  const errors: string[] = [];
  const meta = loadSnapshotMetadata(metadataPath);

  const metadataFormat = meta.format === EXPECTED_FORMAT;
  if (!metadataFormat) {
    errors.push(`formato de metadata inesperado: "${meta.format}" (se esperaba "${EXPECTED_FORMAT}")`);
  }

  const snapshotAbsolutePath = isAbsolute(meta.snapshotPath)
    ? meta.snapshotPath
    : resolve(join(rootDir, meta.snapshotPath));

  const fileExists = existsSync(snapshotAbsolutePath);
  if (!fileExists) {
    errors.push(`snapshot ausente: ${snapshotAbsolutePath}`);
  }

  let sha256 = false;
  let bytes = false;
  if (fileExists) {
    const actualHash = sha256OfFile(snapshotAbsolutePath);
    sha256 = actualHash === meta.snapshotSha256;
    if (!sha256) {
      errors.push(`SHA-256 no coincide: ${actualHash} != ${meta.snapshotSha256}`);
    }
    const actualBytes = statSync(snapshotAbsolutePath).size;
    bytes = actualBytes === meta.snapshotBytes;
    if (!bytes) {
      errors.push(`tamaño no coincide: ${actualBytes} != ${meta.snapshotBytes}`);
    }
  }

  const bounds = boundsAreSane(meta.bounds);
  if (!bounds) {
    errors.push('límites geográficos inválidos o sin fuente');
  }

  const attribution = meta.attribution === EXPECTED_ATTRIBUTION;
  if (!attribution) {
    errors.push(`atribución inválida: "${meta.attribution}"`);
  }

  const license = typeof meta.license === 'string' && meta.license.includes('ODbL');
  if (!license) {
    errors.push(`licencia inválida: "${meta.license}" (se espera ODbL)`);
  }

  return {
    ok: errors.length === 0,
    errors,
    checks: { metadataFormat, fileExists, sha256, bytes, bounds, attribution, license },
    snapshotAbsolutePath,
  };
}
