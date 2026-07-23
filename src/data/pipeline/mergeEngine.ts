/**
 * Motor de FUSIÓN determinista (City Pipeline V1) — genérico y neutral al
 * proveedor. Combina `CanonicalFragment[]` de múltiples fuentes en lugares
 * canónicos fusionados con:
 *   - detección de duplicados (id estable, o proximidad + nombre + categoría);
 *   - resolución de conflictos a nivel de CAMPO por confianza de fuente;
 *   - herencia de confianza desde la fuente ganadora;
 *   - atribución de TODAS las fuentes contribuyentes;
 *   - orden estable en todos los arreglos.
 *
 * Determinista: mismas entradas → misma salida. Sin `Date.now`, sin aleatoriedad,
 * sin dependencia del orden de inserción (se ordena antes de agrupar). NO está
 * cableado a la construcción del pack de Culiacán (proveedor único): es la base
 * para packs multiproveedor futuros.
 */
import { haversineKm, isValidCoordinates } from '../../domain/distance';
import type { CategoryId, Coordinates, OpeningHours } from '../../domain/place';
import type { PlaceAddress, PlaceContact, PlaceFeatures, PlacePrice, PlaceVerification } from '../../domain/places/LocavoPlace';
import type { CanonicalFragment, FragmentProvenance } from './canonicalFragment';
import type { LicenseTier } from './licenseTier';
import type { ProviderRegistry } from './providerRegistry';
import { trustRankOf } from './sourceTrust';

export interface MergedPlace {
  /** Clave de agrupación determinista (id estable o menor provider|externalId). */
  readonly key: string;
  readonly name?: string;
  readonly normalizedName?: string;
  readonly coordinates?: Coordinates;
  readonly category?: CategoryId;
  readonly address?: PlaceAddress;
  readonly contact?: PlaceContact;
  readonly features?: PlaceFeatures;
  readonly hours?: OpeningHours;
  readonly price?: PlacePrice;
  readonly searchTerms?: readonly string[];
  /** Todas las fuentes contribuyentes (atribución), en orden estable. */
  readonly sources: readonly FragmentProvenance[];
  /** Verificación heredada de la fuente de mayor confianza. */
  readonly verification: Pick<PlaceVerification, 'status' | 'confidence'>;
  /** Niveles de licencia presentes (para separar sidecars ODbL/CC-BY). */
  readonly licenseTiers: readonly LicenseTier[];
}

export interface MergeConfig {
  readonly registry: ProviderRegistry;
  /** Radio de coincidencia espacial (km) cuando no hay id estable. */
  readonly matchRadiusKm?: number;
}

const DEFAULT_RADIUS_KM = 0.06; // ~60 m

/** Clave de fragmento estable y única. */
function fragmentKey(f: CanonicalFragment): string {
  return `${f.provider}|${f.externalId}`;
}

/** Orden determinista de fragmentos de entrada (independiente de inserción). */
function sortFragments(fragments: readonly CanonicalFragment[]): CanonicalFragment[] {
  return [...fragments].sort((a, b) => (fragmentKey(a) < fragmentKey(b) ? -1 : fragmentKey(a) > fragmentKey(b) ? 1 : 0));
}

/** Celda espacial gruesa para acotar comparaciones (bucket determinista). */
function cellOf(coords: Coordinates, radiusKm: number): string {
  // ~111 km por grado; el tamaño de celda ≈ radio para que vecinos basten.
  const deg = Math.max(radiusKm / 111, 1e-4);
  return `${Math.round(coords.latitude / deg)}:${Math.round(coords.longitude / deg)}`;
}

/** ¿Dos fragmentos son el mismo lugar? (proximidad + nombre + categoría compatible). */
function isSamePlace(a: CanonicalFragment, b: CanonicalFragment, radiusKm: number): boolean {
  if (a.stableId && b.stableId) {
    return a.stableId === b.stableId;
  }
  if (!a.coordinates || !b.coordinates || !isValidCoordinates(a.coordinates) || !isValidCoordinates(b.coordinates)) {
    return false;
  }
  if (haversineKm(a.coordinates, b.coordinates) > radiusKm) {
    return false;
  }
  if (a.normalizedName && b.normalizedName && a.normalizedName !== b.normalizedName) {
    return false;
  }
  if (a.category && b.category && a.category !== b.category) {
    return false;
  }
  return true;
}

/** Union-find determinista sobre índices. */
class UnionFind {
  private readonly parent: number[];
  constructor(n: number) {
    this.parent = Array.from({ length: n }, (_, i) => i);
  }
  find(x: number): number {
    let root = x;
    while (this.parent[root] !== root) {
      root = this.parent[root];
    }
    let cur = x;
    while (this.parent[cur] !== root) {
      const next = this.parent[cur];
      this.parent[cur] = root;
      cur = next;
    }
    return root;
  }
  union(a: number, b: number): void {
    const ra = this.find(a);
    const rb = this.find(b);
    if (ra !== rb) {
      // Une hacia el índice menor (estable).
      if (ra < rb) {
        this.parent[rb] = ra;
      } else {
        this.parent[ra] = rb;
      }
    }
  }
}

