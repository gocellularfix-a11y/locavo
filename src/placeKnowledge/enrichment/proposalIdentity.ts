/**
 * IDENTIDAD DE PROPUESTA (GEN-1 · Fase D).
 *
 * Id y huella deterministas: la misma propuesta, producida por la misma regla
 * o proveedor y versión, tiene siempre la misma identidad. Eso permite
 * deduplicar entre corridas y detectar cuándo una versión nueva del productor
 * cambió realmente el resultado.
 */
import { fingerprintOf } from '../acquisition/fingerprint';
import type { KnowledgeFieldKey } from '../model/knowledgeField';

export interface ProposalFingerprintInput {
  readonly placeId: string;
  readonly field: KnowledgeFieldKey;
  readonly value: unknown;
  readonly producerId: string;
  readonly producerVersion: string;
}

export function proposalFingerprintOf(input: ProposalFingerprintInput): string {
  return fingerprintOf(
    [
      input.placeId,
      input.field,
      JSON.stringify(input.value),
      input.producerId,
      input.producerVersion,
    ].join('|'),
  );
}

export function proposalIdOf(
  placeId: string,
  field: KnowledgeFieldKey,
  fingerprint: string,
): string {
  return `${placeId}::${field}::${fingerprint}`;
}
