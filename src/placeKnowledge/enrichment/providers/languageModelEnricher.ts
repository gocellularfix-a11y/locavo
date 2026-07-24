/**
 * ENRIQUECEDOR GENERATIVO (GEN-1 · Fase D) — adaptador neutral.
 *
 * El transporte se inyecta, así que sirve igual a un motor local o remoto sin
 * que ninguna lógica de producto entre al pipeline.
 *
 * La salida del motor se trata como ENTRADA HOSTIL: se parsea a la defensiva y
 * se descarta todo lo que intente salirse del contrato —campos desconocidos,
 * prosa donde se pidió estructura, JSON roto, afirmaciones no solicitadas,
 * intentos de reescribir procedencia o de elevar la confianza—.
 */
import type { KnowledgeFieldKey } from '../../model/knowledgeField';
import { isKnownKnowledgeField } from '../../validation/fieldValueValidation';
import type {
  EnrichmentContext,
  EnrichmentDiagnostic,
  EnrichmentProposal,
  EnrichmentTarget,
} from '../enrichmentModel';
import type { EnrichmentOutput, EnrichmentProvider } from '../enrichmentProvider';
import { proposalFingerprintOf, proposalIdOf } from '../proposalIdentity';

export interface EnrichmentTransport {
  readonly id: string;
  readonly version: string;
  readonly offline: boolean;
  send(payload: string, target: EnrichmentTarget): Promise<string>;
}

export interface LanguageModelEnricherOptions {
  readonly transport: EnrichmentTransport;
  readonly promptId: string;
  readonly promptVersion: string;
  readonly promptFingerprint: string;
  readonly fields: readonly KnowledgeFieldKey[];
}

/** Claves que un proveedor NUNCA puede dictar; si las manda, se descartan. */
const FORBIDDEN_KEYS = [
  'confidence',
  'provenance',
  'sourceId',
  'licenseTier',
  'validatorVersion',
  'reviewHistory',
  'evidence',
];

export function createLanguageModelEnricher(
  options: LanguageModelEnricherOptions,
): EnrichmentProvider {
  const producerVersion = `${options.transport.version}+${options.promptFingerprint}`;

  return {
    id: options.transport.id,
    version: producerVersion,
    kind: 'language_model',
    capabilities: { fields: options.fields, offline: options.transport.offline, deterministic: false },

    async enrich(target: EnrichmentTarget, context: EnrichmentContext): Promise<EnrichmentOutput> {
      const diagnostics: EnrichmentDiagnostic[] = [];
      const allowed = context.policy.allowedFields
        ? options.fields.filter((field) => context.policy.allowedFields!.includes(field))
        : options.fields;

      const payload = JSON.stringify({
        promptId: options.promptId,
        promptVersion: options.promptVersion,
        placeId: target.placeId,
        fields: allowed,
        facts: target.fragments.map((fragment) => ({
          id: fragment.id,
          field: fragment.field,
          value: fragment.value,
        })),
      });

      let raw: string;
      try {
        raw = await options.transport.send(payload, target);
      } catch {
        return {
          proposals: [],
          diagnostics: [
            { code: 'TRANSPORT_FAILED', severity: 'error', targetId: target.placeId },
          ],
        };
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch {
        return {
          proposals: [],
          diagnostics: [
            { code: 'MALFORMED_OUTPUT', severity: 'error', targetId: target.placeId },
          ],
        };
      }

      const list = Array.isArray(parsed) ? parsed : null;
      if (!list) {
        return {
          proposals: [],
          diagnostics: [
            { code: 'UNEXPECTED_SHAPE', severity: 'error', targetId: target.placeId },
          ],
        };
      }

      const knownFragmentIds = new Set(target.fragments.map((fragment) => fragment.id));
      const proposals: EnrichmentProposal[] = [];

      for (const item of list) {
        if (typeof item !== 'object' || item === null || Array.isArray(item)) {
          diagnostics.push({ code: 'UNEXPECTED_SHAPE', severity: 'warning', targetId: target.placeId });
          continue;
        }
        const record = item as Record<string, unknown>;

        for (const forbidden of FORBIDDEN_KEYS) {
          if (Object.prototype.hasOwnProperty.call(record, forbidden)) {
            // Un proveedor no dicta procedencia ni confianza: se ignora el
            // intento y queda registrado.
            diagnostics.push({
              code: 'PROVIDER_OVERREACH',
              severity: 'warning',
              targetId: target.placeId,
              detail: { key: forbidden },
            });
          }
        }

        const field = record.field;
        if (typeof field !== 'string' || !isKnownKnowledgeField(field)) {
          diagnostics.push({ code: 'UNKNOWN_FIELD', severity: 'warning', targetId: target.placeId });
          continue;
        }
        if (!allowed.includes(field)) {
          diagnostics.push({ code: 'FIELD_OUT_OF_SCOPE', severity: 'warning', targetId: target.placeId });
          continue;
        }
        if (record.value === undefined) {
          diagnostics.push({ code: 'MISSING_VALUE', severity: 'warning', targetId: target.placeId });
          continue;
        }

        // Toda propuesta factual debe apuntar a hechos de entrada validados.
        const inputs = Array.isArray(record.basedOn)
          ? record.basedOn.filter(
              (id): id is string => typeof id === 'string' && knownFragmentIds.has(id),
            )
          : [];
        if (inputs.length === 0) {
          diagnostics.push({
            code: 'UNSUPPORTED_PROPOSAL',
            severity: 'warning',
            targetId: target.placeId,
            detail: { field },
          });
          continue;
        }

        const fingerprint = proposalFingerprintOf({
          placeId: target.placeId,
          field,
          value: record.value,
          producerId: options.transport.id,
          producerVersion,
        });
        const supporting = target.fragments.filter((fragment) => inputs.includes(fragment.id));

        proposals.push({
          id: proposalIdOf(target.placeId, field, fingerprint),
          placeId: target.placeId,
          inputFragmentIds: [...inputs].sort(),
          field,
          value: record.value,
          // Hereda la evidencia atómica de los hechos que la sustentan; el
          // motor no puede aportar citas propias.
          bindings: supporting.flatMap((fragment) => fragment.evidence.bindings ?? []),
          derivation: 'generative_proposal',
          producerId: options.transport.id,
          producerVersion,
          confidence: { basis: 0, result: 0, rule: 'PENDING' },
          reviewRequirement: 'required',
          explanation: ['GENERATIVE_PROPOSAL', `prompt:${options.promptFingerprint}`],
          fingerprint,
        });
      }

      proposals.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
      return { proposals, diagnostics };
    },
  };
}
