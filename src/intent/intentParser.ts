/**
 * Parser de intención (V5.5) — PURO. Devuelve coincidencias estructuradas, no
 * recomendaciones. Frases multi-palabra primero (más larga gana), sin
 * solapamientos. Nunca lanza; nunca accede a almacenamiento ni a lugares.
 * Chino: coincidencia por subcadena sobre frases del catálogo (no por espacios).
 */
import { normalizeQuery } from '../domain/queryNormalizer';
import { DEFAULT_LOCALE, isSupportedLocale, type SupportedLocale } from '../i18n/types';
import { INTENT_LEXICON } from './intentLexicon';
import type { IntentId } from './intentModel';
import { normalizeIntentInput } from './intentNormalization';

export interface IntentTermMatch {
  intent: IntentId;
  term: string;
}

export interface IntentParseDiagnostics {
  matchCount: number;
  unresolvedCount: number;
}

export interface IntentParseResult {
  normalizedInput: string;
  matches: IntentTermMatch[];
  unresolvedTokens: string[];
  diagnostics: IntentParseDiagnostics;
}

interface LexPhrase {
  intent: IntentId;
  term: string;
  normalized: string;
  tokens: string[];
}

/** Índice normalizado por idioma (memoizado). */
const INDEX_CACHE = new Map<SupportedLocale, LexPhrase[]>();

function indexFor(locale: SupportedLocale): LexPhrase[] {
  const cached = INDEX_CACHE.get(locale);
  if (cached) {
    return cached;
  }
  const phrases: LexPhrase[] = [];
  for (const intent of Object.keys(INTENT_LEXICON) as IntentId[]) {
    for (const raw of INTENT_LEXICON[intent][locale]) {
      const normalized = normalizeQuery(raw);
      if (normalized.length === 0) {
        continue;
      }
      phrases.push({ intent, term: raw, normalized, tokens: normalized.split(' ') });
    }
  }
  // Frase más larga primero (por caracteres); desempate determinista por texto.
  phrases.sort((a, b) =>
    b.normalized.length - a.normalized.length || (a.normalized < b.normalized ? -1 : a.normalized > b.normalized ? 1 : 0),
  );
  INDEX_CACHE.set(locale, phrases);
  return phrases;
}

function matchLatin(tokens: string[], phrases: LexPhrase[]): { matches: { intent: IntentId; term: string; at: number }[]; consumed: Set<number> } {
  const consumed = new Set<number>();
  const matches: { intent: IntentId; term: string; at: number }[] = [];
  for (const phrase of phrases) {
    const len = phrase.tokens.length;
    for (let i = 0; i + len <= tokens.length; i++) {
      let ok = true;
      for (let j = 0; j < len; j++) {
        if (consumed.has(i + j) || tokens[i + j] !== phrase.tokens[j]) {
          ok = false;
          break;
        }
      }
      if (ok) {
        for (let j = 0; j < len; j++) consumed.add(i + j);
        matches.push({ intent: phrase.intent, term: phrase.term, at: i });
        break; // primera ocurrencia (izquierda) de esta frase
      }
    }
  }
  return { matches, consumed };
}

function matchChinese(normalized: string, phrases: LexPhrase[]): { matches: { intent: IntentId; term: string; at: number }[]; consumedChars: boolean[] } {
  const consumedChars = new Array(normalized.length).fill(false);
  const matches: { intent: IntentId; term: string; at: number }[] = [];
  for (const phrase of phrases) {
    let from = 0;
    for (;;) {
      const idx = normalized.indexOf(phrase.normalized, from);
      if (idx < 0) break;
      let free = true;
      for (let k = idx; k < idx + phrase.normalized.length; k++) {
        if (consumedChars[k]) {
          free = false;
          break;
        }
      }
      if (free) {
        for (let k = idx; k < idx + phrase.normalized.length; k++) consumedChars[k] = true;
        matches.push({ intent: phrase.intent, term: phrase.term, at: idx });
        break;
      }
      from = idx + 1;
    }
  }
  return { matches, consumedChars };
}

export function parseIntentText(input: unknown, locale: string): IntentParseResult {
  const effective: SupportedLocale = isSupportedLocale(locale) ? locale : DEFAULT_LOCALE;
  const { normalized, tokens } = normalizeIntentInput(input);
  const phrases = indexFor(effective);

  let raw: { intent: IntentId; term: string; at: number }[];
  let unresolvedTokens: string[];

  if (effective === 'zh-CN') {
    const { matches, consumedChars } = matchChinese(normalized, phrases);
    raw = matches;
    const leftover = normalized
      .split('')
      .filter((_, i) => !consumedChars[i] && normalized[i] !== ' ')
      .join('');
    unresolvedTokens = leftover.length > 0 ? [leftover] : [];
  } else {
    const { matches, consumed } = matchLatin(tokens, phrases);
    raw = matches;
    unresolvedTokens = tokens.filter((_, i) => !consumed.has(i));
  }

  // Orden determinista por posición; dedup por intención (primera aparición).
  raw.sort((a, b) => a.at - b.at || (a.intent < b.intent ? -1 : a.intent > b.intent ? 1 : 0));
  const seen = new Set<IntentId>();
  const matches: IntentTermMatch[] = [];
  for (const m of raw) {
    if (!seen.has(m.intent)) {
      seen.add(m.intent);
      matches.push({ intent: m.intent, term: m.term });
    }
  }

  return {
    normalizedInput: normalized,
    matches,
    unresolvedTokens,
    diagnostics: { matchCount: matches.length, unresolvedCount: unresolvedTokens.length },
  };
}
