/**
 * SESIÓN DE ENRIQUECIMIENTO (GEN-1 · Fase D) — el pipeline completo.
 *
 *   hechos validados → proveedor (regla o motor) → propuestas
 *                    → confianza propagada → fragmentos candidatos
 *                    → VALIDACIÓN (Fase B) → admitidos + cuarentena
 *
 * Ninguna propuesta entra al conocimiento canónico por sí sola, y ninguna se
 * salta la validación. Un objetivo defectuoso o un proveedor caído degradan
 * solo ese elemento: el lote continúa.
 *
 * Sin red, sin disco y sin reloj: la fecha de evaluación se inyecta.
 */
import type { KnowledgeFragment } from '../model/knowledgeFragment';
import { KNOWLEDGE_SCHEMA_VERSION, knowledgeFragmentIdOf } from '../model/knowledgeFragment';
import type { KnowledgeSourceRegistry } from '../model/source';
import { ACQUISITION_RULE_ENGINE, ACQUISITION_LANGUAGE_MODEL } from '../model/acquisition';
import type { DocumentCorpus } from '../validation/evidenceDocument';
import type { QuarantineEntry } from '../validation/quarantine';
import type { ValidationOutcome } from '../validation/validationModel';
import { VALIDATOR_VERSION } from '../validation/validationModel';
import { runKnowledgeValidation, type ValidationReport } from '../validation/validationRun';
import { detectContradictions, detectDuplicateFragments } from './contradictions';
import { propagateConfidence, type EvidenceWitness } from './confidencePropagation';
import type {
  EnrichmentContext,
  EnrichmentDiagnostic,
  EnrichmentProposal,
  EnrichmentTarget,
} from './enrichmentModel';
import {
  selectEnrichmentProviders,
  type EnrichmentProviderRegistry,
  type EnrichmentSelection,
} from './enrichmentProvider';
import { assessSupersession, type FreshnessAssessment } from './freshness';
import { withRetry, type RetryPolicy } from '../acquisition/retryPolicy';

export interface EnrichmentRunInput {
  readonly targets: readonly EnrichmentTarget[];
  readonly providers: EnrichmentProviderRegistry;
  readonly sources: KnowledgeSourceRegistry;
  readonly context: EnrichmentContext;
  /** Corpus de las citas heredadas; sin él la validación las rechazará. */
  readonly corpus?: DocumentCorpus;
  readonly selection?: EnrichmentSelection;
  readonly retry?: RetryPolicy;
  readonly previouslyRejected?: ReadonlySet<string>;
  readonly requireAcceptedReview?: boolean;
}

export interface EnrichmentReport {
  readonly retrievedAt: string;
  readonly totals: {
    readonly targets: number;
    readonly proposals: number;
    readonly accepted: number;
    readonly quarantined: number;
    readonly skipped: number;
    readonly failed: number;
  };
  readonly byProducer: readonly { readonly producerId: string; readonly proposals: number }[];
  readonly diagnostics: readonly EnrichmentDiagnostic[];
  readonly freshness: readonly FreshnessAssessment[];
  readonly duplicateFragmentIds: readonly string[];
}

export interface EnrichmentRunResult {
  readonly proposals: readonly EnrichmentProposal[];
  readonly accepted: readonly KnowledgeFragment[];
  readonly quarantine: readonly QuarantineEntry[];
  readonly outcomes: readonly ValidationOutcome[];
  readonly validationReport: ValidationReport;
  readonly report: EnrichmentReport;
}

/** Testigos de evidencia de los hechos que sustentan una propuesta. */
function witnessesFor(
  proposal: EnrichmentProposal,
  fragments: readonly KnowledgeFragment[],
  sources: KnowledgeSourceRegistry,
): readonly EvidenceWitness[] {
  const witnesses: EvidenceWitness[] = [];
  for (const fragment of fragments) {
    if (!proposal.inputFragmentIds.includes(fragment.id)) {
      continue;
    }
    const source = sources.get(fragment.sourceId);
    if (!source) {
      continue;
    }
    witnesses.push({
      sourceId: fragment.sourceId,
      documentId: fragment.evidence.span?.documentId ?? fragment.evidence.reference ?? '',
      verificationLevel: source.verificationLevel,
      evidenceLevel: fragment.evidence.level,
    });
  }
  return witnesses;
}

