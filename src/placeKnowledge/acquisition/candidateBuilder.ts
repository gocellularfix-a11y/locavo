/**
 * CONSTRUCCIÓN DE CANDIDATOS (GEN-1 · Fase C).
 *
 * Convierte afirmaciones de un proveedor en fragmentos CANDIDATOS con
 * procedencia, cita y metadatos de adquisición completos. No decide si son
 * verdad: eso lo hace la validación de la Fase B.
 *
 * Resolución de la cita —el punto donde se contiene la fabricación—: se
 * prefieren los desplazamientos propuestos por el proveedor solo si verifican
 * literalmente; si no, la cita se LOCALIZA en el documento. Si el texto citado
 * no aparece, el candidato se construye igualmente con la cita tal cual y la
 * validación lo rechazará. Adquisición nunca descarta en silencio.
 */
import {
  ACQUISITION_COMPUTER_VISION,
  ACQUISITION_EXTERNAL_API,
  ACQUISITION_LANGUAGE_MODEL,
  ACQUISITION_MANUAL_ENTRY,
  ACQUISITION_OCR,
  ACQUISITION_RULE_ENGINE,
  type AcquisitionMetadata,
} from '../model/acquisition';
import { atomicPathsOf } from '../model/atomicPath';
import type { EvidenceLevel } from '../model/evidence';
import type { EvidenceSpan } from '../model/evidenceSpan';
import type { KnowledgeFieldKey } from '../model/knowledgeField';
import {
  KNOWLEDGE_SCHEMA_VERSION,
  knowledgeFragmentIdOf,
  type KnowledgeFragment,
} from '../model/knowledgeFragment';
import type { LicenseTier } from '../../data/pipeline/licenseTier';
import type { EvidenceDocument } from '../validation/evidenceDocument';
import { VALIDATOR_VERSION } from '../validation/validationModel';
import type { RegisteredPrompt } from './promptRegistry';
import type { ExtractionProvider, ProviderClaim, ProviderKind } from './providerModel';

/** Campos cuyo valor es una lista y por tanto se acumulan en un solo hecho. */
const LIST_FIELDS: readonly KnowledgeFieldKey[] = [
  'phones',
  'services',
  'paymentMethods',
  'extraCategories',
  'languages',
  'products',
  'hoursExceptions',
];

const METHOD_BY_KIND: Readonly<Record<ProviderKind, string>> = {
  rule_based: ACQUISITION_RULE_ENGINE,
  language_model: ACQUISITION_LANGUAGE_MODEL,
  ocr: ACQUISITION_OCR,
  computer_vision: ACQUISITION_COMPUTER_VISION,
  manual: ACQUISITION_MANUAL_ENTRY,
  external_api: ACQUISITION_EXTERNAL_API,
};

export interface CandidateBuildContext {
  readonly placeId: string;
  readonly document: EvidenceDocument;
  readonly provider: ExtractionProvider;
  readonly prompt?: RegisteredPrompt;
  readonly sourceId: string;
  readonly licenseTier: LicenseTier;
  readonly evidenceLevel: EvidenceLevel;
  /** Fecha del hecho según la fuente (dato, nunca reloj). */
  readonly capturedAt: string;
  /** Fecha de la corrida de adquisición (dato de proceso). */
  readonly retrievedAt: string;
}

export interface CandidateDiagnostic {
  readonly field: string;
  readonly code:
    | 'QUOTE_NOT_FOUND'
    | 'PROVIDER_OFFSETS_REJECTED'
    | 'DUPLICATE_SCALAR_CLAIM'
    | 'EMPTY_QUOTE';
  readonly quote: string;
}

export interface CandidateBuildResult {
  readonly candidates: readonly KnowledgeFragment[];
  readonly diagnostics: readonly CandidateDiagnostic[];
}

/** Localiza la cita en el documento y devuelve el span verificado, o null. */
function resolveSpan(
  document: EvidenceDocument,
  claim: ProviderClaim,
  diagnostics: CandidateDiagnostic[],
): EvidenceSpan | null {
  const quote = claim.quote;
  if (typeof quote !== 'string' || quote.length === 0) {
    diagnostics.push({ field: String(claim.field), code: 'EMPTY_QUOTE', quote: '' });
    return null;
  }

  // 1) Desplazamientos propuestos, SOLO si verifican literalmente.
  if (
    typeof claim.start === 'number' &&
    typeof claim.end === 'number' &&
    document.text.slice(claim.start, claim.end) === quote
  ) {
    return {
      documentId: document.id,
      format: document.format,
      start: claim.start,
      end: claim.end,
      text: quote,
    };
  }
  if (claim.start !== undefined || claim.end !== undefined) {
    diagnostics.push({ field: String(claim.field), code: 'PROVIDER_OFFSETS_REJECTED', quote });
  }

  // 2) Localización determinista: primera aparición literal.
  const index = document.text.indexOf(quote);
  if (index < 0) {
    diagnostics.push({ field: String(claim.field), code: 'QUOTE_NOT_FOUND', quote });
    return null;
  }
  return {
    documentId: document.id,
    format: document.format,
    start: index,
    end: index + quote.length,
    text: quote,
  };
}

