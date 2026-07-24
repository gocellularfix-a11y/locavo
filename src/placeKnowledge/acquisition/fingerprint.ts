/**
 * HUELLA determinista (GEN-1 · Fase C).
 *
 * FNV-1a de 32 bits en hexadecimal. Misma cadena → misma huella, sin
 * dependencias, sin reloj y sin aleatoriedad. Se usa para identificar
 * versiones de prompt y contenidos de documento, no para seguridad
 * criptográfica.
 */
const FNV_OFFSET_BASIS = 0x811c9dc5;
const FNV_PRIME = 0x01000193;

export function fingerprintOf(input: string): string {
  let hash = FNV_OFFSET_BASIS;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, FNV_PRIME);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}
