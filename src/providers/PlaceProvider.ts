import type { CategoryId } from '../domain/place';
import type { PlaceSource } from '../domain/places/LocavoPlace';

/**
 * Contrato de proveedores externos de lugares (V3).
 *
 * Un proveedor entrega registros CRUDOS (`ProviderPlace`); la conversión al
 * modelo canónico, la normalización de categorías y la deduplicación
 * ocurren fuera del proveedor (mapper + CategoryNormalizer +
 * PlaceMergeService). Ningún proveedor se consulta desde la UI.
 *
 * En V3 los proveedores concretos (DENUE, OSM) son esqueletos NO
 * conectados: compilan, están tipados y documentan lo pendiente, pero no
 * hacen llamadas reales ni contienen claves.
 */

export interface ProviderNearbyQuery {
  latitude: number;
  longitude: number;
  radiusMeters: number;
  limit?: number;
}

export interface ProviderTextQuery {
  text: string;
  latitude?: number;
  longitude?: number;
  limit?: number;
}

/** Registro crudo tal como lo entrega la fuente, sin transformar. */
export interface ProviderPlace {
  externalId: string;
  source: PlaceSource;
  name: string;
  latitude: number;
  longitude: number;
  /** Señales para el CategoryNormalizer. */
  scianCode?: string;
  osmTags?: Record<string, string>;
  categoryHint?: CategoryId;
  addressFormatted?: string;
  phone?: string;
  website?: string;
  raw?: unknown;
}

export interface PlaceProvider {
  readonly id: string;

  searchNearby?(query: ProviderNearbyQuery): Promise<ProviderPlace[]>;

  searchText?(query: ProviderTextQuery): Promise<ProviderPlace[]>;

  getByExternalId?(externalId: string): Promise<ProviderPlace | null>;
}

/** Error tipado de proveedores aún no conectados (estado explícito, no simulación). */
export class ProviderNotConnectedError extends Error {
  constructor(providerId: string) {
    super(
      `El proveedor "${providerId}" todavía no está conectado. ` +
        'Es un esqueleto de V3: no hace llamadas reales ni tiene credenciales.',
    );
    this.name = 'ProviderNotConnectedError';
  }
}
