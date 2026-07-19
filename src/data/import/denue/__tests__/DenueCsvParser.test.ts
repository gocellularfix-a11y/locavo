import { DenueCsvError, parseDenueCsv } from '../DenueCsvParser';
import { DENUE_COLUMNS } from '../DenueRawRecord';
import { csvOf, rawRecord } from './helpers';

describe('parseDenueCsv', () => {
  it('parsea un CSV oficial completo y conserva todos los campos', () => {
    const rows = parseDenueCsv(csvOf([{ id: '111' }, { id: '222', nom_estab: 'CAFÉ DOS' }]));
    expect(rows).toHaveLength(2);
    expect(rows[0].row).toBe(1);
    expect(rows[0].record.id).toBe('111');
    expect(rows[1].record.nom_estab).toBe('CAFÉ DOS');
    expect(rows[1].record.codigo_act).toBe('722514');
    for (const column of DENUE_COLUMNS) {
      expect(typeof rows[0].record[column]).toBe('string');
    }
  });

  it('soporta comas y comillas escapadas dentro de campos entrecomillados', () => {
    const rows = parseDenueCsv(csvOf([{ nom_estab: 'TACOS "EL GÜERO", SUCURSAL CENTRO' }]));
    expect(rows[0].record.nom_estab).toBe('TACOS "EL GÜERO", SUCURSAL CENTRO');
  });

  it('soporta saltos de línea dentro de campos entrecomillados', () => {
    const rows = parseDenueCsv(csvOf([{ nom_vial: 'AVENIDA\nSEGUNDA LÍNEA' }]));
    expect(rows).toHaveLength(1);
    expect(rows[0].record.nom_vial).toBe('AVENIDA\nSEGUNDA LÍNEA');
  });

  it('materializa como vacías las columnas opcionales ausentes de la cabecera', () => {
    const csv = 'id,nom_estab,codigo_act,latitud,longitud,cve_ent,cve_mun\n' +
      '999,SOLO LO MÍNIMO,722514,24.8,-107.4,25,006\n';
    const rows = parseDenueCsv(csv);
    expect(rows[0].record.id).toBe('999');
    expect(rows[0].record.telefono).toBe('');
    expect(rows[0].record.clee).toBe('');
    expect(rows[0].record.www).toBe('');
  });

  it('rechaza cabeceras sin columnas obligatorias', () => {
    expect(() => parseDenueCsv('id,nombre\n1,x\n')).toThrow(DenueCsvError);
    expect(() => parseDenueCsv('')).toThrow(DenueCsvError);
  });

  it('rechaza un CSV con comilla sin cerrar', () => {
    const csv = DENUE_COLUMNS.join(',') + '\n"abierto,1,2\n';
    expect(() => parseDenueCsv(csv)).toThrow(DenueCsvError);
  });

  it('es determinista: mismo texto, mismas filas', () => {
    const csv = csvOf([{ id: '1' }, { id: '2' }]);
    expect(parseDenueCsv(csv)).toEqual(parseDenueCsv(csv));
  });

  it('parsea el registro base de pruebas sin pérdidas (ida y vuelta)', () => {
    const record = rawRecord();
    const [parsed] = parseDenueCsv(csvOf([record]));
    expect(parsed.record).toEqual(record);
  });
});
