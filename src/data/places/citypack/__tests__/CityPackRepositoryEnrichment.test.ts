import { fakeLoaderFrom, fixturePack } from './fixtures';
import { buildRuntimePack } from '../buildRuntimePack';
import { CityPackRepository } from '../CityPackRepository';
import { LocalPlaceRepository } from '../../LocalPlaceRepository';
import {
  assertEnrichmentSidecar,
  indexEnrichmentSidecar,
  type OsmEnrichmentIndex,
  type OsmEnrichmentSidecar,
} from '../../../osm/OsmEnrichment';

const ENRICHMENT_PATH = 'osm-enrichment.json';

function sidecarFor(locavoPlaceId: string): OsmEnrichmentSidecar {
  return {
    format: 'locavo-osm-enrichment',
    schemaVersion: 1,
    pipelineVersion: 1,
    city: 'culiacan',
    license: 'ODbL 1.0',
    attribution: '© OpenStreetMap contributors',
    snapshotSource: 'test',
    configFingerprint: 'test',
    entries: [
      {
        locavoPlaceId,
        osmId: 'n1',
        confidence: 1,
        reasons: ['same_website'],
        distanceMeters: 10,
        nameSimilarity: 1,
        fields: { website: { value: 'https://enriched.example', ingested: true } },
      },
    ],
  };
}

function makeRepo(withProvider: boolean, options?: { serveSidecar?: boolean }) {
  const { files } = buildRuntimePack(fixturePack(), { maxChunkRecords: 1, commonTokenFraction: 0.5 });
  const fake = fakeLoaderFrom(files);
  if (options?.serveSidecar ?? true) {
    fake.set(ENRICHMENT_PATH, JSON.stringify(sidecarFor('denue-100')));
  }
  const provider = withProvider
    ? async (): Promise<OsmEnrichmentIndex> => {
        const raw = await fake.loader.load(ENRICHMENT_PATH);
        return indexEnrichmentSidecar(assertEnrichmentSidecar(JSON.parse(raw)));
      }
    : undefined;
  const repo = new CityPackRepository(fake.loader, new LocalPlaceRepository(), {
    enrichmentProvider: provider,
  });
  return { repo, fake };
}

beforeEach(() => {
  jest.spyOn(console, 'warn').mockImplementation(() => undefined);
});
afterEach(() => {
  jest.restoreAllMocks();
});

describe('CityPackRepository — merge de enriquecimiento OSM (flag)', () => {
  it('con proveedor: fusiona campos aprobados y agrega procedencia OSM', async () => {
    const { repo } = makeRepo(true);
    const place = await repo.getById('denue-100');
    expect(place?.contact?.website).toBe('https://enriched.example');
    expect(place?.provenance[0].source).toBe('denue');
    expect(place?.provenance.at(-1)?.source).toBe('openstreetmap');
  });

  it('SIN proveedor (flag OFF): comportamiento base, sin enriquecimiento', async () => {
    const { repo } = makeRepo(false);
    const place = await repo.getById('denue-100');
    expect(place?.contact?.website).toBeUndefined();
    expect(place?.provenance.some((p) => p.source === 'openstreetmap')).toBe(false);
  });

  it('sidecar ausente/dañado → degrada sin romper la carga del pack', async () => {
    const { repo } = makeRepo(true, { serveSidecar: false });
    const place = await repo.getById('denue-100');
    expect(place).not.toBeNull();
    expect(place?.contact?.website).toBeUndefined();
    expect(place?.provenance.some((p) => p.source === 'openstreetmap')).toBe(false);
  });

  it('un lugar sin entrada de enriquecimiento queda intacto', async () => {
    const { repo } = makeRepo(true);
    const place = await repo.getById('denue-101');
    expect(place?.provenance.some((p) => p.source === 'openstreetmap')).toBe(false);
  });
});
