/**
 * Frase de EXPLICACIÓN del primario "Para ti ahora" — presentación pura y
 * determinista (V5.6). NO rankea, NO recupera, NO recalcula scores ni confianza.
 *
 * Compone UNA sola oración natural a partir ÚNICAMENTE de razones REALES ya
 * producidas por el motor congelado:
 *   - `reasonKeys` del modelo (V5.0 calidad + V5.5 intención),
 *   - `contextBadges` del contexto (V5.2, hora del día).
 * Jamás inventa calidad, precio, ambiente, popularidad ni opiniones: cada
 * fragmento mapea 1:1 a una señal estructurada existente. Si no hay señales,
 * degrada a una frase honesta más simple.
 */
import type { ContextBadge } from '../../context';
import type { TranslationKey } from '../../i18n/locales/es';

/** Traductor mínimo (compatible con `t` de I18nContext). */
export type TranslateFn = (key: TranslationKey, params?: Record<string, string | number>) => string;

/**
 * Razón real del motor (clave i18n ya emitida) → fragmento de "por qué".
 * Reutiliza los fragmentos de oración existentes (`reason.*`) donde aplica y
 * añade solo los que faltaban (`decision.why.*`). Varias razones convergen al
 * mismo fragmento (p. ej. abierto por V5.0 o por intención) y se deduplican.
 */
const REASON_KEY_TO_WHY: Partial<Record<TranslationKey, TranslationKey>> = {
  'rec.reason.openNow': 'reason.OPEN_NOW',
  'rec.reason.nearby': 'reason.NEARBY',
  'rec.reason.highConfidence': 'reason.HIGH_CONFIDENCE',
  'rec.reason.family': 'decision.why.family',
  'rec.reason.accessible': 'decision.why.accessible',
  'rec.reason.parking': 'decision.why.parking',
  'rec.reason.official': 'decision.why.verified',
  'rec.reason.intentMatch': 'decision.why.intentMatch',
  'intent.reason.match': 'decision.why.intentMatch',
  'intent.reason.openNow': 'reason.OPEN_NOW',
  'intent.reason.openLate': 'decision.why.openLate',
  'intent.reason.nearby': 'reason.NEARBY',
  'intent.reason.family': 'decision.why.family',
  'intent.reason.accessibility': 'decision.why.accessible',
};

/** Insignia de contexto real (V5.2) → fragmento de "por qué". */
const BADGE_TO_WHY: Partial<Record<ContextBadge, TranslationKey>> = {
  breakfast: 'decision.why.mealBreakfast',
  lunch: 'decision.why.mealLunch',
  dinner: 'decision.why.mealDinner',
  morningFavorite: 'decision.why.morning',
  weekendPick: 'decision.why.weekend',
  familyTime: 'decision.why.family',
  openLate: 'decision.why.openLate',
};

/** Orden canónico determinista de emisión (lee natural: abierto → cerca → hora → confianza). */
export const DECISION_WHY_ORDER: readonly TranslationKey[] = [
  'reason.OPEN_NOW',
  'decision.why.openLate',
  'reason.NEARBY',
  'decision.why.mealBreakfast',
  'decision.why.mealLunch',
  'decision.why.mealDinner',
  'decision.why.morning',
  'decision.why.weekend',
  'decision.why.intentMatch',
  'decision.why.family',
  'decision.why.accessible',
  'decision.why.parking',
  'reason.HIGH_CONFIDENCE',
  'decision.why.verified',
];

/** Tope de fragmentos: una frase clara, no una lista exhaustiva. */
export const MAX_WHY_FRAGMENTS = 4;

/**
 * Fragmentos de "por qué" (claves i18n) para el primario, deduplicados, en orden
 * canónico y acotados. Puro: mismas señales → misma salida.
 */
export function buildDecisionWhyKeys(
  reasonKeys: readonly TranslationKey[],
  contextBadges: readonly ContextBadge[],
): TranslationKey[] {
  const present = new Set<TranslationKey>();
  for (const key of reasonKeys) {
    const why = REASON_KEY_TO_WHY[key];
    if (why) {
      present.add(why);
    }
  }
  for (const badge of contextBadges) {
    const why = BADGE_TO_WHY[badge];
    if (why) {
      present.add(why);
    }
  }
  return DECISION_WHY_ORDER.filter((key) => present.has(key)).slice(0, MAX_WHY_FRAGMENTS);
}

/**
 * Compone la oración final con la conjunción propia del idioma (mismo patrón que
 * `explainReasonsLocalized`). Sin fragmentos → frase honesta de degradación.
 */
export function composeDecisionWhy(
  fragmentKeys: readonly TranslationKey[],
  translate: TranslateFn,
): string {
  if (fragmentKeys.length === 0) {
    return translate('decision.why.fallback');
  }
  const phrases = fragmentKeys.map((key) => translate(key));
  const separator = translate('reason.separator');
  const and = translate('reason.and');
  const list =
    phrases.length === 1
      ? phrases[0]
      : `${phrases.slice(0, -1).join(separator)}${and}${phrases[phrases.length - 1]}`;
  return translate('decision.why.template', { list });
}
