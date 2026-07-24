/**
 * COMPROBACIONES TEMPORALES (GEN-1 · Fase B) — puras y sin reloj.
 *
 * Validar una fecha NO es compararla con "ahora": el validador jamás lee el
 * reloj, porque hacerlo volvería el resultado dependiente del momento de la
 * corrida y rompería la reproducibilidad. Aquí solo se comprueba FORMA y
 * existencia del calendario.
 */

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/;
const CLOCK_TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

/** ¿La fecha existe realmente en el calendario? (rechaza 2026-02-30). */
function isRealCalendarDate(value: string): boolean {
  const [year, month, day] = value.split('-').map((part) => Number.parseInt(part, 10));
  if (month < 1 || month > 12 || day < 1) {
    return false;
  }
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return day <= daysInMonth;
}

/** Fecha 'YYYY-MM-DD' existente. */
export function isIsoDateOnly(value: unknown): value is string {
  return typeof value === 'string' && DATE_ONLY.test(value) && isRealCalendarDate(value);
}

/** Marca de tiempo ISO-8601 completa y parseable. */
export function isIsoDateTime(value: unknown): value is string {
  return (
    typeof value === 'string' && DATE_TIME.test(value) && !Number.isNaN(Date.parse(value))
  );
}

/** Fecha o marca de tiempo ISO-8601 (ambas comparables lexicográficamente). */
export function isIsoInstant(value: unknown): value is string {
  return isIsoDateOnly(value) || isIsoDateTime(value);
}

/** Hora local 'HH:mm' en formato 24 h. */
export function isClockTime(value: unknown): value is string {
  return typeof value === 'string' && CLOCK_TIME.test(value);
}
