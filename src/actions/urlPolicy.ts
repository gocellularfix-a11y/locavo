/**
 * Política canónica de SITIO WEB (V5.7) — pura, determinista, ReDoS-safe.
 *
 * Validación ESTRUCTURAL (sin red, sin seguir redirecciones, sin `new URL` para
 * evitar diferencias entre entornos). Solo se permiten esquemas web aprobados
 * (`https:` y `http:`). Los dominios "desnudos" (sin esquema) se normalizan de
 * forma explícita, determinista y acotada a `https://`. Nunca deja pasar el
 * valor crudo del repositorio a un manejador externo.
 */

export type UrlReasonCode =
  | 'ACTION_AVAILABLE'
  | 'ACTION_MISSING_VALUE'
  | 'ACTION_INVALID_URL'
  | 'ACTION_UNSUPPORTED_SCHEME';

export interface UrlValidation {
  readonly valid: boolean;
  /** Destino canónico (`https:`/`http:`) solo cuando `valid` es true; si no, `null`. */
  readonly target: string | null;
  readonly reasonCode: UrlReasonCode;
}

/** Esquemas web aprobados. `http:` se permite explícitamente por política de producto. */
export const ALLOWED_WEB_SCHEMES: readonly string[] = ['https', 'http'];

/** Host válido: ≥2 etiquetas alfanuméricas (con guiones internos) y un TLD. */
const HOST_RE = /^(?=.{1,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$/;
/** Cualquier carácter de control (C0), espacio o DEL invalida la URL. */
const CONTROL_OR_SPACE_RE = /[\u0000-\u0020\u007f]/;
const SCHEME_RE = /^([a-zA-Z][a-zA-Z0-9+.-]*):/;

const MISSING: UrlValidation = { valid: false, target: null, reasonCode: 'ACTION_MISSING_VALUE' };
const INVALID: UrlValidation = { valid: false, target: null, reasonCode: 'ACTION_INVALID_URL' };
const UNSUPPORTED: UrlValidation = { valid: false, target: null, reasonCode: 'ACTION_UNSUPPORTED_SCHEME' };

/**
 * Valida un sitio web crudo. Rechaza: vacío/espacios; caracteres de control;
 * URLs relativas al esquema (`//host`); esquemas no aprobados (`javascript:`,
 * `data:`, `file:`, `intent:`, `content:`, `ftp:`, `tel:`, `mailto:`);
 * credenciales embebidas (`user@`); host vacío o malformado. Normaliza dominios
 * desnudos a `https://`. Devuelve el destino canónico solo tras validar.
 */
export function validateWebsite(raw: string | undefined | null): UrlValidation {
  if (raw === undefined || raw === null) {
    return MISSING;
  }
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return MISSING;
  }
  // Cualquier carácter de control o espacio interno invalida.
  if (CONTROL_OR_SPACE_RE.test(trimmed)) {
    return INVALID;
  }
  // URL relativa al esquema.
  if (trimmed.startsWith('//')) {
    return INVALID;
  }

  let scheme: string;
  let rest: string; // authority[/path?query#fragment]
  const schemeMatch = SCHEME_RE.exec(trimmed);
  if (schemeMatch) {
    scheme = schemeMatch[1].toLowerCase();
    if (!ALLOWED_WEB_SCHEMES.includes(scheme)) {
      return UNSUPPORTED;
    }
    const prefix = `${schemeMatch[1]}://`;
    if (!trimmed.startsWith(prefix)) {
      // p. ej. "https:foo" sin "//" → malformado.
      return INVALID;
    }
    rest = trimmed.slice(prefix.length);
  } else {
    // Dominio desnudo: normalización explícita y acotada a https.
    scheme = 'https';
    rest = trimmed;
  }

  // Autoridad = hasta el primer '/', '?' o '#'.
  let authorityEnd = rest.length;
  for (const sep of ['/', '?', '#']) {
    const at = rest.indexOf(sep);
    if (at !== -1 && at < authorityEnd) {
      authorityEnd = at;
    }
  }
  const authority = rest.slice(0, authorityEnd);
  const remainder = rest.slice(authorityEnd);

  if (authority.length === 0) {
    return INVALID;
  }
  // Credenciales embebidas.
  if (authority.includes('@')) {
    return INVALID;
  }

  // Separar host y puerto opcional.
  let host = authority;
  let port = '';
  const colon = authority.indexOf(':');
  if (colon !== -1) {
    host = authority.slice(0, colon);
    port = authority.slice(colon + 1);
    if (!/^[0-9]{1,5}$/.test(port)) {
      return INVALID;
    }
  }

  const lowerHost = host.toLowerCase();
  if (!HOST_RE.test(lowerHost)) {
    return INVALID;
  }

  const target = `${scheme}://${lowerHost}${port ? `:${port}` : ''}${remainder}`;
  return { valid: true, target, reasonCode: 'ACTION_AVAILABLE' };
}
