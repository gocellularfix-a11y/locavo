import { DENUE_COLUMNS, type DenueRawRecord } from '../DenueRawRecord';
import type {
  DenueImportGateway,
  DenueImportTx,
  DenuePlaceWrite,
  DenueSyncItem,
  ExistingDenuePlace,
} from '../DenueImportGateway';

/** Registro DENUE base válido de Culiacán para pruebas. */
export function rawRecord(overrides: Partial<DenueRawRecord> = {}): DenueRawRecord {
  const base = {} as DenueRawRecord;
  for (const column of DENUE_COLUMNS) {
    base[column] = '';
  }
  return {
    ...base,
    id: '1234567',
    clee: '25006TESTCLEE001',
    nom_estab: 'TAQUERÍA LA PRUEBA',
    raz_social: 'PRUEBAS SA DE CV',
    codigo_act: '722514',
    nombre_act: 'Restaurantes con servicio de preparación de tacos y tortas',
    tipo_vial: 'AVENIDA',
    nom_vial: 'OBREGÓN',
    numero_ext: '210',
    tipo_asent: 'COLONIA',
    nomb_asent: 'CENTRO',
    cod_postal: '80000',
    cve_ent: '25',
    entidad: 'Sinaloa',
    cve_mun: '006',
    municipio: 'Culiacán',
    localidad: 'Culiacán Rosales   ',
    telefono: '6670000001',
    correoelec: 'HOLA@EJEMPLO.COM',
    www: 'ejemplo.com',
    latitud: '24.80790000',
    longitud: '-107.39580000',
    fecha_alta: '2010-07',
    ...overrides,
  };
}

