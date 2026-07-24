/**
 * Intent Engine V1 — API pública. Motor DETERMINISTA que traduce lenguaje
 * natural (en/es/pt) a una intención de búsqueda estructurada y decide su ruteo.
 * Sin LLM, sin IA generativa, sin red, sin embeddings, sin proveedores. No
 * rankea ni recomienda: solo interpreta la intención. Independiente del engine
 * de intención V5.5 (`src/intent`), que ajusta ranking.
 */
export { detectIntent } from './detectIntent';
export { routeSearch } from './routeSearch';
export { categoryForIntent, INTENT_CATEGORY, SEARCH_INTENT_ORDER } from './intentCategoryMap';
export { INTENT_DICTIONARY } from './intentDictionary';
export { normalizeIntentText, intentTokens } from './normalize';
export {
  DECISION_CONFIDENCE_THRESHOLD,
  type SearchIntentId,
  type IntentLanguage,
  type IntentReasonCode,
  type IntentExplanation,
  type IntentDetection,
  type SearchRoute,
} from './types';
