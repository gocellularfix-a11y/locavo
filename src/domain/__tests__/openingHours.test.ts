import {
  evaluateOpenStatus,
  formatTime12h,
  minutesToTime,
  parseTimeToMinutes,
  toCuliacanLocal,
} from '../openingHours';
import type { OpeningHours } from '../place';

/**
 * Referencias horarias (Culiacán = UTC-7 fijo, sin horario de verano):
 * - 2026-07-15T19:30:00Z → miércoles 12:30 local (día 3).
 * - 2026-07-18T08:00:00Z → sábado 01:00 local (día 6).
 */
const WED_1230 = new Date('2026-07-15T19:30:00Z');
const SAT_0100 = new Date('2026-07-18T08:00:00Z');
const SAT_0230 = new Date('2026-07-18T09:30:00Z');

const day = (open: string, close: string) => [{ open, close }];

function week(template: Partial<Record<number, ReturnType<typeof day> | [] | null>>): OpeningHours {
  const weekly = Array.from({ length: 7 }, (_, i) =>
    i in template ? (template[i] ?? null) : day('09:00', '18:00'),
  );
  return { weekly };
}

describe('toCuliacanLocal', () => {
  it('convierte UTC a hora local de Culiacán (UTC-7)', () => {
    expect(toCuliacanLocal(WED_1230)).toEqual({ day: 3, minutes: 12 * 60 + 30 });
    expect(toCuliacanLocal(SAT_0100)).toEqual({ day: 6, minutes: 60 });
  });
});

describe('parseTimeToMinutes', () => {
  it('convierte HH:mm válido', () => {
    expect(parseTimeToMinutes('00:00')).toBe(0);
    expect(parseTimeToMinutes('23:59')).toBe(23 * 60 + 59);
  });

  it('rechaza formatos inválidos', () => {
    expect(() => parseTimeToMinutes('24:00')).toThrow();
    expect(() => parseTimeToMinutes('9:00')).toThrow();
    expect(() => parseTimeToMinutes('abc')).toThrow();
  });
});

describe('evaluateOpenStatus', () => {
  it('horario nulo → no confirmado', () => {
    expect(evaluateOpenStatus(null, WED_1230)).toEqual({ state: 'unknown' });
  });

  it('abierto dentro de un intervalo normal, con hora de cierre', () => {
    const hours = week({ 3: day('12:00', '23:00') });
    expect(evaluateOpenStatus(hours, WED_1230)).toEqual({ state: 'open', closesAt: '23:00' });
  });

  it('cerrado fuera del intervalo', () => {
    const hours = week({ 3: day('13:00', '23:00') });
    expect(evaluateOpenStatus(hours, WED_1230)).toEqual({ state: 'closed' });
  });

  it('día sin horario ([]) → cerrado', () => {
    const hours = week({ 3: [] });
    expect(evaluateOpenStatus(hours, WED_1230)).toEqual({ state: 'closed' });
  });

  it('día con horario null → no confirmado', () => {
    const hours = week({ 3: null });
    expect(evaluateOpenStatus(hours, WED_1230)).toEqual({ state: 'unknown' });
  });

  it('intervalo que cruza medianoche sigue abierto de madrugada', () => {
    // Viernes (5) 20:00–02:00; sábado 01:00 local sigue abierto.
    const hours = week({ 5: day('20:00', '02:00'), 6: [] });
    expect(evaluateOpenStatus(hours, SAT_0100)).toEqual({ state: 'open', closesAt: '02:00' });
    // A las 02:30 ya cerró (y el sábado no abre).
    expect(evaluateOpenStatus(hours, SAT_0230)).toEqual({ state: 'closed' });
  });

  it('cruce de medianoche activo domina sobre día actual null', () => {
    const hours = week({ 5: day('20:00', '02:00'), 6: null });
    expect(evaluateOpenStatus(hours, SAT_0100)).toEqual({ state: 'open', closesAt: '02:00' });
    expect(evaluateOpenStatus(hours, SAT_0230)).toEqual({ state: 'unknown' });
  });

  it('abierto 24 horas (00:00–00:00)', () => {
    const hours = week({ 3: day('00:00', '00:00') });
    expect(evaluateOpenStatus(hours, WED_1230)).toEqual({ state: 'open', closesAt: '00:00' });
  });
});

describe('formato de estado', () => {
  it('formatTime12h', () => {
    expect(formatTime12h('23:00')).toBe('11:00 p. m.');
    expect(formatTime12h('00:30')).toBe('12:30 a. m.');
    expect(formatTime12h('12:05')).toBe('12:05 p. m.');
  });

  it('minutesToTime', () => {
    expect(minutesToTime(0)).toBe('00:00');
    expect(minutesToTime(23 * 60 + 5)).toBe('23:05');
  });
});
