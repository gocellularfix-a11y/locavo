import { csvOf } from './helpers';
import {
  buildCityPack,
  serializeCityPack,
  serializeQuarantine,
  type CityPackMeta,
} from '../CityPackBuilder';
import { mapDenueRow, type DenueImportCandidate, type DenueRejection } from '../DenueCandidateMapper';
import { parseDenueCsv } from '../DenueCsvParser';
import { DENUE_IMPORT_DEFAULTS } from '../DenueImportService';

const META: CityPackMeta = {
  city: 'culiacan',
  municipality: DENUE_IMPORT_DEFAULTS.municipality,
  dataset: DENUE_IMPORT_DEFAULTS.dataset,
  sourceVersion: DENUE_IMPORT_DEFAULTS.sourceVersion,
  sourceFile: 'denue_inegi_25_.csv',
  license: 'Términos de Libre Uso de la Información del INEGI',
};

/** Corre CSV sintético por el pipeline V4B reutilizado y construye el pack. */
function buildFromCsv(csv: string) {
  const rows = parseDenueCsv(csv);
  const candidates: DenueImportCandidate[] = [];
  const rejections: DenueRejection[] = [];
  for (const parsed of rows) {
    const result = mapDenueRow(parsed, DENUE_IMPORT_DEFAULTS.municipality);
    if ('candidate' in result) {
      candidates.push(result.candidate);
    } else {
      rejections.push(result.rejection);
    }
  }
  return buildCityPack(candidates, rejections, rows.length, META);
}

