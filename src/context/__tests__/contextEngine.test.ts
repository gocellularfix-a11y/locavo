import { bandOfMinutes, evaluateContext, profileOf } from '../contextEngine';

describe('bandOfMinutes — fronteras deterministas', () => {
  it.each([
    [0, 'lateNight'],
    [359, 'lateNight'],
    [360, 'breakfast'],
    [659, 'breakfast'],
    [660, 'lunch'],
    [959, 'lunch'],
    [960, 'afternoon'],
    [1139, 'afternoon'],
    [1140, 'dinner'],
    [1319, 'dinner'],
    [1320, 'nightlife'],
    [1439, 'nightlife'],
  ])('minuto %i → %s', (minutes, band) => {
    expect(bandOfMinutes(minutes)).toBe(band);
  });
});

describe('profileOf — perfil por franja y fin de semana', () => {
  it('afternoon depende de fin de semana', () => {
    expect(profileOf('afternoon', true)).toBe('familyAfternoon');
    expect(profileOf('afternoon', false)).toBe('shopping');
  });
  it('el resto es independiente del fin de semana', () => {
    expect(profileOf('breakfast', false)).toBe('breakfast');
    expect(profileOf('lunch', true)).toBe('lunch');
    expect(profileOf('dinner', false)).toBe('dinner');
    expect(profileOf('nightlife', true)).toBe('nightlife');
    expect(profileOf('lateNight', false)).toBe('lateNight');
  });
});

describe('evaluateContext — hora local de Culiacán (UTC-7), determinista', () => {
  it('mañana entre semana → desayuno', () => {
    // 15:00 UTC → 08:00 local, miércoles 2026-07-22.
    const c = evaluateContext(new Date('2026-07-22T15:00:00.000Z'));
    expect(c.minutesOfDay).toBe(480);
    expect(c.timeBand).toBe('breakfast');
    expect(c.dayOfWeek).toBe(3);
    expect(c.isWeekend).toBe(false);
    expect(c.profile).toBe('breakfast');
    expect(c.isHoliday).toBe(false);
  });

  it('madrugada → lateNight', () => {
    // 09:00 UTC → 02:00 local.
    const c = evaluateContext(new Date('2026-07-22T09:00:00.000Z'));
    expect(c.minutesOfDay).toBe(120);
    expect(c.timeBand).toBe('lateNight');
    expect(c.profile).toBe('lateNight');
  });

  it('noche → nightlife', () => {
    // 05:30 UTC del jueves → 22:30 local del miércoles.
    const c = evaluateContext(new Date('2026-07-23T05:30:00.000Z'));
    expect(c.minutesOfDay).toBe(1350);
    expect(c.timeBand).toBe('nightlife');
    expect(c.profile).toBe('nightlife');
  });

  it('tarde de fin de semana → familyAfternoon', () => {
    // 00:00 UTC domingo → 17:00 local del sábado 2026-07-25.
    const c = evaluateContext(new Date('2026-07-26T00:00:00.000Z'));
    expect(c.dayOfWeek).toBe(6);
    expect(c.isWeekend).toBe(true);
    expect(c.timeBand).toBe('afternoon');
    expect(c.profile).toBe('familyAfternoon');
  });

  it('determinista: mismo instante → mismo contexto', () => {
    const d = new Date('2026-07-22T18:00:00.000Z');
    expect(evaluateContext(d)).toEqual(evaluateContext(d));
  });
});
