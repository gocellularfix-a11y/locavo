/**
 * Proveedor DENUE (INEGI) — descriptor + adaptador de ingesta (City Pipeline V1).
 *
 * El descriptor centraliza el conocimiento que antes era literal ('denue',
 * verificación source_verified/0.6, ranura denueId/clee). El adaptador prueba que
 * DENUE fluye por el contrato de fragmento canónico sin lógica específica fuera
 * de este archivo. NO reenvía la construcción del pack en vivo (esa ruta de
 * Culiacán permanece idéntica); es la base neutral para packs multiproveedor.
 */
import type { DenueImportCandidate } from '../../import/denue/DenueCandidateMapper';
import type { CanonicalFragment } from '../canonicalFragment';
import type { ProviderAdapter } from '../providerAdapter';
import type { ProviderDescriptor } from '../providerDescriptor';
import type { ProviderMetadata } from '../providerMetadata';
import { PROVIDER_DENUE } from '../providerId';

export const DENUE_DESCRIPTOR: ProviderDescriptor = {
  id: PROVIDER_DENUE,
  name: 'INEGI DENUE',
  version: '1',
  license: {
    name: 'Términos de Libre Uso de la Información del INEGI',
    tier: 'permissive-base',
    shareAlike: false,
    attribution: 'INEGI, Directorio Estadístico Nacional de Unidades Económicas (DENUE)',
    url: 'https://www.inegi.org.mx/app/mapa/denue/',
  },
  countries: ['MX'],
  capabilities: {
    coordinates: true,
    categories: true,
    openingHours: false,
    contact: true,
    accessibility: false,
    tourism: false,
    prices: false,
    multilingual: false,
  },
  verificationLevel: 'source_verified',
  // Idéntico a la importación histórica (V4B/V4C): fuente oficial.
  verification: { status: 'source_verified', confidence: 0.6 },
  sourceRefSlots: { externalId: 'denueId', clee: 'clee' },
};

/** Convierte un candidato DENUE en fragmento canónico (puro y determinista). */
export function denueCandidateToFragment(
  candidate: DenueImportCandidate,
  meta: ProviderMetadata,
): CanonicalFragment {
  const extra: Record<string, string> = { rawActivityCode: candidate.raw.codigo_act.trim() };
  const rawActivityName = candidate.raw.nombre_act.replace(/\s+/g, ' ').trim();
  if (rawActivityName) {
    extra.rawActivityName = rawActivityName;
  }
  const fragment: CanonicalFragment = {
    provider: PROVIDER_DENUE,
    externalId: candidate.denueId,
    name: candidate.name,
    normalizedName: candidate.normalizedName,
    coordinates: { latitude: candidate.latitude, longitude: candidate.longitude },
    category: candidate.category,
    address: candidate.address,
    searchTerms: candidate.searchTerms,
    provenance: {
      providerId: PROVIDER_DENUE,
      externalId: candidate.denueId,
      dataset: meta.datasetVersion,
      edition: meta.edition,
      extra,
    },
    licenseTier: 'permissive-base',
  };
  if (candidate.contact) {
    return { ...fragment, contact: candidate.contact };
  }
  return fragment;
}

export const denueAdapter: ProviderAdapter<DenueImportCandidate> = {
  providerId: PROVIDER_DENUE,
  normalize(raw, meta) {
    return raw.map((candidate) => denueCandidateToFragment(candidate, meta));
  },
};
