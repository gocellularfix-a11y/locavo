/**
 * VALIDADOR DE FRAGMENTOS (GEN-1 · Fase B) — la puerta del grafo canónico.
 *
 * Puro, determinista y sin efectos: recibe el fragmento, el corpus de
 * evidencia y el registro de fuentes, y devuelve un veredicto con todos los
 * hallazgos. No lee disco, no lee red, no lee el reloj y no muta nada.
 *
 * Reutiliza el registro de fuentes, el modelo de licencias y el modelo de
 * confianza existentes. NO resuelve conflictos ni fusiona conocimiento: la
 * precedencia sigue siendo responsabilidad exclusiva del motor ya aprobado.
 */
import { isExcluded, type LicenseTier } from '../../data/pipeline/licenseTier';
import { deriveKnowledgeConfidence } from '../model/confidence';
import { EVIDENCE_LEVEL_RANK, type EvidenceLevel } from '../model/evidence';
import type { KnowledgeFieldKey } from '../model/knowledgeField';
import {
  knowledgeFragmentIdOf,
  type KnowledgeFragment,
} from '../model/knowledgeFragment';
import { currentReviewStatus, type ReviewHistory } from '../model/review';
import type { KnowledgeSourceRegistry } from '../model/source';
import { EMPTY_CORPUS, verifyEvidenceSpan, type DocumentCorpus } from './evidenceDocument';
import { isKnownKnowledgeField, validateFieldValue } from './fieldValueValidation';
import { isIsoDateOnly, isIsoInstant } from './temporal';
import {
  buildOutcome,
  SUPPORTED_SCHEMA_VERSIONS,
  VALIDATOR_VERSION,
  type ValidationIssue,
  type ValidationOutcome,
} from './validationModel';

const LICENSE_TIERS: readonly LicenseTier[] = [
  'permissive-base',
  'odbl-sidecar',
  'ccby-sidecar',
  'proprietary-excluded',
];

/**
 * Campos que NUNCA pueden inferirse (§24 del protocolo). Exigen cita literal y
 * prohíben el nivel de evidencia `inferred`. Si el catálogo crece con otro
 * atributo sensible, se agrega aquí.
 */
export const SPAN_REQUIRED_FIELDS: readonly KnowledgeFieldKey[] = [
  'hours',
  'hoursExceptions',
  'accessibility',
  'parking',
  'paymentMethods',
  'services',
];

export interface ValidationContext {
  /** Documentos contra los que se comprueban las citas. */
  readonly corpus?: DocumentCorpus;
  /** Fuentes registradas; una fuente no registrada invalida el fragmento. */
  readonly sources: KnowledgeSourceRegistry;
  readonly validatorVersion?: string;
  readonly supportedSchemaVersions?: readonly number[];
  /**
   * Si es true, un fragmento sin revisión aceptada se RECHAZA. Por defecto
   * `pending` solo genera aviso, para poder validar antes de revisar.
   */
  readonly requireAcceptedReview?: boolean;
  /**
   * MEMORIA DE CUARENTENA: ids ya rechazados en corridas anteriores. Sin ella
   * la misma propuesta defectuosa vuelve a proponerse y a revisarse en cada
   * corrida y la revisión nunca converge.
   */
  readonly previouslyRejected?: ReadonlySet<string>;
}

function validateReviewHistory(history: ReviewHistory, issues: ValidationIssue[]): void {
  if (!Array.isArray(history)) {
    issues.push({ code: 'REVIEW_ENTRY_INVALID', severity: 'error', path: 'reviewHistory' });
    return;
  }
  let previous = '';
  for (let i = 0; i < history.length; i++) {
    const entry = history[i];
    const path = `reviewHistory[${i}]`;
    if (
      (entry.status !== 'pending' && entry.status !== 'accepted' && entry.status !== 'rejected') ||
      typeof entry.reviewer !== 'string' ||
      entry.reviewer.trim().length === 0 ||
      !isIsoInstant(entry.reviewedAt) ||
      typeof entry.version !== 'number' ||
      !Number.isInteger(entry.version)
    ) {
      issues.push({ code: 'REVIEW_ENTRY_INVALID', severity: 'error', path });
      continue;
    }
    if (previous !== '' && entry.reviewedAt < previous) {
      issues.push({
        code: 'REVIEW_HISTORY_UNORDERED',
        severity: 'error',
        path,
        detail: { previous, current: entry.reviewedAt },
      });
    }
    previous = entry.reviewedAt;
  }
}

/**
 * Valida un fragmento completo. Devuelve TODOS los hallazgos, no solo el
 * primero: un informe parcial obligaría a revalidar en bucle.
 */
