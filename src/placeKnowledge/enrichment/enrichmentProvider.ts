/**
 * CONTRATO DE PROVEEDOR DE ENRIQUECIMIENTO (GEN-1 · Fase D).
 *
 * Un solo contrato para reglas deterministas locales y para motores
 * generativos. Ninguna lógica de un producto concreto entra a la
 * orquestación: los adaptadores viven en la frontera y el transporte se
 * inyecta.
 *
 * Un proveedor devuelve PROPUESTAS; nunca hechos canónicos.
 */
import type { KnowledgeFieldKey } from '../model/knowledgeField';
import type {
  EnrichmentContext,
  EnrichmentDiagnostic,
  EnrichmentProposal,
  EnrichmentTarget,
} from './enrichmentModel';

export type EnrichmentProviderKind = 'deterministic_rule' | 'language_model' | 'external_api';

export interface EnrichmentCapabilities {
  readonly fields: readonly KnowledgeFieldKey[];
  readonly offline: boolean;
  readonly deterministic: boolean;
}

export interface EnrichmentOutput {
  readonly proposals: readonly EnrichmentProposal[];
  readonly diagnostics?: readonly EnrichmentDiagnostic[];
}

export interface EnrichmentProvider {
  readonly id: string;
  readonly version: string;
  readonly kind: EnrichmentProviderKind;
  readonly capabilities: EnrichmentCapabilities;
  enrich(target: EnrichmentTarget, context: EnrichmentContext): Promise<EnrichmentOutput>;
}

export type EnrichmentProviderRegistry = ReadonlyMap<string, EnrichmentProvider>;

export function buildEnrichmentRegistry(
  providers: readonly EnrichmentProvider[],
): EnrichmentProviderRegistry {
  const registry = new Map<string, EnrichmentProvider>();
  for (const provider of providers) {
    if (!registry.has(provider.id)) {
      registry.set(provider.id, provider);
    }
  }
  return registry;
}

export interface EnrichmentSelection {
  readonly preferOffline?: boolean;
  readonly requireDeterministic?: boolean;
  readonly providerIds?: readonly string[];
}

/**
 * Selección determinista: deterministas antes que generativos, offline antes
 * que en línea si se pidió, e id ascendente como desempate estable. El orden
 * de ejecución no depende del orden de registro.
 */
export function selectEnrichmentProviders(
  registry: EnrichmentProviderRegistry,
  selection: EnrichmentSelection = {},
): readonly EnrichmentProvider[] {
  return [...registry.values()]
    .filter((provider) =>
      selection.providerIds ? selection.providerIds.includes(provider.id) : true,
    )
    .filter((provider) => (selection.requireDeterministic ? provider.capabilities.deterministic : true))
    .sort((a, b) => {
      const deterministic =
        Number(b.capabilities.deterministic) - Number(a.capabilities.deterministic);
      if (deterministic !== 0) {
        return deterministic;
      }
      if (selection.preferOffline) {
        const offline = Number(b.capabilities.offline) - Number(a.capabilities.offline);
        if (offline !== 0) {
          return offline;
        }
      }
      return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
    });
}
