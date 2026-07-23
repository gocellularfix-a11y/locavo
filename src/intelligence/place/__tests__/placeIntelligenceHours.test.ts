import { buildPlaceIntelligence } from '../placeIntelligenceEngine';
import { daily, makePlace, weekly } from './fixtures';

const bestCodes = (name: string, category: 'coffee' | 'food' | 'nightlife', hours?: ReturnType<typeof daily>) =>
  buildPlaceIntelligence(makePlace({ category, name, hours })).bestTimes.map((b) => b.code);

describe('V5.8 — mejores momentos derivados de horario', () => {
  it('horario de desayuno ⇒ BREAKFAST', () => {
    expect(bestCodes('Café', 'coffee', daily('07:00', '11:00'))).toContain('BREAKFAST');
  });

  it('horario de comida ⇒ LUNCH', () => {
    expect(bestCodes('Restaurante', 'food', daily('13:00', '16:00'))).toContain('LUNCH');
  });

  it('horario de tarde-noche ⇒ EVENING', () => {
    expect(bestCodes('Bar', 'nightlife', daily('20:00', '23:00'))).toContain('EVENING');
  });

  it('horario que cruza medianoche ⇒ LATE_NIGHT (correctitud de overnight preservada)', () => {
    const codes = bestCodes('Club', 'nightlife', daily('20:00', '02:00'));
    expect(codes).toContain('LATE_NIGHT');
    expect(codes).toContain('EVENING');
  });

  it('horario ausente ⇒ bandas típicas de categoría (MEDIUM) sin WEEKDAY/WEEKEND', () => {
    const r = buildPlaceIntelligence(makePlace({ category: 'coffee', name: 'Café' }));
    const codes = r.bestTimes.map((b) => b.code);
    expect(codes).toEqual(expect.arrayContaining(['BREAKFAST', 'MORNING']));
    expect(codes).not.toContain('WEEKDAY');
    expect(codes).not.toContain('WEEKEND');
    expect(r.bestTimes.find((b) => b.code === 'BREAKFAST')?.confidence).toBe('MEDIUM');
  });

  it('un periodo cerrado NO se etiqueta como mejor momento', () => {
    // Café abierto solo por la tarde-noche: no debe afirmar desayuno/mañana.
    const codes = bestCodes('Café Nocturno', 'coffee', daily('18:00', '23:00'));
    expect(codes).not.toContain('BREAKFAST');
    expect(codes).not.toContain('MORNING');
  });

  it('horario solo de fin de semana ⇒ WEEKEND y no WEEKDAY', () => {
    const w = weekly([{ open: '10:00', close: '18:00' }], [], [], [], [], [], [{ open: '10:00', close: '18:00' }]);
    const codes = buildPlaceIntelligence(makePlace({ category: 'food', name: 'Mercado', hours: w })).bestTimes.map((b) => b.code);
    expect(codes).toContain('WEEKEND');
    expect(codes).not.toContain('WEEKDAY');
  });

  it('nunca infiere un momento fuera de las ventanas conocidas de apertura', () => {
    // food normalmente afín a LUNCH y DINNER; si solo abre al mediodía, DINNER se omite.
    const codes = bestCodes('Fonda', 'food', daily('12:00', '16:00'));
    expect(codes).toContain('LUNCH');
    expect(codes).not.toContain('DINNER');
  });
});

describe('V5.8 — accesibilidad (estado desconocido)', () => {
  it('dato explícito de silla de ruedas se preserva con evidencia', () => {
    const r = buildPlaceIntelligence(makePlace({ category: 'food', features: { wheelchairAccessible: true } }));
    const a = r.accessibility.find((x) => x.code === 'WHEELCHAIR_ACCESSIBLE');
    expect(a?.confidence).toBe('HIGH');
    expect(a?.evidence[0]?.code).toBe('FEATURE_WHEELCHAIR_ACCESSIBLE');
  });

  it('accesibilidad ausente NO se trata como false', () => {
    const r = buildPlaceIntelligence(makePlace({ category: 'food' }));
    expect(r.accessibility.map((a) => a.code)).not.toContain('WHEELCHAIR_ACCESSIBLE');
    expect(r.accessibility).toEqual([]);
  });

  it('la categoría por sí sola no implica accesibilidad en silla de ruedas', () => {
    for (const category of ['food', 'coffee', 'pharmacy', 'store', 'lodging'] as const) {
      const r = buildPlaceIntelligence(makePlace({ category, name: 'X' }));
      expect(r.accessibility.map((a) => a.code)).not.toContain('WHEELCHAIR_ACCESSIBLE');
    }
  });

  it('estacionamiento y kid-friendly requieren evidencia explícita', () => {
    const none = buildPlaceIntelligence(makePlace({ category: 'food' }));
    expect(none.accessibility.map((a) => a.code)).not.toContain('GENERAL_PARKING');
    expect(none.accessibility.map((a) => a.code)).not.toContain('KID_FRIENDLY');
    const yes = buildPlaceIntelligence(makePlace({ category: 'food', features: { parking: true, familyFriendly: true } }));
    expect(yes.accessibility.map((a) => a.code)).toEqual(expect.arrayContaining(['GENERAL_PARKING', 'KID_FRIENDLY']));
  });

  it('accesibilidad explícitamente false se omite (no se emite ni como accesible ni inaccesible)', () => {
    const r = buildPlaceIntelligence(makePlace({ category: 'food', features: { wheelchairAccessible: false } }));
    expect(r.accessibility.map((a) => a.code)).not.toContain('WHEELCHAIR_ACCESSIBLE');
  });
});