export function validateKnowledgeFragment(
  fragment: KnowledgeFragment,
  context: ValidationContext,
): ValidationOutcome {
  const issues: ValidationIssue[] = [];
  const corpus = context.corpus ?? EMPTY_CORPUS;
  const expectedValidator = context.validatorVersion ?? VALIDATOR_VERSION;
  const supported = context.supportedSchemaVersions ?? SUPPORTED_SCHEMA_VERSIONS;

  if (typeof fragment !== 'object' || fragment === null) {
    return buildOutcome('', [
      { code: 'FRAGMENT_MALFORMED', severity: 'error', path: '' },
    ], expectedValidator);
  }

  const fragmentId = typeof fragment.id === 'string' ? fragment.id : '';

  // ── Estructura e identidad ──────────────────────────────────────────
  if (fragmentId.length === 0) {
    issues.push({ code: 'FRAGMENT_MALFORMED', severity: 'error', path: 'id' });
  }
  if (typeof fragment.placeId !== 'string' || fragment.placeId.trim().length === 0) {
    issues.push({ code: 'PLACE_ID_EMPTY', severity: 'error', path: 'placeId' });
  }
  if (!supported.includes(fragment.schemaVersion)) {
    issues.push({
      code: 'SCHEMA_VERSION_UNSUPPORTED',
      severity: 'error',
      path: 'schemaVersion',
      detail: { found: fragment.schemaVersion, supported: supported.join(',') },
    });
  }
  if (!isIsoDateOnly(fragment.retrievedAt)) {
    issues.push({ code: 'RETRIEVED_AT_INVALID', severity: 'error', path: 'retrievedAt' });
  }

  // ── Campo canónico y valor ──────────────────────────────────────────
  const fieldKnown = typeof fragment.field === 'string' && isKnownKnowledgeField(fragment.field);
  if (!fieldKnown) {
    issues.push({
      code: 'FIELD_UNKNOWN',
      severity: 'error',
      path: 'field',
      detail: { field: String(fragment.field) },
    });
  } else {
    const valueCheck = validateFieldValue(fragment.field, fragment.value);
    if (!valueCheck.ok) {
      issues.push({
        code: 'VALUE_INVALID',
        severity: 'error',
        path: 'value',
        detail: { field: fragment.field, reason: valueCheck.reason },
      });
    }
  }

  // ── Evidencia ───────────────────────────────────────────────────────
  const evidence = fragment.evidence;
  const evidenceLevelValid =
    !!evidence &&
    typeof evidence.level === 'string' &&
    Object.prototype.hasOwnProperty.call(EVIDENCE_LEVEL_RANK, evidence.level);
  if (!evidence) {
    issues.push({ code: 'FRAGMENT_MALFORMED', severity: 'error', path: 'evidence' });
  } else {
    if (!evidenceLevelValid) {
      issues.push({
        code: 'EVIDENCE_LEVEL_INVALID',
        severity: 'error',
        path: 'evidence.level',
        detail: { level: String(evidence.level) },
      });
    }
    if (typeof evidence.method !== 'string' || evidence.method.trim().length === 0) {
      issues.push({ code: 'EVIDENCE_METHOD_EMPTY', severity: 'error', path: 'evidence.method' });
    }
    if (!isIsoInstant(evidence.capturedAt)) {
      issues.push({
        code: 'EVIDENCE_CAPTURED_AT_INVALID',
        severity: 'error',
        path: 'evidence.capturedAt',
      });
    }
  }

  // ── Span: la comprobación literal contra el documento ───────────────
  const restricted = fieldKnown && SPAN_REQUIRED_FIELDS.includes(fragment.field);
  const span = evidence?.span;
  if (span === undefined) {
    if (restricted) {
      issues.push({
        code: 'SPAN_REQUIRED',
        severity: 'error',
        path: 'evidence.span',
        detail: { field: String(fragment.field) },
      });
    }
  } else {
    const check = verifyEvidenceSpan(span, corpus);
    if (!check.ok) {
      const CODE_BY_REASON = {
        document_unknown: 'SPAN_DOCUMENT_UNKNOWN',
        format_mismatch: 'SPAN_FORMAT_MISMATCH',
        range_invalid: 'SPAN_RANGE_INVALID',
        out_of_bounds: 'SPAN_OUT_OF_BOUNDS',
        text_mismatch: 'SPAN_TEXT_MISMATCH',
      } as const;
      issues.push({
        code: CODE_BY_REASON[check.reason],
        severity: 'error',
        path: 'evidence.span',
        detail: { documentId: span.documentId },
      });
    }
  }

  // ── Política §24: lo restringido jamás se infiere ───────────────────
  if (restricted && evidenceLevelValid && (evidence.level as EvidenceLevel) === 'inferred') {
    issues.push({
      code: 'INFERENCE_NOT_ALLOWED',
      severity: 'error',
      path: 'evidence.level',
      detail: { field: String(fragment.field) },
    });
  }

  // ── Procedencia y licencia ──────────────────────────────────────────
  const source =
    typeof fragment.sourceId === 'string' ? context.sources.get(fragment.sourceId) : undefined;
  if (!source) {
    issues.push({
      code: 'SOURCE_UNKNOWN',
      severity: 'error',
      path: 'sourceId',
      detail: { sourceId: String(fragment.sourceId) },
    });
  }
  if (!LICENSE_TIERS.includes(fragment.licenseTier)) {
    issues.push({
      code: 'LICENSE_TIER_INVALID',
      severity: 'error',
      path: 'licenseTier',
      detail: { tier: String(fragment.licenseTier) },
    });
  } else if (fragment.licenseTier === 'proprietary-excluded') {
    issues.push({ code: 'LICENSE_EXCLUDED', severity: 'error', path: 'licenseTier' });
  } else if (source && source.license.tier !== fragment.licenseTier) {
    issues.push({
      code: 'LICENSE_TIER_MISMATCH',
      severity: 'error',
      path: 'licenseTier',
      detail: { fragment: fragment.licenseTier, source: source.license.tier },
    });
  }
  if (source && isExcluded(source.license)) {
    issues.push({ code: 'LICENSE_EXCLUDED', severity: 'error', path: 'sourceId' });
  }

  // ── Adquisición ─────────────────────────────────────────────────────
  const acquisition = fragment.acquisition;
  if (
    !acquisition ||
    typeof acquisition.method !== 'string' ||
    acquisition.method.trim().length === 0 ||
    typeof acquisition.toolId !== 'string' ||
    acquisition.toolId.trim().length === 0 ||
    typeof acquisition.toolVersion !== 'string' ||
    acquisition.toolVersion.trim().length === 0
  ) {
    issues.push({ code: 'ACQUISITION_INCOMPLETE', severity: 'error', path: 'acquisition' });
  }
  if (acquisition && !isIsoInstant(acquisition.acquiredAt)) {
    issues.push({
      code: 'ACQUISITION_ACQUIRED_AT_INVALID',
      severity: 'error',
      path: 'acquisition.acquiredAt',
    });
  }

  // ── Versión de validador ────────────────────────────────────────────
  if (fragment.validatorVersion !== expectedValidator) {
    issues.push({
      code: 'VALIDATOR_VERSION_MISMATCH',
      severity: 'error',
      path: 'validatorVersion',
      detail: { found: String(fragment.validatorVersion), expected: expectedValidator },
    });
  }

  // ── Revisión ────────────────────────────────────────────────────────
  validateReviewHistory(fragment.reviewHistory, issues);
  if (Array.isArray(fragment.reviewHistory)) {
    const status = currentReviewStatus(fragment.reviewHistory);
    if (status === 'rejected') {
      issues.push({ code: 'REVIEW_REJECTED', severity: 'error', path: 'reviewHistory' });
    } else if (status === 'pending') {
      issues.push({
        code: 'REVIEW_PENDING',
        severity: context.requireAcceptedReview ? 'error' : 'warning',
        path: 'reviewHistory',
      });
    }
  }

  // ── Confianza derivable ─────────────────────────────────────────────
  if (source && evidenceLevelValid) {
    const confidence = deriveKnowledgeConfidence({
      verificationLevel: source.verificationLevel,
      evidenceLevel: evidence.level as EvidenceLevel,
    });
    if (!Number.isFinite(confidence.score) || confidence.score < 0 || confidence.score > 1) {
      issues.push({ code: 'CONFIDENCE_NOT_DERIVABLE', severity: 'error', path: 'evidence.level' });
    }
  } else {
    issues.push({
      code: 'CONFIDENCE_NOT_DERIVABLE',
      severity: 'error',
      path: 'evidence.level',
      detail: { reason: source ? 'evidence_level_invalid' : 'source_unknown' },
    });
  }

  // ── Memoria de cuarentena ───────────────────────────────────────────
  if (fragmentId.length > 0 && context.previouslyRejected?.has(fragmentId)) {
    issues.push({
      code: 'PREVIOUSLY_QUARANTINED',
      severity: 'error',
      path: 'id',
      detail: { fragmentId },
    });
  }

  // ── Id determinista ─────────────────────────────────────────────────
  if (
    fieldKnown &&
    typeof fragment.placeId === 'string' &&
    typeof fragment.sourceId === 'string' &&
    evidence &&
    typeof evidence.capturedAt === 'string'
  ) {
    const expectedId = knowledgeFragmentIdOf(
      fragment.placeId,
      fragment.field,
      fragment.sourceId,
      evidence.capturedAt,
    );
    if (fragmentId !== expectedId) {
      issues.push({
        code: 'FRAGMENT_ID_MISMATCH',
        severity: 'error',
        path: 'id',
        detail: { expected: expectedId },
      });
    }
  }

  return buildOutcome(fragmentId, issues, expectedValidator);
}
