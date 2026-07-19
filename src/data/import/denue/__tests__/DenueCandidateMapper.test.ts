import { buildSearchTerms, mapDenueRow } from '../DenueCandidateMapper';
import { rawRecord } from './helpers';

const CULIACAN = { cveEnt: '25', cveMun: '006' };

function mapOk(overrides = {}) {
  const result = mapDenueRow({ row: 1, record: rawRecord(overrides) }, CULIACAN);
  if (!('candidate' in result)) {
    throw new Error(`esperaba candidato, hubo rechazo: ${JSON.stringify(result)}`);
  }
  return result.candidate;
}

function mapRejected(overrides = {}) {
  const result = mapDenueRow({ row: 1, record: rawRecord(overrides) }, CULIACAN);
  if (!('rejection' in result)) {
    throw new Error('esperaba rechazo, hubo candidato');
  }
  return result.rejection;
}

describe('mapDenueRow — registro válido', () => {
  it('preserva el nombre original y deriva el normalizado por separado', () => {
    const candidate = mapOk({ nom_estab: 'TAQUERÍA  “EL   GÜERO”' });
    expect(candidate.name).toBe('TAQUERÍA “EL GÜERO”');
    expect(candidate.normalizedName).toBe('taqueria “el guero”');
    expect(candidate.name).not.toBe(candidate.normalizedName);
  });

  it('usa el id DENUE y el CLEE como referencias externas separadas', () => {
    const candidate = mapOk();
    expect(candidate.denueId).toBe('1234567');
    expect(candidate.clee).toBe('25006TESTCLEE001');
  });

  it('mapea categoría vía la capa SCIAN documentada', () => {
    expect(mapOk({ codigo_act: '722514' }).category).toBe('food');
    expect(mapOk({ codigo_act: '464112' }).category).toBe('pharmacy');
  });

  it('parsea coordenadas numéricas', () => {
    const candidate = mapOk();
    expect(candidate.latitude).toBeCloseTo(24.8079, 6);
    expect(candidate.longitude).toBeCloseTo(-107.3958, 6);
  });

  it('construye la dirección canónica con locality sin relleno', () => {
    const candidate = mapOk();
    expect(candidate.address).toEqual({
      countryCode: 'MX',
      formatted: 'AVENIDA OBREGÓN 210, CENTRO, Culiacán Rosales',
      street: 'AVENIDA OBREGÓN',
      exteriorNumber: '210',
      neighborhood: 'CENTRO',
      postalCode: '80000',
      locality: 'Culiacán Rosales',
      municipality: 'Culiacán',
      state: 'Sinaloa',
    });
  });

  it('construye contacto con email en minúsculas y sitio con esquema', () => {
    const candidate = mapOk();
    expect(candidate.contact).toEqual({
      phone: '6670000001',
      email: 'hola@ejemplo.com',
      website: 'https://ejemplo.com',
    });
    expect(mapOk({ www: 'https://ya-con-esquema.mx' }).contact?.website).toBe(
      'https://ya-con-esquema.mx',
    );
  });

  it('conserva el registro crudo completo para el snapshot', () => {
    const record = rawRecord();
    const result = mapDenueRow({ row: 1, record }, CULIACAN);
    expect('candidate' in result && result.candidate.raw).toEqual(record);
  });
});

describe('mapDenueRow — opcionales faltantes', () => {
  it('acepta registros sin teléfono, correo, web, colonia ni CLEE', () => {
    const candidate = mapOk({
      telefono: '',
      correoelec: '',
      www: '',
      nomb_asent: '',
      clee: '',
      numero_ext: '',
    });
    expect(candidate.contact).toBeUndefined();
    expect(candidate.clee).toBeUndefined();
    expect(candidate.address.neighborhood).toBeUndefined();
    expect(candidate.address.formatted).toBe('AVENIDA OBREGÓN, Culiacán Rosales');
  });

  it('usa raz_social como respaldo cuando nom_estab está vacío', () => {
    const candidate = mapOk({ nom_estab: '  ' });
    expect(candidate.name).toBe('PRUEBAS SA DE CV');
  });
});

describe('mapDenueRow — rechazos', () => {
  it('rechaza id faltante o no numérico', () => {
    expect(mapRejected({ id: '' }).reason).toBe('missing_or_invalid_id');
    expect(mapRejected({ id: 'ABC123' }).reason).toBe('missing_or_invalid_id');
    expect(mapRejected({ id: '12 34' }).reason).toBe('missing_or_invalid_id');
  });

  it('rechaza registros sin ningún nombre', () => {
    expect(mapRejected({ nom_estab: '', raz_social: '  ' }).reason).toBe('missing_name');
  });

  it('rechaza categorías SCIAN sin mapeo', () => {
    expect(mapRejected({ codigo_act: '812110' }).reason).toBe('unmapped_category');
  });

  it('rechaza coordenadas malformadas o fuera de rango', () => {
    expect(mapRejected({ latitud: '' }).reason).toBe('invalid_coordinates');
    expect(mapRejected({ latitud: 'no-numérico' }).reason).toBe('invalid_coordinates');
    expect(mapRejected({ latitud: '95.1' }).reason).toBe('invalid_coordinates');
    expect(mapRejected({ longitud: '181' }).reason).toBe('invalid_coordinates');
  });

  it('rechaza registros fuera del municipio piloto', () => {
    expect(mapRejected({ cve_mun: '001' }).reason).toBe('outside_pilot_municipality');
    expect(mapRejected({ cve_ent: '26' }).reason).toBe('outside_pilot_municipality');
  });

  it('el rechazo informa fila e id cuando existe', () => {
    const rejection = mapRejected({ codigo_act: '999999' });
    expect(rejection.row).toBe(1);
    expect(rejection.denueId).toBe('1234567');
  });
});

describe('buildSearchTerms', () => {
  it('deriva términos normalizados, sin genéricos, únicos y acotados', () => {
    expect(
      buildSearchTerms('Restaurantes con servicio de preparación de tacos y tortas'),
    ).toEqual(['restaurantes', 'tacos', 'tortas']);
    expect(buildSearchTerms('Comercio al por menor de cerveza')).toEqual(['cerveza']);
    expect(buildSearchTerms('')).toEqual([]);
  });

  it('es determinista y no excede 6 términos', () => {
    const long = 'panadería tortillería carnicería frutería verdulería dulcería abarrotes cremería';
    const terms = buildSearchTerms(long);
    expect(terms.length).toBeLessThanOrEqual(6);
    expect(terms).toEqual(buildSearchTerms(long));
  });
});
