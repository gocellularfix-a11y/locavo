import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import {
  EXPECTED_ATTRIBUTION,
  loadSnapshotMetadata,
  verifySnapshot,
  type SnapshotMetadata,
} from '../snapshotIntegrity';

const REPO_ROOT = resolve(__dirname, '..', '..', '..', '..');
const REAL_METADATA = join(REPO_ROOT, 'data', 'osm', 'culiacan', 'snapshot-metadata.json');

function writeTempMetadata(mutate: (m: SnapshotMetadata & Record<string, unknown>) => void): string {
  const meta = loadSnapshotMetadata(REAL_METADATA) as SnapshotMetadata & Record<string, unknown>;
  // El snapshotPath sigue siendo relativo al repo; se resuelve con REPO_ROOT.
  mutate(meta);
  const dir = mkdtempSync(join(tmpdir(), 'locavo-osm-'));
  const path = join(dir, 'snapshot-metadata.json');
  writeFileSync(path, JSON.stringify(meta), 'utf8');
  return path;
}

describe('verifySnapshot — snapshot OSM congelado de Culiacán', () => {
  it('el snapshot real coincide con su metadata (todas las comprobaciones OK)', () => {
    const result = verifySnapshot(REAL_METADATA, REPO_ROOT);
    expect(result.errors).toEqual([]);
    expect(result.ok).toBe(true);
    expect(result.checks).toEqual({
      metadataFormat: true,
      fileExists: true,
      sha256: true,
      bytes: true,
      bounds: true,
      attribution: true,
      license: true,
    });
  });

  it('la metadata declara atribución y licencia ODbL correctas', () => {
    const meta = loadSnapshotMetadata(REAL_METADATA);
    expect(meta.attribution).toBe(EXPECTED_ATTRIBUTION);
    expect(meta.license).toContain('ODbL');
  });

  it('SHA-256 manipulado → falla', () => {
    const path = writeTempMetadata((m) => {
      m.snapshotSha256 = '0'.repeat(64);
    });
    const result = verifySnapshot(path, REPO_ROOT);
    expect(result.ok).toBe(false);
    expect(result.checks.sha256).toBe(false);
  });

  it('tamaño en bytes incorrecto → falla', () => {
    const path = writeTempMetadata((m) => {
      m.snapshotBytes = 1;
    });
    const result = verifySnapshot(path, REPO_ROOT);
    expect(result.ok).toBe(false);
    expect(result.checks.bytes).toBe(false);
  });

  it('límites inválidos (south >= north) → falla', () => {
    const path = writeTempMetadata((m) => {
      m.bounds = { ...m.bounds, south: 90, north: 0 };
    });
    const result = verifySnapshot(path, REPO_ROOT);
    expect(result.ok).toBe(false);
    expect(result.checks.bounds).toBe(false);
  });

  it('atribución incorrecta → falla', () => {
    const path = writeTempMetadata((m) => {
      m.attribution = 'Datos propios';
    });
    const result = verifySnapshot(path, REPO_ROOT);
    expect(result.ok).toBe(false);
    expect(result.checks.attribution).toBe(false);
  });

  it('licencia sin ODbL → falla', () => {
    const path = writeTempMetadata((m) => {
      m.license = 'MIT';
    });
    const result = verifySnapshot(path, REPO_ROOT);
    expect(result.ok).toBe(false);
    expect(result.checks.license).toBe(false);
  });

  it('snapshot ausente → falla de forma segura', () => {
    const path = writeTempMetadata((m) => {
      m.snapshotPath = 'data/osm/culiacan/does-not-exist.osm.pbf';
    });
    const result = verifySnapshot(path, REPO_ROOT);
    expect(result.ok).toBe(false);
    expect(result.checks.fileExists).toBe(false);
  });
});
