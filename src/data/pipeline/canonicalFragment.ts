/**
 * FRAGMENTO canónico (City Pipeline V1) — la estructura intermedia ÚNICA que
 * todo adaptador de proveedor produce. Nunca es un `LocavoPlace` final ni un DTO
 * específico del proveedor: es una contribución parcial y neutral que el motor
 * de fusión combina. La procedencia y el nivel de licencia viajan con cada
 * fragmento para trazabilidad y separación legal.
 *
 * Nada específico de un proveedor escapa del adaptador: aquí solo hay campos
 * canónicos del dominio.
 */
import type { CategoryId, Coordinates, OpeningHours } from '../../domain/place';
import type { PlaceAddress, PlaceContact, PlaceFeatures, PlacePrice } from '../../domain/places/LocavoPlace';
import type { LicenseTier } from './licenseTier';
import type { ProviderId } from './providerId';

/** Procedencia por fragmento: de dónde salió y con qué referencia de proveedor. */
export interface FragmentProvenance {
  readonly providerId: ProviderId;
  /** Id del establecimiento en la fuente (denue_id, osm node/way/relation…). */
  readonly externalId: string;
  readonly dataset?: string;
  readonly edition?: string;
  readonly sourceFile?: string;
  /** Señales crudas seguras del proveedor (p. ej. código SCIAN), nunca PII libre. */
  readonly extra?: Readonly<Record<string, string | number>>;
}

export interface CanonicalFragment {
  readonly provider: ProviderId;
  readonly externalId: string;
  /**
   * Id estable entre proveedores si existe (Overture GERS, "node/123" de OSM):
   * permite cortocircuitar la deduplicación sin heurística.
   */
  readonly stableId?: string;

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

  readonly provenance: FragmentProvenance;
  readonly licenseTier: LicenseTier;
}
