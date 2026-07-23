/**
 * Política canónica de TELÉFONO (V5.7) — pura, determinista, ReDoS-safe.
 *
 * Normaliza y valida un número crudo del repositorio ANTES de construir un
 * destino `tel:`. Nunca infiere código de país, nunca modifica el registro y
 * nunca deja pasar un valor crudo a un manejador externo.
 */

export type PhoneReasonCode = 'ACTION_AVAILABLE' | 'ACTION_MISSING_VALUE' | 'ACTION_INVALID_PHONE';

export interface PhoneValidation {
  readonly valid: boolean;
  /** Destino canónico `tel:` solo cuando `valid` es true; si no, `null`. */
  readonly target: string | null;
  readonly reasonCode: PhoneReasonCode;
}

/** Límites razonables de dígitos: mínimo local; máximo E.164 (15). */
export const MIN_PHONE_DIGITS = 7;
export const MAX_PHONE_DIGITS = 15;

/** Caracteres visuales de separación permitidos (se eliminan). */
const SEPARATORS = new Set([' ', '(', ')', '.', '-']);

const INVALID: PhoneValidation = { valid: false, target: null, reasonCode: 'ACTION_INVALID_PHONE' };
const MISSING: PhoneValidation = { valid: false, target: null, reasonCode: 'ACTION_MISSING_VALUE' };

/**
 * Valida un teléfono crudo. Reglas: recorta espacios; permite un único `+`
 * inicial; elimina separadores visuales seguros; rechaza letras, esquemas
 * (`tel:`), fragmentos/consultas de URL, caracteres de control y valores vacíos;
 * exige una longitud de dígitos en [MIN, MAX]. Produce `tel:` solo tras validar.
 */
export function normalizePhone(raw: string | undefined | null): PhoneValidation {
  if (raw === undefined || raw === null) {
    return MISSING;
  }
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return MISSING;
  }

  let hasPlus = false;
  let digits = '';
  for (let i = 0; i < trimmed.length; i += 1) {
    const ch = trimmed[i];
    if (ch === '+') {
      // Solo válido como primer carácter y una sola vez.
      if (i !== 0) {
        return INVALID;
      }
      hasPlus = true;
      continue;
    }
    if (ch >= '0' && ch <= '9') {
      digits += ch;
      continue;
    }
    if (SEPARATORS.has(ch)) {
      continue;
    }
    // Letras, ':', '?', '#', '/', control, o cualquier otro → inválido.
    return INVALID;
  }

  if (digits.length < MIN_PHONE_DIGITS || digits.length > MAX_PHONE_DIGITS) {
    return INVALID;
  }

  const target = `tel:${hasPlus ? '+' : ''}${digits}`;
  return { valid: true, target, reasonCode: 'ACTION_AVAILABLE' };
}
