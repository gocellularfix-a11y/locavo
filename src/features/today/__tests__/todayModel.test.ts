import type { ContextSnapshot } from '../../../context';
import type { CategoryId } from '../../../domain/place';
import type { RecommendationCardModel } from '../../recommendations';
import { buildTodayModels } from '../todayModel';

const BREAKFAST: ContextSnapshot = {
  minutesOfDay: 480,
  dayOfWeek: 3,
  isWeekend: false,
  timeBand: 'breakfast',
  profile: 'breakfast',
  isHoliday: false,
};

function base(id: string, category: CategoryId, scoreTotal: number, rank: number): RecommendationCardModel {
  return {
    placeId: id,
    name: `P ${id}`,
    category,
    rank,
    stars: 4,
    scoreTotal,
    confidence: 'medium',
    badges: [],
    reasonKeys: ['rec.reason.intentMatch'],
    warningKeys: [],
    distanceKm: 0.1,
    openState: 'open',
  };
}

describe('buildTodayModels', () => {
  it('lista vacía → sin modelos', () => {
    expect(buildTodayModels([], BREAKFAST)).toEqual([]);
  });

  it('reordena por score contextual (café supera a comida con el mismo score base en desayuno)', () => {
    const models = buildTodayModels(
      [base('food', 'food', 0.7, 1), base('coffee', 'coffee', 0.7, 2)],
      BREAKFAST,
    );
    expect(models[0].model.placeId).toBe('coffee'); // 0.7 * 1.2 > 0.7 * 1.1
    expect(models[0].todayRank).toBe(1);
    expect(models[0].contextualScore).toBeCloseTo(0.84, 6);
  });

  it('fusiona razones de contexto en el modelo base y añade insignias', () => {
    const [coffee] = buildTodayModels([base('c', 'coffee', 0.7, 1)], BREAKFAST);
    expect(coffee.model.reasonKeys).toContain('rec.reason.intentMatch'); // base preservada
    expect(coffee.model.reasonKeys).toContain('ctx.reason.breakfast');
    expect(coffee.model.reasonKeys).toContain('ctx.reason.morningFavorite');
    expect(coffee.contextBadges).toContain('breakfast');
    expect(coffee.contextBadgeKeys).toContain('ctx.badge.breakfast');
  });

  it('categoría neutra: sin contexto, score contextual = score base', () => {
    const [gas] = buildTodayModels([base('g', 'gas', 0.5, 1)], BREAKFAST);
    expect(gas.contextBadges).toEqual([]);
    expect(gas.contextualScore).toBeCloseTo(0.5, 6);
    expect(gas.model.reasonKeys).toEqual(['rec.reason.intentMatch']);
  });

  it('respeta el límite y es determinista', () => {
    const input = Array.from({ length: 8 }, (_, i) => base(`p${i}`, 'food', 0.5 + i * 0.01, i + 1));
    const a = buildTodayModels(input, BREAKFAST, 5);
    const b = buildTodayModels(input, BREAKFAST, 5);
    expect(a).toHaveLength(5);
    expect(JSON.stringify(b)).toBe(JSON.stringify(a));
  });
});
