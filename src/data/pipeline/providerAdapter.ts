/**
 * Contrato de ADAPTADOR de ingesta (City Pipeline V1).
 *
 * Cada proveedor implementa EXACTAMENTE el mismo contrato: recibe registros
 * crudos ya cargados y produce `CanonicalFragment[]`. La carga (IO: archivos,
 * API, extractos) es una responsabilidad separada e inyectada, para que la
 * normalización sea pura, determinista y testeable sin red ni disco.
 *
 * Nada específico del proveedor escapa del adaptador.
 */
import type { CanonicalFragment } from './canonicalFragment';
import type { ProviderId } from './providerId';
import type { ProviderMetadata } from './providerMetadata';

export interface ProviderAdapter<TRaw = unknown> {
  readonly providerId: ProviderId;
  /**
   * Convierte registros crudos del proveedor en fragmentos canónicos. Puro y
   * determinista: mismas entradas → mismos fragmentos. No hace IO.
   */
  normalize(raw: readonly TRaw[], meta: ProviderMetadata): CanonicalFragment[];
}