describe('buildCityPack (pack canónico de Culiacán)', () => {
  it('es determinista: dos corridas producen exactamente los mismos bytes', () => {
    const csv = csvOf([
      { id: '300', nom_estab: 'CAFÉ TRES' , codigo_act: '722515' },
      { id: '100', nom_estab: 'TAQUERÍA UNO' },
      { id: '200', nom_estab: 'FARMACIA DOS', codigo_act: '464111' },
    ]);
    const a = buildFromCsv(csv);
    const b = buildFromCsv(csv);
    expect(serializeCityPack(a.pack)).toBe(serializeCityPack(b.pack));
    expect(serializeQuarantine(a.quarantine)).toBe(serializeQuarantine(b.quarantine));
    expect(a.stats).toEqual(b.stats);
  });

  it('ordena por denue_id numérico ascendente (orden determinista)', () => {
    const csv = csvOf([{ id: '900' }, { id: '10' }, { id: '101' }]);
    const { pack } = buildFromCsv(csv);
    expect(pack.places.map((p) => p.id)).toEqual(['denue-10', 'denue-101', 'denue-900']);
  });

  it('el pack no contiene marcas de tiempo de ejecución', () => {
    const { pack } = buildFromCsv(csvOf([{ id: '1' }]));
    const json = serializeCityPack(pack);
    const year = new Date().getFullYear();
    // La única fecha presente es la versión oficial del dataset.
    expect(json).not.toContain(new Date().toISOString().slice(0, 10));
    expect(pack.sourceVersion).toBe(DENUE_IMPORT_DEFAULTS.sourceVersion);
    expect(year).toBeGreaterThan(0);
  });

  it('duplicados de denue_id: conserva la primera aparición y los cuenta', () => {
    const csv = csvOf([
      { id: '500', nom_estab: 'PRIMERO' },
      { id: '500', nom_estab: 'SEGUNDO' },
      { id: '501' },
    ]);
    const { pack, stats } = buildFromCsv(csv);
    expect(stats.duplicates).toBe(1);
    expect(pack.count).toBe(2);
    expect(pack.places.find((p) => p.id === 'denue-500')?.name).toBe('PRIMERO');
  });

  it('cada lugar lleva procedencia completa del proveedor', () => {
    const { pack } = buildFromCsv(csvOf([{ id: '77' }]));
    const source = pack.places[0].sources[0];
    expect(source.provider).toBe('denue');
    expect(source.externalId).toBe('77');
    expect(source.dataset).toBe('MEX-INEGI.EEC2.05-DENUE-2026');
    expect(source.edition).toBe(DENUE_IMPORT_DEFAULTS.sourceVersion);
    expect(source.sourceFile).toBe('denue_inegi_25_.csv');
    expect(source.rawActivityCode).toBe('722514');
    expect(source.rawActivityName).toContain('tacos');
    expect(source.clee).toBe('25006TESTCLEE001');
  });

  it('reutiliza el mapeo SCIAN de V4B (sin segunda interpretación)', () => {
    const csv = csvOf([
      { id: '1', codigo_act: '722515' },
      { id: '2', codigo_act: '464112' },
      { id: '3', codigo_act: '468411' },
    ]);
    const { pack } = buildFromCsv(csv);
    expect(pack.places.map((p) => p.category)).toEqual(['coffee', 'pharmacy', 'gas']);
    expect(pack.byCategory).toEqual({ coffee: 1, gas: 1, pharmacy: 1 });
  });

  it('filtra a Culiacán: registros de otros municipios quedan fuera', () => {
    const csv = csvOf([
      { id: '1' },
      { id: '2', cve_mun: '001', municipio: 'Ahome' },
      { id: '3', cve_ent: '19', cve_mun: '039', entidad: 'Nuevo León' },
    ]);
    const { pack, stats } = buildFromCsv(csv);
    expect(pack.count).toBe(1);
    expect(stats.read).toBe(3);
    expect(stats.municipalityRows).toBe(1);
    expect(stats.rejectedReasons['outside_pilot_municipality']).toBe(2);
  });

  it('coordenadas inválidas van a cuarentena, nunca se inventan', () => {
    const csv = csvOf([
      { id: '1' },
      { id: '2', latitud: '', longitud: '' },
      { id: '3', latitud: '999', longitud: '-107.39' },
    ]);
    const { pack, stats, quarantine } = buildFromCsv(csv);
    expect(pack.count).toBe(1);
    expect(stats.quarantinedInvalidCoordinates).toBe(2);
    expect(quarantine).toEqual([
      { row: 2, denueId: '2', reason: 'invalid_coordinates' },
      { row: 3, denueId: '3', reason: 'invalid_coordinates' },
    ]);
    expect(stats.validCoordinates).toBe(1);
  });

  it('actividades no soportadas se reportan agregadas, no se descartan en silencio', () => {
    const csv = csvOf([
      { id: '1' },
      { id: '2', codigo_act: '811111', nombre_act: 'Reparación mecánica de automóviles' },
      { id: '3', codigo_act: '811111', nombre_act: 'Reparación mecánica de automóviles' },
      { id: '4', codigo_act: '621111', nombre_act: 'Consultorios de medicina general' },
    ]);
    const { stats } = buildFromCsv(csv);
    expect(stats.rejectedReasons['unmapped_category']).toBe(3);
    expect(stats.unmappedActivities).toEqual([
      { code: '811111', label: 'Reparación mecánica de automóviles', count: 2 },
      { code: '621111', label: 'Consultorios de medicina general', count: 1 },
    ]);
  });

  it('opcionales faltantes no descartan y se cuentan (teléfono, sitio web)', () => {
    const csv = csvOf([
      { id: '1', telefono: '', www: '' },
      { id: '2', telefono: '6671112222', www: '' },
      { id: '3' },
    ]);
    const { pack, stats } = buildFromCsv(csv);
    expect(pack.count).toBe(3);
    expect(stats.missingPhone).toBe(1);
    expect(stats.missingWebsite).toBe(2);
  });

  it('preserva acentos y ñ en nombres; el nombre normalizado se deriva aparte', () => {
    const csv = csvOf([{ id: '1', nom_estab: 'CAFÉ DOÑA ÑOÑA SÁNCHEZ' }]);
    const { pack } = buildFromCsv(csv);
    expect(pack.places[0].name).toBe('CAFÉ DOÑA ÑOÑA SÁNCHEZ');
    expect(pack.places[0].normalizedName).toBe('cafe dona nona sanchez');
  });

  it('el DTO es neutral al proveedor: sin nombres de campo DENUE en el lugar', () => {
    const { pack } = buildFromCsv(csvOf([{ id: '1' }]));
    const placeKeys = Object.keys(pack.places[0]);
    for (const denueField of ['nom_estab', 'codigo_act', 'cve_ent', 'cve_mun', 'latitud', 'longitud']) {
      expect(placeKeys).not.toContain(denueField);
    }
    // Los campos crudos del proveedor viven solo dentro de sources[] como provenance.
    expect(placeKeys).toEqual(
      expect.arrayContaining(['id', 'name', 'category', 'latitude', 'longitude', 'sources']),
    );
  });
});