/** Campos objeto cuyos subcampos se acumulan entre afirmaciones. */
const OBJECT_MERGE_FIELDS: readonly KnowledgeFieldKey[] = [
  'accessibility',
  'parking',
  'socialMedia',
];

function mergeObjectValue(previous: unknown, incoming: unknown): unknown {
  const left = typeof previous === 'object' && previous !== null ? previous : {};
  const right = typeof incoming === 'object' && incoming !== null ? incoming : {};
  return { ...left, ...right };
}

function mergeListValue(previous: unknown, incoming: unknown): unknown {
  const left = Array.isArray(previous) ? previous : [];
  const right = Array.isArray(incoming) ? incoming : [incoming];
  const merged = new Set<unknown>([...left, ...right]);
  return [...merged].sort((a, b) => (String(a) < String(b) ? -1 : String(a) > String(b) ? 1 : 0));
}

/**
 * Construye los candidatos de una extracción. Agrupa por campo: las listas se
 * acumulan y los escalares conservan la PRIMERA afirmación en orden de
 * documento, registrando el resto como diagnóstico.
 */
export function buildCandidates(
  claims: readonly ProviderClaim[],
  context: CandidateBuildContext,
): CandidateBuildResult {
  const diagnostics: CandidateDiagnostic[] = [];
  const byField = new Map<
    KnowledgeFieldKey,
    {
      value: unknown;
      span: EvidenceSpan | null;
      anchor: number;
      /** Cita por átomo: cada valor afirmable conserva la SUYA. */
      bindings: Map<string, EvidenceSpan>;
    }
  >();

  for (const claim of claims) {
    const span = resolveSpan(context.document, claim, diagnostics);
    const anchor = span?.start ?? Number.MAX_SAFE_INTEGER;
    const existing = byField.get(claim.field);
    const isList = LIST_FIELDS.includes(claim.field);
    const isObject = OBJECT_MERGE_FIELDS.includes(claim.field);

    const nextValue = !existing
      ? isList
        ? mergeListValue([], claim.value)
        : claim.value
      : isList
        ? mergeListValue(existing.value, claim.value)
        : isObject
          ? mergeObjectValue(existing.value, claim.value)
          : anchor < existing.anchor
            ? claim.value
            : existing.value;

    if (existing && !isList && !isObject) {
      diagnostics.push({
        field: String(claim.field),
        code: 'DUPLICATE_SCALAR_CLAIM',
        quote: claim.quote,
      });
    }

    const bindings = existing?.bindings ?? new Map<string, EvidenceSpan>();
    if (span) {
      // Las rutas se derivan de la forma que el campo tendrá realmente: en una
      // lista, la afirmación llega como átomo suelto ('wifi') pero el hecho
      // guarda ['wifi'], y ambas deben producir la misma ruta.
      const shaped = isList ? mergeListValue([], claim.value) : claim.value;
      // Cada átomo que ESTA afirmación introduce queda ligado a SU cita; nunca
      // hereda la de otro valor.
      for (const path of atomicPathsOf(claim.field, shaped)) {
        if (!bindings.has(path)) {
          bindings.set(path, span);
        }
      }
    }

    byField.set(claim.field, {
      value: nextValue,
      span: !existing || anchor < existing.anchor ? (span ?? existing?.span ?? null) : existing.span,
      anchor: Math.min(anchor, existing?.anchor ?? Number.MAX_SAFE_INTEGER),
      bindings,
    });
  }

  const acquisition: AcquisitionMetadata = {
    method: METHOD_BY_KIND[context.provider.kind],
    toolId: context.provider.id,
    toolVersion: context.provider.version,
    ...(context.prompt
      ? {
          parameters: {
            promptId: context.prompt.id,
            promptVersion: context.prompt.version,
            promptFingerprint: context.prompt.fingerprint,
          },
        }
      : {}),
    acquiredAt: context.retrievedAt,
  };

  const candidates: KnowledgeFragment[] = [];
  for (const [field, entry] of byField) {
    candidates.push({
      id: knowledgeFragmentIdOf(context.placeId, field, context.sourceId, context.capturedAt),
      schemaVersion: KNOWLEDGE_SCHEMA_VERSION,
      placeId: context.placeId,
      field,
      value: entry.value as KnowledgeFragment['value'],
      sourceId: context.sourceId,
      evidence: {
        level: context.evidenceLevel,
        method: `${context.provider.kind}:${context.provider.id}`,
        capturedAt: context.capturedAt,
        reference: context.document.id,
        ...(entry.span ? { span: entry.span } : {}),
        ...(entry.bindings.size > 0
          ? {
              bindings: [...entry.bindings.entries()]
                .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
                .map(([path, span]) => ({ path, span })),
            }
          : {}),
      },
      retrievedAt: context.retrievedAt,
      licenseTier: context.licenseTier,
      acquisition,
      validatorVersion: VALIDATOR_VERSION,
      reviewHistory: [],
    });
  }

  candidates.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  diagnostics.sort((a, b) =>
    a.field !== b.field
      ? a.field < b.field
        ? -1
        : 1
      : a.code < b.code
        ? -1
        : a.code > b.code
          ? 1
          : 0,
  );
  return { candidates, diagnostics };
}
