import { PLACE_ACTION_REASON_CODES, type PlaceActionOutcomeCode } from '../actionModel';
import { placeActionOutcomeLabelKey, placeActionReasonLabelKey } from '../../app/place/placeActionLabels';
import { de } from '../../i18n/locales/de';
import { en } from '../../i18n/locales/en';
import { es } from '../../i18n/locales/es';
import { fr } from '../../i18n/locales/fr';
import { it as itCatalog } from '../../i18n/locales/it';
import { pt } from '../../i18n/locales/pt';
import { zhCN } from '../../i18n/locales/zh-CN';
import type { TranslationKey } from '../../i18n/locales/es';

const LOCALES = { es, en, pt, fr, it: itCatalog, de, 'zh-CN': zhCN } as const;

const VISIBLE_KEYS: TranslationKey[] = [
  'place.call',
  'place.callA11y',
  'place.callHint',
  'place.websiteHint',
  'place.actionFailed',
];

const OUTCOME_CODES: PlaceActionOutcomeCode[] = ['ACTION_OPENED', 'ACTION_BLOCKED', 'ACTION_OPEN_FAILED'];

describe('cobertura i18n de acciones seguras (V5.7)', () => {
  it('todo código de razón mapea a una clave i18n existente y tipada', () => {
    for (const code of PLACE_ACTION_REASON_CODES) {
      expect(typeof es[placeActionReasonLabelKey(code)]).toBe('string');
    }
  });

  it('todo código de resultado mapea a una clave i18n existente', () => {
    for (const code of OUTCOME_CODES) {
      expect(typeof es[placeActionOutcomeLabelKey(code)]).toBe('string');
    }
  });

  it('los siete catálogos contienen todas las claves nuevas con texto no vacío', () => {
    const reasonKeys = PLACE_ACTION_REASON_CODES.map(placeActionReasonLabelKey);
    const allKeys = [...new Set<TranslationKey>([...VISIBLE_KEYS, ...reasonKeys])];
    for (const catalog of Object.values(LOCALES)) {
      for (const key of allKeys) {
        const value = (catalog as Record<string, string>)[key];
        expect(typeof value).toBe('string');
        expect((value ?? '').length).toBeGreaterThan(0);
      }
    }
  });
});
