import { mapCloudRowToPlace } from '../SupabasePlaceMapper';

const FULL_ROW = {
  id: '00000000-0000-4000-8000-000000000001',
  name: 'Demo Taquería Centro',
  normalizedName: 'demo taqueria centro',
  category: 'food',
  secondaryCategories: ['nightlife'],
  coordinates: { latitude: 24.8079, longitude: -107.3958 },
  address: { formatted: 'Av. Obregón 210, Centro', countryCode: 'MX' },
  contact: { phone: '+52 667 000 0001', website: 'https://example.com/demo' },
  hours: { weekly: [[{ open: '12:00', close: '23:00' }], [], null, [], [], [], []] },
  price: { level: 1, currency: 'MXN' },
  features: { wheelchairAccessible: true, parking: true },
  searchTerms: ['tacos', 'asada'],
  verification: { status: 'source_verified', confidence: 0.82, lastVerifiedAt: '2026-07-10T18:00:00Z' },
  sourceRefs: { locavoId: 'demo-01', denueId: '1234567', clee: 'CLEE-1', osmId: 'node/99' },
  provenance: [
    { source: 'mock', importedAt: '2026-07-01T00:00:00Z', updatedAt: '2026-07-10T18:00:00Z' },
    { source: 'denue', importedAt: '2026-07-12T00:00:00Z' },
  ],
  status: { active: true, temporarilyClosed: false, permanentlyClosed: false },
  content: {
    description: {
      original: {
        text: 'Tacos estilo Culiacán en el centro.',
        language: 'es-MX',
        source: 'owner',
        capturedAt: '2026-07-01T00:00:00Z',
      },
      translations: {
        en: { text: 'Culiacán-style tacos downtown.', translatedAt: '2026-07-02T00:00:00Z', source: 'locavo' },
      },
    },
  },
  createdAt: '2026-07-01T00:00:00Z',
  updatedAt: '2026-07-10T18:00:00Z',
};

describe('mapCloudRowToPlace', () => {
  it('fila completa → LocavoPlace con identidad propia y referencias', () => {
    const place = mapCloudRowToPlace(FULL_ROW);
    expect(place).not.toBeNull();
    expect(place!.id).toBe('00000000-0000-4000-8000-000000000001');
    // El id NUNCA es un id de proveedor: esos van en sourceRefs.
    expect(place!.sourceRefs).toEqual({
      locavoId: 'demo-01',
      denueId: '1234567',
      clee: 'CLEE-1',
      osmId: 'node/99',
      ownerId: undefined,
    });
    expect(place!.coordinates).toEqual({ latitude: 24.8079, longitude: -107.3958 });
    expect(place!.category).toBe('food');
    expect(place!.secondaryCategories).toEqual(['nightlife']);
  });

  it('horarios, características, precio y términos se conservan', () => {
    const place = mapCloudRowToPlace(FULL_ROW)!;
    expect(place.hours?.weekly[0]).toEqual([{ open: '12:00', close: '23:00' }]);
    expect(place.features?.wheelchairAccessible).toBe(true);
    expect(place.price?.level).toBe(1);
    expect(place.searchTerms).toEqual(['tacos', 'asada']);
  });

  it('verificación, confianza y procedencia se conservan', () => {
    const place = mapCloudRowToPlace(FULL_ROW)!;
    expect(place.verification).toEqual({
      status: 'source_verified',
      confidence: 0.82,
      lastVerifiedAt: '2026-07-10T18:00:00Z',
    });
    expect(place.provenance).toHaveLength(2);
    expect(place.provenance[1].source).toBe('denue');
  });

  it('contenido localizado: original intacto + traducciones separadas', () => {
    const place = mapCloudRowToPlace(FULL_ROW)!;
    expect(place.content?.description?.original.text).toBe('Tacos estilo Culiacán en el centro.');
    expect(place.content?.description?.original.language).toBe('es-MX');
    expect(place.content?.description?.translations?.en?.text).toBe(
      'Culiacán-style tacos downtown.',
    );
  });

  it('valores nulos/ausentes degradan con seguridad', () => {
    const place = mapCloudRowToPlace({
      ...FULL_ROW,
      address: null,
      contact: null,
      hours: null,
      price: null,
      features: null,
      content: null,
      provenance: null,
      sourceRefs: null,
      verification: null,
    })!;
    expect(place).not.toBeNull();
    expect(place.address).toBeUndefined();
    expect(place.hours).toBeUndefined();
    expect(place.content).toBeUndefined();
    expect(place.provenance).toEqual([]);
    expect(place.verification.status).toBe('unverified');
    expect(place.verification.confidence).toBe(0);
  });

  it('datos inesperados se rechazan: fila sin esenciales → null', () => {
    expect(mapCloudRowToPlace(null)).toBeNull();
    expect(mapCloudRowToPlace('texto')).toBeNull();
    expect(mapCloudRowToPlace({})).toBeNull();
    expect(mapCloudRowToPlace({ ...FULL_ROW, id: undefined })).toBeNull();
    expect(mapCloudRowToPlace({ ...FULL_ROW, category: 'casino' })).toBeNull();
    expect(
      mapCloudRowToPlace({ ...FULL_ROW, coordinates: { latitude: 999, longitude: 0 } }),
    ).toBeNull();
    expect(
      mapCloudRowToPlace({ ...FULL_ROW, coordinates: { latitude: 'x', longitude: 'y' } }),
    ).toBeNull();
  });

  it('confianza fuera de rango degrada a 0 y estado desconocido a unverified', () => {
    const place = mapCloudRowToPlace({
      ...FULL_ROW,
      verification: { status: 'hacked', confidence: 7 },
    })!;
    expect(place.verification.confidence).toBe(0);
    expect(place.verification.status).toBe('unverified');
  });
});
