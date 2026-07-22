import { evaluateContext } from '../../../context';
import type { OpeningHours } from '../../../domain/place';
import type { LocavoCategory, LocavoPlace } from '../../../domain/places/LocavoPlace';
import type { PlaceRepository } from '../../../data/places/PlaceRepository';
import type { PlaceSearchResult } from '../../../data/places/PlaceSearchResult';
import { selectSurprisePlace } from '../../home/surprise';
import { retrieveRecommendationCandidates } from '../../../recommendationCandidates';
import { buildRecommendationModels } from '../../recommendations';
import { buildTodayModels } from '../todayModel';

const ORIGIN = { latitude: 24.8, longitude: -107.4 };
const latOff = (m: number) => m / 111320;
// 08:00 local (breakfast) miércoles → café con boost.
const BREAKFAST_NOW = new Date('2026-07-22T15:00:00.000Z');
const OPEN: OpeningHours = { weekly: Array.from({ length: 7 }, () => [{ open: '00:00', close: '00:00' }]) };

function place(id: string, category: LocavoCategory, meters: number, hours?: OpeningHours): LocavoPlace {
  const p: LocavoPlace = {
    id,
    sourceRefs: { denueId: id },
    name: `P ${id}`,
    normalizedName: `p ${id}`,
    category,
    coordinates: { latitude: ORIGIN.latitude + latOff(meters), longitude: ORIGIN.longitude },
    verification: { status: 'source_verified', confidence: 0.6 },
    provenance: [{ source: 'denue' }],
    status: { active: true },
    createdAt: '2026-07-01T00:00:00.000Z',
    updatedAt: '2026-07-01T00:00:00.000Z',
  };
  if (hours) p.hours = hours;
  return p;
}

function fakeRepo(places: LocavoPlace[]): PlaceRepository {
  const empty: PlaceSearchResult = { places: [], total: 0 };
  return {
    async getById(id) {
      return places.find((p) => p.id === id) ?? null;
    },
    async searchNearby() {
      return empty;
    },
    async searchText() {
      return empty;
    },
    async listByCategory(category, options) {
      const all = places.filter((p) => p.category === category);
      const limit = options?.limit ?? 20;
      const offset = options?.cursor ? Number.parseInt(options.cursor, 10) || 0 : 0;
      const page = all.slice(offset, offset + limit);
      const nextOffset = offset + page.length;
      return { places: page, total: all.length, nextCursor: nextOffset < all.length ? String(nextOffset) : undefined };
    },
  };
}

async function runToday(repoPlaces: LocavoPlace[]) {
  const { candidates } = await retrieveRecommendationCandidates({
    repository: fakeRepo(repoPlaces),
    origin: ORIGIN,
    safetyLimit: 100,
  });
  const { models } = buildRecommendationModels(
    { now: BREAKFAST_NOW, intent: 'surprise', origin: ORIGIN, preferences: { openNow: true }, maxResults: candidates.length },
    candidates,
  );
  const today = buildTodayModels(models, evaluateContext(BREAKFAST_NOW), 5);
  return { candidates, today };
}

// 150 lugares de comida lejanos + un café muy cercano y abierto ("star").
const STAR = place('star', 'coffee', 5, OPEN);
const CROWD = Array.from({ length: 150 }, (_, i) => place(`food${String(i).padStart(3, '0')}`, 'food', 20 + i * 10));

describe('Today via canonical retrieval (V5.3)', () => {
  it('un candidato cercano fuerte alcanza el ranking de Today (no truncado por hash)', async () => {
    const { candidates, today } = await runToday([...CROWD, STAR]);
    // Recuperación por distancia: el café más cercano SIEMPRE está en el pool.
    expect(candidates.some((c) => c.id === 'star')).toBe(true);
    // Y con boost de desayuno + cercanía, encabeza Today.
    expect(today[0].model.placeId).toBe('star');
    expect(today.length).toBeLessThanOrEqual(5);
  });

  it('el orden de los candidatos del repositorio no afecta a Today', async () => {
    const a = await runToday([...CROWD, STAR]);
    const b = await runToday([STAR, ...[...CROWD].reverse()]);
    expect(b.today.map((t) => t.model.placeId)).toEqual(a.today.map((t) => t.model.placeId));
  });

  it('flujo determinista: mismas entradas → mismos modelos de Today', async () => {
    const a = await runToday([...CROWD, STAR]);
    const b = await runToday([...CROWD, STAR]);
    expect(JSON.stringify(b.today)).toBe(JSON.stringify(a.today));
  });

  it('Surprise sigue funcionando de forma independiente y determinista', () => {
    const pool = [STAR, ...CROWD.slice(0, 5)];
    const random = () => 0; // fuente inyectable determinista
    const first = selectSurprisePlace(pool, { now: BREAKFAST_NOW, origin: ORIGIN, random });
    const second = selectSurprisePlace(pool, { now: BREAKFAST_NOW, origin: ORIGIN, random });
    expect(first).not.toBeNull();
    expect(second?.id).toBe(first?.id); // mismo random → mismo resultado
  });
});
