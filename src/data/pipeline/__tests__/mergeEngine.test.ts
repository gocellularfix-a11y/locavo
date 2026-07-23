import type { CanonicalFragment } from '../canonicalFragment';
import { mergeFragments, type MergeConfig } from '../mergeEngine';
import { providerRegistry } from '../providerRegistry';
import { PROVIDER_DENUE, PROVIDER_OSM } from '../providerId';

const cfg: MergeConfig = { registry: providerRegistry };
const CULIACAN = { latitude: 24.8069, longitude: -107.394 };

function frag(provider: string, externalId: string, over: Partial<CanonicalFragment> = {}): CanonicalFragment {
  return {
    provider,
    externalId,
    provenance: { providerId: provider, externalId, edition: '2026-01-01' },
    licenseTier: provider === PROVIDER_OSM ? 'odbl-sidecar' : 'permissive-base',
    ...over,
  };
}

describe('mergeFragments (City Pipeline V1)', () => {
  it('entrada vacía → sin lugares', () => {
    expect(mergeFragments([], cfg)).toEqual([]);
  });

  it('deduplica por id estable', () => {
    const a = frag(PROVIDER_DENUE, 'd1', { stableId: 'GERS-1', name: 'A', coordinates: CULIACAN });
    const b = frag(PROVIDER_OSM, 'node/1', { stableId: 'GERS-1', name: 'A', coordinates: CULIACAN });
    expect(mergeFragments([a, b], cfg)).toHaveLength(1);
  });

  it('deduplica por proximidad + nombre + categoría compatible', () => {
    const a = frag(PROVIDER_DENUE, 'd1', { name: 'Café Sur', normalizedName: 'cafe sur', coordinates: CULIACAN, category: 'coffee' });
    const b = frag(PROVIDER_OSM, 'node/2', { name: 'Café Sur', normalizedName: 'cafe sur', coordinates: { latitude: 24.8070, longitude: -107.3941 }, category: 'coffee' });
    expect(mergeFragments([a, b], cfg)).toHaveLength(1);
  });

  it('NO fusiona lugares lejanos ni de categoría distinta', () => {
    const a = frag(PROVIDER_DENUE, 'd1', { name: 'X', normalizedName: 'x', coordinates: CULIACAN, category: 'coffee' });
    const far = frag(PROVIDER_DENUE, 'd2', { name: 'X', normalizedName: 'x', coordinates: { latitude: 25.5, longitude: -108 }, category: 'coffee' });
    const otherCat = frag(PROVIDER_OSM, 'node/3', { name: 'X', normalizedName: 'x', coordinates: CULIACAN, category: 'pharmacy' });
    expect(mergeFragments([a, far], cfg)).toHaveLength(2);
    expect(mergeFragments([a, otherCat], cfg)).toHaveLength(2);
  });

  it('resolución de conflicto a nivel de campo por confianza (DENUE > OSM en nombre)', () => {
    const denue = frag(PROVIDER_DENUE, 'd1', { name: 'Nombre Oficial', normalizedName: 'n', coordinates: CULIACAN, category: 'food' });
    const osm = frag(PROVIDER_OSM, 'node/4', { name: 'Nombre Comunitario', normalizedName: 'n', coordinates: CULIACAN, category: 'food', hours: { weekly: Array.from({ length: 7 }, () => [{ open: '09:00', close: '18:00' }]) } });
    const [m] = mergeFragments([denue, osm], cfg);
    expect(m.name).toBe('Nombre Oficial'); // mayor confianza gana el campo
    expect(m.hours).toBeDefined(); // el campo que solo aporta OSM sí se hereda
  });

  it('hereda la verificación de la fuente de mayor confianza y atribuye TODAS las fuentes', () => {
    const denue = frag(PROVIDER_DENUE, 'd1', { name: 'A', normalizedName: 'a', coordinates: CULIACAN, category: 'food' });
    const osm = frag(PROVIDER_OSM, 'node/5', { name: 'A', normalizedName: 'a', coordinates: CULIACAN, category: 'food' });
    const [m] = mergeFragments([denue, osm], cfg);
    expect(m.verification).toEqual({ status: 'source_verified', confidence: 0.6 });
    expect(m.sources.map((s) => s.providerId)).toEqual([PROVIDER_DENUE, PROVIDER_OSM]); // mayor confianza primero
    expect(m.licenseTiers).toEqual(['odbl-sidecar', 'permissive-base']);
  });

  it('determinista: el orden de entrada no cambia la salida', () => {
    const a = frag(PROVIDER_DENUE, 'd1', { name: 'A', normalizedName: 'a', coordinates: CULIACAN, category: 'food' });
    const b = frag(PROVIDER_OSM, 'node/6', { name: 'A', normalizedName: 'a', coordinates: CULIACAN, category: 'food' });
    const c = frag(PROVIDER_DENUE, 'd9', { name: 'Z', normalizedName: 'z', coordinates: { latitude: 25, longitude: -108 }, category: 'food' });
    expect(mergeFragments([a, b, c], cfg)).toEqual(mergeFragments([c, b, a], cfg));
  });

  it('empate de confianza: gana la edición más reciente, luego la clave', () => {
    const older = frag(PROVIDER_DENUE, 'd1', { name: 'Viejo', normalizedName: 'n', coordinates: CULIACAN, category: 'food', provenance: { providerId: PROVIDER_DENUE, externalId: 'd1', edition: '2025-01-01' } });
    const newer = frag(PROVIDER_DENUE, 'd2', { name: 'Nuevo', normalizedName: 'n', coordinates: CULIACAN, category: 'food', provenance: { providerId: PROVIDER_DENUE, externalId: 'd2', edition: '2026-01-01' } });
    const [m] = mergeFragments([older, newer], cfg);
    expect(m.name).toBe('Nuevo');
  });
});
