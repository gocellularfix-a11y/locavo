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
/**
 * Caracteres peligrosos/invisibles que invalidan la URL en cualquier posicion
 * (esquema, host, puerto, ruta, consulta, fragmento): controles C0 y espacio
 * (0000-0020), DEL + controles C1 + NBSP (007f-00a0), separadores de linea y
 * parrafo (2028/2029), ancho cero y marcas direccionales (200b-200f), union de
 * palabras (2060) y BOM/ZWNBSP (feff). No rechaza texto internacional visible.
 */
const ASCII_CTRL_RE = /[\u0000-\u0020\u007f]/;
const INVISIBLE_RE = /[\u0080-\u00a0\u2028\u2029\u200b-\u200f\u2060\ufeff]/;
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
  // Invisibles peligrosos (C1, NBSP, separadores de línea/párrafo, ancho cero,
  // marcas direccionales, unión de palabras, BOM) se rechazan en CUALQUIER
  // posición sobre el valor crudo: nunca son legítimos, ni en los extremos, y
  // `trim` no debe "limpiarlos" silenciosamente.
  if (INVISIBLE_RE.test(raw)) {
    return INVALID;
  }
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return MISSING;
  }
  // Control ASCII (C0), espacio o DEL interno invalida.
  if (ASCII_CTRL_RE.test(trimmed)) {
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
    // Puerto: solo dígitos y dentro del rango TCP válido 0–65535.
    if (!/^[0-9]{1,5}$/.test(port) || Number(port) > 65535) {
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
