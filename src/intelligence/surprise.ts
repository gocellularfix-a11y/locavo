/**
 * Orden SURPRISE determinista (V5.0).
 *
 * Decisión de alcance: V5.0 define el CONTRATO de `surprise` como un orden
 * determinista sembrado sobre IDs de lugar estables (misma semilla → mismo
 * orden; distinta semilla → orden distinto pero determinista). La POLÍTICA de
 * ranking que mezcle distancia/apertura se difiere a V5.1. Nunca usa
 * `Math.random()`.
 */

/** Clave determinista [0, 1) a partir de (semilla, id) vía FNV-1a de 32 bits. */
export function surpriseKey(seed: number, placeId: string): number {
  const input = `${seed}:${placeId}`;
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0) / 0x1_0000_0000;
}
