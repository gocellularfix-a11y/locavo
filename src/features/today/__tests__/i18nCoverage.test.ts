import type { ContextBadge, ContextReasonCode } from '../../../context';
import { de } from '../../../i18n/locales/de';
import { en } from '../../../i18n/locales/en';
import { es } from '../../../i18n/locales/es';
import { fr } from '../../../i18n/locales/fr';
import { it as itCatalog } from '../../../i18n/locales/it';
import { pt } from '../../../i18n/locales/pt';
import { zhCN } from '../../../i18n/locales/zh-CN';
import { contextBadgeLabelKey, contextReasonLabelKey } from '../todayLabels';

const LOCALES = { es, en, pt, fr, it: itCatalog, de, 'zh-CN': zhCN } as const;
const CTX_KEYS = (Object.keys(es) as (keyof typeof es)[]).filter(
  (k) => (k as string).startsWith('ctx.') || (k as string).startsWith('today.'),
);

const REASON_CODES: ContextReasonCode[] = [
  'CTX_BREAKFAST', 'CTX_LUNCH', 'CTX_DINNER', 'CTX_EVENING', 'CTX_LATE_NIGHT',
  'CTX_MORNING_FAVORITE', 'CTX_WEEKEND_PICK', 'CTX_FAMILY_TIME', 'CTX_GOOD_TIME_OF_DAY',
];
const BADGES: ContextBadge[] = [
  'breakfast', 'lunch', 'dinner', 'openLate', 'weekendPick', 'morningFavorite', 'familyTime',
];

describe('cobertura i18n de contexto (V5.2)', () => {
  it('cada locale traduce todas las claves ctx.*/today.* con texto no vacío', () => {
    expect(CTX_KEYS.length).toBeGreaterThanOrEqual(17);
    for (const [name, catalog] of Object.entries(LOCALES)) {
      for (const key of CTX_KEYS) {
        const value = (catalog as Record<string, string>)[key];
        expect(typeof value).toBe('string');
        expect((value ?? '').length).toBeGreaterThan(0);
        void name;
      }
    }
  });

  it('cada código/insignia de contexto mapea a una clave existente', () => {
    for (const code of REASON_CODES) {
      expect(typeof es[contextReasonLabelKey(code)]).toBe('string');
    }
    for (const badge of BADGES) {
      expect(typeof es[contextBadgeLabelKey(badge)]).toBe('string');
    }
  });
});
