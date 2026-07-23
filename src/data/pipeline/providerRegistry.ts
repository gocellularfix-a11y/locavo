/**
 * REGISTRO de proveedores (City Pipeline V1).
 *
 * Fuente única de verdad de los proveedores soportados. El pipeline y el runtime
 * consultan el registro; NO contienen nombres de proveedor hardcodeados. Agregar
 * un proveedor es registrar su descriptor (y su adaptador), jamás editar el
 * pipeline. Los descriptores son datos puros; el registro es su índice.
 */
import type { PlaceVerification } from '../../domain/places/LocavoPlace';
import type { ProviderDescriptor, ProviderSourceRefSlots } from './providerDescriptor';
import type { ProviderId } from './providerId';
import { DENUE_DESCRIPTOR } from './providers/denue';
import { OSM_DESCRIPTOR } from './providers/osm';

/** Verificación por defecto para una procedencia desconocida (idéntica a la histórica). */
export const DEFAULT_VERIFICATION: Pick<PlaceVerification, 'status' | 'confidence'> = {
  status: 'unverified',
  confidence: 0.3,
};

export class ProviderRegistry {
  private readonly byId = new Map<ProviderId, ProviderDescriptor>();

  register(descriptor: ProviderDescriptor): void {
    if (this.byId.has(descriptor.id)) {
      throw new Error(`Proveedor ya registrado: "${descriptor.id}"`);
    }
    this.byId.set(descriptor.id, descriptor);
  }

  has(id: ProviderId): boolean {
    return this.byId.has(id);
  }

  get(id: ProviderId): ProviderDescriptor | undefined {
    return this.byId.get(id);
  }

  /** Lista determinista (orden por id). */
  list(): ProviderDescriptor[] {
    return [...this.byId.values()].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  }

  /** Verificación declarada del proveedor, o el valor por defecto si es desconocido. */
  verificationOf(id: ProviderId | undefined): Pick<PlaceVerification, 'status' | 'confidence'> {
    const d = id ? this.byId.get(id) : undefined;
    return d ? d.verification : DEFAULT_VERIFICATION;
  }

  /** Ranuras de `sourceRefs` del proveedor, o vacío si es desconocido. */
  sourceRefSlotsOf(id: ProviderId | undefined): ProviderSourceRefSlots {
    const d = id ? this.byId.get(id) : undefined;
    return d ? d.sourceRefSlots : {};
  }
}

/** Registro por defecto de la app, con los proveedores ya soportados. */
export const providerRegistry = new ProviderRegistry();
providerRegistry.register(DENUE_DESCRIPTOR);
providerRegistry.register(OSM_DESCRIPTOR);
