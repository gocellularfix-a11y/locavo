import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';

import { SEARCH_DEBOUNCE_MS, useSearchQuery, type SearchQueryController } from '../useSearchQuery';

function renderSearchQuery(initial = ''): { current: SearchQueryController } {
  const ref = { current: null as unknown as SearchQueryController };
  function Probe(): null {
    ref.current = useSearchQuery(initial);
    return null;
  }
  act(() => {
    TestRenderer.create(React.createElement(Probe));
  });
  return ref;
}

describe('useSearchQuery (UX-S1) — debounce / flush / clear', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('escribir actualiza el texto de inmediato pero la consulta activa con debounce', () => {
    const q = renderSearchQuery('');
    act(() => q.current.setQuery('taco'));
    expect(q.current.query).toBe('taco');
    expect(q.current.activeQuery).toBe(''); // aún no

    act(() => jest.advanceTimersByTime(SEARCH_DEBOUNCE_MS - 1));
    expect(q.current.activeQuery).toBe(''); // antes del umbral, no dispara

    act(() => jest.advanceTimersByTime(1));
    expect(q.current.activeQuery).toBe('taco'); // tras el debounce
  });

  it('pulsar Buscar ejecuta de inmediato sin esperar el debounce (flush)', () => {
    const q = renderSearchQuery('');
    act(() => q.current.setQuery('starbucks'));
    act(() => q.current.submit());
    expect(q.current.activeQuery).toBe('starbucks'); // sin avanzar timers
  });

  it('limpiar (X) reinicia texto y consulta al instante → Decision Mode', () => {
    const q = renderSearchQuery('walmart');
    act(() => q.current.clear());
    expect(q.current.query).toBe('');
    expect(q.current.activeQuery).toBe('');
  });

  it('vaciar el texto aplica de inmediato (no espera el debounce)', () => {
    const q = renderSearchQuery('');
    act(() => q.current.setQuery('cafe'));
    act(() => jest.advanceTimersByTime(SEARCH_DEBOUNCE_MS));
    expect(q.current.activeQuery).toBe('cafe');
    act(() => q.current.setQuery(''));
    expect(q.current.activeQuery).toBe(''); // inmediato, sin timers
  });

  it('tecleo rápido: solo la última consulta se vuelve activa (debounce colapsa)', () => {
    const q = renderSearchQuery('');
    act(() => q.current.setQuery('t'));
    act(() => jest.advanceTimersByTime(100));
    act(() => q.current.setQuery('ta'));
    act(() => jest.advanceTimersByTime(100));
    act(() => q.current.setQuery('tac'));
    expect(q.current.activeQuery).toBe(''); // nada disparó todavía
    act(() => jest.advanceTimersByTime(SEARCH_DEBOUNCE_MS));
    expect(q.current.activeQuery).toBe('tac'); // solo la última
  });
});
