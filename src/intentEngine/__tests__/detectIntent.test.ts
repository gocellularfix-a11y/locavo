import { detectIntent } from '../detectIntent';
import { INTENT_DICTIONARY } from '../intentDictionary';
import { categoryForIntent, SEARCH_INTENT_ORDER } from '../intentCategoryMap';
import { DECISION_CONFIDENCE_THRESHOLD } from '../types';

describe('detectIntent — English needs → intent', () => {
  const cases: [string, string][] = [
    ["I'm hungry", 'FOOD'],
    ['I am starving', 'FOOD'],
    ['where can i eat', 'FOOD'],
    ['I need coffee', 'COFFEE'],
    ['morning coffee', 'COFFEE'],
    ['Need gas', 'FUEL'],
    ['out of gas', 'FUEL'],
    ['Where can I sleep?', 'LODGING'],
    ['need a room', 'LODGING'],
    ["I'm looking for a pharmacy", 'PHARMACY'],
    ['cold beer', 'BEER'],
    ['grab a bite', 'FOOD'],
  ];
  it.each(cases)('%s → %s', (text, expected) => {
    expect(detectIntent(text, 'en').intent).toBe(expected);
  });
});

describe('detectIntent — Spanish', () => {
  const cases: [string, string][] = [
    ['tengo hambre', 'FOOD'],
    ['quiero comer', 'FOOD'],
    ['necesito gasolina', 'FUEL'],
    ['quiero un cafe', 'COFFEE'],
    ['donde dormir', 'LODGING'],
    ['farmacia', 'PHARMACY'],
    ['cerveza fria', 'BEER'],
    ['supermercado', 'SUPERMARKET'],
  ];
  it.each(cases)('%s → %s', (text, expected) => {
    expect(detectIntent(text, 'es').intent).toBe(expected);
  });
});

describe('detectIntent — Portuguese', () => {
  const cases: [string, string][] = [
    ['estou com fome', 'FOOD'],
    ['preciso de gasolina', 'FUEL'],
    ['um cafe', 'COFFEE'],
    ['onde dormir', 'LODGING'],
    ['farmacia', 'PHARMACY'],
  ];
  it.each(cases)('%s → %s', (text, expected) => {
    expect(detectIntent(text, 'pt').intent).toBe(expected);
  });
});

describe('detectIntent — normalization: capitalization, accents, plurals, whitespace', () => {
  it('is case-insensitive', () => {
    expect(detectIntent('FOOD').intent).toBe('FOOD');
    expect(detectIntent('CoFFeE').intent).toBe('COFFEE');
  });
  it('trims and collapses whitespace', () => {
    expect(detectIntent('   coffee   ').intent).toBe('COFFEE');
    expect(detectIntent('gas    station').intent).toBe('FUEL');
  });
  it('strips accents', () => {
    expect(detectIntent('café', 'es').intent).toBe('COFFEE');
    expect(detectIntent('farmácia', 'pt').intent).toBe('PHARMACY');
  });
  it('handles common plurals', () => {
    expect(detectIntent('hotels').intent).toBe('LODGING');
    expect(detectIntent('restaurants').intent).toBe('FOOD');
    expect(detectIntent('pharmacies').intent).toBe('PHARMACY');
    expect(detectIntent('bars').intent).toBe('NIGHTLIFE');
  });
  it('normalizes apostrophe variants identically', () => {
    const straight = detectIntent("i'm hungry");
    const curly = detectIntent('i’m hungry');
    expect(straight.intent).toBe('FOOD');
    expect(curly.intent).toBe('FOOD');
    expect(curly.confidence).toBe(straight.confidence);
  });
});

describe('detectIntent — confidence tiers', () => {
  it('assigns highest confidence to an exact whole-text match', () => {
    const d = detectIntent('coffee');
    expect(d.explanation.reason).toBe('EXACT_MATCH');
    expect(d.confidence).toBeGreaterThan(0.95);
  });
  it('assigns phrase confidence when a multi-word phrase is embedded', () => {
    const d = detectIntent('i really need coffee please');
    expect(d.intent).toBe('COFFEE');
    expect(d.explanation.reason).toBe('PHRASE_MATCH');
    expect(d.confidence).toBeGreaterThanOrEqual(0.9);
    expect(d.confidence).toBeLessThan(0.98);
  });
  it('assigns token confidence scaled by coverage', () => {
    const d = detectIntent('maybe coffee');
    expect(d.intent).toBe('COFFEE');
    expect(d.explanation.reason).toBe('TOKEN_MATCH');
    expect(d.confidence).toBeGreaterThanOrEqual(DECISION_CONFIDENCE_THRESHOLD);
    expect(d.confidence).toBeLessThan(0.92);
  });
});

describe('detectIntent — explainability', () => {
  it('exposes matched words / phrases, resolved category, language and reason', () => {
    const d = detectIntent("I'm hungry", 'en');
    expect(d.explanation.matchedPhrases).toContain('im hungry');
    expect(d.explanation.resolvedCategory).toBe('food');
    expect(d.explanation.language).toBe('en');
    expect(d.explanation.reason).toBe('EXACT_MATCH');
    expect(d.categories).toEqual(['food']);
  });
  it('returns residual keywords for the fallback search path', () => {
    const d = detectIntent('cheap romantic hotel');
    expect(d.intent).toBe('LODGING');
    expect(d.keywords).toEqual(expect.arrayContaining(['cheap', 'romantic']));
    expect(d.keywords).not.toContain('hotel');
  });
});

describe('detectIntent — unknown / fallback (never blocks)', () => {
  const unknowns = ['tacos', 'starbucks', 'walmart', 'xyzabc', 'zzz qqq'];
  it.each(unknowns)('%s → unknown, low confidence', (text) => {
    const d = detectIntent(text);
    expect(d.intent).toBeNull();
    expect(d.categories).toEqual([]);
    expect(d.confidence).toBeLessThan(DECISION_CONFIDENCE_THRESHOLD);
    expect(d.explanation.reason).toBe('UNKNOWN');
  });
  it('empty input yields a neutral unknown detection', () => {
    const d = detectIntent('   ');
    expect(d.intent).toBeNull();
    expect(d.confidence).toBe(0);
    expect(d.keywords).toEqual([]);
  });
  it('preserves specific unknown query tokens as keywords', () => {
    expect(detectIntent('tacos').keywords).toEqual(['tacos']);
  });
});

describe('detectIntent — determinism & invariants', () => {
  it('is a pure function (identical output for identical input)', () => {
    const a = detectIntent('i am hungry', 'en');
    const b = detectIntent('i am hungry', 'en');
    expect(a).toEqual(b);
  });
  it('every mapped intent resolves to a valid Locavo category', () => {
    for (const intent of SEARCH_INTENT_ORDER) {
      const category = categoryForIntent(intent);
      if (category !== null) {
        // A decision route requires a category; confirm the first en/es/pt noun classifies to it.
        const noun = INTENT_DICTIONARY[intent].en[0];
        const d = detectIntent(noun, 'en');
        expect(d.intent).toBe(intent);
        expect(d.categories).toEqual([category]);
      }
    }
  });
});
