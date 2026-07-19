import type { CityPackPlace, CityPackV1 } from '../../../import/denue/CityPackBuilder';
import type { CityPackAssetLoader } from '../CityPackAssetLoader';
import type { RuntimePackFile } from '../buildRuntimePack';

/** Lugar canónico mínimo del pack para pruebas (sin datos inventados). */
export function fixturePlace(overrides: Partial<CityPackPlace> = {}): CityPackPlace {
  const id = overrides.id ?? 'denue-100';
  return {
    id,
    name: 'Demo Fixture',
    normalizedName: 'demo fixture',
    category: 'food',
    latitude: 24.8069,
    longitude: -107.394,
    address: { countryCode: 'MX', formatted: 'Av. Obregón 210, Centro', neighborhood: 'Centro' },
    searchTerms: ['tacos'],
    sources: [
      {
        provider: 'denue',
        externalId: id.replace('denue-', ''),
        dataset: 'MEX-INEGI.EEC2.05-DENUE-2026',
        edition: '2026-07-01',
        sourceFile: 'denue_inegi_25_.csv',
        rawActivityCode: '722514',
        rawActivityName: 'Restaurantes de tacos y tortas',
      },
    ],
    ...overrides,
  };
}

/**
 * Pack fixture: 6 lugares en 3 categorías, dos zonas geográficas separadas
 * (centro y norte, ~3 km) para producir varios trozos con maxChunkRecords
 * pequeño.
 */
export function fixturePack(places?: CityPackPlace[]): CityPackV1 {
  const all = places ?? [
    fixturePlace({ id: 'denue-100', name: 'TAQUERÍA CENTRO', normalizedName: 'taqueria centro' }),
    fixturePlace({
      id: 'denue-101',
      name: 'MARISCOS NORTE',
      normalizedName: 'mariscos norte',
      latitude: 24.84,
      longitude: -107.39,
      searchTerms: ['mariscos'],
    }),
    fixturePlace({
      id: 'denue-200',
      name: 'CAFÉ DOÑA ÑOÑA',
      normalizedName: 'cafe dona nona',
      category: 'coffee',
      searchTerms: ['cafeteria'],
      contact: { phone: '6670000001' },
    }),
    fixturePlace({
      id: 'denue-201',
      name: 'CAFÉ NORTE',
      normalizedName: 'cafe norte',
      category: 'coffee',
      latitude: 24.841,
      longitude: -107.391,
      searchTerms: ['cafeteria'],
    }),
    fixturePlace({
      id: 'denue-300',
      name: 'DEPÓSITO CENTRO',
      normalizedName: 'deposito centro',
      category: 'beer',
      searchTerms: ['cerveza'],
    }),
    fixturePlace({
      id: 'denue-301',
      name: 'DEPÓSITO NORTE',
      normalizedName: 'deposito norte',
      category: 'beer',
      latitude: 24.842,
      longitude: -107.392,
      searchTerms: ['cerveza'],
    }),
  ];
  const byCategory: Record<string, number> = {};
  for (const place of all) {
    byCategory[place.category] = (byCategory[place.category] ?? 0) + 1;
  }
  return {
    format: 'locavo-city-pack',
    formatVersion: 1,
    city: 'culiacan',
    municipality: { cveEnt: '25', cveMun: '006' },
    dataset: 'MEX-INEGI.EEC2.05-DENUE-2026',
    sourceVersion: '2026-07-01',
    sourceFile: 'denue_inegi_25_.csv',
    license: 'Términos de Libre Uso de la Información del INEGI',
    count: all.length,
    byCategory,
    places: all,
  };
}

export interface FakeLoader {
  loader: CityPackAssetLoader;
  /** Conteo de cargas por ruta: evidencia exacta de la carga perezosa. */
  loads: Map<string, number>;
  /** Sobrescribe/corrompe un recurso puntual. */
  set(path: string, content: string): void;
  remove(path: string): void;
}

/** Cargador en memoria a partir de los archivos generados. */
export function fakeLoaderFrom(files: readonly RuntimePackFile[]): FakeLoader {
  const store = new Map(files.map((f) => [f.path, f.content]));
  const loads = new Map<string, number>();
  return {
    loader: {
      async load(path: string): Promise<string> {
        loads.set(path, (loads.get(path) ?? 0) + 1);
        const content = store.get(path);
        if (content === undefined) {
          throw new Error(`no existe: ${path}`);
        }
        return content;
      },
    },
    loads,
    set: (path, content) => store.set(path, content),
    remove: (path) => store.delete(path),
  };
}

/** Total de cargas cuyo path cumple el predicado. */
export function loadsWhere(loads: Map<string, number>, predicate: (path: string) => boolean): number {
  let total = 0;
  for (const [path, count] of loads) {
    if (predicate(path)) {
      total += count;
    }
  }
  return total;
}
