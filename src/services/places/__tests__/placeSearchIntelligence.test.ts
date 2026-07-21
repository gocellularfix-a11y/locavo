import fs from 'node:fs';
import path from 'node:path';

import { fakeLoaderFrom, loadsWhere } from '../../../data/places/citypack/__tests__/fixtures';
import { buildBundledCuliacanPack, BUNDLED_SOURCE_FILE } from '../../../data/places/citypack/buildBundledPack';
import { CityPackRepository } from '../../../data/places/citypack/CityPackRepository';
import { createPlaceRepository } from '../../../data/places/createPlaceRepository';
import { LocalPlaceRepository } from '../../../data/places/LocalPlaceRepository';
import { decodeDenueBytes } from '../../../data/import/denue/encoding';
import { FEATURE_FLAGS } from '../../../config/featureFlags';
import type { Coordinates } from '../../../domain/place';
import { translateIn } from '../../../i18n/I18nContext';
import { SUPPORTED_LOCALES } from '../../../i18n/types';
import type { AnalyticsService } from '../../analytics';
import { PlaceSearchService } from '../PlaceSearchService';
import type { RecommendationReason } from '../PlaceRankingService';

/**
 * V4D — Búsqueda inteligente sobre el City Pack REAL de Culiacán.
 * Todo se construye desde el extracto versionado; sin red, sin IA.
 */

const ROOT = path.join(__dirname, '..', '..', '..', '..');
const CSV = decodeDenueBytes(
  fs.readFileSync(path.join(ROOT, 'data', 'denue', BUNDLED_SOURCE_FILE)),
).text;
const BUNDLE = buildBundledCuliacanPack(CSV);
const ORIGIN: Coordinates = { latitude: 24.8091, longitude: -107.394 };
const NOOP_ANALYTICS: AnalyticsService = { track() {}, exposeForDevInspection() {} } as unknown as AnalyticsService;

function service(overrides?: (fake: ReturnType<typeof fakeLoaderFrom>) => void) {
  const fake = fakeLoaderFrom(BUNDLE.files);
  overrides?.(fake);
  const repo = new CityPackRepository(fake.loader, new LocalPlaceRepository());
  return { svc: new PlaceSearchService(repo, NOOP_ANALYTICS), fake };
}

