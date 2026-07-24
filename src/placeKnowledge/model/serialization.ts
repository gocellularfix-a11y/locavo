/**
 * SERIALIZACIÓN determinista de fragmentos (GEN-1 · Fase A).
 *
 * El orden de claves es EXPLÍCITO y estable, nunca el orden de inserción del
 * objeto: los mismos datos producen siempre los mismos bytes, de modo que un
 * log de conocimiento se puede hashear, diferenciar y auditar.
 *
 * La deserialización es ESTRUCTURAL: comprueba que el JSON tenga la forma del
 * modelo y nada más. NO verifica que la cita exista en su documento, ni la
 * autoridad de la fuente, ni la política de revisión: eso es el validador de
 * la Fase B y aquí no se implementa.
 */
import type { AcquisitionMetadata } from './acquisition';
import type { Evidence, EvidenceBinding } from './evidence';
import type { EvidenceSpan } from './evidenceSpan';
import type { KnowledgeFieldKey } from './knowledgeField';
import type { KnowledgeFragment } from './knowledgeFragment';
import type { ReviewEntry, ReviewHistory } from './review';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function orderedSpan(span: EvidenceSpan): Record<string, unknown> {
  return {
    documentId: span.documentId,
    format: span.format,
    start: span.start,
    end: span.end,
    text: span.text,
  };
}

function orderedBinding(binding: EvidenceBinding): Record<string, unknown> {
  const ordered: Record<string, unknown> = {
    path: binding.path,
    span: orderedSpan(binding.span),
  };
  if (binding.level !== undefined) {
    ordered.level = binding.level;
  }
  return ordered;
}

function orderedEvidence(evidence: Evidence): Record<string, unknown> {
  const ordered: Record<string, unknown> = {
    level: evidence.level,
    method: evidence.method,
    capturedAt: evidence.capturedAt,
  };
  if (evidence.reference !== undefined) {
    ordered.reference = evidence.reference;
  }
  if (evidence.note !== undefined) {
    ordered.note = evidence.note;
  }
  if (evidence.span !== undefined) {
    ordered.span = orderedSpan(evidence.span);
  }
  if (evidence.bindings !== undefined) {
    // Orden por ruta: la salida no depende del orden de construcción.
    ordered.bindings = [...evidence.bindings]
      .sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0))
      .map(orderedBinding);
  }
  return ordered;
}

function orderedAcquisition(acquisition: AcquisitionMetadata): Record<string, unknown> {
  const ordered: Record<string, unknown> = {
    method: acquisition.method,
    toolId: acquisition.toolId,
    toolVersion: acquisition.toolVersion,
  };
  if (acquisition.parameters !== undefined) {
    // Parámetros ordenados por clave: dos corridas equivalentes producen los
    // mismos bytes aunque hayan construido el objeto en otro orden.
    const keys = Object.keys(acquisition.parameters).sort();
    const parameters: Record<string, unknown> = {};
    for (const key of keys) {
      parameters[key] = acquisition.parameters[key];
    }
    ordered.parameters = parameters;
  }
  ordered.acquiredAt = acquisition.acquiredAt;
  return ordered;
}

function orderedReview(entry: ReviewEntry): Record<string, unknown> {
  const ordered: Record<string, unknown> = {
    status: entry.status,
    reviewer: entry.reviewer,
    reviewedAt: entry.reviewedAt,
  };
  if (entry.reason !== undefined) {
    ordered.reason = entry.reason;
  }
  if (entry.notes !== undefined) {
    ordered.notes = entry.notes;
  }
  ordered.version = entry.version;
  return ordered;
}

/** Representación canónica ordenada (útil para hashear sin serializar dos veces). */
export function toCanonicalFragmentRecord(
  fragment: KnowledgeFragment,
): Record<string, unknown> {
  const ordered: Record<string, unknown> = {
    id: fragment.id,
    schemaVersion: fragment.schemaVersion,
    placeId: fragment.placeId,
    field: fragment.field,
    value: fragment.value,
    sourceId: fragment.sourceId,
    evidence: orderedEvidence(fragment.evidence),
    retrievedAt: fragment.retrievedAt,
    licenseTier: fragment.licenseTier,
  };
  if (fragment.supersedes !== undefined) {
    ordered.supersedes = fragment.supersedes;
  }
  ordered.acquisition = orderedAcquisition(fragment.acquisition);
  ordered.validatorVersion = fragment.validatorVersion;
  ordered.reviewHistory = fragment.reviewHistory.map(orderedReview);
  return ordered;
}

/** Serializa un fragmento con orden de claves estable. */
export function serializeKnowledgeFragment(fragment: KnowledgeFragment): string {
  return JSON.stringify(toCanonicalFragmentRecord(fragment));
}

/** Serializa un log completo conservando el orden recibido. */
export function serializeKnowledgeFragments(
  fragments: readonly KnowledgeFragment[],
): string {
  return JSON.stringify(fragments.map(toCanonicalFragmentRecord));
}

function parseSpan(raw: unknown): EvidenceSpan | null {
  if (!isRecord(raw)) {
    return null;
  }
  const { documentId, format, start, end, text } = raw;
  if (
    typeof documentId !== 'string' ||
    typeof format !== 'string' ||
    typeof start !== 'number' ||
    typeof end !== 'number' ||
    typeof text !== 'string'
  ) {
    return null;
  }
  return { documentId, format, start, end, text };
}

