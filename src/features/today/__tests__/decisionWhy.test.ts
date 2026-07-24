import { es } from '../../../i18n/locales/es';
import type { TranslationKey } from '../../../i18n/locales/es';
import {
  buildDecisionWhyKeys,
  composeDecisionWhy,
  DECISION_WHY_ORDER,
  MAX_WHY_FRAGMENTS,
} from '../decisionWhy';

/** Traductor de prueba: devuelve el texto real de `es` (o el eco de la clave). */
const translate = (key: TranslationKey, params?: Record<string, string | number>): string => {
  const raw = (es as Record<string, string>)[key] ?? key;
  if (!params) {
    return raw;
  }
  return raw.replace(/\{(\w+)\}/g, (_m, name) => String(params[name] ?? ''));
};

describe('buildDecisionWhyKeys — solo señales reales del motor', () => {
  it('mapea el ejemplo del spec (abierto + cerca + hora de comer + confianza)', () => {
    const keys = buildDecisionWhyKeys(
      ['rec.reason.openNow', 'rec.reason.nearby', 'rec.reason.highConfidence'],
      ['lunch'],
    );
    expect(keys).toEqual([
      'reason.OPEN_NOW',
      'reason.NEARBY',
      'decision.why.mealLunch',
      'reason.HIGH_CONFIDENCE',
    ]);
  });

  it('deduplica señales convergentes (abierto por V5.0 y por intención)', () => {
    const keys = buildDecisionWhyKeys(['rec.reason.openNow', 'intent.reason.openNow'], []);
    expect(keys).toEqual(['reason.OPEN_NOW']);
  });

  it('respeta el orden canónico independientemente del orden de entrada', () => {
    const keys = buildDecisionWhyKeys(['rec.reason.highConfidence', 'rec.reason.openNow'], []);
    expect(keys).toEqual(['reason.OPEN_NOW', 'reason.HIGH_CONFIDENCE']);
  });

  it('acota a MAX_WHY_FRAGMENTS', () => {
    const keys = buildDecisionWhyKeys(
      [
        'rec.reason.openNow',
        'rec.reason.nearby',
        'rec.reason.family',
        'rec.reason.accessible',
        'rec.reason.parking',
        'rec.reason.highConfidence',
      ],
      ['lunch'],
    );
    expect(keys).toHaveLength(MAX_WHY_FRAGMENTS);
    expect(keys[0]).toBe('reason.OPEN_NOW');
  });

  it('ignora razones/insignias sin fragmento (no inventa nada)', () => {
    expect(buildDecisionWhyKeys(['rec.reason.enriched'], [])).toEqual([]);
    expect(buildDecisionWhyKeys([], [])).toEqual([]);
  });

  it('deriva insignias de contexto (V5.2)', () => {
    expect(buildDecisionWhyKeys([], ['dinner'])).toEqual(['decision.why.mealDinner']);
    expect(buildDecisionWhyKeys([], ['familyTime'])).toEqual(['decision.why.family']);
  });

  it('es determinista', () => {
    const a = buildDecisionWhyKeys(['rec.reason.openNow'], ['lunch']);
    const b = buildDecisionWhyKeys(['rec.reason.openNow'], ['lunch']);
    expect(a).toEqual(b);
  });
});

describe('composeDecisionWhy — oración natural localizada', () => {
  it('compone una sola frase con la conjunción del idioma', () => {
    const sentence = composeDecisionWhy(
      ['reason.OPEN_NOW', 'reason.NEARBY', 'decision.why.mealLunch', 'reason.HIGH_CONFIDENCE'],
      translate,
    );
    expect(sentence).toBe(
      'Te lo recomendamos porque está abierto, está cerca, es hora de comer y su información es de alta confianza.',
    );
  });

  it('una sola razón no usa conjunción', () => {
    expect(composeDecisionWhy(['reason.OPEN_NOW'], translate)).toBe(
      'Te lo recomendamos porque está abierto.',
    );
  });

  it('sin señales degrada a una frase honesta simple', () => {
    expect(composeDecisionWhy([], translate)).toBe(es['decision.why.fallback']);
  });
});

describe('cobertura i18n de los fragmentos de decisión', () => {
  it('cada clave del orden canónico existe en es con texto no vacío', () => {
    for (const key of DECISION_WHY_ORDER) {
      const value = (es as Record<string, string>)[key];
      expect(typeof value).toBe('string');
      expect(value.length).toBeGreaterThan(0);
    }
  });

  it('la plantilla y el fallback existen', () => {
    expect(es['decision.why.template']).toContain('{list}');
    expect((es['decision.why.fallback'] ?? '').length).toBeGreaterThan(0);
  });
});
