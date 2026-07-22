import { haversineKm } from '../../domain/distance';
import type { LocavoPlace } from '../../domain/places/LocavoPlace';
import { normalizeText, tokenize } from '../../utils/text';

/**
 * Detección de duplicados entre fuentes (V3).
 *
 * Decide si dos registros representan el mismo negocio ANTES de fusionar
 * datos de DENUE, OSM, propietarios o comunidad. En esta fase define el
 * algoritmo y sus pruebas; no fusiona datos reales todavía.
 *
 * Reglas:
 * - Teléfono o dominio web coincidente pesan mucho.
 * - Nombre similar sin cercanía NO basta (cadenas y sucursales).
 * - Cercanía sin nombre similar NO basta (locales vecinos).
 * - Nunca fusionar automáticamente con confianza baja; la procedencia se
 *   conserva siempre (el historial vive en `provenance`).
 */

export type PlaceMatchReason =
  | 'nearby_coordinates'
  | 'similar_name'
  | 'same_phone'
  | 'same_website'
  | 'similar_address'
  | 'same_category';

export interface PlaceMatchResult {
  likelySamePlace: boolean;
  confidence: number;
  reasons: PlaceMatchReason[];
  /** Distancia canónica en metros (ya calculada; compartida, no recalculada). */
  distanceMeters: number;
  /** Similitud de nombre canónica 0–1 (ya calculada; compartida). */
  nameSimilarity: number;
}

/** Umbral mínimo para considerar dos registros el mismo lugar. */
export const MERGE_CONFIDENCE_THRESHOLD = 0.75;

/** Banda FUERTE de cercanía (m) — corroboración fuerte reconocida por el motor. */
export const NEARBY_STRONG_M = 75;
/** Umbral FUERTE de similitud de nombre — corroboración fuerte del motor. */
export const STRONG_NAME_SIMILARITY = 0.8;
const NEARBY_WEAK_M = 200;

export function normalizedDigits(phone: string | undefined): string | null {
  if (!phone) {
    return null;
  }
  const digits = phone.replace(/\D/g, '');
  // Compara los últimos 10 dígitos (número nacional MX).
  return digits.length >= 10 ? digits.slice(-10) : digits.length > 0 ? digits : null;
}

export function websiteDomain(url: string | undefined): string | null {
  if (!url) {
    return null;
  }
  const match = /^(?:https?:\/\/)?(?:www\.)?([^/?#]+)/i.exec(url.trim());
  return match ? match[1].toLowerCase() : null;
}

/** Similitud de nombres 0–1: igualdad, contención o Jaccard de tokens. */
export function nameSimilarity(a: string, b: string): number {
  const na = normalizeText(a);
  const nb = normalizeText(b);
  if (na.length === 0 || nb.length === 0) {
    return 0;
  }
  if (na === nb) {
    return 1;
  }
  if (na.includes(nb) || nb.includes(na)) {
    return 0.85;
  }
  const ta = new Set(tokenize(na));
  const tb = new Set(tokenize(nb));
  const intersection = [...ta].filter((t) => tb.has(t)).length;
  const union = new Set([...ta, ...tb]).size;
  return union === 0 ? 0 : intersection / union;
}

function addressSimilar(a: LocavoPlace, b: LocavoPlace): boolean {
  const fa = normalizeText(a.address?.formatted ?? '');
  const fb = normalizeText(b.address?.formatted ?? '');
  if (fa.length === 0 || fb.length === 0) {
    return false;
  }
  if (fa === fb) {
    return true;
  }
  const ta = new Set(tokenize(fa));
  const tb = new Set(tokenize(fb));
  const intersection = [...ta].filter((t) => tb.has(t)).length;
  return intersection >= Math.min(ta.size, tb.size) * 0.6 && intersection >= 2;
}

export function matchPlaces(a: LocavoPlace, b: LocavoPlace): PlaceMatchResult {
  const reasons: PlaceMatchReason[] = [];
  let confidence = 0;

  const distanceM = haversineKm(a.coordinates, b.coordinates) * 1000;
  const similarity = nameSimilarity(a.name, b.name);
  const nameIsSimilar = similarity >= STRONG_NAME_SIMILARITY;
  const nameIsClose = similarity >= 0.5;

  const phoneA = normalizedDigits(a.contact?.phone);
  const phoneB = normalizedDigits(b.contact?.phone);
  const samePhone = phoneA !== null && phoneA === phoneB;

  const domainA = websiteDomain(a.contact?.website);
  const domainB = websiteDomain(b.contact?.website);
  const sameWebsite = domainA !== null && domainA === domainB;

  if (samePhone) {
    reasons.push('same_phone');
    confidence += 0.45;
  }
  if (sameWebsite) {
    reasons.push('same_website');
    confidence += 0.4;
  }
  if (distanceM <= NEARBY_STRONG_M) {
    reasons.push('nearby_coordinates');
    confidence += 0.25;
  } else if (distanceM <= NEARBY_WEAK_M) {
    reasons.push('nearby_coordinates');
    confidence += 0.12;
  }
  if (nameIsSimilar) {
    reasons.push('similar_name');
    confidence += 0.3;
  } else if (nameIsClose) {
    reasons.push('similar_name');
    confidence += 0.12;
  }
  if (addressSimilar(a, b)) {
    reasons.push('similar_address');
    confidence += 0.15;
  }
  if (a.category === b.category) {
    reasons.push('same_category');
    confidence += 0.05;
  }

  confidence = Math.min(1, confidence);

  // Señales fuertes requeridas: identificador compartido (teléfono/web) o
  // nombre similar Y cercanía real. Nada de fusiones por una sola señal débil.
  const hasStrongSignal =
    samePhone || sameWebsite || (nameIsSimilar && distanceM <= NEARBY_WEAK_M);

  return {
    likelySamePlace: hasStrongSignal && confidence >= MERGE_CONFIDENCE_THRESHOLD,
    confidence,
    reasons,
    distanceMeters: distanceM,
    nameSimilarity: similarity,
  };
}
