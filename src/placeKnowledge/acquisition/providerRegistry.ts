/**
 * REGISTRO DE PROVEEDORES (GEN-1 · Fase C).
 *
 * Fuente única de proveedores disponibles. La selección es DETERMINISTA y por
 * capacidad, nunca por nombre incrustado: agregar un proveedor es registrarlo,
 * jamás editar el pipeline. Misma doctrina que el registro de proveedores del
 * City Pipeline.
 */
import type {
  ExtractionProvider,
  ExtractionRequest,
} from './providerModel';
import { providerSupports } from './providerModel';

export type ProviderRegistry = ReadonlyMap<string, ExtractionProvider>;

/**
 * Construye el registro. Ante ids duplicados gana el PRIMERO, de modo que el
 * orden de registro no cambie el resultado en silencio.
 */
export function buildProviderRegistry(
  providers: readonly ExtractionProvider[],
): ProviderRegistry {
  const registry = new Map<string, ExtractionProvider>();
  for (const provider of providers) {
    if (!registry.has(provider.id)) {
      registry.set(provider.id, provider);
    }
  }
  return registry;
}

export interface ProviderSelection {
  /** Prefiere proveedores que funcionan sin conexión (local-first). */
  readonly preferOffline?: boolean;
  /** Exige determinismo declarado. */
  readonly requireDeterministic?: boolean;
  /** Restringe a un proveedor concreto por id. */
  readonly providerId?: string;
}

/**
 * Orden canónico de preferencia: primero lo que cumple los requisitos duros;
 * entre los aptos, offline antes que en línea (si se pidió), determinista
 * antes que no determinista, y finalmente id ascendente como desempate
 * estable. Dos corridas con el mismo registro eligen siempre igual.
 */
export function selectProviders(
  registry: ProviderRegistry,
  request: ExtractionRequest,
  selection: ProviderSelection = {},
): readonly ExtractionProvider[] {
  const candidates = [...registry.values()]
    .filter((provider) => (selection.providerId ? provider.id === selection.providerId : true))
    .filter((provider) => (selection.requireDeterministic ? provider.capabilities.deterministic : true))
    .filter((provider) => providerSupports(provider, request));

  return candidates.sort((a, b) => {
    if (selection.preferOffline) {
      const offline = Number(b.capabilities.offline) - Number(a.capabilities.offline);
      if (offline !== 0) {
        return offline;
      }
    }
    const deterministic =
      Number(b.capabilities.deterministic) - Number(a.capabilities.deterministic);
    if (deterministic !== 0) {
      return deterministic;
    }
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
}

/** Primer proveedor apto según el orden canónico, o null si no hay ninguno. */
export function selectProvider(
  registry: ProviderRegistry,
  request: ExtractionRequest,
  selection: ProviderSelection = {},
): ExtractionProvider | null {
  return selectProviders(registry, request, selection)[0] ?? null;
}
