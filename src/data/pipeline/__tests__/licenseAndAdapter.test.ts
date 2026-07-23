import type { DenueImportCandidate } from '../../import/denue/DenueCandidateMapper';
import type { DenueRawRecord } from '../../import/denue/DenueRawRecord';
import { isExcluded, isPermissiveBase, requiresSidecar } from '../licenseTier';
import type { ProviderMetadata } from '../providerMetadata';
import { DENUE_DESCRIPTOR, denueAdapter, denueCandidateToFragment } from '../providers/denue';
import { OSM_DESCRIPTOR } from '../providers/osm';
import { PROVIDER_DENUE } from '../providerId';

describe('arquitectura de licencia', () => {
  it('clasifica base permissive / sidecar / excluido', () => {
    expect(isPermissiveBase(DENUE_DESCRIPTOR.license)).toBe(true);
    expect(requiresSidecar(OSM_DESCRIPTOR.license)).toBe(true);
    expect(isExcluded({ name: 'Google Places', tier: 'proprietary-excluded', shareAlike: false })).toBe(true);
    expect(requiresSidecar(DENUE_DESCRIPTOR.license)).toBe(false);
  });
});

const META: ProviderMetadata = {
  providerId: PROVIDER_DENUE,
  name: 'INEGI DENUE',
  datasetVersion: 'MEX-INEGI.EEC2.05-DENUE-2026',
  license: 'Términos de Libre Uso INEGI',
  edition: '2026-07-01',
  verificationLevel: 'source_verified',
};

const candidate = (over: Partial<DenueImportCandidate> = {}): DenueImportCandidate => ({
  denueId: '100',
  name: 'Taquería El Sol',
  normalizedName: 'taqueria el sol',
  category: 'food',
  latitude: 24.8069,
  longitude: -107.394,
  address: { countryCode: 'MX' },
  searchTerms: ['tacos'],
  raw: { codigo_act: '722511', nombre_act: 'Restaurantes con servicio de preparación de tacos' } as DenueRawRecord,
  ...over,
});

describe('adaptador DENUE → fragmento canónico', () => {
  it('produce un CanonicalFragment (nunca un LocavoPlace) con procedencia y licencia', () => {
    const f = denueCandidateToFragment(candidate(), META);
    expect(f.provider).toBe(PROVIDER_DENUE);
    expect(f.externalId).toBe('100');
    expect(f.coordinates).toEqual({ latitude: 24.8069, longitude: -107.394 });
    expect(f.category).toBe('food');
    expect(f.licenseTier).toBe('permissive-base');
    expect(f.provenance.providerId).toBe(PROVIDER_DENUE);
    expect(f.provenance.extra?.rawActivityCode).toBe('722511');
    // No filtra estructuras finales ni de dominio:
    const asRecord = f as unknown as Record<string, unknown>;
    expect(asRecord.verification).toBeUndefined();
    expect(asRecord.sourceRefs).toBeUndefined();
  });

  it('el adaptador mapea un arreglo de forma determinista', () => {
    const out = denueAdapter.normalize([candidate({ denueId: '1' }), candidate({ denueId: '2' })], META);
    expect(out).toHaveLength(2);
    expect(out.map((f) => f.externalId)).toEqual(['1', '2']);
    expect(denueAdapter.normalize([candidate()], META)).toEqual(denueAdapter.normalize([candidate()], META));
  });

  it('preserva contacto solo cuando existe', () => {
    expect(denueCandidateToFragment(candidate(), META).contact).toBeUndefined();
    const withContact = denueCandidateToFragment(candidate({ contact: { phone: '6670000000' } }), META);
    expect(withContact.contact).toEqual({ phone: '6670000000' });
  });
});
