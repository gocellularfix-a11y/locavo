import { translateIn } from '../I18nContext';
import { sourceLabelLocalized, verificationTextLocalized } from '../format';
import { SUPPORTED_LOCALES } from '../types';
import {
  individualVerificationDateOf,
  type LocavoPlace,
  type PlaceVerification,
} from '../../domain/places/LocavoPlace';
import { scorePlace } from '../../services/places/PlaceRankingService';

/**
 * V4D.1 — Semántica veraz de fuente y verificación.
 * La fecha de edición de un dataset masivo (DENUE) JAMÁS puede presentarse
 * como verificación individual del negocio.
 */

const DENUE_ONLY: PlaceVerification = {
  status: 'source_verified',
  confidence: 0.6,
  sourceDatasetUpdatedAt: '2026-07-01T00:00:00.000Z',
};

function denuePlace(verification: PlaceVerification = DENUE_ONLY): LocavoPlace {
  return {
    id: 'denue-1',
    sourceRefs: { denueId: '1' },
    name: 'PIZZETA OBREGÓN',
    normalizedName: 'pizzeta obregon',
    category: 'food',
    coordinates: { latitude: 24.8069, longitude: -107.394 },
    verification,
    provenance: [{ source: 'denue', importedAt: '2026-07-01', updatedAt: '2026-07-01' }],
    status: { active: true },
    createdAt: '2026-07-01T00:00:00.000Z',
    updatedAt: '2026-07-01T00:00:00.000Z',
  };
}

describe('individualVerificationDateOf', () => {
  it('la fecha del dataset NO cuenta como verificación individual', () => {
    expect(individualVerificationDateOf(DENUE_ONLY)).toBeUndefined();
  });

  it('las verificaciones reales sí cuentan (canónica > propietario > comunidad > evidencia)', () => {
    expect(
      individualVerificationDateOf({ ...DENUE_ONLY, canonicalVerifiedAt: '2026-07-10' }),
    ).toBe('2026-07-10');
    expect(
      individualVerificationDateOf({ ...DENUE_ONLY, ownerConfirmedAt: '2026-07-09' }),
    ).toBe('2026-07-09');
    expect(
      individualVerificationDateOf({ ...DENUE_ONLY, communityConfirmedAt: '2026-07-08' }),
    ).toBe('2026-07-08');
    expect(
      individualVerificationDateOf({ ...DENUE_ONLY, evidenceObservedAt: '2026-07-07' }),
    ).toBe('2026-07-07');
  });
});

describe('verificationTextLocalized (7 idiomas)', () => {
  it('un registro SOLO-DENUE nunca muestra la etiqueta de "Verificado el"', () => {
    for (const locale of SUPPORTED_LOCALES) {
      const text = verificationTextLocalized(DENUE_ONLY, locale);
      // Nunca el template de verificación individual con la fecha del dataset.
      const months = translateIn(locale, 'format.months').split('|');
      const date = translateIn(locale, 'format.date', {
        day: 1,
        month: months[6],
        year: 2026,
      });
      const verifiedOn = translateIn(locale, 'place.verifiedOn', { date });
      expect(text).not.toBe(verifiedOn);
      expect(text).toBe(translateIn(locale, 'place.datasetUpdated', { date }));
      expect(text.length).toBeGreaterThan(0);
      expect(text).not.toContain('{date}');
    }
  });

  it('una verificación individual real sí muestra "Verificado el"', () => {
    for (const locale of SUPPORTED_LOCALES) {
      const text = verificationTextLocalized(
        { ...DENUE_ONLY, canonicalVerifiedAt: '2026-07-10T00:00:00.000Z' },
        locale,
      );
      expect(text).toBe(
        translateIn(locale, 'place.verifiedOn', {
          date: translateIn(locale, 'format.date', {
            day: 10,
            month: translateIn(locale, 'format.months').split('|')[6],
            year: 2026,
          }),
        }),
      );
    }
  });

  it('sin ninguna fecha → "Horario/verificación no disponible"', () => {
    for (const locale of SUPPORTED_LOCALES) {
      expect(
        verificationTextLocalized({ status: 'unverified', confidence: 0.3 }, locale),
      ).toBe(translateIn(locale, 'place.verifiedUnknown'));
    }
  });
});

describe('sourceLabelLocalized (7 idiomas)', () => {
  it('DENUE se etiqueta como INEGI DENUE, nunca como texto crudo "denue"', () => {
    for (const locale of SUPPORTED_LOCALES) {
      const label = sourceLabelLocalized(denuePlace(), locale);
      expect(label).toContain('INEGI DENUE');
      expect(label).not.toBe('denue');
    }
  });
});

describe('ranking sin verificación inventada', () => {
  it('un lugar SOLO-DENUE nunca recibe la razón RECENTLY_VERIFIED', () => {
    const now = new Date('2026-07-02T12:00:00Z'); // un día tras la edición
    const scored = scorePlace(denuePlace(), { latitude: 24.8069, longitude: -107.394 }, now);
    expect(scored.reasons).not.toContain('RECENTLY_VERIFIED');
  });

  it('una verificación individual reciente sí la recibe', () => {
    const now = new Date('2026-07-02T12:00:00Z');
    const scored = scorePlace(
      denuePlace({ ...DENUE_ONLY, canonicalVerifiedAt: '2026-07-01T00:00:00.000Z' }),
      { latitude: 24.8069, longitude: -107.394 },
      now,
    );
    expect(scored.reasons).toContain('RECENTLY_VERIFIED');
  });
});
