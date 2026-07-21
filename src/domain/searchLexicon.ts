import type { CategoryId } from './place';
import { normalizeText } from '../utils/text';

/**
 * Léxico de búsqueda centralizado y DETERMINISTA (V4D).
 *
 * Una sola estructura, versionada, independiente de DENUE y de la UI, que
 * complementa el Search Alias Engine de categorías (`i18n/searchAliases`)
 * con las señales de intención en los 7 idiomas soportados:
 *
 * - SUBTYPE_CATEGORIES: subtipos e "palabras de intención" (tacos, sushi,
 *   hambre, dormir, medicina…) que infieren la categoría amplia y ADEMÁS
 *   siguen siendo términos de búsqueda válidos;
 * - NEARBY / OPEN_NOW: vocabulario de cercanía y de "abierto ahora";
 * - FILLER: palabras de relleno sin valor de búsqueda que se descartan.
 *
 * Todo se normaliza (minúsculas, sin acentos) con la misma función que la
 * búsqueda: "Café" ≡ "cafe", "farmacía" ≡ "farmacia". Extender = editar estas
 * tablas; está cubierto por pruebas y no requiere tocar la UI.
 */
export const SEARCH_LEXICON_VERSION = 1;

/**
 * Subtipos y palabras de intención → categoría amplia. NO se inventa una
 * categoría canónica por subtipo: "tacos" sigue siendo un término de búsqueda
 * y además infiere `food`. Cubre los términos de alto valor que NO están ya
 * en el alias de categoría (tacos/mariscos/antro/… ya viven en searchAliases).
 */
const RAW_SUBTYPES: Record<string, CategoryId> = {
  // comida — subtipos y platillos
  sushi: 'food',
  pizza: 'food',
  pizzas: 'food',
  hamburguesa: 'food',
  hamburguesas: 'food',
  hamburger: 'food',
  hamburgers: 'food',
  burger: 'food',
  burgers: 'food',
  desayuno: 'food',
  desayunos: 'food',
  breakfast: 'food',
  panaderia: 'food',
  panaderias: 'food',
  bakery: 'food',
  pan: 'food',
  postre: 'food',
  postres: 'food',
  dessert: 'food',
  desserts: 'food',
  dulce: 'food',
  dulces: 'food',
  sweet: 'food',
  birria: 'food',
  pozole: 'food',
  torta: 'food',
  tortas: 'food',
  taqueria: 'food',
  taquerias: 'food',
  hotdog: 'food',
  seafood: 'food',
  chinese: 'food',
  china: 'food',
  mexican: 'food',
  mexicana: 'food',
  // palabras de intención de comer (idiomas soportados)
  hambre: 'food',
  hungry: 'food',
  comer: 'food',
  fome: 'food', // pt
  faim: 'food', // fr
  fame: 'food', // it
  hunger: 'food', // de
  // hospedaje — intención de dormir
  dormir: 'lodging',
  sleep: 'lodging',
  moteles: 'lodging',
  // tienda
  grocery: 'store',
  groceries: 'store',
  conveniencia: 'store',
  // farmacia — intención de medicina
  medicina: 'pharmacy',
  medicinas: 'pharmacy',
  medicine: 'pharmacy',
  medicamento: 'pharmacy',
  medicamentos: 'pharmacy',
  remedio: 'pharmacy',
};

/** Vocabulario de cercanía (tokens normalizados, 7 idiomas). */
const RAW_NEARBY = [
  'cerca',
  'cercano',
  'cercana',
  'nearby',
  'near',
  'close',
  'perto', // pt
  'proche', // fr
  'pres', // fr "près"
  'vicino', // it
  'nahe', // de "nähe"
  'naehe',
  '附近', // zh
];

/** Vocabulario de "abierto ahora" (tokens normalizados, 7 idiomas). */
const RAW_OPEN_NOW = [
  'abierto',
  'abiertos',
  'abierta',
  'open',
  'aberto', // pt
  'ouvert', // fr
  'aperto', // it
  'aperti',
  'geoffnet', // de "geöffnet"
  'offen',
  '营业', // zh
];

