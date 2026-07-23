import { de } from '../../i18n/locales/de';
import { en } from '../../i18n/locales/en';
import { es } from '../../i18n/locales/es';
import { fr } from '../../i18n/locales/fr';
import { it as itCatalog } from '../../i18n/locales/it';
import { pt } from '../../i18n/locales/pt';
import { zhCN } from '../../i18n/locales/zh-CN';
import { preferenceReasonLabelKey } from '../../features/today/personalizedToday';
import type { PreferenceReasonCode } from '../index';

const LOCALES = { es, en, pt, fr, it: itCatalog, de, 'zh-CN': zhCN } as const;
const PREF_KEYS = (Object.keys(es) as (keyof typeof es)[]).filter((k) => (k as string).startsWith('pref.'));

const REASON_CODES: PreferenceReasonCode[] = [
  'PREF_FAVORITE_PLACE', 'PREF_FAVORITE_CATEGORY', 'PREF_DISTANCE_MATCH', 'PREF_ACCESSIBILITY_MATCH',
  'PREF_FAMILY_MATCH', 'PREF_PARKING_MATCH', 'PREF_OPEN_NOW_MATCH', 'PREF_PREVIOUS_DIRECTIONS',
];

describe('cobertura i18n de preferencias (V5.4)', () => {
  it('cada locale traduce todas las claves pref.* con texto no vacío', () => {
    expect(PREF_KEYS.length).toBeGreaterThanOrEqual(24);
    for (const catalog of Object.values(LOCALES)) {
      for (const key of PREF_KEYS) {
        const value = (catalog as Record<string, string>)[key];
        expect(typeof value).toBe('string');
        expect((value ?? '').length).toBeGreaterThan(0);
      }
    }
  });

  it('cada código de razón de preferencia mapea a una clave existente', () => {
    for (const code of REASON_CODES) {
      expect(typeof es[preferenceReasonLabelKey(code)]).toBe('string');
    }
  });
});
