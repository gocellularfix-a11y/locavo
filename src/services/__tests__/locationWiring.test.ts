import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';

const SRC = join(__dirname, '..', '..');

interface SourceFile {
  readonly path: string;
  readonly code: string;
}

function sourcesIn(relativeDir: string): SourceFile[] {
  const root = join(SRC, relativeDir);
  const out: SourceFile[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) {
        if (entry !== '__tests__') {
          walk(full);
        }
        continue;
      }
      if (/\.(ts|tsx)$/.test(entry)) {
        out.push({ path: full.replace(SRC, 'src').replace(/\\/g, '/'), code: readFileSync(full, 'utf8') });
      }
    }
  };
  walk(root);
  return out;
}

/**
 * Archivos autorizados a nombrar el centro de Culiacán: la resolución canónica
 * (que lo usa como RESPALDO final), la semilla de datos que lo define y el
 * saneamiento del mapa (centro visual ante coordenadas inválidas, no un origen
 * de distancia).
 */
const CITY_CENTER_ALLOWLIST = [
  'src/services/effectiveLocation.ts',
  'src/data/places.mock.ts',
  'src/features/map/markers.ts',
];

describe('una sola resolución canónica de ubicación efectiva', () => {
  it('nadie fuera de la lista autorizada usa el centro de Culiacán como origen', () => {
    const offenders = [
      ...sourcesIn('app'),
      ...sourcesIn('features'),
      ...sourcesIn('components'),
      ...sourcesIn('hooks'),
      ...sourcesIn('services'),
      ...sourcesIn('state'),
    ]
      .filter((file) => !CITY_CENTER_ALLOWLIST.includes(file.path))
      .filter((file) => /CULIACAN_CENTER|ACTIVE_CITY\.coords/.test(file.code))
      .map((file) => file.path);
    expect(offenders).toEqual([]);
  });

  it('las superficies con distancia toman el origen del estado canónico, no de constantes', () => {
    // 6. "Para ti ahora" (Home), búsqueda/explorar y el detalle consumen la
    // MISMA ubicación efectiva: el hook canónico, jamás coordenadas propias.
    const consumers = [
      'app/(tabs)/index.tsx',
      'app/(tabs)/explore.tsx',
      'app/place/[id].tsx',
      'hooks/usePlacesQuery.ts',
    ];
    for (const relative of consumers) {
      const code = readFileSync(join(SRC, relative), 'utf8');
      expect(code).toMatch(/useLocationState|usePlacesQuery/);
      expect(code).not.toMatch(/CULIACAN_CENTER/);
    }
  });

  it('las tarjetas derivan el origen mostrado del mismo estado que calcula la distancia', () => {
    for (const relative of [
      'components/PlaceCard.tsx',
      'components/RecommendedPlaceCard.tsx',
      'features/recommendations/RecommendationCard.tsx',
      'features/today/DecisionSection.tsx',
    ]) {
      const code = readFileSync(join(SRC, relative), 'utf8');
      expect(code).not.toMatch(/CULIACAN_CENTER/);
      // O reciben el origen por props, o lo leen del estado canónico.
      expect(code).toMatch(/useDistanceOrigin|DistanceOrigin/);
    }
  });

  it('la resolución canónica vive en un único módulo', () => {
    const resolvers = [...sourcesIn('services'), ...sourcesIn('state'), ...sourcesIn('hooks')]
      .filter((file) => /export function resolveEffectiveLocation/.test(file.code))
      .map((file) => file.path);
    expect(resolvers).toEqual(['src/services/effectiveLocation.ts']);
  });
});
