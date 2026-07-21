import { interpretQuery } from '../queryInterpreter';
import { normalizeQuery, tokenVariants } from '../queryNormalizer';
import type { CategoryId } from '../place';

/**
 * V4D — Inteligencia de búsqueda: interpretación de consultas.
 * Determinista, multilingüe, conservadora. Sin red, sin IA.
 */

function cats(query: string): CategoryId[] {
  return interpretQuery(query).categories;
}

describe('normalización de consultas (V4D)', () => {
  it('es insensible a acentos: café ≡ cafe', () => {
    expect(normalizeQuery('Café')).toBe('cafe');
    expect(interpretQuery('café').normalized).toBe(interpretQuery('cafe').normalized);
  });

  it('maneja la ñ (ñ → n): DOÑA ≡ dona, taquería ≡ taqueria', () => {
    expect(normalizeQuery('DOÑA')).toBe('dona');
    expect(normalizeQuery('Taquería')).toBe('taqueria');
  });

  it('limpia puntuación y espacios repetidos', () => {
    expect(normalizeQuery('  ¿Tacos?? , al  pastor! ')).toBe('tacos al pastor');
    expect(cats('¡tacos!')).toContain('food');
  });

  it('variantes singular/plural seguras (sin stemming agresivo)', () => {
    expect(tokenVariants('farmacias')).toContain('farmacia');
    expect(tokenVariants('gasolineras')).toContain('gasolinera');
    expect(tokenVariants('cafes')).toContain('cafe');
    // palabras cortas no se alteran de forma peligrosa
    expect(tokenVariants('bar')).toEqual(['bar']);
  });
});

describe('remoción de relleno y términos (V4D)', () => {
  it('quita relleno y conserva el término útil', () => {
    const intent = interpretQuery('quiero una cerveza');
    expect(intent.terms).toEqual(['cerveza']);
    expect(intent.removed).toEqual(expect.arrayContaining(['quiero', 'una']));
  });

  it('un nombre propio se conserva como término (no se sobreinterpreta)', () => {
    const intent = interpretQuery('Marco');
    expect(intent.terms).toEqual(['marco']);
    expect(intent.categories).toEqual([]);
  });

  it('un subtipo conserva su token Y ADEMÁS infiere la categoría amplia', () => {
    const sushi = interpretQuery('sushi');
    expect(sushi.terms).toContain('sushi');
    expect(sushi.categories).toContain('food');
    const tacos = interpretQuery('tacos');
    expect(tacos.terms).toContain('tacos');
    expect(tacos.categories).toContain('food');
  });
});

describe('intención de categoría — español (las 8)', () => {
  const CASES: Array<[string, CategoryId]> = [
    ['comida', 'food'],
    ['cerveza', 'beer'],
    ['café', 'coffee'],
    ['hotel', 'lodging'],
    ['farmacia', 'pharmacy'],
    ['gasolina', 'gas'],
    ['tienda', 'store'],
    ['antro', 'nightlife'],
  ];
  for (const [query, category] of CASES) {
    it(`"${query}" → ${category}`, () => {
      expect(cats(query)).toContain(category);
    });
  }
});

describe('intención de categoría — inglés (las 8)', () => {
  const CASES: Array<[string, CategoryId]> = [
    ['food', 'food'],
    ['beer', 'beer'],
    ['coffee', 'coffee'],
    ['hotel', 'lodging'],
    ['pharmacy', 'pharmacy'],
    ['gas', 'gas'],
    ['store', 'store'],
    ['nightlife', 'nightlife'],
  ];
  for (const [query, category] of CASES) {
    it(`"${query}" → ${category}`, () => {
      expect(cats(query)).toContain(category);
    });
  }
});

describe('intención de categoría — pt/fr/it/de/zh (representativa)', () => {
  const CASES: Array<[string, string, CategoryId]> = [
    ['pt', 'restaurante', 'food'],
    ['pt', 'cerveja', 'beer'],
    ['fr', 'restaurant', 'food'],
    ['fr', 'bière', 'beer'],
    ['it', 'ristorante', 'food'],
    ['it', 'birra', 'beer'],
    ['de', 'essen', 'food'],
    ['de', 'apotheke', 'pharmacy'],
    ['zh', '餐厅', 'food'],
    ['zh', '啤酒', 'beer'],
  ];
  for (const [lang, query, category] of CASES) {
    it(`[${lang}] "${query}" → ${category}`, () => {
      expect(cats(query)).toContain(category);
    });
  }
});

describe('intención de lenguaje natural (V4D)', () => {
  it('"tengo hambre" → food (sin término residual)', () => {
    const intent = interpretQuery('tengo hambre');
    expect(intent.categories).toEqual(['food']);
    expect(intent.terms).toEqual([]);
  });

  it('"quiero comer" → food', () => {
    expect(cats('quiero comer')).toEqual(['food']);
  });

  it('"dónde dormir" → lodging', () => {
    const intent = interpretQuery('dónde dormir');
    expect(intent.categories).toEqual(['lodging']);
    expect(intent.terms).toEqual([]);
  });

  it('"necesito medicina" → pharmacy', () => {
    expect(cats('necesito medicina')).toEqual(['pharmacy']);
  });

  it('"quiero una cerveza cerca" → beer + nearby, término = cerveza', () => {
    const intent = interpretQuery('quiero una cerveza cerca');
    expect(intent.categories).toEqual(['beer']);
    expect(intent.nearby).toBe(true);
    expect(intent.terms).toEqual(['cerveza']);
    expect(intent.openNow).toBe(false);
  });

  it('"algo cerca" → solo cercanía (no sobreinterpreta)', () => {
    const intent = interpretQuery('algo cerca');
    expect(intent.nearby).toBe(true);
    expect(intent.categories).toEqual([]);
    expect(intent.terms).toEqual([]);
  });
});

describe('intención de "abierto ahora" (V4D)', () => {
  it('"abierto ahora" → openNow', () => {
    expect(interpretQuery('abierto ahora').openNow).toBe(true);
  });
  it('"open now" → openNow', () => {
    expect(interpretQuery('open now').openNow).toBe(true);
  });
  it('"24 horas" → openNow (sin términos residuales)', () => {
    const intent = interpretQuery('24 horas');
    expect(intent.openNow).toBe(true);
    expect(intent.terms).toEqual([]);
  });
  it('"farmacia abierta" preserva la categoría y marca openNow', () => {
    const intent = interpretQuery('farmacia abierta');
    expect(intent.categories).toContain('pharmacy');
    expect(intent.openNow).toBe(true);
  });
});
