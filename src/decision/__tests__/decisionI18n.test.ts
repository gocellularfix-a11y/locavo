import { decisionReasonLabelKey, decisionRoleLabelKey, decisionTradeoffLabelKey } from '../../features/today/decisionLabels';
import { de } from '../../i18n/locales/de';
import { en } from '../../i18n/locales/en';
import { es } from '../../i18n/locales/es';
import { fr } from '../../i18n/locales/fr';
import { it as itCatalog } from '../../i18n/locales/it';
import { pt } from '../../i18n/locales/pt';
import { zhCN } from '../../i18n/locales/zh-CN';
import { DECISION_REASON_CODES, DECISION_ROLES, DECISION_TRADEOFF_CODES } from '../decisionModel';

const LOCALES = { es, en, pt, fr, it: itCatalog, de, 'zh-CN': zhCN } as const;
const DECISION_KEYS = (Object.keys(es) as (keyof typeof es)[]).filter((k) => (k as string).startsWith('decision.'));

describe('cobertura i18n de decisión (V5.6)', () => {
  it('(69) todos los papeles mapean a claves i18n existentes y tipadas', () => {
    for (const role of DECISION_ROLES) {
      expect(typeof es[decisionRoleLabelKey(role)]).toBe('string');
    }
  });

  it('(70) todos los códigos de razón mapean a claves i18n existentes', () => {
    for (const code of DECISION_REASON_CODES) {
      expect(typeof es[decisionReasonLabelKey(code)]).toBe('string');
    }
  });

  it('(71) todos los códigos de compromiso mapean a claves i18n existentes', () => {
    for (const code of DECISION_TRADEOFF_CODES) {
      expect(typeof es[decisionTradeoffLabelKey(code)]).toBe('string');
    }
  });

  it('(72) los siete locales contienen todas las claves decision.* con texto no vacío', () => {
    expect(DECISION_KEYS.length).toBeGreaterThanOrEqual(39);
    for (const catalog of Object.values(LOCALES)) {
      for (const key of DECISION_KEYS) {
        const value = (catalog as Record<string, string>)[key];
        expect(typeof value).toBe('string');
        expect((value ?? '').length).toBeGreaterThan(0);
      }
    }
  });
});
