/**
 * SESIÓN DE ADQUISICIÓN (GEN-1 · Fase C) — el pipeline completo.
 *
 *   evidencia cruda → ingesta → proveedor → candidatos → VALIDACIÓN (Fase B)
 *                                                   → admitidos + cuarentena
 *
 * La adquisición NUNCA escribe conocimiento canónico: entrega candidatos ya
 * validados y artefactos deterministas. Un documento problemático, un
 * proveedor caído o una respuesta corrupta degradan ese elemento y jamás
 * interrumpen el lote.
 *
 * Puro respecto del entorno: sin red, sin disco y sin reloj. Las fechas son
 * datos de entrada y el transporte se inyecta.
 */
import type { LicenseTier } from '../../data/pipeline/licenseTier';
import type { EvidenceLevel } from '../model/evidence';
import type { KnowledgeFieldKey } from '../model/knowledgeField';
import type { KnowledgeFragment } from '../model/knowledgeFragment';
import type { KnowledgeSourceRegistry } from '../model/source';
import { buildDocumentCorpus, type DocumentCorpus, type EvidenceDocument } from '../validation/evidenceDocument';
import type { QuarantineEntry } from '../validation/quarantine';
import type { ValidationOutcome } from '../validation/validationModel';
import { runKnowledgeValidation, type ValidationReport } from '../validation/validationRun';
import { buildCandidates, type CandidateDiagnostic } from './candidateBuilder';
import {
  ingestDocument,
  type IngestionOptions,
  type RawDocument,
} from './documentIngestion';
import { selectProvider, type ProviderRegistry, type ProviderSelection } from './providerRegistry';
import {
  resolveSourceBindings,
  type AcquisitionManifest,
  type BindingIssue,
} from './sourceBinding';
import { selectPrompt, type PromptRegistry } from './promptRegistry';
import type { ExtractionProvider } from './providerModel';
import { withRetry, type RetryPolicy } from './retryPolicy';

export interface AcquisitionTarget {
  readonly placeId: string;
  readonly document: RawDocument;
  /** Fuente registrada a la que se atribuirá el conocimiento. */
  readonly sourceId: string;
  readonly licenseTier: LicenseTier;
  readonly evidenceLevel: EvidenceLevel;
  /** Fecha del hecho según la fuente. */
  readonly capturedAt: string;
}

export interface AcquisitionRunInput {
  readonly targets: readonly AcquisitionTarget[];
  readonly fields: readonly KnowledgeFieldKey[];
  readonly providers: ProviderRegistry;
  readonly sources: KnowledgeSourceRegistry;
  /** Fecha de la corrida (dato de proceso, nunca reloj). */
  readonly retrievedAt: string;
  readonly prompts?: PromptRegistry;
  readonly selection?: ProviderSelection;
  readonly retry?: RetryPolicy;
  readonly ingestion?: IngestionOptions;
  readonly previouslyRejected?: ReadonlySet<string>;
  readonly requireAcceptedReview?: boolean;
  /**
   * Manifiesto de atribución. Cuando se aporta, TODO documento necesita una
   * ligadura válida y la ligadura MANDA sobre lo declarado en el objetivo:
   * la fuente, la licencia y el nivel de evidencia salen de ella. Sin
   * manifiesto se conserva el comportamiento de la Fase C.
   */
  readonly manifest?: AcquisitionManifest;
}

export type AcquisitionFailureCode =
  | 'DOCUMENT_REJECTED'
  | 'NO_PROVIDER_AVAILABLE'
  | 'PROVIDER_FAILED'
  /** El documento no tiene una ligadura de fuente que autorice su uso. */
  | 'BINDING_REJECTED';

export interface AcquisitionFailure {
  readonly placeId: string;
  readonly documentId: string;
  readonly code: AcquisitionFailureCode;
  readonly detail: string;
}

