import {
  createSuggestionRotator,
  nextSuggestionIndex,
  SUGGESTION_INTERVAL_MS,
  suggestionTransition,
} from '../suggestionRotator';

describe('createSuggestionRotator (limpieza de temporizadores)', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it('avanza en la cadencia configurada mientras está activo', () => {
    const onAdvance = jest.fn();
    const rotator = createSuggestionRotator(onAdvance);
    rotator.start();
    jest.advanceTimersByTime(SUGGESTION_INTERVAL_MS * 3);
    expect(onAdvance).toHaveBeenCalledTimes(3);
    rotator.stop();
  });

  it('la cadencia respeta el rango 3.5–4.5 s del milestone', () => {
    expect(SUGGESTION_INTERVAL_MS).toBeGreaterThanOrEqual(3_500);
    expect(SUGGESTION_INTERVAL_MS).toBeLessThanOrEqual(4_500);
  });

  it('stop limpia el intervalo: no quedan avances pendientes', () => {
    const onAdvance = jest.fn();
    const rotator = createSuggestionRotator(onAdvance);
    rotator.start();
    expect(rotator.running).toBe(true);
    rotator.stop();
    expect(rotator.running).toBe(false);
    jest.advanceTimersByTime(SUGGESTION_INTERVAL_MS * 10);
    expect(onAdvance).not.toHaveBeenCalled();
    expect(jest.getTimerCount()).toBe(0);
  });

  it('start repetido no duplica temporizadores (volver de segundo plano)', () => {
    const onAdvance = jest.fn();
    const rotator = createSuggestionRotator(onAdvance);
    rotator.start();
    rotator.start();
    rotator.start();
    jest.advanceTimersByTime(SUGGESTION_INTERVAL_MS);
    expect(onAdvance).toHaveBeenCalledTimes(1);
    rotator.stop();
    expect(jest.getTimerCount()).toBe(0);
  });
});

describe('nextSuggestionIndex', () => {
  it('rota circularmente', () => {
    expect(nextSuggestionIndex(0, 4)).toBe(1);
    expect(nextSuggestionIndex(3, 4)).toBe(0);
  });

  it('tolera listas vacías', () => {
    expect(nextSuggestionIndex(0, 0)).toBe(0);
  });
});

describe('suggestionTransition (movimiento reducido)', () => {
  it('con movimiento reducido no hay animación ni desplazamiento', () => {
    expect(suggestionTransition(true)).toEqual({ fadeMs: 0, translate: 0, animated: false });
  });

  it('sin movimiento reducido usa fundido corto y desplazamiento sutil', () => {
    const transition = suggestionTransition(false);
    expect(transition.animated).toBe(true);
    expect(transition.fadeMs).toBeGreaterThan(0);
    expect(transition.fadeMs).toBeLessThanOrEqual(250);
    expect(Math.abs(transition.translate)).toBeLessThanOrEqual(8);
  });
});
