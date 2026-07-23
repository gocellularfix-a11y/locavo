/**
 * Confianza de FUENTE para resolución de conflictos (City Pipeline V1).
 *
 * Orden de autoridad determinista: oficial > curado > verificado por fuente >
 * comunitario. Deriva del `verificationLevel` del descriptor, jamás del nombre
 * del proveedor. En empate, el desempate es por recencia de edición y luego por
 * id de proveedor + externalId (estable).
 */
import type { ProviderDescriptor } from './providerDescriptor';
import type { VerificationLevel } from './providerMetadata';

const TRUST_RANK: Readonly<Record<VerificationLevel, number>> = {
  official: 4,
  curated: 3,
  source_verified: 2,
  unverified: 1,
};

export function trustRankOf(descriptor: ProviderDescriptor | undefined): number {
  return descriptor ? TRUST_RANK[descriptor.verificationLevel] : 0;
}
