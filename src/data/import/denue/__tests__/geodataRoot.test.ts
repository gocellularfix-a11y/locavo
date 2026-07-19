import { GeoDataRootError, resolveGeoDataRoot } from '../geodataRoot';

describe('resolveGeoDataRoot (raíz configurable, sin letras de unidad fijas)', () => {
  it('acepta --data-root con valor separado', () => {
    expect(resolveGeoDataRoot(['--data-root', 'D:\\GeoData'], {})).toBe('D:\\GeoData');
  });

  it('acepta la forma --data-root=<ruta>', () => {
    expect(resolveGeoDataRoot(['--data-root=D:\\GeoData'], {})).toBe('D:\\GeoData');
  });

  it('maneja rutas de Windows con espacios (con y sin comillas envolventes)', () => {
    expect(resolveGeoDataRoot(['--data-root', 'C:\\My Geo Data\\GeoData'], {})).toBe(
      'C:\\My Geo Data\\GeoData',
    );
    expect(resolveGeoDataRoot(['--data-root', '"C:\\My Geo Data\\GeoData"'], {})).toBe(
      'C:\\My Geo Data\\GeoData',
    );
    expect(resolveGeoDataRoot(['--data-root="E:\\Disco Externo\\GeoData"'], {})).toBe(
      'E:\\Disco Externo\\GeoData',
    );
  });

  it('recorta separadores finales', () => {
    expect(resolveGeoDataRoot(['--data-root', 'D:\\GeoData\\'], {})).toBe('D:\\GeoData');
  });

  it('usa LOCAVO_GEODATA_DIR cuando no hay argumento CLI', () => {
    expect(resolveGeoDataRoot([], { LOCAVO_GEODATA_DIR: 'F:\\GeoData' })).toBe('F:\\GeoData');
  });

  it('el CLI tiene precedencia sobre la variable de entorno', () => {
    expect(
      resolveGeoDataRoot(['--data-root', 'D:\\GeoData'], { LOCAVO_GEODATA_DIR: 'F:\\Otro' }),
    ).toBe('D:\\GeoData');
  });

  it('sin configuración lanza un error con instrucciones (sin default de máquina)', () => {
    expect(() => resolveGeoDataRoot([], {})).toThrow(GeoDataRootError);
    expect(() => resolveGeoDataRoot([], {})).toThrow(/LOCAVO_GEODATA_DIR/);
  });

  it('--data-root sin valor lanza un error claro', () => {
    expect(() => resolveGeoDataRoot(['--data-root'], {})).toThrow(GeoDataRootError);
    expect(() => resolveGeoDataRoot(['--data-root='], {})).toThrow(GeoDataRootError);
  });
});
