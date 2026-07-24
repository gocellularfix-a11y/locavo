/**
 * NORMALIZACIÓN DETERMINISTA (GEN-1 · Fase D).
 *
 * Reglas puras que proponen una representación canónica sin cambiar el
 * SIGNIFICADO. Cada regla conserva el valor original, declara su identidad y
 * versión, y explica qué hizo: una normalización nunca es un cambio silencioso.
 *
 * Si una regla no aplica, no propone nada. No hay "mejor esfuerzo".
 */
import type { KnowledgeFieldKey } from '../model/knowledgeField';
import {
  PAYMENT_CASH,
  PAYMENT_CREDIT_CARD,
  PAYMENT_DEBIT_CARD,
  SERVICE_DELIVERY,
  SERVICE_OUTDOOR_SEATING,
  SERVICE_TAKEOUT,
  SERVICE_WIFI,
} from '../model/knowledgeField';

export interface NormalizationRule {
  readonly id: string;
  readonly version: string;
  readonly fields: readonly KnowledgeFieldKey[];
  /** Devuelve el valor canónico, o null si la regla no aplica. */
  readonly apply: (value: unknown) => unknown | null;
  /**
   * Normaliza UN elemento de lista. Permite rastrear qué átomo original dio
   * origen a cada átomo normalizado y, con ello, arrastrar su evidencia: sin
   * este mapeo, normalizar dejaría las citas apuntando a valores que ya no
   * existen y la propuesta jamás podría validarse.
   */
  readonly mapAtom?: (item: unknown) => unknown;
  /** Código de explicación estructurada. */
  readonly explanation: string;
}

/** Correspondencia átomo original → átomo normalizado, para mover las citas. */
export function atomMapping(
  rule: NormalizationRule,
  value: unknown,
): ReadonlyMap<string, string> {
  const mapping = new Map<string, string>();
  if (!rule.mapAtom || !Array.isArray(value)) {
    return mapping;
  }
  for (const item of value) {
    mapping.set(String(item), String(rule.mapAtom(item)));
  }
  return mapping;
}

/** Normalización textual: NFC + espacios colapsados. Nunca cambia el caso. */
export function normalizeText(value: string): string {
  return value.normalize('NFC').replace(/\s+/g, ' ').trim();
}

/** Sinónimos conocidos → etiqueta canónica de servicio. */
const SERVICE_ALIASES: Readonly<Record<string, string>> = {
  'wi-fi': SERVICE_WIFI,
  wifi: SERVICE_WIFI,
  'internet gratis': SERVICE_WIFI,
  'free wifi': SERVICE_WIFI,
  terraza: SERVICE_OUTDOOR_SEATING,
  'outdoor seating': SERVICE_OUTDOOR_SEATING,
  'mesas al aire libre': SERVICE_OUTDOOR_SEATING,
  domicilio: SERVICE_DELIVERY,
  'servicio a domicilio': SERVICE_DELIVERY,
  delivery: SERVICE_DELIVERY,
  'para llevar': SERVICE_TAKEOUT,
  takeaway: SERVICE_TAKEOUT,
  'take away': SERVICE_TAKEOUT,
};

const PAYMENT_ALIASES: Readonly<Record<string, string>> = {
  tarjeta: PAYMENT_CREDIT_CARD,
  tarjetas: PAYMENT_CREDIT_CARD,
  'tarjeta de credito': PAYMENT_CREDIT_CARD,
  'credit card': PAYMENT_CREDIT_CARD,
  'tarjeta de debito': PAYMENT_DEBIT_CARD,
  'debit card': PAYMENT_DEBIT_CARD,
  efectivo: PAYMENT_CASH,
  cash: PAYMENT_CASH,
};

