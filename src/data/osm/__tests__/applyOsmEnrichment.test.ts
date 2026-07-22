import { primarySourceOf } from '../../../domain/places/LocavoPlace';
import { applyOsmEnrichment } from '../applyOsmEnrichment';
import type { OsmEnrichmentEntry, OsmEnrichmentFields } from '../OsmEnrichment';
import { makeDenue } from './helpers';

function entry(fields: OsmEnrichmentFields): OsmEnrichmentEntry {
  return {
    locavoPlaceId: 'denue-1',
    osmId: 'n1',
    confidence: 1,
    reasons: [],
    distanceMeters: 10,
    nameSimilarity: 1,
    fields,
  };
}

describe('applyOsmEnrichment — merge de runtime append-only', () => {
  it('procedencia append-only: DENUE en índice 0, OSM al final; primarySourceOf intacto', () => {
    const place = makeDenue();
    const enriched = applyOsmEnrichment(place, entry({ website: { value: 'https://x.mx', ingested: true } }));
    expect(enriched.provenance[0].source).toBe('denue');
    expect(enriched.provenance[enriched.provenance.length - 1].source).toBe('openstreetmap');
    expect(primarySourceOf(enriched)).toBe('denue');
    // El objeto original no se muta.
    expect(place.provenance).toHaveLength(1);
  });

  it('rellena teléfono vacío', () => {
    const enriched = applyOsmEnrichment(makeDenue(), entry({ phone: { value: '6671234567', ingested: true } }));
    expect(enriched.contact?.phone).toBe('6671234567');
  });

  it('NUNCA sobrescribe un teléfono DENUE válido (doble guarda)', () => {
    const place = makeDenue({ phone: '6670000000' });
    const enriched = applyOsmEnrichment(place, entry({ phone: { value: '6679999999', ingested: true } }));
    expect(enriched.contact?.phone).toBe('6670000000');
  });

  it('ingiere horarios y features booleanas', () => {
    const enriched = applyOsmEnrichment(
      makeDenue(),
      entry({
        hours: { ingested: true, supported: true, raw: '24/7', value: { weekly: [[], [], [], [], [], [], []] } },
        wheelchairAccessible: { value: true, ingested: true },
      }),
    );
    expect(enriched.hours).toBeDefined();
    expect(enriched.features?.wheelchairAccessible).toBe(true);
  });

  it('no altera identidad, categoría, coordenadas ni verificación DENUE', () => {
    const place = makeDenue();
    const enriched = applyOsmEnrichment(place, entry({ website: { value: 'https://x.mx', ingested: true } }));
    expect(enriched.id).toBe(place.id);
    expect(enriched.name).toBe(place.name);
    expect(enriched.category).toBe(place.category);
    expect(enriched.coordinates).toEqual(place.coordinates);
    expect(enriched.verification).toEqual(place.verification);
  });
});
