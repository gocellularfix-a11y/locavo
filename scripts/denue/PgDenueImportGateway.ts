import type { Client } from 'pg';

import type {
  DenueImportGateway,
  DenueImportTx,
  DenuePlaceWrite,
  DenueSyncItem,
  ExistingDenuePlace,
} from '../../src/data/import/denue/DenueImportGateway';

/**
 * Implementación Postgres del gateway de importación DENUE (V4B).
 *
 * Solo se ejecuta en desarrollo local contra el stack Supabase de Docker,
 * conectando directo a la base (el esquema `private` no se expone por la
 * API). Toda la corrida ocurre en UNA transacción: fallo → ROLLBACK.
 */

function txOf(client: Client): DenueImportTx {
  return {
    async findByDenueId(denueId: string): Promise<ExistingDenuePlace | null> {
      const { rows } = await client.query(
        `select p.id,
                p.name,
                p.normalized_name,
                p.category,
                ST_Y(p.location::geometry)::float8 as latitude,
                ST_X(p.location::geometry)::float8 as longitude,
                p.address,
                p.contact,
                p.search_terms,
                p.verification_status,
                p.confidence::float8 as confidence,
                to_char(p.last_verified_at at time zone 'utc', 'YYYY-MM-DD') as last_verified_at,
                exists (
                  select 1 from public.place_source_refs c
                  where c.place_id = p.id and c.source = 'denue' and c.ref_type = 'clee'
                ) as has_clee_ref
           from public.place_source_refs r
           join public.places p on p.id = r.place_id
          where r.source = 'denue' and r.ref_type = 'denue_id' and r.external_id = $1`,
        [denueId],
      );
      if (rows.length === 0) {
        return null;
      }
      const row = rows[0];
      return {
        placeId: row.id,
        name: row.name,
        normalizedName: row.normalized_name,
        category: row.category,
        latitude: row.latitude,
        longitude: row.longitude,
        address: row.address,
        contact: row.contact,
        searchTerms: row.search_terms ?? [],
        verificationStatus: row.verification_status,
        confidence: row.confidence,
        lastVerifiedAt: row.last_verified_at,
        hasCleeRef: row.has_clee_ref,
      };
    },

    async insertPlace({ write, denueId, clee, sourceVersion, snapshot }): Promise<string> {
      const { rows } = await client.query(
        `insert into public.places
           (name, normalized_name, category, location, address, contact, search_terms,
            verification_status, confidence, last_verified_at, status, published)
         values ($1, $2, $3,
                 ST_SetSRID(ST_MakePoint($4, $5), 4326)::geography,
                 $6::jsonb, $7::jsonb, $8,
                 $9, $10, $11::timestamptz, 'active', true)
         returning id`,
        [
          write.name,
          write.normalizedName,
          write.category,
          write.longitude,
          write.latitude,
          JSON.stringify(write.address),
          write.contact === null ? null : JSON.stringify(write.contact),
          write.searchTerms,
          write.verificationStatus,
          write.confidence,
          sourceVersion,
        ],
      );
      const placeId: string = rows[0].id;

      await client.query(
        `insert into public.place_source_refs (place_id, source, ref_type, external_id)
         values ($1, 'denue', 'denue_id', $2)`,
        [placeId, denueId],
      );
      if (clee) {
        await client.query(
          `insert into public.place_source_refs (place_id, source, ref_type, external_id)
           values ($1, 'denue', 'clee', $2)
           on conflict on constraint place_source_refs_unique_external do nothing`,
          [placeId, clee],
        );
      }
      await client.query(
        `insert into public.place_provenance (place_id, source, imported_at, updated_at)
         values ($1, 'denue', $2::timestamptz, $2::timestamptz)`,
        [placeId, sourceVersion],
      );
      await client.query(
        `insert into private.provider_snapshots (source_id, external_id, place_id, payload)
         values ('denue', $1, $2, $3::jsonb)`,
        [denueId, placeId, JSON.stringify(snapshot)],
      );
      await client.query(
        `insert into private.place_change_history (place_id, changed_by, change, reason)
         values ($1, 'import:denue', $2::jsonb, 'denue_culiacan_pilot')`,
        [placeId, JSON.stringify({ action: 'insert', denueId })],
      );
      return placeId;
    },

    async updatePlace({ placeId, write, denueId, changedFields, sourceVersion, snapshot }): Promise<void> {
      await client.query(
        `update public.places
            set name = $2,
                normalized_name = $3,
                category = $4,
                location = ST_SetSRID(ST_MakePoint($5, $6), 4326)::geography,
                address = $7::jsonb,
                contact = $8::jsonb,
                search_terms = $9,
                verification_status = $10,
                confidence = $11,
                last_verified_at = $12::timestamptz
          where id = $1`,
        [
          placeId,
          write.name,
          write.normalizedName,
          write.category,
          write.longitude,
          write.latitude,
          JSON.stringify(write.address),
          write.contact === null ? null : JSON.stringify(write.contact),
          write.searchTerms,
          write.verificationStatus,
          write.confidence,
          sourceVersion,
        ],
      );
      await client.query(
        `update public.place_provenance
            set updated_at = $2::timestamptz
          where place_id = $1 and source = 'denue'`,
        [placeId, sourceVersion],
      );
      await client.query(
        `insert into private.provider_snapshots (source_id, external_id, place_id, payload)
         values ('denue', $1, $2, $3::jsonb)`,
        [denueId, placeId, JSON.stringify(snapshot)],
      );
      await client.query(
        `insert into private.place_change_history (place_id, changed_by, change, reason)
         values ($1, 'import:denue', $2::jsonb, 'denue_culiacan_pilot')`,
        [placeId, JSON.stringify({ action: 'update', denueId, changedFields })],
      );
    },

    async addCleeRef(placeId: string, clee: string): Promise<void> {
      await client.query(
        `insert into public.place_source_refs (place_id, source, ref_type, external_id)
         values ($1, 'denue', 'clee', $2)
         on conflict on constraint place_source_refs_unique_external do nothing`,
        [placeId, clee],
      );
    },

    async recordRun({ sourceVersion, stats, items }): Promise<void> {
      const { rows } = await client.query(
        `insert into private.sync_runs (source_id, finished_at, status, stats)
         values ('denue', now(), 'succeeded', $1::jsonb)
         returning id`,
        [JSON.stringify({ ...stats, sourceVersion })],
      );
      const runId: string = rows[0].id;
      for (const item of items as DenueSyncItem[]) {
        await client.query(
          `insert into private.sync_items (sync_run_id, external_id, action, place_id, detail)
           values ($1, $2, $3, $4, $5::jsonb)`,
          [runId, item.externalId, item.action, item.placeId ?? null, item.detail ? JSON.stringify(item.detail) : null],
        );
      }
    },
  };
}

export function createPgDenueImportGateway(client: Client): DenueImportGateway {
  return {
    async runInTransaction<T>(fn: (tx: DenueImportTx) => Promise<T>): Promise<T> {
      await client.query('begin');
      try {
        const result = await fn(txOf(client));
        await client.query('commit');
        return result;
      } catch (error) {
        await client.query('rollback');
        throw error;
      }
    },
  };
}

// Sin uso directo aquí, pero mantiene el contrato visible para el lector.
export type { DenuePlaceWrite };
