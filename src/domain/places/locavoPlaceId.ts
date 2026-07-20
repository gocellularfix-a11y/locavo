/**
 * Identidad canónica de lugar de Locavo — UUID v5 DETERMINISTA (RFC 4122).
 *
 * `LocavoPlace.id` (locavoPlaceId) es SIEMPRE una identidad propia de Locavo,
 * jamás un id de proveedor. Para datos derivados de un proveedor (DENUE,
 * OpenStreetMap, …) la identidad canónica se deriva de forma DETERMINISTA con
 * un UUID versión 5 (namespace + nombre, SHA-1) sobre un namespace propio de
 * Locavo y un nombre estable `<provider>:<externalId>`.
 *
 * Propiedades (garantizadas por el estándar UUID v5):
 * - el MISMO registro de proveedor produce SIEMPRE el mismo UUID
 *   (reproducible entre builds, máquinas, clones limpios, Web y Android);
 * - registros distintos producen UUIDs distintos (colisión ~imposible);
 * - NO depende de aleatoriedad ni del orden de construcción del pack.
 *
 * El id de proveedor (denue_id) y la CLEE se preservan APARTE en `sources[]`
 * / `sourceRefs`; nunca son la identidad canónica.
 *
 * Implementación pura en JS (sin dependencias ni APIs nativas) para que la
 * misma identidad se derive de forma idéntica en Node (empaquetado), en las
 * pruebas y en cualquier runtime. Verificada contra el vector RFC 4122.
 */

/**
 * Namespace PROPIO de Locavo para identidades de lugar (entrada del UUID v5).
 * CONSTANTE PERMANENTE: cambiar este valor reasignaría TODAS las identidades
 * canónicas de lugar. No modificar.
 */
export const LOCAVO_PLACE_NAMESPACE = '9e6a7b40-2d5c-4c8b-9f3a-1e2d3c4b5a60';

/** Codifica una cadena a bytes UTF-8 (sin dependencias nativas). */
function utf8Bytes(text: string): number[] {
  const out: number[] = [];
  for (let i = 0; i < text.length; i++) {
    let code = text.charCodeAt(i);
    if (code < 0x80) {
      out.push(code);
    } else if (code < 0x800) {
      out.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
    } else if (code >= 0xd800 && code <= 0xdbff) {
      // Par subrogado → punto de código completo.
      const hi = code;
      const lo = text.charCodeAt(++i);
      code = 0x10000 + ((hi - 0xd800) << 10) + (lo - 0xdc00);
      out.push(
        0xf0 | (code >> 18),
        0x80 | ((code >> 12) & 0x3f),
        0x80 | ((code >> 6) & 0x3f),
        0x80 | (code & 0x3f),
      );
    } else {
      out.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
    }
  }
  return out;
}

/** SHA-1 (RFC 3174) sobre un arreglo de bytes → 20 bytes. Puro, determinista. */
function sha1(bytes: readonly number[]): number[] {
  const rotl = (n: number, s: number): number => ((n << s) | (n >>> (32 - s))) >>> 0;

  const message = bytes.slice();
  const originalBitLen = message.length * 8;
  message.push(0x80);
  while (message.length % 64 !== 56) {
    message.push(0);
  }
  // Longitud en bits como entero de 64 bits big-endian (32 bits altos = 0
  // para nuestras entradas, muy por debajo de 2^32 bits).
  for (let i = 7; i >= 0; i--) {
    message.push((Math.floor(originalBitLen / 2 ** (i * 8)) & 0xff) >>> 0);
  }

  let h0 = 0x67452301;
  let h1 = 0xefcdab89;
  let h2 = 0x98badcfe;
  let h3 = 0x10325476;
  let h4 = 0xc3d2e1f0;

  const w = new Array<number>(80);
  for (let chunk = 0; chunk < message.length; chunk += 64) {
    for (let i = 0; i < 16; i++) {
      const j = chunk + i * 4;
      w[i] =
        ((message[j] << 24) |
          (message[j + 1] << 16) |
          (message[j + 2] << 8) |
          message[j + 3]) >>>
        0;
    }
    for (let i = 16; i < 80; i++) {
      w[i] = rotl((w[i - 3] ^ w[i - 8] ^ w[i - 14] ^ w[i - 16]) >>> 0, 1);
    }

    let a = h0;
    let b = h1;
    let c = h2;
    let d = h3;
    let e = h4;
    for (let i = 0; i < 80; i++) {
      let f: number;
      let k: number;
      if (i < 20) {
        f = (b & c) | (~b & d);
        k = 0x5a827999;
      } else if (i < 40) {
        f = b ^ c ^ d;
        k = 0x6ed9eba1;
      } else if (i < 60) {
        f = (b & c) | (b & d) | (c & d);
        k = 0x8f1bbcdc;
      } else {
        f = b ^ c ^ d;
        k = 0xca62c1d6;
      }
      const temp = (rotl(a, 5) + f + e + k + w[i]) >>> 0;
      e = d;
      d = c;
      c = rotl(b, 30);
      b = a;
      a = temp;
    }
    h0 = (h0 + a) >>> 0;
    h1 = (h1 + b) >>> 0;
    h2 = (h2 + c) >>> 0;
    h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0;
  }

  const out: number[] = [];
  for (const h of [h0, h1, h2, h3, h4]) {
    out.push((h >>> 24) & 0xff, (h >>> 16) & 0xff, (h >>> 8) & 0xff, h & 0xff);
  }
  return out;
}

/** Convierte un UUID canónico a sus 16 bytes. */
function uuidToBytes(uuid: string): number[] {
  const hex = uuid.replace(/-/g, '');
  if (!/^[0-9a-fA-F]{32}$/.test(hex)) {
    throw new Error(`UUID de namespace inválido: ${uuid}`);
  }
  const bytes: number[] = [];
  for (let i = 0; i < 16; i++) {
    bytes.push(parseInt(hex.slice(i * 2, i * 2 + 2), 16));
  }
  return bytes;
}

/** Formatea 16 bytes como UUID canónico en minúsculas. */
function bytesToUuid(bytes: readonly number[]): string {
  const hex = bytes.map((b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/**
 * UUID versión 5 (RFC 4122): SHA-1(namespace || name), con bits de versión y
 * variante fijados. Determinista y estándar.
 */
export function uuidV5(name: string, namespace: string): string {
  const hash = sha1([...uuidToBytes(namespace), ...utf8Bytes(name)]);
  const bytes = hash.slice(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x50; // versión 5
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // variante RFC 4122
  return bytesToUuid(bytes);
}

/**
 * Identidad canónica de Locavo para un registro de proveedor. El nombre v5 es
 * `<provider>:<externalId>` para que ids numéricos iguales de proveedores
 * distintos nunca colisionen.
 */
export function locavoPlaceIdFromProvider(provider: string, externalId: string): string {
  return uuidV5(`${provider}:${externalId}`, LOCAVO_PLACE_NAMESPACE);
}

/** Identidad canónica de Locavo para un establecimiento DENUE (por denue_id). */
export function locavoPlaceIdFromDenue(denueId: string): string {
  return locavoPlaceIdFromProvider('denue', denueId);
}

/** Valida el formato de un UUID v5 canónico de Locavo. */
export function isLocavoPlaceId(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(value);
}
