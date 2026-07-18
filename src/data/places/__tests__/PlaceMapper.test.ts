import { MOCK_PLACES } from '../../places.mock';
import { isValidCoordinates } from '../../../domain/distance';
import { isDemoPlace, primarySourceOf } from '../../../domain/places/LocavoPlace';
import { SEED_IMPORTED_AT, seedToLocavoPlace } from '../PlaceMapper';

describe('seedToLocavoPlace (migración de mocks al modelo canónico)', () => {
  const canonical = MOCK_PLACES.map(seedToLocavoPlace);

  it('mantiene los 24+ lugares con ids internos de Locavo', () => {
    expect(canonical.length).toBeGreaterThanOrEqual(24);
    for (const place of canonical) {
      expect(place.id.startsWith('locavo-')).toBe(true);
      // El id del proveedor queda como referencia externa, nunca como PK.
      expect(place.sourceRefs.locavoId).toBeDefined();
      expect(place.id).not.toBe(place.sourceRefs.locavoId);
    }
  });

  it('ids únicos y coordenadas válidas', () => {
    expect(new Set(canonical.map((p) => p.id)).size).toBe(canonical.length);
    for (const place of canonical) {
      expect(isValidCoordinates(place.coordinates)).toBe(true);
    }
  });

  it('procedencia mock explícita: nunca se mezcla con producción en silencio', () => {
    for (const place of canonical) {
      expect(primarySourceOf(place)).toBe('mock');
      expect(isDemoPlace(place)).toBe(true);
      expect(place.provenance[0].importedAt).toBe(SEED_IMPORTED_AT);
      // La semilla demostrativa jamás se presenta como verificada.
      expect(place.verification.status).toBe('unverified');
    }
  });

  it('mapea confianza legible a confianza numérica 0–1', () => {
    for (const place of canonical) {
      expect(place.verification.confidence).toBeGreaterThan(0);
      expect(place.verification.confidence).toBeLessThanOrEqual(1);
    }
    const high = canonical.find((p) => p.id === 'locavo-coffee-rio-01');
    expect(high?.verification.confidence).toBe(0.9);
  });

  it('nombre normalizado listo para búsqueda y dedupe', () => {
    const taqueria = canonical.find((p) => p.id === 'locavo-food-centro-01');
    expect(taqueria?.normalizedName).toBe('demo taqueria centro');
    // El nombre original NUNCA se altera ni traduce.
    expect(taqueria?.name).toBe('Demo Taquería Centro');
  });

  it('dirección estructurada con país y municipio', () => {
    for (const place of canonical) {
      expect(place.address?.countryCode).toBe('MX');
      expect(place.address?.municipality).toBe('Culiacán');
    }
  });
});