/**
 * Convierte una propuesta en fragmento candidato. Conserva la procedencia del
 * hecho de origen: el enriquecimiento nunca reescribe fuente ni licencia.
 */
function proposalToCandidate(
  proposal: EnrichmentProposal,
  origin: KnowledgeFragment,
  retrievedAt: string,
  isGenerative: boolean,
): KnowledgeFragment {
  const capturedAt = origin.evidence.capturedAt;
  return {
    id: knowledgeFragmentIdOf(proposal.placeId, proposal.field, origin.sourceId, capturedAt),
    schemaVersion: KNOWLEDGE_SCHEMA_VERSION,
    placeId: proposal.placeId,
    field: proposal.field,
    // La propuesta llega sin tipar: la forma la comprueba el validador de la
    // Fase B contra el vocabulario cerrado del campo.
    value: proposal.value as KnowledgeFragment['value'],
    sourceId: origin.sourceId,
    evidence: {
      level: origin.evidence.level,
      method: `enrichment:${proposal.producerId}`,
      capturedAt,
      ...(origin.evidence.reference !== undefined ? { reference: origin.evidence.reference } : {}),
      ...(origin.evidence.span !== undefined ? { span: origin.evidence.span } : {}),
      ...(proposal.bindings.length > 0 ? { bindings: proposal.bindings } : {}),
    },
    retrievedAt,
    licenseTier: origin.licenseTier,
    acquisition: {
      method: isGenerative ? ACQUISITION_LANGUAGE_MODEL : ACQUISITION_RULE_ENGINE,
      toolId: proposal.producerId,
      toolVersion: proposal.producerVersion,
      parameters: { derivation: proposal.derivation, proposalFingerprint: proposal.fingerprint },
      acquiredAt: retrievedAt,
    },
    validatorVersion: VALIDATOR_VERSION,
    // Toda propuesta nace sin revisar: la revisión es humana y posterior.
    reviewHistory: [],
    supersedes: origin.id,
  };
}

