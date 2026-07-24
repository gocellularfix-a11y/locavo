/**
 * Clasificador de INTENCIÓN (Intent Engine V1) — puro y determinista.
 *
 * Traduce texto libre a una intención estructurada por coincidencia de FRASE o
 * TOKEN exacta contra diccionarios cerrados (en/es/pt). Sin fuzzy, sin ML, sin
 * red. Confianza en niveles fijos y explicabilidad completa. Nunca lanza; la
 * intención desconocida devuelve `intent: null` (→ búsqueda universal).
 */
import type { CategoryId } from '../domain/place';
import { categoryForIntent, SEARCH_INTENT_ORDER } from './intentCategoryMap';
import { INTENT_DICTIONARY } from './intentDictionary';
import { FILLER_WORDS, normalizeIntentText } from './normalize';
import type { IntentDetection, IntentLanguage, IntentReasonCode, SearchIntentId } from './types';

// Niveles de confianza deterministas (solo detección de intención).
const CONF_EXACT = 0.98;
const CONF_PHRASE = 0.92;
const CONF_TOKEN_BASE = 0.7;
const CONF_TOKEN_SPAN = 0.2;
const CONF_TOKEN_MAX = 0.9;
const CONF_UNKNOWN = 0.15;
const MIN_INTENT_CONFIDENCE = 0.5;

const LANGUAGES: readonly IntentLanguage[] = ['en', 'es', 'pt'];

interface LangIndex {
  readonly exact: ReadonlySet<string>;
  readonly words: ReadonlySet<string>;
  readonly phrases: readonly string[];
}

/** Índice normalizado precomputado una sola vez (determinista, inmutable). */
const INDEX: Readonly<Record<SearchIntentId, Readonly<Record<IntentLanguage, LangIndex>>>> = (() => {
  const out = {} as Record<SearchIntentId, Record<IntentLanguage, LangIndex>>;
  for (const intent of SEARCH_INTENT_ORDER) {
    out[intent] = {} as Record<IntentLanguage, LangIndex>;
    for (const lang of LANGUAGES) {
      const exact = new Set<string>();
      const words = new Set<string>();
      const phrases: string[] = [];
      for (const raw of INTENT_DICTIONARY[intent][lang]) {
        const normalized = normalizeIntentText(raw);
        if (normalized.length === 0) {
          continue;
        }
        exact.add(normalized);
        if (normalized.includes(' ')) {
          phrases.push(normalized);
        } else {
          words.add(normalized);
        }
      }
      out[intent][lang] = { exact, words, phrases };
    }
  }
  return out;
})();

interface Candidate {
  readonly intent: SearchIntentId;
  readonly language: IntentLanguage;
  readonly score: number;
  readonly reason: IntentReasonCode;
  readonly matchedWords: string[];
  readonly matchedPhrases: string[];
}

function scoreIntentLang(
  intent: SearchIntentId,
  language: IntentLanguage,
  normInput: string,
  tokens: readonly string[],
  meaningfulCount: number,
): Candidate | null {
  const idx = INDEX[intent][language];

  // 1. Coincidencia EXACTA de todo el texto.
  if (idx.exact.has(normInput)) {
    const isPhrase = normInput.includes(' ');
    return {
      intent, language, score: CONF_EXACT, reason: 'EXACT_MATCH',
      matchedWords: isPhrase ? [] : [normInput],
      matchedPhrases: isPhrase ? [normInput] : [],
    };
  }

  // 2. FRASE (multi-palabra) contenida como secuencia completa.
  const padded = ` ${normInput} `;
  const matchedPhrases = idx.phrases.filter((p) => padded.includes(` ${p} `));

  // 3. TOKENs individuales.
  const matchedWords = [...new Set(tokens.filter((t) => idx.words.has(t)))];

  if (matchedPhrases.length > 0) {
    return { intent, language, score: CONF_PHRASE, reason: 'PHRASE_MATCH', matchedWords, matchedPhrases };
  }
  if (matchedWords.length > 0) {
    const coverage = matchedWords.length / Math.max(1, meaningfulCount);
    const score = Math.min(CONF_TOKEN_MAX, CONF_TOKEN_BASE + CONF_TOKEN_SPAN * coverage);
    return { intent, language, score, reason: 'TOKEN_MATCH', matchedWords, matchedPhrases: [] };
  }
  return null;
}

/** Mejor candidato: mayor score → orden canónico de intención → orden de idioma. */
function betterCandidate(a: Candidate, b: Candidate): Candidate {
  if (a.score !== b.score) {
    return a.score > b.score ? a : b;
  }
  const ia = SEARCH_INTENT_ORDER.indexOf(a.intent);
  const ib = SEARCH_INTENT_ORDER.indexOf(b.intent);
  if (ia !== ib) {
    return ia < ib ? a : b;
  }
  return LANGUAGES.indexOf(a.language) <= LANGUAGES.indexOf(b.language) ? a : b;
}

const UNKNOWN = (keywords: readonly string[]): IntentDetection => ({
  intent: null,
  confidence: keywords.length > 0 ? CONF_UNKNOWN : 0,
  categories: [],
  keywords,
  explanation: { matchedWords: [], matchedPhrases: [], resolvedCategory: null, language: null, reason: 'UNKNOWN' },
});

/**
 * Detecta la intención de un texto. `localeHint` solo desempata idiomas cuando
 * la misma palabra existe en varios diccionarios; nunca cambia la intención.
 */
export function detectIntent(input: string, localeHint?: IntentLanguage): IntentDetection {
  const normInput = normalizeIntentText(input);
  const tokens = normInput.length === 0 ? [] : normInput.split(' ');
  const meaningfulTokens = tokens.filter((t) => !FILLER_WORDS.has(t));
  const meaningfulCount = meaningfulTokens.length;

  if (tokens.length === 0) {
    return UNKNOWN([]);
  }

  // Orden de idiomas con la pista de locale primero (solo desempate).
  const langs: IntentLanguage[] = localeHint
    ? [localeHint, ...LANGUAGES.filter((l) => l !== localeHint)]
    : [...LANGUAGES];

  let best: Candidate | null = null;
  for (const intent of SEARCH_INTENT_ORDER) {
    for (const language of langs) {
      const candidate = scoreIntentLang(intent, language, normInput, tokens, meaningfulCount);
      if (candidate) {
        best = best === null ? candidate : betterCandidate(best, candidate);
      }
    }
  }

  if (best === null || best.score < MIN_INTENT_CONFIDENCE) {
    return UNKNOWN(meaningfulTokens);
  }

  const category = categoryForIntent(best.intent);
  const categories: CategoryId[] = category ? [category] : [];
  const matchedSet = new Set(best.matchedWords);
  const keywords = meaningfulTokens.filter((t) => !matchedSet.has(t));

  return {
    intent: best.intent,
    confidence: best.score,
    categories,
    keywords,
    explanation: {
      matchedWords: best.matchedWords,
      matchedPhrases: best.matchedPhrases,
      resolvedCategory: category,
      language: best.language,
      reason: best.reason,
    },
  };
}
