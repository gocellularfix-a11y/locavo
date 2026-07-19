import { createHash } from 'node:crypto';

import { fixturePack, fixturePlace } from './fixtures';
import { buildRuntimePack, compactSearchTextOf } from '../buildRuntimePack';
import {
  MANIFEST_PATH,
  PLACE_ID_INDEX_PATH,
  SEARCH_INDEX_PATH,
  type CompactSearchIndex,
  type PlaceIdIndex,
} from '../RuntimePackFormat';

function sha256Hex(content: string): string {
  return createHash('sha256').update(content, 'utf8').digest('hex');
}

describe('buildRuntimePack (generación troceada determinista)', () => {
  it('dos corridas producen exactamente los mismos archivos', () => {
    const a = buildRuntimePack(fixturePack(), { maxChunkRecords: 2 });
    const b = buildRuntimePack(fixturePack(), { maxChunkRecords: 2 });
    expect(a.files.map((f) => f.path)).toEqual(b.files.map((f) => f.path));
    for (let i = 0; i < a.files.length; i++) {
      expect(a.files[i].content).toBe(b.files[i].content);
    }
  });

  it('el manifiesto cuadra: totales, bytes y SHA-256 reales de cada archivo', () => {
    const { manifest, files } = buildRuntimePack(fixturePack(), { maxChunkRecords: 2 });
    expect(manifest.totalPlaces).toBe(6);
    expect(manifest.byCategory).toEqual({ beer: 2, coffee: 2, food: 2 });
    expect(manifest.chunks.reduce((sum, c) => sum + c.count, 0)).toBe(6);

    const byPath = new Map(files.map((f) => [f.path, f.content]));
    for (const chunk of manifest.chunks) {
      const content = byPath.get(chunk.name)!;
      expect(Buffer.byteLength(content, 'utf8')).toBe(chunk.bytes);
      expect(sha256Hex(content)).toBe(chunk.sha256);
    }
    expect(sha256Hex(byPath.get(PLACE_ID_INDEX_PATH)!)).toBe(manifest.indexes.placeId.sha256);
    expect(sha256Hex(byPath.get(SEARCH_INDEX_PATH)!)).toBe(manifest.indexes.search.sha256);
  });

  it('divide por categoría y subdivide por retícula cuando excede el máximo', () => {
    const { manifest } = buildRuntimePack(fixturePack(), { maxChunkRecords: 1 });
    // 6 lugares, máximo 1 por trozo → 6 trozos, nunca mezcla categorías.
    expect(manifest.chunks.length).toBe(6);
    for (const chunk of manifest.chunks) {
      expect(chunk.count).toBe(1);
      expect(chunk.name).toContain(`categories/${chunk.category}/`);
    }
  });

  it('los límites (bounds) de cada trozo contienen a sus lugares', () => {
    const { manifest, files } = buildRuntimePack(fixturePack(), { maxChunkRecords: 2 });
    const byPath = new Map(files.map((f) => [f.path, f.content]));
    for (const chunk of manifest.chunks) {
      const { places } = JSON.parse(byPath.get(chunk.name)!) as {
        places: { latitude: number; longitude: number }[];
      };
      for (const place of places) {
        expect(place.latitude).toBeGreaterThanOrEqual(chunk.bounds.minLat);
        expect(place.latitude).toBeLessThanOrEqual(chunk.bounds.maxLat);
        expect(place.longitude).toBeGreaterThanOrEqual(chunk.bounds.minLng);
        expect(place.longitude).toBeLessThanOrEqual(chunk.bounds.maxLng);
      }
    }
  });

  it('el índice de ids cubre todos los lugares y apunta al trozo correcto', () => {
    const { manifest, files } = buildRuntimePack(fixturePack(), { maxChunkRecords: 2 });
    const byPath = new Map(files.map((f) => [f.path, f.content]));
    const idIndex = JSON.parse(byPath.get(PLACE_ID_INDEX_PATH)!) as PlaceIdIndex;
    expect(Object.keys(idIndex.ids).length).toBe(6);
    for (const [id, chunkIdx] of Object.entries(idIndex.ids)) {
      const { places } = JSON.parse(byPath.get(manifest.chunks[chunkIdx].name)!) as {
        places: { id: string }[];
      };
      expect(places.some((p) => p.id === id)).toBe(true);
    }
  });

  it('el índice de búsqueda es compacto y preserva texto normalizado sin acentos', () => {
    const { files } = buildRuntimePack(fixturePack(), { maxChunkRecords: 2 });
    const search = JSON.parse(
      files.find((f) => f.path === SEARCH_INDEX_PATH)!.content,
    ) as CompactSearchIndex;
    expect(search.entries.length).toBe(6);
    const cafe = search.entries.find(([id]) => id === 'denue-200')!;
    expect(cafe[2]).toContain('cafe dona nona');
    expect(cafe[2]).toContain('cafeteria');
    expect(cafe[2]).toContain('centro');
    // Sin mayúsculas ni acentos en el índice.
    expect(cafe[2]).toBe(cafe[2].toLowerCase());
    expect(cafe[2]).not.toMatch(/[ÁÉÍÓÚÑáéíóúñ]/);
  });

  it('compactSearchTextOf refleja el índice de dominio sin términos de categoría', () => {
    const place = fixturePlace({ normalizedName: 'cafe dona nona', searchTerms: ['cafeteria'] });
    const text = compactSearchTextOf(place);
    expect(text).toContain('cafe dona nona');
    expect(text).toContain('cafeteria');
    expect(text).toContain('av. obregon 210, centro');
  });

  it('el manifiesto se emite como ÚLTIMO archivo (seguridad ante interrupciones)', () => {
    const { files } = buildRuntimePack(fixturePack());
    expect(files[files.length - 1].path).toBe(MANIFEST_PATH);
  });

  it('rechaza un pack fuente de formato desconocido', () => {
    const bad = { ...fixturePack(), format: 'otro' } as never;
    expect(() => buildRuntimePack(bad)).toThrow(/locavo-city-pack/);
  });
});