export interface AcquisitionReport {
  readonly retrievedAt: string;
  readonly totals: {
    readonly targets: number;
    readonly documentsIngested: number;
    readonly candidatesBuilt: number;
    readonly accepted: number;
    readonly quarantined: number;
    readonly failures: number;
  };
  /** Candidatos construidos por proveedor, en orden de id. */
  readonly byProvider: readonly { readonly providerId: string; readonly candidates: number }[];
  readonly diagnostics: readonly CandidateDiagnostic[];
  readonly failures: readonly AcquisitionFailure[];
  /** Hallazgos de atribución; vacío cuando no se aportó manifiesto. */
  readonly bindingIssues: readonly BindingIssue[];
}

export interface AcquisitionRunResult {
  readonly accepted: readonly KnowledgeFragment[];
  readonly quarantine: readonly QuarantineEntry[];
  readonly outcomes: readonly ValidationOutcome[];
  readonly validationReport: ValidationReport;
  readonly acquisitionReport: AcquisitionReport;
  /** Corpus efectivamente ingerido (documentos contra los que se validó). */
  readonly corpus: DocumentCorpus;
}

/** Divide un lote en tandas deterministas conservando el orden. */
export function batchTargets(
  targets: readonly AcquisitionTarget[],
  size: number,
): readonly (readonly AcquisitionTarget[])[] {
  const chunkSize = Math.max(1, Math.floor(size));
  const batches: AcquisitionTarget[][] = [];
  for (let i = 0; i < targets.length; i += chunkSize) {
    batches.push(targets.slice(i, i + chunkSize));
  }
  return batches;
}

/**
 * Ejecuta la adquisición completa de un lote y valida los candidatos con la
 * plataforma de la Fase B.
 */
