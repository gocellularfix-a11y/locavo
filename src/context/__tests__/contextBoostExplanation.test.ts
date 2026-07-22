import { contextMultiplier } from '../contextBoost';
import type { ContextSnapshot } from '../contextEngine';
import { contextBadgesFor, contextReasonCodes, isContextuallyRelevant } from '../contextExplanation';

function snap(profile: ContextSnapshot['profile'], isWeekend = false): ContextSnapshot {
  return { minutesOfDay: 0, dayOfWeek: isWeekend ? 6 : 3, isWeekend, timeBand: 'breakfast', profile, isHoliday: false };
}

describe('contextMultiplier — boosts por categoría (nunca por negocio)', () => {
  it('desayuno: café sube, vida nocturna baja, neutro = 1', () => {
    expect(contextMultiplier('breakfast', 'coffee')).toBeGreaterThan(1);
    expect(contextMultiplier('breakfast', 'nightlife')).toBeLessThan(1);
    expect(contextMultiplier('breakfast', 'gas')).toBe(1);
  });
  it('comida sube food; noche sube nightlife/beer', () => {
    expect(contextMultiplier('lunch', 'food')).toBeGreaterThan(1);
    expect(contextMultiplier('nightlife', 'nightlife')).toBeGreaterThan(1);
    expect(contextMultiplier('nightlife', 'beer')).toBeGreaterThan(1);
  });
});

describe('contextReasonCodes / badges — deterministas y estructurados', () => {
  it('categoría no favorecida → sin códigos ni insignias', () => {
    expect(isContextuallyRelevant(snap('breakfast'), 'gas')).toBe(false);
    expect(contextReasonCodes(snap('breakfast'), 'gas')).toEqual([]);
    expect(contextBadgesFor(snap('breakfast'), 'gas', 'open')).toEqual([]);
  });

  it('desayuno + café → CTX_BREAKFAST + CTX_MORNING_FAVORITE', () => {
    const codes = contextReasonCodes(snap('breakfast'), 'coffee');
    expect(codes).toContain('CTX_BREAKFAST');
    expect(codes).toContain('CTX_MORNING_FAVORITE');
    expect(contextBadgesFor(snap('breakfast'), 'coffee', 'open')).toContain('breakfast');
  });

  it('noche abierta → insignia openLate', () => {
    expect(contextBadgesFor(snap('nightlife'), 'nightlife', 'open')).toContain('openLate');
    expect(contextBadgesFor(snap('nightlife'), 'nightlife', 'closed')).not.toContain('openLate');
  });

  it('fin de semana en perfil familiar → CTX_WEEKEND_PICK + familyTime', () => {
    const s = snap('familyAfternoon', true);
    expect(contextReasonCodes(s, 'food')).toContain('CTX_WEEKEND_PICK');
    const badges = contextBadgesFor(s, 'food', 'open');
    expect(badges).toContain('familyTime');
    expect(badges).toContain('weekendPick');
  });

  it('sin duplicados', () => {
    const codes = contextReasonCodes(snap('breakfast', true), 'coffee');
    expect(new Set(codes).size).toBe(codes.length);
  });
});
