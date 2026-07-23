import { ProviderRegistry, providerRegistry, DEFAULT_VERIFICATION } from '../providerRegistry';
import { DENUE_DESCRIPTOR } from '../providers/denue';
import { OSM_DESCRIPTOR } from '../providers/osm';
import { PROVIDER_DENUE, PROVIDER_OSM } from '../providerId';

describe('ProviderRegistry (City Pipeline V1)', () => {
  it('el registro por defecto contiene DENUE y OSM', () => {
    expect(providerRegistry.has(PROVIDER_DENUE)).toBe(true);
    expect(providerRegistry.has(PROVIDER_OSM)).toBe(true);
    expect(providerRegistry.get(PROVIDER_DENUE)).toBe(DENUE_DESCRIPTOR);
  });

  it('list() es determinista (orden por id)', () => {
    const ids = providerRegistry.list().map((d) => d.id);
    expect(ids).toEqual([...ids].sort());
  });

  it('registrar un proveedor duplicado lanza error', () => {
    const r = new ProviderRegistry();
    r.register(DENUE_DESCRIPTOR);
    expect(() => r.register(DENUE_DESCRIPTOR)).toThrow();
  });

  it('un proveedor nuevo solo requiere registrar su descriptor', () => {
    const r = new ProviderRegistry();
    r.register(OSM_DESCRIPTOR);
    expect(r.get(PROVIDER_OSM)?.license.tier).toBe('odbl-sidecar');
    expect(r.list()).toHaveLength(1);
  });

  it('verificationOf: DENUE conserva source_verified/0.6; desconocido cae a default', () => {
    expect(providerRegistry.verificationOf(PROVIDER_DENUE)).toEqual({ status: 'source_verified', confidence: 0.6 });
    expect(providerRegistry.verificationOf('proveedor-inexistente')).toEqual(DEFAULT_VERIFICATION);
    expect(providerRegistry.verificationOf(undefined)).toEqual(DEFAULT_VERIFICATION);
  });

  it('sourceRefSlotsOf: DENUE mapea externalId→denueId y clee→clee; OSM externalId→osmId', () => {
    expect(providerRegistry.sourceRefSlotsOf(PROVIDER_DENUE)).toEqual({ externalId: 'denueId', clee: 'clee' });
    expect(providerRegistry.sourceRefSlotsOf(PROVIDER_OSM)).toEqual({ externalId: 'osmId' });
    expect(providerRegistry.sourceRefSlotsOf('desconocido')).toEqual({});
  });

  it('DENUE es permissive-base; OSM exige sidecar ODbL con atribución', () => {
    expect(DENUE_DESCRIPTOR.license.tier).toBe('permissive-base');
    expect(OSM_DESCRIPTOR.license.shareAlike).toBe(true);
    expect(OSM_DESCRIPTOR.license.attribution).toContain('OpenStreetMap');
  });
});