/** Palabras de relleno sin valor de búsqueda (7 idiomas). Nunca son términos. */
const RAW_FILLER = [
  // es
  'quiero', 'quisiera', 'necesito', 'busco', 'buscar', 'dame', 'tengo', 'ando',
  'un', 'una', 'unos', 'unas', 'el', 'la', 'los', 'las', 'de', 'del', 'al',
  'algo', 'algun', 'alguna', 'mi', 'me', 'para', 'por', 'que', 'donde', 'aqui',
  'esta', 'estan', 'hay', 'ahora', 'ya', 'con',
  // horario "24 horas" (la intención de apertura se detecta aparte)
  '24', 'horas', 'hora', 'hours', 'hour', 'hrs', 'h',
  // en
  'i', 'a', 'an', 'the', 'some', 'want', 'need', 'looking', 'for', 'to', 'find',
  'where', 'is', 'are', 'my', 'please', 'now', 'here', 'get', 'somewhere',
  // pt
  'eu', 'um', 'uma', 'quero', 'preciso', 'onde',
  // fr
  'je', 'veux', 'un', 'une', 'ou', 'moi', 'des',
  // it
  'voglio', 'un', 'una', 'dove', 'cerco',
  // de
  'ich', 'will', 'suche', 'ein', 'eine', 'wo', 'brauche',
  // zh (partículas comunes)
  '我', '想', '的', '在',
];

function buildSet(values: readonly string[]): Set<string> {
  return new Set(values.map((v) => normalizeText(v)));
}

const SUBTYPE_INDEX: Map<string, CategoryId> = (() => {
  const index = new Map<string, CategoryId>();
  for (const [term, category] of Object.entries(RAW_SUBTYPES)) {
    index.set(normalizeText(term), category);
  }
  return index;
})();
const NEARBY_SET = buildSet(RAW_NEARBY);
const OPEN_NOW_SET = buildSet(RAW_OPEN_NOW);
const FILLER_SET = buildSet(RAW_FILLER);

/**
 * Palabras de intención PURA: infieren categoría pero NO son términos de
 * búsqueda válidos (ningún negocio se llama "hambre" o "dormir"). Se usan
 * para inferir la categoría y luego se descartan del texto de búsqueda; en
 * cambio "tacos", "medicina", "sushi" SÍ aparecen en datos reales y quedan
 * como términos.
 */
const RAW_INTENT_ONLY = [
  'hambre', 'hungry', 'comer', 'fome', 'faim', 'fame', 'hunger', // comer
  'dormir', 'sleep', // hospedaje
];
const INTENT_ONLY_SET = buildSet(RAW_INTENT_ONLY);

/** "24 horas", "24h", "24 hours", "24/7" → intención de abierto ahora. */
const OPEN_24H = /\b24\s*(h|hr|hrs|hora|horas|hour|hours|\/\s*7)\b/;

/** Categoría amplia que infiere un subtipo/palabra de intención (o null). */
export function subtypeCategoryOf(token: string): CategoryId | null {
  return SUBTYPE_INDEX.get(normalizeText(token)) ?? null;
}

/** ¿El token expresa cercanía? */
export function isNearbyToken(token: string): boolean {
  return NEARBY_SET.has(normalizeText(token));
}

/** ¿El token expresa "abierto ahora"? */
export function isOpenNowToken(token: string): boolean {
  return OPEN_NOW_SET.has(normalizeText(token));
}

/** ¿La consulta normalizada completa expresa "abierto/24 horas"? */
export function hasOpen24hPhrase(normalized: string): boolean {
  return OPEN_24H.test(normalized);
}

/** ¿El token es relleno sin valor de búsqueda? */
export function isFillerToken(token: string): boolean {
  return FILLER_SET.has(normalizeText(token));
}

/**
 * ¿El token es una palabra de intención pura (infiere categoría pero no es
 * un término de búsqueda, p. ej. "hambre", "dormir")?
 */
export function isIntentOnlyToken(token: string): boolean {
  return INTENT_ONLY_SET.has(normalizeText(token));
}
