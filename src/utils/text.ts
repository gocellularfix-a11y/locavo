/**
 * Normalización de texto para búsqueda local:
 * minúsculas, sin acentos/diacríticos y con espacios colapsados.
 */
export function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** Divide una consulta normalizada en tokens no vacíos. */
export function tokenize(value: string): string[] {
  const normalized = normalizeText(value);
  return normalized.length === 0 ? [] : normalized.split(' ');
}
