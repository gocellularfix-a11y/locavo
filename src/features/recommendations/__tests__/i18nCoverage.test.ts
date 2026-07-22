import { de } from '../../../i18n/locales/de';
import { en } from '../../../i18n/locales/en';
import { es } from '../../../i18n/locales/es';
import { fr } from '../../../i18n/locales/fr';
import { it as itCatalog } from '../../../i18n/locales/it';
import { pt } from '../../../i18n/locales/pt';
import { zhCN } from '../../../i18n/locales/zh-CN';

const LOCALES = { es, en, pt, fr, it: itCatalog, de, 'zh-CN': zhCN } as const;
const REC_KEYS = (Object.keys(es) as (keyof typeof es)[]).filter((k) => (k as string).startsWith('rec.'));

describe('cobertura i18n de recomendaciones (V5.1)', () => {
  it('existen claves rec.* en el catálogo base', () => {
    expect(REC_KEYS.length).toBeGreaterThanOrEqual(30);
  });

  it('cada locale traduce todas las claves rec.* con texto no vacío', () => {
    for (const [name, catalog] of Object.entries(LOCALES)) {
      for (const key of REC_KEYS) {
        const value = (catalog as Record<string, string>)[key];
        expect(typeof value).toBe('string');
        expect(`${name}:${key} → ${value ?? ''}`.length).toBeGreaterThan(`${name}:${key} → `.length);
      }
    }
  });
});