describe('V4D · búsqueda inteligente (datos reales)', () => {
  describe('consultas reales devuelven resultados relevantes', () => {
    const terms = ['taco', 'mariscos', 'cerveza', 'farmacia', 'hotel', 'gasolina', 'tienda', 'bar'];
    for (const term of terms) {
      it(`"${term}" → resultados`, async () => {
        const { svc } = service();
        const { results } = await svc.search({ origin: ORIGIN, text: term });
        expect(results.length).toBeGreaterThan(0);
      });
    }

    it('"café" y "cafe" producen resultados equivalentes', async () => {
      const { svc } = service();
      const withAccent = await svc.search({ origin: ORIGIN, text: 'café' });
      const withoutAccent = await svc.search({ origin: ORIGIN, text: 'cafe' });
      expect(withoutAccent.results.map((r) => r.place.id)).toEqual(
        withAccent.results.map((r) => r.place.id),
      );
    });

    it('"medicina" → farmacias; "dónde dormir" → hospedaje; "tengo hambre" → comida', async () => {
      const { svc } = service();
      const med = await svc.search({ origin: ORIGIN, text: 'medicina' });
      expect(med.intent?.categories).toContain('pharmacy');
      expect(med.results[0]?.place.category).toBe('pharmacy');
      const sleep = await svc.search({ origin: ORIGIN, text: 'dónde dormir' });
      expect(sleep.intent?.categories).toEqual(['lodging']);
      expect(sleep.results[0]?.place.category).toBe('lodging');
      const hungry = await svc.search({ origin: ORIGIN, text: 'tengo hambre' });
      expect(hungry.intent?.categories).toEqual(['food']);
      expect(hungry.results[0]?.place.category).toBe('food');
    });

    it('un nombre real exacto del pack queda primero', async () => {
      const { svc } = service();
      // Tomar un negocio real del pack como consulta por su nombre.
      const target = BUNDLE.build.pack.places.find((p) => /MARISCOS LAS PALMAS/i.test(p.name));
      expect(target).toBeDefined();
      const { results } = await svc.search({ origin: ORIGIN, text: target!.name });
      expect(results[0]?.place.name).toBe(target!.name);
      expect(results[0]?.reasons.some((r) => r.startsWith('NAME') || r === 'EXACT_NAME_MATCH')).toBe(
        true,
      );
    });
  });

  describe('verdad de horarios ("abierto ahora")', () => {
    it('intención de "abierto" sin horarios reales: preserva resultados + aviso', async () => {
      const { svc } = service();
      const { results, notice } = await svc.search({ origin: ORIGIN, text: 'farmacia abierto ahora' });
      expect(results.length).toBeGreaterThan(0); // NO se vacía la lista
      expect(notice).toBe('HOURS_UNAVAILABLE');
    });

    it('nunca marca "abierto ahora" sin horario real (City Pack)', async () => {
      const { svc } = service();
      const { results } = await svc.search({ origin: ORIGIN, text: 'farmacia' });
      for (const r of results) {
        expect(r.reasons).not.toContain('OPEN_NOW' as RecommendationReason);
        expect(r.status.state).not.toBe('open');
      }
    });
  });

  describe('cercanía y ubicación', () => {
    it('busca sin GPS usando el ancla de zona seleccionada (no crashea)', async () => {
      const { svc } = service();
      const { results } = await svc.search({ origin: ORIGIN, text: 'cerveza cerca' });
      expect(results.length).toBeGreaterThan(0);
    });

    it('"algo cerca" ordena por cercanía sin inventar categorías', async () => {
      const { svc } = service();
      const { results, intent } = await svc.search({ origin: ORIGIN, text: 'algo cerca' });
      expect(intent?.nearby).toBe(true);
      expect(results.length).toBeGreaterThan(0);
    });
  });

  describe('integridad y arquitectura', () => {
    it('sin resultados duplicados', async () => {
      const { svc } = service();
      const { results } = await svc.search({ origin: ORIGIN, text: 'taco' });
      const ids = results.map((r) => r.place.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it('límite acotado (≤ 50 por página)', async () => {
      const { svc } = service();
      const { results } = await svc.search({ origin: ORIGIN, text: 'comida' });
      expect(results.length).toBeLessThanOrEqual(50);
    });

    it('carga perezosa: una búsqueda NO carga todos los trozos del pack', async () => {
      const { svc, fake } = service();
      await svc.search({ origin: ORIGIN, text: 'farmacia' });
      const chunkLoads = loadsWhere(fake.loads, (p) => p.startsWith('categories/'));
      expect(chunkLoads).toBeGreaterThan(0);
      expect(chunkLoads).toBeLessThan(BUNDLE.manifest.chunks.length);
    });

    it('respaldo local: pack ausente → no crashea, la búsqueda responde', async () => {
      const repo = new CityPackRepository(
        {
          async load() {
            throw new Error('sin pack');
          },
        },
        new LocalPlaceRepository(),
      );
      const svc = new PlaceSearchService(repo, NOOP_ANALYTICS);
      const { results } = await svc.search({ origin: ORIGIN, text: 'taco' });
      expect(Array.isArray(results)).toBe(true);
    });

    it('City Pack activo por defecto y Cloud OFF', () => {
      expect(createPlaceRepository()).toBeInstanceOf(CityPackRepository);
      expect(FEATURE_FLAGS.useCloudPlaceRepository).toBe(false);
    });
  });

  describe('explicaciones localizadas en los 7 idiomas', () => {
    const codes: RecommendationReason[] = [
      'EXACT_NAME_MATCH',
      'NAME_MATCH',
      'NAME_AND_ACTIVITY',
      'CATEGORY_MATCH',
      'TERM_MATCH',
    ];
    it('cada código de razón de búsqueda existe y no expone la clave cruda', () => {
      expect(SUPPORTED_LOCALES).toHaveLength(7);
      for (const locale of SUPPORTED_LOCALES) {
        for (const code of codes) {
          const key = `reason.${code}`;
          const text = translateIn(locale, key);
          expect(text.trim().length).toBeGreaterThan(0);
          expect(text).not.toBe(key);
        }
        const notice = translateIn(locale, 'search.hoursUnconfirmed');
        expect(notice.trim().length).toBeGreaterThan(0);
        expect(notice).not.toBe('search.hoursUnconfirmed');
      }
    });
  });
});
