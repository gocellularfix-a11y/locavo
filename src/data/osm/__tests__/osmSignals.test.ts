import {
  parseDelivery,
  parseOpeningHours,
  parseWheelchair,
  parseYesNo,
} from '../osmSignals';

// Índice canónico weekly: 0=domingo … 6=sábado.
const SUN = 0;
const MON = 1;
const FRI = 5;
const SAT = 6;

describe('parseOpeningHours — subconjunto soportado, todo-o-nada', () => {
  it('días no mencionados → null; mencionados → intervalos', () => {
    const h = parseOpeningHours('Mo-Fr 09:00-17:00');
    expect(h).not.toBeNull();
    expect(h!.weekly[MON]).toEqual([{ open: '09:00', close: '17:00' }]);
    expect(h!.weekly[FRI]).toEqual([{ open: '09:00', close: '17:00' }]);
    // Sábado y domingo NO mencionados → null (nunca [] "cerrado").
    expect(h!.weekly[SAT]).toBeNull();
    expect(h!.weekly[SUN]).toBeNull();
  });

  it('off/closed explícito → [] (cerrado)', () => {
    const h = parseOpeningHours('Mo-Sa 08:00-20:00; Su off');
    expect(h!.weekly[SUN]).toEqual([]);
    expect(h!.weekly[MON]).toEqual([{ open: '08:00', close: '20:00' }]);
  });

  it('múltiples intervalos por día', () => {
    const h = parseOpeningHours('Mo 08:00-14:00,16:00-20:00');
    expect(h!.weekly[MON]).toEqual([
      { open: '08:00', close: '14:00' },
      { open: '16:00', close: '20:00' },
    ]);
  });

  it('cruce de medianoche (close <= open)', () => {
    const h = parseOpeningHours('Fr 20:00-02:00');
    expect(h!.weekly[FRI]).toEqual([{ open: '20:00', close: '02:00' }]);
  });

  it('24/7 → todos los días 00:00-00:00', () => {
    const h = parseOpeningHours('24/7');
    for (let d = 0; d < 7; d++) {
      expect(h!.weekly[d]).toEqual([{ open: '00:00', close: '00:00' }]);
    }
  });

  it('sin selector de días → aplica a todos los días', () => {
    const h = parseOpeningHours('10:00-18:00');
    for (let d = 0; d < 7; d++) {
      expect(h!.weekly[d]).toEqual([{ open: '10:00', close: '18:00' }]);
    }
  });

  it.each([
    ['PH off'],
    ['Mo-Fr 09:00-17:00; PH 10:00-14:00'],
    ['Mo-Fr sunrise-sunset'],
    ['Jan-Mar 09:00-17:00'],
    ['Mo 08:00+'],
    ['Mo 09:00-17:00 || Tu off'],
    ['"by appointment"'],
    ['Mo 24:00-25:00'],
    ['Mo'],
    ['garbage'],
  ])('expresión no soportada → null: %s', (expr) => {
    expect(parseOpeningHours(expr)).toBeNull();
  });

  it('contradicción (intervalos + off el mismo día) → null', () => {
    expect(parseOpeningHours('Mo 09:00-17:00; Mo off')).toBeNull();
  });
});

describe('booleanos — ausente/unknown/limited nunca es false', () => {
  it('parseYesNo', () => {
    expect(parseYesNo('yes')).toBe(true);
    expect(parseYesNo('no')).toBe(false);
    expect(parseYesNo(undefined)).toBeUndefined();
    expect(parseYesNo('limited')).toBeUndefined();
    expect(parseYesNo('maybe')).toBeUndefined();
  });

  it('wheelchair: yes→true; no/limited→SOLO diagnóstico (no false)', () => {
    expect(parseWheelchair('yes')).toEqual({ value: true });
    expect(parseWheelchair('no')).toEqual({ diagnostic: 'no' });
    expect(parseWheelchair('limited')).toEqual({ diagnostic: 'limited' });
    expect(parseWheelchair(undefined)).toEqual({});
  });

  it('delivery: limited/only → undefined', () => {
    expect(parseDelivery('yes')).toBe(true);
    expect(parseDelivery('no')).toBe(false);
    expect(parseDelivery('limited')).toBeUndefined();
    expect(parseDelivery('only')).toBeUndefined();
  });
});
