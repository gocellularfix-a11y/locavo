/**
 * Arquitectura de LICENCIA (City Pipeline V1) — separación legal formal.
 *
 * Un City Pack se compone de una BASE permissive relicenciable más sidecars
 * OPCIONALES etiquetados y removibles (ODbL/CC-BY). Esta capa modela el tipo de
 * licencia de cada proveedor para que el constructor de packs pueda mantener la
 * separación:
 *
 *   Base permissive  →  Sidecars ODbL  →  Sidecars CC-BY  →  City Pack
 *
 * Los proveedores propietarios que prohíben cache/redistribución quedan
 * EXCLUIDOS del dataset canónico (nunca alimentan un pack offline).
 */
export type LicenseTier =
  | 'permissive-base'
  | 'odbl-sidecar'
  | 'ccby-sidecar'
  | 'proprietary-excluded';

export interface ProviderLicense {
  /** Nombre de la licencia (p. ej. "CDLA-Permissive-2.0", "ODbL-1.0"). */
  readonly name: string;
  readonly tier: LicenseTier;
  /** ¿Requiere atribución share-alike sobre datos derivados? (ODbL/CC-BY-SA). */
  readonly shareAlike: boolean;
  /** Texto de atribución obligatorio, si aplica. */
  readonly attribution?: string;
  readonly url?: string;
}

/** ¿La licencia permite integrarse a la base relicenciable del pack? */
export function isPermissiveBase(license: ProviderLicense): boolean {
  return license.tier === 'permissive-base';
}

/** ¿La licencia obliga a un sidecar separado (share-alike)? */
export function requiresSidecar(license: ProviderLicense): boolean {
  return license.tier === 'odbl-sidecar' || license.tier === 'ccby-sidecar';
}

/** ¿La licencia excluye al proveedor de un pack offline (propietaria)? */
export function isExcluded(license: ProviderLicense): boolean {
  return license.tier === 'proprietary-excluded';
}
