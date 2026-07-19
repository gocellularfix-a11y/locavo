import type { DenueImportCandidate, DenueMunicipalityFilter, DenueRejection } from './DenueCandidateMapper';
import { mapDenueRow } from './DenueCandidateMapper';
import { parseDenueCsv } from './DenueCsvParser';
import type {
  DenueImportGateway,
  DenuePlaceWrite,
  DenueSyncItem,
  ExistingDenuePlace,
} from './DenueImportGateway';

/**
 * Servicio de importación DENUE (V4B) — upsert idempotente.
 *
 * Clave de upsert: (source='denue', ref_type='denue_id', external_id).
 * Garantías:
 *   - cero lugares canónicos duplicados: un `denue_id` = un lugar;
 *   - corridas repetidas con el mismo extracto → `unchanged`, sin escrituras;
 *   - los campos NO administrados por DENUE (horarios, precio, features,
 *     contenido localizado, status/published) jamás se tocan en updates;
 *   - valores vacíos del proveedor nunca borran datos existentes
 *     (merge protector por clave en address/contact);
 *   - toda la corrida es una única transacción (fallo → rollback total).
 */

export const DENUE_IMPORT_DEFAULTS = {
  /** Versión del dataset oficial (campo Modified de los metadatos INEGI). */
  sourceVersion: '2026-07-01',
  dataset: 'MEX-INEGI.EEC2.05-DENUE-2026',
  municipality: { cveEnt: '25', cveMun: '006' } satisfies DenueMunicipalityFilter,
  verificationStatus: 'source_verified',
  confidence: 0.6,
} as const;

export interface DenueImportOptions {
  sourceVersion: string;
  dataset: string;
  municipality: DenueMunicipalityFilter;
}

export interface DenueImportReport {
  source: 'denue';
  dataset: string;
  sourceVersion: string;
  municipality: DenueMunicipalityFilter;
  read: number;
  accepted: number;
  rejected: number;
  rejectedReasons: Record<string, number>;
  rejections: DenueRejection[];
  skippedDuplicates: number;
  inserted: number;
  updated: number;
  unchanged: number;
  errors: number;
  byCategory: Record<string, number>;
}

const COORD_EPSILON = 1e-7;

function jsonEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}

/**
 * Merge protector: las claves del proveedor con valor sobreescriben; las
 * claves existentes que el proveedor trae vacías/ausentes se conservan.
 */
export function protectiveMergeJson(
  existing: Record<string, unknown> | null,
  provider: Record<string, unknown> | null,
): Record<string, unknown> | null {
  if (provider === null || Object.keys(provider).length === 0) {
    return existing;
  }
  const merged: Record<string, unknown> = { ...(existing ?? {}) };
  for (const [key, value] of Object.entries(provider)) {
    if (value !== undefined && value !== null && value !== '') {
      merged[key] = value;
    }
  }
  return merged;
}

function toWrite(candidate: DenueImportCandidate, options: DenueImportOptions): DenuePlaceWrite {
  return {
    name: candidate.name,
    normalizedName: candidate.normalizedName,
    category: candidate.category,
    latitude: candidate.latitude,
    longitude: candidate.longitude,
    address: candidate.address as unknown as Record<string, unknown>,
    contact: (candidate.contact as unknown as Record<string, unknown>) ?? null,
    searchTerms: candidate.searchTerms,
    verificationStatus: DENUE_IMPORT_DEFAULTS.verificationStatus,
    confidence: DENUE_IMPORT_DEFAULTS.confidence,
    lastVerifiedAt: options.sourceVersion,
  };
}

/** Aplica el merge protector del candidato sobre el estado existente. */
function mergedWrite(existing: ExistingDenuePlace, write: DenuePlaceWrite): DenuePlaceWrite {
  return {
    ...write,
    address: protectiveMergeJson(existing.address, write.address) ?? write.address,
    contact: protectiveMergeJson(existing.contact, write.contact),
  };
}

