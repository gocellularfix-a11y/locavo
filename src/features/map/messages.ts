/**
 * Mensajes WebView ↔ aplicación.
 *
 * Solo se aceptan tipos de la allowlist y con la forma exacta esperada.
 * JSON inválido o estructuras desconocidas se descartan sin lanzar.
 */

export type MapMessage =
  | { type: 'select'; id: string }
  | { type: 'ready' }
  | { type: 'error' };

const ALLOWED_TYPES = new Set(['select', 'ready', 'error']);

export function parseMapMessage(raw: unknown): MapMessage | null {
  if (typeof raw !== 'string' || raw.length === 0 || raw.length > 10_000) {
    return null;
  }
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof data !== 'object' || data === null) {
    return null;
  }
  const type = (data as { type?: unknown }).type;
  if (typeof type !== 'string' || !ALLOWED_TYPES.has(type)) {
    return null;
  }
  if (type === 'select') {
    const id = (data as { id?: unknown }).id;
    if (typeof id !== 'string' || id.length === 0 || id.length > 200) {
      return null;
    }
    return { type: 'select', id };
  }
  return { type } as MapMessage;
}