/** Clave de alias: minúsculas y sin acentos, solo para BUSCAR el sinónimo. */
function aliasKey(value: string): string {
  return normalizeText(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

function mapAliases(
  value: unknown,
  table: Readonly<Record<string, string>>,
): readonly string[] | null {
  if (!Array.isArray(value)) {
    return null;
  }
  let changed = false;
  const mapped = value.map((item) => {
    const key = aliasKey(String(item));
    const canonical = table[key];
    if (canonical && canonical !== item) {
      changed = true;
      return canonical;
    }
    return String(item);
  });
  if (!changed) {
    return null;
  }
  return [...new Set(mapped)].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

/** Teléfono mexicano a formato E.164 cuando la forma lo permite sin ambigüedad. */
export function normalizePhone(raw: string): string | null {
  const trimmed = normalizeText(raw);
  const digits = trimmed.replace(/[^\d+]/g, '');
  if (/^\+52\d{10}$/.test(digits)) {
    return digits;
  }
  if (/^52\d{10}$/.test(digits)) {
    return `+${digits}`;
  }
  if (/^\d{10}$/.test(digits)) {
    return `+52${digits}`;
  }
  // Cualquier otra forma es ambigua: no se adivina.
  return null;
}

/** URL canónica: esquema explícito, host en minúsculas, sin barra final. */
export function normalizeUrl(raw: string): string | null {
  const trimmed = normalizeText(raw);
  if (trimmed.length === 0) {
    return null;
  }
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  const match = /^(https?):\/\/([^/?#]+)(.*)$/i.exec(withScheme);
  if (!match) {
    return null;
  }
  const [, scheme, host, rest] = match;
  const path = rest.replace(/\/+$/, '');
  const canonical = `${scheme.toLowerCase()}://${host.toLowerCase()}${path}`;
  return canonical === trimmed ? null : canonical;
}

export const NORMALIZATION_RULES: readonly NormalizationRule[] = [
  {
    id: 'normalize.phones.e164',
    version: '1',
    fields: ['phones'],
    explanation: 'PHONE_E164',
    apply: (value) => {
      if (!Array.isArray(value)) {
        return null;
      }
      let changed = false;
      const mapped = value.map((item) => {
        const normalized = normalizePhone(String(item));
        if (normalized && normalized !== item) {
          changed = true;
          return normalized;
        }
        return String(item);
      });
      return changed ? [...new Set(mapped)].sort() : null;
    },
    mapAtom: (item) => normalizePhone(String(item)) ?? String(item),
  },
  {
    id: 'normalize.website.canonical',
    version: '1',
    fields: ['website'],
    explanation: 'URL_CANONICAL',
    apply: (value) => (typeof value === 'string' ? normalizeUrl(value) : null),
  },
  {
    id: 'normalize.services.alias',
    version: '1',
    fields: ['services'],
    explanation: 'SERVICE_ALIAS',
    apply: (value) => mapAliases(value, SERVICE_ALIASES),
    mapAtom: (item) => SERVICE_ALIASES[aliasKey(String(item))] ?? String(item),
  },
  {
    id: 'normalize.payments.alias',
    version: '1',
    fields: ['paymentMethods'],
    explanation: 'PAYMENT_ALIAS',
    apply: (value) => mapAliases(value, PAYMENT_ALIASES),
    mapAtom: (item) => PAYMENT_ALIASES[aliasKey(String(item))] ?? String(item),
  },
  {
    id: 'normalize.languages.tag',
    version: '1',
    fields: ['languages'],
    explanation: 'LANGUAGE_TAG',
    mapAtom: (item) => normalizeText(String(item)).toLowerCase().replace(/_/g, '-'),
    apply: (value) => {
      if (!Array.isArray(value)) {
        return null;
      }
      let changed = false;
      const mapped = value.map((item) => {
        const text = normalizeText(String(item));
        const canonical = text.toLowerCase().replace(/_/g, '-');
        if (canonical !== item) {
          changed = true;
        }
        return canonical;
      });
      return changed ? [...new Set(mapped)].sort() : null;
    },
  },
];

/** Reglas aplicables a un campo, en orden determinista por id. */
export function rulesForField(field: KnowledgeFieldKey): readonly NormalizationRule[] {
  return NORMALIZATION_RULES.filter((rule) => rule.fields.includes(field)).sort((a, b) =>
    a.id < b.id ? -1 : a.id > b.id ? 1 : 0,
  );
}
