import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { decodeDenueBytes } from '../../import/denue/encoding';
import { buildOsmEnrichment } from '../buildOsmEnrichment';
import type { OsmPoi } from '../OsmEnrichment';
import { denuePlacesFromCsv, parseOsmPoiDocument } from '../pilotInputs';
import { makeDenue, makePoi, metersToLatOffset } from './helpers';

const REPO_ROOT = resolve(__dirname, '..', '..', '..', '..');
const LAT = 24.8;
const LON = -107.4;
const P = '6671112233';
const W = 'https://alfa.mx';

function north(meters: number): number {
  return LAT + metersToLatOffset(meters);
}

describe('buildOsmEnrichment — pipeline determinista', () => {
  it('generación de candidatos: categoría y radio filtran (incompatible/lejano → NO-MATCH)', () => {
    const denue = makeDenue({ id: 'denue-1', category: 'pharmacy', name: 'Farmacia Alfa', latitude: LAT, longitude: LON });
    const pois: OsmPoi[] = [
      makePoi('nFar', north(500), LON, { amenity: 'pharmacy', name: 'Farmacia Alfa', phone: P, website: 'http://alfa.mx' }),
      makePoi('nIncompat', north(10), LON, { amenity: 'restaurant', name: 'Farmacia Alfa', phone: P }),
    ];
    const { report } = buildOsmEnrichment([denue], pois);
    expect(report.totals.autoSafe).toBe(0);
    expect(report.candidateStats.placesWithCandidates).toBe(0);
  });

  it('salida byte-idéntica e independiente del orden de los POIs', () => {
    const denue = makeDenue({ id: 'denue-1', category: 'pharmacy', name: 'Farmacia Alfa', latitude: LAT, longitude: LON });
    const pois: OsmPoi[] = [
      makePoi('nA', north(20), LON, { amenity: 'pharmacy', name: 'Farmacia Alfa', phone: P, website: 'http://alfa.mx' }),
      makePoi('nB', north(400), LON, { amenity: 'pharmacy', name: 'Otra' }),
    ];
    const a = buildOsmEnrichment([denue], pois);
    const b = buildOsmEnrichment([denue], [...pois].reverse());
    expect(JSON.stringify(b.sidecar)).toBe(JSON.stringify(a.sidecar));
  });

  it('contención 1:1: un OSM ganado por el de mayor confianza (empate → menor id); perdedor reevaluado', () => {
    // dA y dB sin website → el website de nX es ingerible por el ganador.
    const dA = makeDenue({ id: 'denue-a', category: 'pharmacy', name: 'Farmacia Uno', phone: P, latitude: LAT, longitude: LON });
    const dB = makeDenue({ id: 'denue-b', category: 'pharmacy', name: 'Farmacia Uno', phone: P, latitude: north(33), longitude: LON });
    const pois: OsmPoi[] = [
      makePoi('nX', LAT, LON, { amenity: 'pharmacy', name: 'Farmacia Uno', phone: P, website: 'http://alfa.mx' }),
    ];
    const { sidecar, report } = buildOsmEnrichment([dB, dA], pois);
    const onX = sidecar.entries.filter((e) => e.osmId === 'nX');
    expect(onX).toHaveLength(1);
    expect(onX[0].locavoPlaceId).toBe('denue-a');
    expect(report.contention).toEqual([{ osmId: 'nX', winner: 'denue-a', losers: ['denue-b'] }]);
  });

  it('conflicto de teléfono: DENUE presente no se sobrescribe; se registra como diagnóstico', () => {
    // AUTO-SAFE por website+nombre+cercanía; el teléfono difiere (diagnóstico),
    // los horarios (que DENUE no tiene) sí se ingieren → hay entrada.
    const denue = makeDenue({ id: 'denue-1', category: 'pharmacy', name: 'Farmacia Alfa', phone: '6670000001', website: W, latitude: LAT, longitude: LON });
    const pois: OsmPoi[] = [
      makePoi('nA', north(20), LON, {
        amenity: 'pharmacy',
        name: 'Farmacia Alfa',
        phone: '6679999999',
        website: 'http://alfa.mx',
        opening_hours: 'Mo-Fr 09:00-17:00',
      }),
    ];
    const { sidecar, report } = buildOsmEnrichment([denue], pois);
    expect(report.conflicts.phoneDiffers).toBe(1);
    const entry = sidecar.entries.find((e) => e.locavoPlaceId === 'denue-1');
    expect(entry?.fields.phone?.ingested).toBe(false);
    expect(entry?.fields.hours?.ingested).toBe(true);
  });

  it('reconstrucción sobre las entradas reales del repo → sidecar comprometido byte-idéntico', () => {
    const csv = decodeDenueBytes(
      readFileSync(join(REPO_ROOT, 'data', 'denue', 'denue_culiacan_pilot.csv')),
    ).text;
    const denue = denuePlacesFromCsv(csv);
    const pois = parseOsmPoiDocument(
      readFileSync(join(REPO_ROOT, 'data', 'osm', 'culiacan', 'osm-pois.json'), 'utf8'),
    );
    const { sidecar } = buildOsmEnrichment(denue, pois, {
      city: 'culiacan',
      snapshotSource: 'data/osm/culiacan/culiacan-osm-pilot.osm.pbf',
    });
    const committed = readFileSync(
      join(REPO_ROOT, 'data', 'osm', 'culiacan', 'osm-enrichment.json'),
      'utf8',
    );
    expect(`${JSON.stringify(sidecar, null, 2)}\n`).toBe(committed);
  });
});
