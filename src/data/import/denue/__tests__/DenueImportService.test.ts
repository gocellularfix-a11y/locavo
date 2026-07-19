import {
  DENUE_IMPORT_DEFAULTS,
  protectiveMergeJson,
  runDenueImport,
} from '../DenueImportService';
import { csvOf, emptyStore, fakeGateway } from './helpers';

describe('runDenueImport — primera corrida', () => {
  it('inserta candidatos válidos y reporta conteos deterministas', async () => {
    const store = emptyStore();
    const csv = csvOf([
      { id: '1', nom_estab: 'TAQUERÍA UNO', codigo_act: '722514' },
      { id: '2', nom_estab: 'CAFÉ DOS', codigo_act: '722515' },
      { id: '3', nom_estab: 'FARMACIA TRES', codigo_act: '464111' },
    ]);

    const report = await runDenueImport(csv, fakeGateway(store));

    expect(report).toMatchObject({
      source: 'denue',
      dataset: DENUE_IMPORT_DEFAULTS.dataset,
      read: 3,
      accepted: 3,
      rejected: 0,
      inserted: 3,
      updated: 0,
      unchanged: 0,
      skippedDuplicates: 0,
      errors: 0,
      byCategory: { food: 1, coffee: 1, pharmacy: 1 },
    });
    expect(store.places.size).toBe(3);
    expect(store.refs.filter((r) => r.refType === 'denue_id')).toHaveLength(3);
    expect(store.refs.filter((r) => r.refType === 'clee')).toHaveLength(3);
    expect(store.provenance).toHaveLength(3);
    expect(store.snapshots).toHaveLength(3);
    expect(store.history).toHaveLength(3);
    expect(store.runs).toHaveLength(1);
  });

  it('preserva el snapshot crudo completo y el nombre original', async () => {
    const store = emptyStore();
    await runDenueImport(csvOf([{ id: '7', nom_estab: 'MARISCOS “LA PALAPA”' }]), fakeGateway(store));

    const snapshot = store.snapshots[0].payload;
    expect(snapshot.nom_estab).toBe('MARISCOS “LA PALAPA”');
    expect(snapshot.codigo_act).toBe('722514');
    expect(snapshot.fecha_alta).toBe('2010-07');

    const place = [...store.places.values()][0];
    expect(place.name).toBe('MARISCOS “LA PALAPA”');
    expect(place.normalizedName).toBe('mariscos “la palapa”');
    expect(place.verificationStatus).toBe('source_verified');
    expect(place.confidence).toBe(0.6);
  });

  it('reporta rechazos por razón sin abortar los registros válidos', async () => {
    const store = emptyStore();
    const csv = csvOf([
      { id: '1' },
      { id: 'XX' },
      { id: '3', latitud: '99' },
      { id: '4', codigo_act: '812110' },
      { id: '5', cve_mun: '001' },
    ]);
    const report = await runDenueImport(csv, fakeGateway(store));

    expect(report.read).toBe(5);
    expect(report.accepted).toBe(1);
    expect(report.rejected).toBe(4);
    expect(report.rejectedReasons).toEqual({
      missing_or_invalid_id: 1,
      invalid_coordinates: 1,
      unmapped_category: 1,
      outside_pilot_municipality: 1,
    });
    expect(report.inserted).toBe(1);
    const failed = store.runs[0].items.filter((i) => i.action === 'failed');
    expect(failed).toHaveLength(4);
  });

  it('omite duplicados dentro del mismo lote (mismo denue_id)', async () => {
    const store = emptyStore();
    const csv = csvOf([{ id: '9' }, { id: '9', nom_estab: 'REPETIDO' }]);
    const report = await runDenueImport(csv, fakeGateway(store));

    expect(report.inserted).toBe(1);
    expect(report.skippedDuplicates).toBe(1);
    expect(store.places.size).toBe(1);
    expect(store.refs.filter((r) => r.refType === 'denue_id')).toHaveLength(1);
  });
});

