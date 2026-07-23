import { de } from '../../i18n/locales/de';
import { en } from '../../i18n/locales/en';
import { es } from '../../i18n/locales/es';
import { fr } from '../../i18n/locales/fr';
import { it as itCatalog } from '../../i18n/locales/it';
import { pt } from '../../i18n/locales/pt';
import { zhCN } from '../../i18n/locales/zh-CN';
import { intentChipLabelKey, intentReasonLabelKey } from '../../features/today/intentToday';
import { INTENT_IDS } from '../intentModel';
import type { IntentReasonCode } from '../intentModel';

const LOCALES = { es, en, pt, fr, it: itCatalog, de, 'zh-CN': zhCN } as const;
const INTENT_KEYS = (Object.keys(es) as (keyof typeof es)[]).filter((k) => (k as string).startsWith('intent.'));

const REASON_CODES: IntentReasonCode[] = [
  'INTENT_EXACT_MATCH', 'INTENT_CATEGORY_MATCH', 'INTENT_BREAKFAST_MATCH', 'INTENT_COFFEE_MATCH',
  'INTENT_LUNCH_MATCH', 'INTENT_DINNER_MATCH', 'INTENT_FAMILY_MATCH', 'INTENT_QUICK_STOP_MATCH',
  'INTENT_PHARMACY_MATCH', 'INTENT_MEDICAL_MATCH', 'INTENT_FUEL_MATCH', 'INTENT_LODGING_MATCH',
  'INTENT_ENTERTAINMENT_MATCH', 'INTENT_ACCESSIBILITY_MATCH', 'INTENT_OPEN_NOW_MATCH',
  'INTENT_OPEN_LATE_MATCH', 'INTENT_NEARBY_MATCH',
];

describe('cobertura i18n de intención (V5.5)', () => {
  it('cada locale traduce todas las claves intent.* con texto no vacío', () => {
    expect(INTENT_KEYS.length).toBeGreaterThanOrEqual(29);
    for (const catalog of Object.values(LOCALES)) {
      for (const key of INTENT_KEYS) {
        const value = (catalog as Record<string, string>)[key];
        expect(typeof value).toBe('string');
        expect((value ?? '').length).toBeGreaterThan(0);
      }
    }
  });

  it('cada chip de intención y código de razón mapean a claves existentes', () => {
    for (const id of INTENT_IDS) {
      expect(typeof es[intentChipLabelKey(id)]).toBe('string');
    }
    for (const code of REASON_CODES) {
      expect(typeof es[intentReasonLabelKey(code)]).toBe('string');
    }
  });
});