function parseBindings(raw: unknown): readonly EvidenceBinding[] | null {
  if (!Array.isArray(raw)) {
    return null;
  }
  const bindings: EvidenceBinding[] = [];
  for (const item of raw) {
    if (!isRecord(item) || typeof item.path !== 'string') {
      return null;
    }
    const span = parseSpan(item.span);
    if (span === null) {
      return null;
    }
    bindings.push({
      path: item.path,
      span,
      ...(typeof item.level === 'string' ? { level: item.level as Evidence['level'] } : {}),
    });
  }
  return bindings;
}

function parseEvidence(raw: unknown): Evidence | null {
  if (!isRecord(raw)) {
    return null;
  }
  const { level, method, capturedAt, reference, note, span, bindings } = raw;
  if (typeof level !== 'string' || typeof method !== 'string' || typeof capturedAt !== 'string') {
    return null;
  }
  let evidence: Evidence = {
    level: level as Evidence['level'],
    method,
    capturedAt,
    ...(typeof reference === 'string' ? { reference } : {}),
    ...(typeof note === 'string' ? { note } : {}),
  };
  if (span !== undefined) {
    const parsedSpan = parseSpan(span);
    if (parsedSpan === null) {
      return null;
    }
    evidence = { ...evidence, span: parsedSpan };
  }
  if (bindings !== undefined) {
    const parsedBindings = parseBindings(bindings);
    if (parsedBindings === null) {
      return null;
    }
    evidence = { ...evidence, bindings: parsedBindings };
  }
  return evidence;
}

function parseAcquisition(raw: unknown): AcquisitionMetadata | null {
  if (!isRecord(raw)) {
    return null;
  }
  const { method, toolId, toolVersion, parameters, acquiredAt } = raw;
  if (
    typeof method !== 'string' ||
    typeof toolId !== 'string' ||
    typeof toolVersion !== 'string' ||
    typeof acquiredAt !== 'string'
  ) {
    return null;
  }
  if (parameters === undefined) {
    return { method, toolId, toolVersion, acquiredAt };
  }
  if (!isRecord(parameters)) {
    return null;
  }
  for (const value of Object.values(parameters)) {
    if (typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'boolean') {
      return null;
    }
  }
  return {
    method,
    toolId,
    toolVersion,
    parameters: parameters as Readonly<Record<string, string | number | boolean>>,
    acquiredAt,
  };
}

function parseReviewHistory(raw: unknown): ReviewHistory | null {
  if (!Array.isArray(raw)) {
    return null;
  }
  const entries: ReviewEntry[] = [];
  for (const item of raw) {
    if (!isRecord(item)) {
      return null;
    }
    const { status, reviewer, reviewedAt, reason, notes, version } = item;
    if (
      (status !== 'pending' && status !== 'accepted' && status !== 'rejected') ||
      typeof reviewer !== 'string' ||
      typeof reviewedAt !== 'string' ||
      typeof version !== 'number'
    ) {
      return null;
    }
    entries.push({
      status,
      reviewer,
      reviewedAt,
      ...(typeof reason === 'string' ? { reason } : {}),
      ...(typeof notes === 'string' ? { notes } : {}),
      version,
    });
  }
  return entries;
}

/**
 * Deserialización ESTRUCTURAL. Devuelve `null` ante cualquier forma que no
 * corresponda al modelo, en vez de lanzar: un log dañado degrada el fragmento
 * afectado sin tumbar la lectura del resto.
 */
export function deserializeKnowledgeFragment(raw: unknown): KnowledgeFragment | null {
  const source = typeof raw === 'string' ? safeParseJson(raw) : raw;
  if (!isRecord(source)) {
    return null;
  }
  const {
    id,
    schemaVersion,
    placeId,
    field,
    value,
    sourceId,
    retrievedAt,
    licenseTier,
    supersedes,
    validatorVersion,
  } = source;

  if (
    typeof id !== 'string' ||
    typeof schemaVersion !== 'number' ||
    typeof placeId !== 'string' ||
    typeof field !== 'string' ||
    typeof sourceId !== 'string' ||
    typeof retrievedAt !== 'string' ||
    typeof licenseTier !== 'string' ||
    typeof validatorVersion !== 'string' ||
    value === undefined
  ) {
    return null;
  }

  const evidence = parseEvidence(source.evidence);
  const acquisition = parseAcquisition(source.acquisition);
  const reviewHistory = parseReviewHistory(source.reviewHistory);
  if (evidence === null || acquisition === null || reviewHistory === null) {
    return null;
  }

  return {
    id,
    schemaVersion,
    placeId,
    field: field as KnowledgeFieldKey,
    value: value as KnowledgeFragment['value'],
    sourceId,
    evidence,
    retrievedAt,
    licenseTier: licenseTier as KnowledgeFragment['licenseTier'],
    ...(typeof supersedes === 'string' ? { supersedes } : {}),
    acquisition,
    validatorVersion,
    reviewHistory,
  };
}

function safeParseJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
