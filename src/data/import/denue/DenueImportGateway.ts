/**
 * Puerta de acceso a datos del importador DENUE (V4B).
 *
 * Interfaz provider-neutral hacia la base: el servicio de importación no
 * conoce SQL ni supabase-js; las implementaciones reales (Postgres en
 * `scripts/denue/`) y las de prueba (en memoria) cumplen este contrato.
 * Todas las escrituras de una corrida ocurren dentro de `runInTransaction`:
 * si algo falla, la corrida completa se revierte (sin importaciones a medias).
 */

/** Campos de `public.places` administrados por el proveedor DENUE. */
export interface DenuePlaceWrite {
  name: string;
  normalizedName: string;
  category: string;
  latitude: number;
  longitude: number;
  address: Record<string, unknown>;
  contact: Record<string, unknown> | null;
  searchTerms: string[];
  verificationStatus: string;
  confidence: number;
  /** Fecha ISO de la versión del dataset (determinista entre corridas). */
  lastVerifiedAt: string;
}

/** Estado actual de un lugar ya vinculado a un `denue_id`. */
export interface ExistingDenuePlace {
  placeId: string;
  name: string;
  normalizedName: string;
  category: string;
  latitude: number;
  longitude: number;
  address: Record<string, unknown> | null;
  contact: Record<string, unknown> | null;
  searchTerms: string[];
  verificationStatus: string;
  confidence: number;
  lastVerifiedAt: string | null;
  /** Ya existe la referencia CLEE de este lugar. */
  hasCleeRef: boolean;
}

export interface DenueSyncItem {
  externalId: string;
  action: 'created' | 'updated' | 'skipped' | 'failed';
  placeId?: string;
  detail?: Record<string, unknown>;
}

/** Operaciones disponibles dentro de la transacción de importación. */
export interface DenueImportTx {
  findByDenueId(denueId: string): Promise<ExistingDenuePlace | null>;

  /** Inserta lugar + refs + procedencia + snapshot + auditoría. Devuelve el UUID nuevo. */
  insertPlace(input: {
    write: DenuePlaceWrite;
    denueId: string;
    clee?: string;
    sourceVersion: string;
    snapshot: Record<string, unknown>;
  }): Promise<string>;

  /** Actualiza SOLO campos administrados por DENUE + procedencia + snapshot + auditoría. */
  updatePlace(input: {
    placeId: string;
    write: DenuePlaceWrite;
    denueId: string;
    changedFields: string[];
    sourceVersion: string;
    snapshot: Record<string, unknown>;
  }): Promise<void>;

  /** Añade la referencia CLEE si aún no existe (nunca duplica). */
  addCleeRef(placeId: string, clee: string): Promise<void>;

  /** Registra la corrida en la bitácora interna (sync_runs/sync_items). */
  recordRun(input: {
    sourceVersion: string;
    stats: Record<string, unknown>;
    items: DenueSyncItem[];
  }): Promise<void>;
}

export interface DenueImportGateway {
  runInTransaction<T>(fn: (tx: DenueImportTx) => Promise<T>): Promise<T>;
}
