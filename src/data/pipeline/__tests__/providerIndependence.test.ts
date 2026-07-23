import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';

import type { CityPackPlace } from '../../import/denue/CityPackBuilder';
import { cityPackPlaceToLocavoPlace } from '../../places/citypack/CityPackPlaceMapper';
import { PROVIDER_DENUE } from '../providerId';

/** Recorre archivos .ts (sin tests) de un directorio de motor. */
function engineSources(dir: string): string[] {
  const root = join(__dirname, '..', '..', '..', dir);
  const out: string[] = [];
  const walk = (d: string) => {
    for (const e of readdirSync(d)) {
      const full = join(d, e);
      if (statSync(full).isDirectory()) {
        if (e !== '__tests__') {
          walk(full);
        }
        continue;
      }
      if (/\.(ts|tsx)$/.test(e)) {
        out.push(readFileSync(full, 'utf8'));
      }
    }
  };
  walk(root);
  return out;
}

describe('independencia de proveedor de los motores (City Pipeline V1)', () => {
  const ENGINES = [
    'intelligence', 'context', 'recommendationCandidates', 'preferences', 'intent',
    'decision', 'actions', 'features/recommendations', 'features/today',
  ];

  it('ningún motor importa la plataforma de ingesta (registro/adaptadores/fusión)', () => {
    // Garantía de esta etapa: los motores NO conocen la plataforma de proveedores.
    // (Nota: `src/intelligence/explanation.ts` mantiene una lista histórica V5.0
    // que lee la PROCEDENCIA canónica 'denue' para OFFICIAL_SOURCE — motor
    // congelado, fuera de alcance aquí; ver notas de migración.)
    for (const engine of ENGINES) {
      for (const src of engineSources(engine)) {
        expect(src).not.toMatch(/data\/pipeline/);
        expect(src).not.toMatch(/providerRegistry/);
        expect(src).not.toMatch(/mergeFragments|ProviderAdapter|CanonicalFragment/);
      }
    }
  });
});

const packPlace = (provider: string, over: Partial<CityPackPlace['sources'][number]> = {}): CityPackPlace => ({
  id: 'loc-1',
  name: 'Lugar',
  normalizedName: 'lugar',
  category: 'food',
  latitude: 24.8069,
  longitude: -107.394,
  searchTerms: [],
  sources: [{
    provider,
    externalId: 'E1',
    dataset: 'DS',
    edition: '2026-07-01',
    sourceFile: 'f.csv',
    rawActivityCode: '722511',
    ...over,
  }],
});

describe('regresión de hidratación (de-hardcode neutral)', () => {
  it('DENUE conserva denueId/clee y verificación source_verified (idéntico a antes)', () => {
    const hydrated = cityPackPlaceToLocavoPlace(packPlace(PROVIDER_DENUE, { clee: 'CLEE-9' }));
    expect(hydrated.sourceRefs.denueId).toBe('E1');
    expect(hydrated.sourceRefs.clee).toBe('CLEE-9');
    expect(hydrated.verification.status).toBe('source_verified');
    expect(hydrated.verification.confidence).toBe(0.6);
    expect(hydrated.provenance[0].source).toBe('denue');
  });

  it('un proveedor desconocido hidrata con verificación por defecto y sin refs (registro genérico)', () => {
    const hydrated = cityPackPlaceToLocavoPlace(packPlace('proveedor-futuro'));
    expect(hydrated.sourceRefs.denueId).toBeUndefined();
    expect(hydrated.verification.status).toBe('unverified');
    expect(hydrated.verification.confidence).toBe(0.3);
  });
});
