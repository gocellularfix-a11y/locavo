import { getPreferredCategories, getTimeOfDayContext } from '../timeOfDay';

/** Fecha local con la hora indicada (la franja usa la hora del dispositivo). */
function at(hour: number, minute = 0): Date {
  return new Date(2026, 6, 15, hour, minute, 0, 0);
}

describe('getTimeOfDayContext (hora local del dispositivo)', () => {
  it('mañana: 05:00–10:59', () => {
    expect(getTimeOfDayContext(at(5))).toBe('morning');
    expect(getTimeOfDayContext(at(8, 30))).toBe('morning');
    expect(getTimeOfDayContext(at(10, 59))).toBe('morning');
  });

  it('comida: 11:00–14:59', () => {
    expect(getTimeOfDayContext(at(11))).toBe('lunch');
    expect(getTimeOfDayContext(at(13, 15))).toBe('lunch');
    expect(getTimeOfDayContext(at(14, 59))).toBe('lunch');
  });

  it('tarde: 15:00–17:59', () => {
    expect(getTimeOfDayContext(at(15))).toBe('afternoon');
    expect(getTimeOfDayContext(at(17, 45))).toBe('afternoon');
  });

  it('noche: 18:00–22:59', () => {
    expect(getTimeOfDayContext(at(18))).toBe('evening');
    expect(getTimeOfDayContext(at(22, 59))).toBe('evening');
  });

  it('madrugada: 23:00–04:59', () => {
    expect(getTimeOfDayContext(at(23))).toBe('lateNight');
    expect(getTimeOfDayContext(at(0))).toBe('lateNight');
    expect(getTimeOfDayContext(at(4, 59))).toBe('lateNight');
  });
});

describe('getPreferredCategories (solo categorías canónicas)', () => {
  const CANONICAL = ['food', 'beer', 'coffee', 'lodging', 'pharmacy', 'gas', 'store', 'nightlife'];

  it('mañana prefiere café, comida y farmacia', () => {
    expect(getPreferredCategories('morning')).toEqual(['coffee', 'food', 'pharmacy']);
  });

  it('comida prefiere comida y café', () => {
    expect(getPreferredCategories('lunch')).toEqual(['food', 'coffee']);
  });

  it('tarde prefiere café, comida y cerveza', () => {
    expect(getPreferredCategories('afternoon')).toEqual(['coffee', 'food', 'beer']);
  });

  it('noche prefiere comida, cerveza, vida nocturna y hospedaje', () => {
    expect(getPreferredCategories('evening')).toEqual(['food', 'beer', 'nightlife', 'lodging']);
  });

  it('madrugada prefiere comida, cerveza, hospedaje, farmacia y gasolinera', () => {
    expect(getPreferredCategories('lateNight')).toEqual([
      'food',
      'beer',
      'lodging',
      'pharmacy',
      'gas',
    ]);
  });

  it('nunca inventa categorías fuera del catálogo canónico', () => {
    for (const timeOfDay of ['morning', 'lunch', 'afternoon', 'evening', 'lateNight'] as const) {
      for (const category of getPreferredCategories(timeOfDay)) {
        expect(CANONICAL).toContain(category);
      }
    }
  });
});