/** Campos administrados que difieren entre el estado actual y el objetivo. */
function changedFieldsOf(existing: ExistingDenuePlace, target: DenuePlaceWrite): string[] {
  const changed: string[] = [];
  if (existing.name !== target.name) changed.push('name');
  if (existing.normalizedName !== target.normalizedName) changed.push('normalized_name');
  if (existing.category !== target.category) changed.push('category');
  if (
    Math.abs(existing.latitude - target.latitude) > COORD_EPSILON ||
    Math.abs(existing.longitude - target.longitude) > COORD_EPSILON
  ) {
    changed.push('location');
  }
  if (!jsonEqual(existing.address, target.address)) changed.push('address');
  if (!jsonEqual(existing.contact, target.contact)) changed.push('contact');
  if (!jsonEqual(existing.searchTerms, target.searchTerms)) changed.push('search_terms');
  if (existing.verificationStatus !== target.verificationStatus) changed.push('verification_status');
  if (Math.abs(existing.confidence - target.confidence) > 1e-9) changed.push('confidence');
  if ((existing.lastVerifiedAt ?? '').slice(0, 10) !== target.lastVerifiedAt.slice(0, 10)) {
    changed.push('last_verified_at');
  }
  return changed;
}

export async function runDenueImport(
  csvText: string,
  gateway: DenueImportGateway,
  options: DenueImportOptions = DENUE_IMPORT_DEFAULTS,
): Promise<DenueImportReport> {
  const rows = parseDenueCsv(csvText);

  const candidates: DenueImportCandidate[] = [];
  const rejections: DenueRejection[] = [];
  for (const parsed of rows) {
    const result = mapDenueRow(parsed, options.municipality);
    if ('candidate' in result) {
      candidates.push(result.candidate);
    } else {
      rejections.push(result.rejection);
    }
  }

  const report: DenueImportReport = {
    source: 'denue',
    dataset: options.dataset,
    sourceVersion: options.sourceVersion,
    municipality: options.municipality,
    read: rows.length,
    accepted: candidates.length,
    rejected: rejections.length,
    rejectedReasons: {},
    rejections,
    skippedDuplicates: 0,
    inserted: 0,
    updated: 0,
    unchanged: 0,
    errors: 0,
    byCategory: {},
  };
  for (const rejection of rejections) {
    report.rejectedReasons[rejection.reason] = (report.rejectedReasons[rejection.reason] ?? 0) + 1;
  }
  for (const candidate of candidates) {
    report.byCategory[candidate.category] = (report.byCategory[candidate.category] ?? 0) + 1;
  }

  await gateway.runInTransaction(async (tx) => {
    const items: DenueSyncItem[] = [];
    const seen = new Set<string>();

    for (const rejection of rejections) {
      items.push({
        externalId: rejection.denueId ?? '(sin id)',
        action: 'failed',
        detail: { reason: rejection.reason, row: rejection.row },
      });
    }

    for (const candidate of candidates) {
      if (seen.has(candidate.denueId)) {
        report.skippedDuplicates += 1;
        items.push({
          externalId: candidate.denueId,
          action: 'skipped',
          detail: { reason: 'duplicate_in_batch' },
        });
        continue;
      }
      seen.add(candidate.denueId);

      const write = toWrite(candidate, options);
      const snapshot = candidate.raw as unknown as Record<string, unknown>;
      const existing = await tx.findByDenueId(candidate.denueId);

      if (existing === null) {
        const placeId = await tx.insertPlace({
          write,
          denueId: candidate.denueId,
          clee: candidate.clee,
          sourceVersion: options.sourceVersion,
          snapshot,
        });
        report.inserted += 1;
        items.push({ externalId: candidate.denueId, action: 'created', placeId });
        continue;
      }

      const target = mergedWrite(existing, write);
      const changedFields = changedFieldsOf(existing, target);

      if (candidate.clee && !existing.hasCleeRef) {
        await tx.addCleeRef(existing.placeId, candidate.clee);
      }

      if (changedFields.length === 0) {
        report.unchanged += 1;
        items.push({
          externalId: candidate.denueId,
          action: 'skipped',
          placeId: existing.placeId,
          detail: { reason: 'unchanged' },
        });
        continue;
      }

      await tx.updatePlace({
        placeId: existing.placeId,
        write: target,
        denueId: candidate.denueId,
        changedFields,
        sourceVersion: options.sourceVersion,
        snapshot,
      });
      report.updated += 1;
      items.push({
        externalId: candidate.denueId,
        action: 'updated',
        placeId: existing.placeId,
        detail: { changedFields },
      });
    }

    const { rejections: _omitted, ...stats } = report;
    await tx.recordRun({ sourceVersion: options.sourceVersion, stats, items });
  });

  return report;
}
