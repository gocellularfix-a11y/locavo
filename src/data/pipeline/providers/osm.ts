/**
 * Proveedor OpenStreetMap — descriptor (City Pipeline V1).
 *
 * OSM aporta atributos ricos (horarios, accesibilidad, contacto, turismo) pero
 * bajo ODbL (share-alike): su licencia lo obliga a un SIDECAR separado y
 * removible, nunca fusionado de forma irreversible en la base permissive. El
 * enriquecimiento OSM concreto vive en `src/data/osm` (V4F-0); aquí solo se
 * declara su descriptor neutral para el registro y la fusión.
 */
import type { ProviderDescriptor } from '../providerDescriptor';
import { PROVIDER_OSM } from '../providerId';

export const OSM_DESCRIPTOR: ProviderDescriptor = {
  id: PROVIDER_OSM,
  name: 'OpenStreetMap',
  version: '1',
  license: {
    name: 'ODbL-1.0',
    tier: 'odbl-sidecar',
    shareAlike: true,
    attribution: '© OpenStreetMap contributors',
    url: 'https://www.openstreetmap.org/copyright',
  },
  countries: ['*'],
  capabilities: {
    coordinates: true,
    categories: true,
    openingHours: true,
    contact: true,
    accessibility: true,
    tourism: true,
    prices: false,
    multilingual: true,
  },
  // Dato comunitario: no es verificación oficial de fuente.
  verificationLevel: 'unverified',
  verification: { status: 'unverified', confidence: 0.3 },
  sourceRefSlots: { externalId: 'osmId' },
};