export async function runAcquisition(
  input: AcquisitionRunInput,
): Promise<AcquisitionRunResult> {
  const documents: EvidenceDocument[] = [];
  const candidates: KnowledgeFragment[] = [];
  const diagnostics: CandidateDiagnostic[] = [];
  const failures: AcquisitionFailure[] = [];
  const perProvider = new Map<string, number>();

  // ── Paso 1: ingesta ─────────────────────────────────────────────────
  const ingestedTargets: { target: AcquisitionTarget; document: EvidenceDocument }[] = [];
  for (const target of input.targets) {
    const ingested = ingestDocument(target.document, input.ingestion);
    if (!ingested.ok) {
      failures.push({
        placeId: target.placeId,
        documentId: String(target.document?.id ?? ''),
        code: 'DOCUMENT_REJECTED',
        detail: ingested.reason,
      });
      continue;
    }
    documents.push(ingested.document);
    ingestedTargets.push({ target, document: ingested.document });
  }

  // ── Paso 2: atribución auditable ────────────────────────────────────
  // Con manifiesto, ningún documento sin ligadura válida autoriza conocimiento.
  const binding = input.manifest
    ? resolveSourceBindings(input.manifest, documents, input.sources)
    : null;
  const bindingIssues = binding?.issues ?? [];

  // ── Paso 3: extracción por objetivo autorizado ──────────────────────
  for (const { target, document } of ingestedTargets) {
    const authorized = binding?.authorized.get(document.id);
    if (binding && !authorized) {
      failures.push({
        placeId: target.placeId,
        documentId: document.id,
        code: 'BINDING_REJECTED',
        detail: 'sin ligadura de fuente válida',
      });
      continue;
    }
    // La ligadura manda sobre lo declarado en el objetivo.
    const sourceId = authorized?.sourceId ?? target.sourceId;
    const licenseTier = authorized?.licenseTier ?? target.licenseTier;
    const evidenceLevel = authorized?.declaredEvidenceLevel ?? target.evidenceLevel;

    const request = { placeId: target.placeId, document, fields: input.fields };
    const provider: ExtractionProvider | null = selectProvider(
      input.providers,
      request,
      input.selection,
    );
    if (!provider) {
      failures.push({
        placeId: target.placeId,
        documentId: document.id,
        code: 'NO_PROVIDER_AVAILABLE',
        detail: `sin proveedor apto para ${document.format}`,
      });
      continue;
    }

    const extraction = await withRetry(() => provider.extract(request), input.retry);
    if (!extraction.ok || !extraction.value) {
      failures.push({
        placeId: target.placeId,
        documentId: document.id,
        code: 'PROVIDER_FAILED',
        detail: `${provider.id} falló tras ${extraction.attempts} intento(s)`,
      });
      continue;
    }

    const prompt = input.prompts
      ? (selectPrompt(input.prompts, provider.kind, input.fields) ?? undefined)
      : undefined;

    const built = buildCandidates(extraction.value.claims, {
      placeId: target.placeId,
      document,
      provider,
      prompt,
      sourceId,
      licenseTier,
      evidenceLevel,
      capturedAt: target.capturedAt,
      retrievedAt: input.retrievedAt,
    });

    candidates.push(...built.candidates);
    diagnostics.push(...built.diagnostics);
    perProvider.set(provider.id, (perProvider.get(provider.id) ?? 0) + built.candidates.length);
  }

  // El corpus de validación es exactamente lo ingerido: una cita solo puede
  // verificarse contra el documento que realmente entró.
  const corpus = buildDocumentCorpus(documents);

  const validation = runKnowledgeValidation(candidates, {
    corpus,
    sources: input.sources,
    previouslyRejected: input.previouslyRejected,
    requireAcceptedReview: input.requireAcceptedReview,
  });

  failures.sort((a, b) =>
    a.documentId !== b.documentId
      ? a.documentId < b.documentId
        ? -1
        : 1
      : a.code < b.code
        ? -1
        : a.code > b.code
          ? 1
          : 0,
  );

  return {
    accepted: validation.accepted,
    quarantine: validation.quarantine,
    outcomes: validation.outcomes,
    validationReport: validation.report,
    corpus,
    acquisitionReport: {
      retrievedAt: input.retrievedAt,
      totals: {
        targets: input.targets.length,
        documentsIngested: documents.length,
        candidatesBuilt: candidates.length,
        accepted: validation.accepted.length,
        quarantined: validation.quarantine.length,
        failures: failures.length,
      },
      byProvider: [...perProvider.entries()]
        .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
        .map(([providerId, count]) => ({ providerId, candidates: count })),
      diagnostics,
      failures,
      bindingIssues,
    },
  };
}

/** Serializa el informe de adquisición con orden de claves estable. */
export function serializeAcquisitionReport(report: AcquisitionReport): string {
  return JSON.stringify({
    retrievedAt: report.retrievedAt,
    totals: {
      targets: report.totals.targets,
      documentsIngested: report.totals.documentsIngested,
      candidatesBuilt: report.totals.candidatesBuilt,
      accepted: report.totals.accepted,
      quarantined: report.totals.quarantined,
      failures: report.totals.failures,
    },
    byProvider: report.byProvider.map((entry) => ({
      providerId: entry.providerId,
      candidates: entry.candidates,
    })),
    diagnostics: report.diagnostics.map((entry) => ({
      field: entry.field,
      code: entry.code,
      quote: entry.quote,
    })),
    failures: report.failures.map((entry) => ({
      placeId: entry.placeId,
      documentId: entry.documentId,
      code: entry.code,
      detail: entry.detail,
    })),
    bindingIssues: report.bindingIssues.map((entry) => ({
      code: entry.code,
      severity: entry.severity,
      documentId: entry.documentId,
      ...(entry.detail !== undefined
        ? {
            detail: Object.keys(entry.detail)
              .sort()
              .reduce<Record<string, unknown>>((acc, key) => {
                acc[key] = entry.detail![key];
                return acc;
              }, {}),
          }
        : {}),
    })),
  });
}