/** Elige el mejor fragmento para un campo: mayor confianza → edición → clave. */
function pickWinner(
  fragments: readonly CanonicalFragment[],
  config: MergeConfig,
  has: (f: CanonicalFragment) => boolean,
): CanonicalFragment | undefined {
  let best: CanonicalFragment | undefined;
  let bestTrust = -1;
  for (const f of fragments) {
    if (!has(f)) {
      continue;
    }
    const trust = trustRankOf(config.registry.get(f.provider));
    if (best === undefined || trust > bestTrust) {
      best = f;
      bestTrust = trust;
      continue;
    }
    if (trust === bestTrust) {
      const ed = f.provenance.edition ?? '';
      const bed = best.provenance.edition ?? '';
      if (ed > bed || (ed === bed && fragmentKey(f) < fragmentKey(best))) {
        best = f;
      }
    }
  }
  return best;
}

function mergeGroup(group: readonly CanonicalFragment[], config: MergeConfig): MergedPlace {
  const ordered = [...group].sort((a, b) => (fragmentKey(a) < fragmentKey(b) ? -1 : 1));
  const winner = <T>(has: (f: CanonicalFragment) => boolean, read: (f: CanonicalFragment) => T): T | undefined => {
    const f = pickWinner(ordered, config, has);
    return f ? read(f) : undefined;
  };

  // Fuente ganadora global (mayor confianza) para heredar verificación.
  const authority = pickWinner(ordered, config, () => true);
  const verification = config.registry.verificationOf(authority?.provider);

  const sources = ordered
    .map((f) => f.provenance)
    .sort((a, b) => {
      const ta = trustRankOf(config.registry.get(a.providerId));
      const tb = trustRankOf(config.registry.get(b.providerId));
      if (ta !== tb) {
        return tb - ta;
      }
      const ka = `${a.providerId}|${a.externalId}`;
      const kb = `${b.providerId}|${b.externalId}`;
      return ka < kb ? -1 : ka > kb ? 1 : 0;
    });

  const licenseTiers = [...new Set(ordered.map((f) => f.licenseTier))].sort();
  const key = ordered[0].stableId ?? fragmentKey(ordered[0]);

  const merged: MergedPlace = {
    key,
    name: winner((f) => f.name !== undefined, (f) => f.name),
    normalizedName: winner((f) => f.normalizedName !== undefined, (f) => f.normalizedName),
    coordinates: winner((f) => f.coordinates !== undefined, (f) => f.coordinates),
    category: winner((f) => f.category !== undefined, (f) => f.category),
    address: winner((f) => f.address !== undefined, (f) => f.address),
    contact: winner((f) => f.contact !== undefined, (f) => f.contact),
    features: winner((f) => f.features !== undefined, (f) => f.features),
    hours: winner((f) => f.hours !== undefined, (f) => f.hours),
    price: winner((f) => f.price !== undefined, (f) => f.price),
    searchTerms: winner((f) => f.searchTerms !== undefined, (f) => f.searchTerms),
    sources,
    verification,
    licenseTiers,
  };
  return merged;
}

/**
 * Fusiona fragmentos en lugares canónicos. Complejidad: `O(n)` de agrupación por
 * celda (comparaciones acotadas a vecinos), `O(m log m)` de orden por grupo. Sin
 * escaneo cuadrático global sobre todo el dataset.
 */
export function mergeFragments(fragments: readonly CanonicalFragment[], config: MergeConfig): MergedPlace[] {
  const radiusKm = config.matchRadiusKm ?? DEFAULT_RADIUS_KM;
  const sorted = sortFragments(fragments);
  const uf = new UnionFind(sorted.length);

  // Índice por celda para acotar comparaciones espaciales.
  const cellIndex = new Map<string, number[]>();
  const stableIndex = new Map<string, number>();
  for (let i = 0; i < sorted.length; i += 1) {
    const f = sorted[i];
    if (f.stableId) {
      const prev = stableIndex.get(f.stableId);
      if (prev !== undefined) {
        uf.union(prev, i);
      } else {
        stableIndex.set(f.stableId, i);
      }
    }
    if (f.coordinates && isValidCoordinates(f.coordinates)) {
      const cell = cellOf(f.coordinates, radiusKm);
      const bucket = cellIndex.get(cell) ?? [];
      bucket.push(i);
      cellIndex.set(cell, bucket);
    }
  }

  // Compara solo dentro de la celda y sus 8 vecinas.
  const deg = Math.max(radiusKm / 111, 1e-4);
  for (let i = 0; i < sorted.length; i += 1) {
    const f = sorted[i];
    if (!f.coordinates || !isValidCoordinates(f.coordinates)) {
      continue;
    }
    const clat = Math.round(f.coordinates.latitude / deg);
    const clng = Math.round(f.coordinates.longitude / deg);
    for (let dlat = -1; dlat <= 1; dlat += 1) {
      for (let dlng = -1; dlng <= 1; dlng += 1) {
        const bucket = cellIndex.get(`${clat + dlat}:${clng + dlng}`);
        if (!bucket) {
          continue;
        }
        for (const j of bucket) {
          if (j > i && isSamePlace(f, sorted[j], radiusKm)) {
            uf.union(i, j);
          }
        }
      }
    }
  }

  const groups = new Map<number, CanonicalFragment[]>();
  for (let i = 0; i < sorted.length; i += 1) {
    const root = uf.find(i);
    const bucket = groups.get(root) ?? [];
    bucket.push(sorted[i]);
    groups.set(root, bucket);
  }

  return [...groups.values()]
    .map((group) => mergeGroup(group, config))
    .sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
}
