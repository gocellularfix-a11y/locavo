/**
 * MODELO DE VALIDACIÓN (GEN-1 · Fase B) — errores, severidad y resultados.
 *
 * La plataforma de validación es la PUERTA de seguridad del grafo canónico:
 * nada entra sin pasar por ella. Es pura, sin efectos secundarios, sin reloj y
 * sin red; las mismas entradas producen siempre exactamente el mismo informe.
 *
 * Los códigos son cerrados y estables: un informe puede compararse entre
 * corridas y entre versiones sin interpretar prosa.
 */

/** Versión del validador. Viaja en cada fragmento admitido. */
export const VALIDATOR_VERSION = 'pke-validator-1';

/** Versiones del esquema de conocimiento que este validador admite. */
export const SUPPORTED_SCHEMA_VERSIONS: readonly number[] = [2];

export type ValidationSeverity = 'error' | 'warning';

/**
 * Códigos de fallo. `error` rechaza el fragmento; `warning` lo admite pero
 * queda registrado en el informe.
 */
export type ValidationErrorCode =
  // Estructura e identidad
  | 'FRAGMENT_MALFORMED'
  | 'PLACE_ID_EMPTY'
  | 'FRAGMENT_ID_MISMATCH'
  | 'SCHEMA_VERSION_UNSUPPORTED'
  | 'RETRIEVED_AT_INVALID'
  // Campo canónico y valor
  | 'FIELD_UNKNOWN'
  | 'VALUE_INVALID'
  // Evidencia
  | 'EVIDENCE_LEVEL_INVALID'
  | 'EVIDENCE_METHOD_EMPTY'
  | 'EVIDENCE_CAPTURED_AT_INVALID'
  // Span
  | 'SPAN_REQUIRED'
  | 'SPAN_DOCUMENT_UNKNOWN'
  | 'SPAN_FORMAT_MISMATCH'
  | 'SPAN_RANGE_INVALID'
  | 'SPAN_OUT_OF_BOUNDS'
  | 'SPAN_TEXT_MISMATCH'
  // Procedencia y licencia
  | 'SOURCE_UNKNOWN'
  | 'LICENSE_TIER_INVALID'
  | 'LICENSE_EXCLUDED'
  | 'LICENSE_TIER_MISMATCH'
  // Adquisición
  | 'ACQUISITION_INCOMPLETE'
  | 'ACQUISITION_ACQUIRED_AT_INVALID'
  // Validador
  | 'VALIDATOR_VERSION_MISMATCH'
  // Revisión
  | 'REVIEW_ENTRY_INVALID'
  | 'REVIEW_HISTORY_UNORDERED'
  | 'REVIEW_REJECTED'
  | 'REVIEW_PENDING'
  // Confianza y política
  | 'CONFIDENCE_NOT_DERIVABLE'
  | 'INFERENCE_NOT_ALLOWED'
  /** Ya fue rechazado antes: la memoria de cuarentena evita re-revisarlo. */
  | 'PREVIOUSLY_QUARANTINED';

/**
 * Orden canónico de emisión. Un informe se ordena por este índice y luego por
 * campo, de modo que dos corridas idénticas produzcan la misma secuencia.
 */
export const VALIDATION_CODE_ORDER: readonly ValidationErrorCode[] = [
  'FRAGMENT_MALFORMED',
  'PLACE_ID_EMPTY',
  'FRAGMENT_ID_MISMATCH',
  'SCHEMA_VERSION_UNSUPPORTED',
  'RETRIEVED_AT_INVALID',
  'FIELD_UNKNOWN',
  'VALUE_INVALID',
  'EVIDENCE_LEVEL_INVALID',
  'EVIDENCE_METHOD_EMPTY',
  'EVIDENCE_CAPTURED_AT_INVALID',
  'SPAN_REQUIRED',
  'SPAN_DOCUMENT_UNKNOWN',
  'SPAN_FORMAT_MISMATCH',
  'SPAN_RANGE_INVALID',
  'SPAN_OUT_OF_BOUNDS',
  'SPAN_TEXT_MISMATCH',
  'SOURCE_UNKNOWN',
  'LICENSE_TIER_INVALID',
  'LICENSE_EXCLUDED',
  'LICENSE_TIER_MISMATCH',
  'ACQUISITION_INCOMPLETE',
  'ACQUISITION_ACQUIRED_AT_INVALID',
  'VALIDATOR_VERSION_MISMATCH',
  'REVIEW_ENTRY_INVALID',
  'REVIEW_HISTORY_UNORDERED',
  'REVIEW_REJECTED',
  'REVIEW_PENDING',
  'CONFIDENCE_NOT_DERIVABLE',
  'INFERENCE_NOT_ALLOWED',
  'PREVIOUSLY_QUARANTINED',
];

const CODE_INDEX: ReadonlyMap<ValidationErrorCode, number> = new Map(
  VALIDATION_CODE_ORDER.map((code, index) => [code, index]),
);

export interface ValidationIssue {
  readonly code: ValidationErrorCode;
  readonly severity: ValidationSeverity;
  /** Ruta del dato señalado (p. ej. 'evidence.span.text'); estructurada, no prosa. */
  readonly path: string;
  /** Detalle estructurado y determinista; nunca texto libre generado. */
  readonly detail?: Readonly<Record<string, string | number | boolean>>;
}

/** Comparador total y determinista de hallazgos. */
export function compareValidationIssues(a: ValidationIssue, b: ValidationIssue): number {
  const byCode = (CODE_INDEX.get(a.code) ?? 0) - (CODE_INDEX.get(b.code) ?? 0);
  if (byCode !== 0) {
    return byCode;
  }
  if (a.path !== b.path) {
    return a.path < b.path ? -1 : 1;
  }
  return 0;
}

export type ValidationVerdict = 'accepted' | 'rejected';

export interface ValidationOutcome {
  readonly verdict: ValidationVerdict;
  /** Id del fragmento evaluado (aunque haya sido rechazado). */
  readonly fragmentId: string;
  /** Hallazgos en orden canónico; puede haber avisos aun estando aceptado. */
  readonly issues: readonly ValidationIssue[];
  readonly validatorVersion: string;
}

export function hasBlockingError(issues: readonly ValidationIssue[]): boolean {
  return issues.some((issue) => issue.severity === 'error');
}

/** Construye un resultado ordenando los hallazgos de forma canónica. */
export function buildOutcome(
  fragmentId: string,
  issues: readonly ValidationIssue[],
  validatorVersion: string = VALIDATOR_VERSION,
): ValidationOutcome {
  const ordered = [...issues].sort(compareValidationIssues);
  return {
    verdict: hasBlockingError(ordered) ? 'rejected' : 'accepted',
    fragmentId,
    issues: ordered,
    validatorVersion,
  };
}