/** Ejecuta el enriquecimiento completo de un lote. */
export async function runEnrichment(
  input: EnrichmentRunInput,
): Promise<EnrichmentRunResult> {
  const proposals: EnrichmentProposal[] = [];
  const diagnostics: EnrichmentDiagnostic[] = [];
  const byProducer = new Map<string, number>();
  const candidates: KnowledgeFragment[] = [];
  const allFragments: KnowledgeFragment[] = [];
  let skipped = 0;
  let failed = 0;

  const providers = selectEnrichmentProviders(input.providers, input.selection);

  for (const target of input.targets) {
    allFragments.push(...target.fragments);

    if (target.fragments.length === 0) {
      skipped += 1;
      diagnostics.push({ code: 'TARGET_EMPTY', severity: 'info', targetId: target.placeId });
      continue;
    }

    diagnostics.push(...detectContradictions(target.fragments));

    for (const provider of providers) {
      const attempt = await withRetry(
        () => provider.enrich(target, input.context),
        input.retry,
      );
      if (!attempt.ok || !attempt.value) {
        failed += 1;
        diagnostics.push({
          code: 'PROVIDER_FAILED',
          severity: 'error',
          targetId: target.placeId,
          detail: { providerId: provider.id, attempts: attempt.attempts },
        });
        continue;
      }

      diagnostics.push(...(attempt.value.diagnostics ?? []));
      const freshness = assessSupersession(target.fragments, input.context.policy);
      const staleIds = new Set(
        freshness.filter((entry) => entry.verdict === 'stale').map((entry) => entry.fragmentId),
      );

      for (const raw of attempt.value.proposals) {
        const origin = target.fragments.find((fragment) =>
          raw.inputFragmentIds.includes(fragment.id),
        );
        if (!origin) {
          diagnostics.push({
            code: 'PROPOSAL_WITHOUT_INPUT',
            severity: 'warning',
            targetId: target.placeId,
          });
          continue;
        }

        // La confianza SIEMPRE se recalcula aquí: lo que declare el proveedor
        // es irrelevante.
        const confidence = propagateConfidence({
          witnesses: witnessesFor(raw, target.fragments, input.sources),
          derivation: raw.derivation,
          stale: raw.inputFragmentIds.some((id) => staleIds.has(id)),
        });

        const isGenerative = provider.kind === 'language_model';
        const proposal: EnrichmentProposal = {
          ...raw,
          confidence,
          reviewRequirement:
            isGenerative || input.context.policy.requireReviewForGenerative
              ? 'required'
              : raw.reviewRequirement,
        };
        proposals.push(proposal);
        byProducer.set(provider.id, (byProducer.get(provider.id) ?? 0) + 1);
        candidates.push(
          proposalToCandidate(proposal, origin, input.context.retrievedAt, isGenerative),
        );
      }
    }
  }

  const validation = runKnowledgeValidation(candidates, {
    corpus: input.corpus,
    sources: input.sources,
    previouslyRejected: input.previouslyRejected,
    requireAcceptedReview: input.requireAcceptedReview,
  });

  proposals.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  diagnostics.sort((a, b) => {
    if (a.targetId !== b.targetId) {
      return a.targetId < b.targetId ? -1 : 1;
    }
    return a.code < b.code ? -1 : a.code > b.code ? 1 : 0;
  });

  return {
    proposals,
    accepted: validation.accepted,
    quarantine: validation.quarantine,
    outcomes: validation.outcomes,
    validationReport: validation.report,
    report: {
      retrievedAt: input.context.retrievedAt,
      totals: {
        targets: input.targets.length,
        proposals: proposals.length,
        accepted: validation.accepted.length,
        quarantined: validation.quarantine.length,
        skipped,
        failed,
      },
      byProducer: [...byProducer.entries()]
        .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
        .map(([producerId, count]) => ({ producerId, proposals: count })),
      diagnostics,
      freshness: assessSupersession(allFragments, input.context.policy),
      duplicateFragmentIds: detectDuplicateFragments(allFragments),
    },
  };
}

/** Serializa el informe de enriquecimiento con orden de claves estable. */
export function serializeEnrichmentReport(report: EnrichmentReport): string {
  return JSON.stringify({
    retrievedAt: report.retrievedAt,
    totals: {
      targets: report.totals.targets,
      proposals: report.totals.proposals,
      accepted: report.totals.accepted,
      quarantined: report.totals.quarantined,
      skipped: report.totals.skipped,
      failed: report.totals.failed,
    },
    byProducer: report.byProducer.map((entry) => ({
      producerId: entry.producerId,
      proposals: entry.proposals,
    })),
    diagnostics: report.diagnostics.map((entry) => ({
      code: entry.code,
      severity: entry.severity,
      targetId: entry.targetId,
    })),
    freshness: report.freshness.map((entry) => ({
      fragmentId: entry.fragmentId,
      field: entry.field,
      verdict: entry.verdict,
      ageDays: entry.ageDays,
      thresholdDays: entry.thresholdDays,
    })),
    duplicateFragmentIds: report.duplicateFragmentIds,
  });
}

/** Serializa propuestas de forma determinista y auditable. */
export function serializeProposals(proposals: readonly EnrichmentProposal[]): string {
  return JSON.stringify(
    [...proposals]
      .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
      .map((proposal) => ({
        id: proposal.id,
        placeId: proposal.placeId,
        inputFragmentIds: [...proposal.inputFragmentIds].sort(),
        field: proposal.field,
        value: proposal.value,
        derivation: proposal.derivation,
        producerId: proposal.producerId,
        producerVersion: proposal.producerVersion,
        confidence: {
          basis: proposal.confidence.basis,
          result: proposal.confidence.result,
          rule: proposal.confidence.rule,
        },
        reviewRequirement: proposal.reviewRequirement,
        explanation: proposal.explanation,
        fingerprint: proposal.fingerprint,
      })),
  );
}
