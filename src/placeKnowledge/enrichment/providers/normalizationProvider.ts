/**
 * PROVEEDOR DE NORMALIZACIÓN (GEN-1 · Fase D) — determinista y offline.
 *
 * Aplica las reglas canónicas a hechos ya validados y propone la
 * representación normalizada conservando la evidencia atómica del original: no
 * introduce hechos nuevos, así que no necesita evidencia nueva.
 */
import { fingerprintOf } from '../../acquisition/fingerprint';
import type {
  EnrichmentContext,
  EnrichmentProposal,
  EnrichmentTarget,
} from '../enrichmentModel';
import type { EnrichmentOutput, EnrichmentProvider } from '../enrichmentProvider';
import { atomMapping, rulesForField } from '../normalization';
import type { EvidenceBinding } from '../../model/evidence';
import { proposalIdOf, proposalFingerprintOf } from '../proposalIdentity';

export const NORMALIZATION_PROVIDER_ID = 'local-normalizer';

/**
 * Traslada cada cita al átomo normalizado que la sustituye. La evidencia no
 * cambia —sigue siendo la misma frase del mismo documento—; lo que cambia es
 * la etiqueta canónica del valor que respalda.
 */
function remapBindings(
  bindings: readonly EvidenceBinding[],
  mapping: ReadonlyMap<string, string>,
): readonly EvidenceBinding[] {
  if (mapping.size === 0) {
    return bindings;
  }
  return bindings.map((binding) => {
    const match = /^\[(.*)\]$/.exec(binding.path);
    if (!match) {
      return binding;
    }
    const normalized = mapping.get(match[1]);
    return normalized === undefined || normalized === match[1]
      ? binding
      : { ...binding, path: `[${normalized}]` };
  });
}

export function createNormalizationProvider(version = '1.0.0'): EnrichmentProvider {
  return {
    id: NORMALIZATION_PROVIDER_ID,
    version,
    kind: 'deterministic_rule',
    capabilities: {
      fields: ['phones', 'website', 'services', 'paymentMethods', 'languages'],
      offline: true,
      deterministic: true,
    },
    async enrich(target: EnrichmentTarget, context: EnrichmentContext): Promise<EnrichmentOutput> {
      const proposals: EnrichmentProposal[] = [];
      const allowed = context.policy.allowedFields;

      for (const fragment of target.fragments) {
        if (allowed && !allowed.includes(fragment.field)) {
          continue;
        }
        for (const rule of rulesForField(fragment.field)) {
          const normalized = rule.apply(fragment.value);
          if (normalized === null) {
            continue;
          }
          const producerVersion = `${version}+${rule.id}@${rule.version}`;
          const fingerprint = proposalFingerprintOf({
            placeId: target.placeId,
            field: fragment.field,
            value: normalized,
            producerId: NORMALIZATION_PROVIDER_ID,
            producerVersion,
          });
          proposals.push({
            id: proposalIdOf(target.placeId, fragment.field, fingerprint),
            placeId: target.placeId,
            inputFragmentIds: [fragment.id],
            field: fragment.field,
            value: normalized,
            // La evidencia del original se conserva tal cual: normalizar no
            // cambia lo que la fuente dijo.
            bindings: remapBindings(fragment.evidence.bindings ?? [], atomMapping(rule, fragment.value)),
            derivation: 'normalization',
            producerId: NORMALIZATION_PROVIDER_ID,
            producerVersion,
            confidence: { basis: 0, result: 0, rule: 'PENDING' },
            reviewRequirement: 'none',
            explanation: [rule.explanation, `original:${fingerprintOf(JSON.stringify(fragment.value))}`],
            fingerprint,
          });
        }
      }

      proposals.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
      return { proposals };
    },
  };
}
