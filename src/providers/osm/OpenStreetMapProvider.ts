import {
  ProviderNotConnectedError,
  type PlaceProvider,
  type ProviderNearbyQuery,
  type ProviderPlace,
} from '../PlaceProvider';

/**
 * Proveedor OpenStreetMap — ESQUELETO NO CONECTADO (V3).
 *
 * Pendiente antes de activarlo:
 * 1. Decidir infraestructura: instancia propia de Overpass o descargas
 *    (extractos regionales) procesadas en backend. NO abusar de los
 *    servidores públicos de Overpass (política de uso estricta).
 * 2. Cumplir la licencia ODbL: atribución "© OpenStreetMap contributors"
 *    y condiciones de share-alike para datos derivados (marcado en
 *    docs/DATA_SOURCE_POLICY.md como punto de revisión legal).
 * 3. Mapear `OsmElement` (tags amenity/shop/tourism) → `ProviderPlace`
 *    para el CategoryNormalizer y deduplicar con PlaceMergeService.
 *
 * Este esqueleto lanza `ProviderNotConnectedError` de forma explícita:
 * no simula estar operativo.
 */
export class OpenStreetMapProvider implements PlaceProvider {
  readonly id = 'openstreetmap';

  async searchNearby(_query: ProviderNearbyQuery): Promise<ProviderPlace[]> {
    throw new ProviderNotConnectedError(this.id);
  }

  async getByExternalId(_externalId: string): Promise<ProviderPlace | null> {
    throw new ProviderNotConnectedError(this.id);
  }
}