function toCsvField(value: string): string {
  return /[",\n\r]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}

/** CSV oficial sintético a partir de registros (cabecera completa). */
export function csvOf(records: Partial<DenueRawRecord>[]): string {
  const lines = [DENUE_COLUMNS.join(',')];
  for (const overrides of records) {
    const record = rawRecord(overrides);
    lines.push(DENUE_COLUMNS.map((c) => toCsvField(record[c])).join(','));
  }
  return lines.join('\n') + '\n';
}

/** Estado en memoria que simula las tablas relevantes. */
export interface FakeStore {
  places: Map<
    string,
    ExistingDenuePlace & { status: string; published: boolean; hours: null; price: null }
  >;
  refs: { placeId: string; source: string; refType: string; externalId: string }[];
  provenance: { placeId: string; source: string; importedAt: string; updatedAt: string }[];
  snapshots: { externalId: string; placeId: string; payload: Record<string, unknown> }[];
  history: { placeId: string; changedBy: string; change: Record<string, unknown> }[];
  runs: { stats: Record<string, unknown>; items: DenueSyncItem[] }[];
}

export function emptyStore(): FakeStore {
  return { places: new Map(), refs: [], provenance: [], snapshots: [], history: [], runs: [] };
}

function cloneStore(store: FakeStore): FakeStore {
  return {
    places: new Map(JSON.parse(JSON.stringify([...store.places.entries()]))),
    refs: JSON.parse(JSON.stringify(store.refs)),
    provenance: JSON.parse(JSON.stringify(store.provenance)),
    snapshots: JSON.parse(JSON.stringify(store.snapshots)),
    history: JSON.parse(JSON.stringify(store.history)),
    runs: JSON.parse(JSON.stringify(store.runs)),
  };
}

/**
 * Gateway en memoria transaccional: escribe sobre una copia y solo publica
 * al `commit`; un error descarta la copia (igual que el rollback real).
 * `failOn` permite simular un fallo a mitad de corrida.
 */
export function fakeGateway(
  store: FakeStore,
  options: { failOnExternalId?: string } = {},
): DenueImportGateway {
  let counter = 0;
  return {
    async runInTransaction<T>(fn: (tx: DenueImportTx) => Promise<T>): Promise<T> {
      const work = cloneStore(store);
      const tx: DenueImportTx = {
        async findByDenueId(denueId: string): Promise<ExistingDenuePlace | null> {
          const ref = work.refs.find(
            (r) => r.source === 'denue' && r.refType === 'denue_id' && r.externalId === denueId,
          );
          if (!ref) {
            return null;
          }
          const place = work.places.get(ref.placeId);
          if (!place) {
            return null;
          }
          return {
            ...place,
            hasCleeRef: work.refs.some(
              (r) => r.placeId === ref.placeId && r.source === 'denue' && r.refType === 'clee',
            ),
          };
        },

        async insertPlace({ write, denueId, clee, sourceVersion, snapshot }): Promise<string> {
          if (denueId === options.failOnExternalId) {
            throw new Error(`fallo simulado en ${denueId}`);
          }
          if (
            work.refs.some(
              (r) => r.source === 'denue' && r.refType === 'denue_id' && r.externalId === denueId,
            )
          ) {
            throw new Error(`violación de unicidad simulada: denue_id ${denueId}`);
          }
          counter += 1;
          const placeId = `uuid-${String(counter).padStart(4, '0')}`;
          work.places.set(placeId, {
            placeId,
            ...writeToPlace(write),
            status: 'active',
            published: true,
            hours: null,
            price: null,
            hasCleeRef: Boolean(clee),
          });
          work.refs.push({ placeId, source: 'denue', refType: 'denue_id', externalId: denueId });
          if (clee) {
            work.refs.push({ placeId, source: 'denue', refType: 'clee', externalId: clee });
          }
          work.provenance.push({
            placeId,
            source: 'denue',
            importedAt: sourceVersion,
            updatedAt: sourceVersion,
          });
          work.snapshots.push({ externalId: denueId, placeId, payload: snapshot });
          work.history.push({
            placeId,
            changedBy: 'import:denue',
            change: { action: 'insert', denueId },
          });
          return placeId;
        },

        async updatePlace({ placeId, write, denueId, changedFields, sourceVersion, snapshot }) {
          if (denueId === options.failOnExternalId) {
            throw new Error(`fallo simulado en ${denueId}`);
          }
          const place = work.places.get(placeId);
          if (!place) {
            throw new Error(`lugar inexistente: ${placeId}`);
          }
          work.places.set(placeId, { ...place, ...writeToPlace(write) });
          for (const entry of work.provenance) {
            if (entry.placeId === placeId && entry.source === 'denue') {
              entry.updatedAt = sourceVersion;
            }
          }
          work.snapshots.push({ externalId: denueId, placeId, payload: snapshot });
          work.history.push({
            placeId,
            changedBy: 'import:denue',
            change: { action: 'update', denueId, changedFields },
          });
        },

        async addCleeRef(placeId: string, clee: string): Promise<void> {
          if (
            !work.refs.some(
              (r) => r.source === 'denue' && r.refType === 'clee' && r.externalId === clee,
            )
          ) {
            work.refs.push({ placeId, source: 'denue', refType: 'clee', externalId: clee });
            const place = work.places.get(placeId);
            if (place) {
              work.places.set(placeId, { ...place, hasCleeRef: true });
            }
          }
        },

        async recordRun({ stats, items }): Promise<void> {
          work.runs.push({ stats, items });
        },
      };

      const result = await fn(tx);
      // commit: publicar la copia de trabajo sobre el estado real
      store.places = work.places;
      store.refs = work.refs;
      store.provenance = work.provenance;
      store.snapshots = work.snapshots;
      store.history = work.history;
      store.runs = work.runs;
      return result;
    },
  };
}

function writeToPlace(write: DenuePlaceWrite) {
  return {
    name: write.name,
    normalizedName: write.normalizedName,
    category: write.category,
    latitude: write.latitude,
    longitude: write.longitude,
    address: write.address,
    contact: write.contact,
    searchTerms: write.searchTerms,
    verificationStatus: write.verificationStatus,
    confidence: write.confidence,
    lastVerifiedAt: write.lastVerifiedAt,
  };
}
