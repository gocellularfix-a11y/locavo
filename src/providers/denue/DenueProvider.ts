import {
  ProviderNotConnectedError,
  type PlaceProvider,
  type ProviderNearbyQuery,
  type ProviderPlace,
} from '../PlaceProvider';

/**
 * Proveedor DENUE (INEGI) — ESQUELETO NO CONECTADO (V3).
 *
 * Pendiente antes de activarlo (Fase de importación real):
 * 1. Registrar un token del API público de INEGI (gratuito) y guardarlo
 *    FUERA del cliente (backend/edge function), nunca en este repositorio.
 * 2. Definir consultas acotadas a Culiacán (Buscar por área/radio) y
 *    respetar los límites de uso del API de INEGI.
 * 3. Mapear `DenueEstablecimiento` → `ProviderPlace` (SCIAN incluido para
 *    el CategoryNormalizer) y correr PlaceMergeService antes de insertar.
 * 4. Revisar los términos de uso de INEGI para atribución (marcado en
 *    docs/DATA_SOURCE_POLICY.md como punto de revisión legal).
 *
 * Este esqueleto lanza `ProviderNotConnectedError` de forma explícita:
 * no simula estar operativo.
 */
export class DenueProvider implements PlaceProvider {
  readonly id = 'denue';

  async searchNearby(_query: ProviderNearbyQuery): Promise<ProviderPlace[]> {
    throw new ProviderNotConnectedError(this.id);
  }

  async getByExternalId(_externalId: string): Promise<ProviderPlace | null> {
    throw new ProviderNotConnectedError(this.id);
  }
}
