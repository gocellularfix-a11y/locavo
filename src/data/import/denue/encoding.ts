/**
 * Detección y decodificación de la codificación de los CSV oficiales
 * DENUE (V4C).
 *
 * Los CSV de descarga masiva del INEGI llegan históricamente en latin1
 * (ISO-8859-1/Windows-1252); ediciones futuras podrían migrar a UTF-8.
 * La detección es determinista: BOM UTF-8 explícito, o validación byte a
 * byte de las secuencias multibyte. Los acentos y la ñ se preservan en
 * ambos casos.
 */

export type DenueEncoding = 'utf8' | 'latin1';

/** ¿La secuencia en `bytes` desde `i` es un carácter UTF-8 multibyte válido? */
function utf8SequenceLength(bytes: Uint8Array, i: number): number {
  const b = bytes[i];
  let length: number;
  if ((b & 0b1110_0000) === 0b1100_0000) {
    length = 2;
  } else if ((b & 0b1111_0000) === 0b1110_0000) {
    length = 3;
  } else if ((b & 0b1111_1000) === 0b1111_0000) {
    length = 4;
  } else {
    return 0;
  }
  if (i + length > bytes.length) {
    return 0;
  }
  for (let k = 1; k < length; k++) {
    if ((bytes[i + k] & 0b1100_0000) !== 0b1000_0000) {
      return 0;
    }
  }
  return length;
}

/**
 * Detecta la codificación del archivo. Reglas:
 * - BOM UTF-8 → utf8.
 * - Algún byte alto que no forme una secuencia UTF-8 válida → latin1.
 * - Solo ASCII o secuencias UTF-8 válidas → utf8.
 */
export function detectDenueEncoding(bytes: Uint8Array): DenueEncoding {
  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    return 'utf8';
  }
  for (let i = 0; i < bytes.length; ) {
    if (bytes[i] < 0x80) {
      i++;
      continue;
    }
    const length = utf8SequenceLength(bytes, i);
    if (length === 0) {
      return 'latin1';
    }
    i += length;
  }
  return 'utf8';
}

export interface DecodedDenueText {
  text: string;
  encoding: DenueEncoding;
}

/**
 * latin1 → texto: cada byte ES su punto de código Unicode (ISO-8859-1).
 * Implementación propia porque no todos los entornos exponen un
 * TextDecoder con soporte iso-8859-1. Por bloques para no desbordar pila.
 */
function decodeLatin1(bytes: Uint8Array): string {
  const CHUNK = 8_192;
  const parts: string[] = [];
  for (let i = 0; i < bytes.length; i += CHUNK) {
    parts.push(String.fromCharCode(...bytes.subarray(i, i + CHUNK)));
  }
  return parts.join('');
}

/** Decodifica los bytes con la codificación detectada, preservando acentos. */
export function decodeDenueBytes(bytes: Uint8Array): DecodedDenueText {
  const encoding = detectDenueEncoding(bytes);
  if (encoding === 'latin1') {
    return { text: decodeLatin1(bytes), encoding };
  }
  const withoutBom =
    bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf
      ? bytes.subarray(3)
      : bytes;
  return { text: new TextDecoder('utf-8').decode(withoutBom), encoding };
}
