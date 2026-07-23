import { normalizeQuery } from '../../domain/queryNormalizer';
import { SUPPORTED_LOCALES } from '../../i18n/types';
import { INTENT_LEXICON } from '../intentLexicon';
import { INTENT_IDS, type IntentId } from '../intentModel';

describe('INTENT_LEXICON', () => {
  it('cada intención tiene ≥1 frase en cada uno de los 7 idiomas', () => {
    for (const intent of INTENT_IDS) {
      for (const locale of SUPPORTED_LOCALES) {
        expect(INTENT_LEXICON[intent][locale].length).toBeGreaterThanOrEqual(1);
      }
    }
  });

  it('sin frases en conflicto (una frase normalizada no mapea a dos intenciones) por idioma', () => {
    for (const locale of SUPPORTED_LOCALES) {
      const byPhrase = new Map<string, IntentId>();
      for (const intent of INTENT_IDS) {
        for (const raw of INTENT_LEXICON[intent][locale]) {
          const norm = normalizeQuery(raw);
          const existing = byPhrase.get(norm);
          expect(existing === undefined || existing === intent).toBe(true);
          byPhrase.set(norm, intent);
        }
      }
    }
  });
});
