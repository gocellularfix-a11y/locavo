import {
  adjustForAgreement,
  baseConfidenceOf,
  categoriesForIntent,
  intentMatchesCategory,
  isRecommendationIntent,
  normalizeContext,
  InvalidContextError,
  weakestConfidence,
  RECOMMENDATION_INTENTS,
} from '../index';
import type { PlaceVerification } from '../../domain/places/LocavoPlace';
import { NOW, ORIGIN } from './helpers';

describe('intent model', () => {
  it('mapea intenciones a categorías canónicas', () => {
    expect(categoriesForIntent('coffee')).toEqual(['coffee']);
    expect(categoriesForIntent('hotel')).toEqual(['lodging']);
    expect(categoriesForIntent('shopping')).toEqual(['store']);
    expect(categoriesForIntent('surprise')).toHaveLength(8);
  });

  it('intentMatchesCategory es estable', () => {
    expect(intentMatchesCategory('coffee', 'coffee')).toBe(true);
    expect(intentMatchesCategory('coffee', 'food')).toBe(false);
    expect(intentMatchesCategory('surprise', 'gas')).toBe(true);
  });

  it('valida intenciones soportadas', () => {
    expect(isRecommendationIntent('food')).toBe(true);
    expect(isRecommendationIntent('breakfast')).toBe(false);
    expect(RECOMMENDATION_INTENTS).toContain('surprise');
  });
});

describe('confidence model', () => {
  const v = (status: PlaceVerification['status']): PlaceVerification => ({ status, confidence: 0.5 });

  it('confianza base por fuente/verificación', () => {
    expect(baseConfidenceOf('denue', v('source_verified'))).toBe('medium');
    expect(baseConfidenceOf('denue', v('unverified'))).toBe('low');
    expect(baseConfidenceOf('mock', v('unverified'))).toBe('unknown');
    expect(baseConfidenceOf('owner', v('owner_verified'))).toBe('high');
  });

  it('conflicto baja (no bajo low); acuerdo sube (tope high)', () => {
    expect(adjustForAgreement('medium', { conflict: true })).toBe('low');
    expect(adjustForAgreement('low', { conflict: true })).toBe('low');
    expect(adjustForAgreement('medium', { agreeingSources: 2 })).toBe('high');
    expect(adjustForAgreement('high', { agreeingSources: 3 })).toBe('high');
  });

  it('weakestConfidence es conservador', () => {
    expect(weakestConfidence(['high', 'low', 'medium'])).toBe('low');
    expect(weakestConfidence([])).toBe('unknown');
  });
});

describe('context normalization', () => {
  it('acepta contexto válido y aplica defaults', () => {
    const n = normalizeContext({ now: NOW, intent: 'food', origin: ORIGIN });
    expect(n.origin).toEqual(ORIGIN);
    expect(n.maxResults).toBe(20);
    expect(n.seed).toBe(0);
    expect(n.constraints).toEqual({});
  });

  it('coordenadas inválidas → origin null (no lanza)', () => {
    const n = normalizeContext({ now: NOW, intent: 'food', origin: { latitude: 999, longitude: 0 } });
    expect(n.origin).toBeNull();
  });

  it('clampa maxResults al tope y a >= 0', () => {
    expect(normalizeContext({ now: NOW, intent: 'food', maxResults: 5000 }).maxResults).toBe(100);
    expect(normalizeContext({ now: NOW, intent: 'food', maxResults: -3 }).maxResults).toBe(0);
  });

  it('now inválido y radio <= 0 lanzan', () => {
    expect(() => normalizeContext({ now: new Date('nope'), intent: 'food' })).toThrow(InvalidContextError);
    expect(() => normalizeContext({ now: NOW, intent: 'food', radiusMeters: 0 })).toThrow(InvalidContextError);
  });
});
