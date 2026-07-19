import type { CategoryId, OpeningHours } from '../place';

/**
 * Modelo canónico de lugar de Locavo (V3 — Data Foundation).
 *
 * Representa un negocio real sin quedar atado a ninguna fuente: DENUE,
 * OpenStreetMap, datos propios, propietarios o comunidad se mapean a este
 * modelo mediante adaptadores. La UI solo conoce `LocavoPlace`.
 *
 * Identidad: `id` es SIEMPRE el identificador interno de Locavo
 * (`locavoPlaceId`). Los ids de proveedores viven en `sourceRefs` y nunca
 * se usan como llave primaria.
 */

/** Categoría canónica de Locavo (las 8 del MVP; `store` = tiendas). */
export type LocavoCategory = CategoryId;

export type PlaceSource =
  | 'locavo'
  | 'denue'
  | 'openstreetmap'
  | 'owner'
  | 'community'
  | 'mock';

export type VerificationStatus =
  | 'unverified'
  | 'source_verified'
  | 'community_verified'
  | 'owner_verified'
  | 'locavo_verified';

/** Horario semanal reutilizado del evaluador existente (determinista, UTC-7). */
export type PlaceHours = OpeningHours;

export interface PlaceSourceRefs {
  locavoId?: string;
  /** Id de establecimiento DENUE. */
  denueId?: string;
  /** Clave Estadística Empresarial (INEGI). */
  clee?: string;
  /** Id de nodo/way/relation de OpenStreetMap (con prefijo de tipo). */
  osmId?: string;
  ownerId?: string;
}

export interface PlaceAddress {
  formatted?: string;
  street?: string;
  exteriorNumber?: string;
  neighborhood?: string;
  postalCode?: string;
  locality?: string;
  municipality?: string;
  state?: string;
  countryCode: string;
}

export interface PlaceContact {
  phone?: string;
  email?: string;
  website?: string;
}

export type PriceLevel = 1 | 2 | 3 | 4;

export interface PlacePrice {
  level?: PriceLevel;
  minimumAmount?: number;
  maximumAmount?: number;
  currency?: 'MXN';
}

export interface PlaceFeatures {
  wheelchairAccessible?: boolean;
  familyFriendly?: boolean;
  parking?: boolean;
  delivery?: boolean;
  outdoorSeating?: boolean;
  reservations?: boolean;
}

export interface PlaceVerification {
  status: VerificationStatus;
  /** Confianza 0–1 en la calidad/actualidad del dato. */
  confidence: number;
  /**
   * Fecha de actualización del DATASET fuente (p. ej. edición DENUE).
   * NUNCA representa una verificación individual del negocio: el INEGI no
   * confirma cada ubicación al publicar el directorio.
   */
  sourceDatasetUpdatedAt?: string;
  /** Evidencia observada del lugar específico (visita, foto, web oficial). */
  evidenceObservedAt?: string;
  /** Confirmación del propietario del negocio. */
  ownerConfirmedAt?: string;
  /** Confirmación de la comunidad. */
  communityConfirmedAt?: string;
  /** Verificación individual canónica de Locavo (la más fuerte). */
  canonicalVerifiedAt?: string;
  /**
   * Legado (semilla demo y capa cloud): fecha de verificación individual
   * simulada/registrada. Para datos derivados de datasets masivos usar
   * `sourceDatasetUpdatedAt`, jamás este campo.
   */
  lastVerifiedAt?: string;
}

/**
 * Fecha de verificación INDIVIDUAL del lugar, si existe. Las fechas de
 * dataset (sourceDatasetUpdatedAt) quedan explícitamente excluidas.
 */
export function individualVerificationDateOf(
  verification: PlaceVerification,
): string | undefined {
  return (
    verification.canonicalVerifiedAt ??
    verification.ownerConfirmedAt ??
    verification.communityConfirmedAt ??
    verification.evidenceObservedAt ??
    verification.lastVerifiedAt
  );
}

export interface PlaceProvenanceEntry {
  source: PlaceSource;
  importedAt?: string;
  updatedAt?: string;
}

export interface PlaceStatus {
  active: boolean;
  temporarilyClosed?: boolean;
  permanentlyClosed?: boolean;
}

export interface LocavoPlace {
  /** locavoPlaceId — identidad interna, nunca un id de proveedor. */
  id: string;

  sourceRefs: PlaceSourceRefs;

  name: string;
  /** Nombre normalizado (minúsculas, sin acentos) para búsqueda y dedupe. */
  normalizedName: string;

  category: LocavoCategory;
  secondaryCategories?: LocavoCategory[];

  coordinates: {
    latitude: number;
    longitude: number;
  };

  address?: PlaceAddress;
  contact?: PlaceContact;
  hours?: PlaceHours;
  price?: PlacePrice;
  features?: PlaceFeatures;

  verification: PlaceVerification;

  /** Historial de fuentes que aportaron o actualizaron este registro. */
  provenance: PlaceProvenanceEntry[];

  status: PlaceStatus;

  /** Términos internos de búsqueda (semilla local; no proviene de la fuente). */
  searchTerms?: string[];

  /**
   * Contenido localizable (descripciones futuras). El texto original nunca
   * se sobrescribe; ver domain/places/LocalizedText.ts.
   */
  content?: {
    description?: import('./LocalizedText').LocalizedText;
  };

  createdAt: string;
  updatedAt: string;
}

/** Nivel legible de confianza para la UI (sin porcentajes visibles). */
export type ConfidenceLevel = 'high' | 'medium' | 'low';

export function confidenceLevelOf(confidence: number): ConfidenceLevel {
  if (confidence >= 0.75) {
    return 'high';
  }
  if (confidence >= 0.45) {
    return 'medium';
  }
  return 'low';
}

/** Fuente principal (la primera entrada de procedencia). */
export function primarySourceOf(place: LocavoPlace): PlaceSource {
  return place.provenance[0]?.source ?? 'locavo';
}

/** Un lugar es de demostración si su procedencia incluye la fuente mock. */
export function isDemoPlace(place: LocavoPlace): boolean {
  return place.provenance.some((entry) => entry.source === 'mock');
}