describe('runDenueImport — idempotencia (segunda corrida)', () => {
  it('la misma entrada dos veces: todo unchanged, cero escrituras nuevas', async () => {
    const store = emptyStore();
    const csv = csvOf([
      { id: '1', nom_estab: 'TAQUERÍA UNO' },
      { id: '2', nom_estab: 'CAFÉ DOS', codigo_act: '722515' },
    ]);

    const first = await runDenueImport(csv, fakeGateway(store));
    const uuidsAfterFirst = [...store.places.keys()].sort();
    const snapshotsAfterFirst = store.snapshots.length;
    const provenanceAfterFirst = JSON.stringify(store.provenance);

    const second = await runDenueImport(csv, fakeGateway(store));

    expect(first.inserted).toBe(2);
    expect(second).toMatchObject({ inserted: 0, updated: 0, unchanged: 2, errors: 0 });
    // UUIDs estables, sin lugares nuevos ni refs duplicadas
    expect([...store.places.keys()].sort()).toEqual(uuidsAfterFirst);
    const denueRefs = store.refs.filter((r) => r.refType === 'denue_id').map((r) => r.externalId);
    expect(new Set(denueRefs).size).toBe(denueRefs.length);
    // unchanged no reescribe: ni snapshots nuevos ni provenance tocada
    expect(store.snapshots.length).toBe(snapshotsAfterFirst);
    expect(JSON.stringify(store.provenance)).toBe(provenanceAfterFirst);
    // la bitácora sí registra ambas corridas
    expect(store.runs).toHaveLength(2);
  });

  it('detecta cambios reales del proveedor y actualiza solo esos lugares', async () => {
    const store = emptyStore();
    await runDenueImport(csvOf([{ id: '1', nom_estab: 'ANTES' }, { id: '2' }]), fakeGateway(store));

    const report = await runDenueImport(
      csvOf([{ id: '1', nom_estab: 'DESPUÉS' }, { id: '2' }]),
      fakeGateway(store),
    );

    expect(report).toMatchObject({ inserted: 0, updated: 1, unchanged: 1 });
    const updatedItem = store.runs[1].items.find((i) => i.action === 'updated');
    expect(updatedItem?.detail?.changedFields).toEqual(['name', 'normalized_name']);
    const names = [...store.places.values()].map((p) => p.name).sort();
    expect(names).toEqual(['DESPUÉS', 'TAQUERÍA LA PRUEBA']);
    // el update añade snapshot nuevo (auditoría), el unchanged no
    expect(store.snapshots).toHaveLength(3);
  });

  it('no sobrescribe datos existentes con valores vacíos del proveedor', async () => {
    const store = emptyStore();
    await runDenueImport(csvOf([{ id: '1' }]), fakeGateway(store));

    // El proveedor "pierde" teléfono y web; el correo cambia.
    const report = await runDenueImport(
      csvOf([{ id: '1', telefono: '', www: '', correoelec: 'NUEVO@EJEMPLO.COM' }]),
      fakeGateway(store),
    );

    expect(report.updated).toBe(1);
    const place = [...store.places.values()][0];
    expect(place.contact).toEqual({
      phone: '6670000001', // preservado
      website: 'https://ejemplo.com', // preservado
      email: 'nuevo@ejemplo.com', // actualizado
    });
  });

  it('jamás toca horarios/precio/status/published en updates', async () => {
    const store = emptyStore();
    await runDenueImport(csvOf([{ id: '1' }]), fakeGateway(store));
    await runDenueImport(csvOf([{ id: '1', nom_estab: 'RENOMBRADO' }]), fakeGateway(store));

    const place = [...store.places.values()][0];
    expect(place.hours).toBeNull();
    expect(place.price).toBeNull();
    expect(place.status).toBe('active');
    expect(place.published).toBe(true);
  });

  it('añade la referencia CLEE faltante sin duplicarla', async () => {
    const store = emptyStore();
    await runDenueImport(csvOf([{ id: '1', clee: '' }]), fakeGateway(store));
    expect(store.refs.filter((r) => r.refType === 'clee')).toHaveLength(0);

    await runDenueImport(csvOf([{ id: '1', clee: 'CLEE-NUEVA' }]), fakeGateway(store));
    await runDenueImport(csvOf([{ id: '1', clee: 'CLEE-NUEVA' }]), fakeGateway(store));
    expect(store.refs.filter((r) => r.refType === 'clee')).toHaveLength(1);
  });
});

describe('runDenueImport — reporte determinista y fallo seguro', () => {
  it('dos corridas sobre estados idénticos producen reportes idénticos', async () => {
    const csv = csvOf([{ id: '1' }, { id: '2', codigo_act: '722515' }, { id: 'MAL' }]);
    const a = await runDenueImport(csv, fakeGateway(emptyStore()));
    const b = await runDenueImport(csv, fakeGateway(emptyStore()));
    expect(a).toEqual(b);
  });

  it('un fallo a mitad de corrida revierte TODO (sin importación parcial)', async () => {
    const store = emptyStore();
    const csv = csvOf([{ id: '1' }, { id: '2' }, { id: '3' }]);

    await expect(
      runDenueImport(csv, fakeGateway(store, { failOnExternalId: '3' })),
    ).rejects.toThrow('fallo simulado');

    expect(store.places.size).toBe(0);
    expect(store.refs).toHaveLength(0);
    expect(store.provenance).toHaveLength(0);
    expect(store.snapshots).toHaveLength(0);
    expect(store.runs).toHaveLength(0);
  });

  it('tras un fallo, reintentar con la entrada corregida importa completo', async () => {
    const store = emptyStore();
    const csv = csvOf([{ id: '1' }, { id: '2' }]);
    await expect(
      runDenueImport(csv, fakeGateway(store, { failOnExternalId: '2' })),
    ).rejects.toThrow();
    const report = await runDenueImport(csv, fakeGateway(store));
    expect(report.inserted).toBe(2);
    expect(store.places.size).toBe(2);
  });
});

describe('protectiveMergeJson', () => {
  it('conserva claves existentes que el proveedor trae vacías', () => {
    expect(
      protectiveMergeJson({ phone: '667', website: 'https://a.mx' }, { phone: '', email: 'x@y.z' }),
    ).toEqual({ phone: '667', website: 'https://a.mx', email: 'x@y.z' });
  });

  it('proveedor vacío o nulo no borra nada', () => {
    expect(protectiveMergeJson({ a: 1 }, null)).toEqual({ a: 1 });
    expect(protectiveMergeJson({ a: 1 }, {})).toEqual({ a: 1 });
    expect(protectiveMergeJson(null, null)).toBeNull();
  });

  it('valores nuevos del proveedor sí sobreescriben', () => {
    expect(protectiveMergeJson({ a: 'viejo' }, { a: 'nuevo' })).toEqual({ a: 'nuevo' });
  });
});
