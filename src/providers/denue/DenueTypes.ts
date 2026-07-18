/**
 * Tipos mínimos del DENUE (INEGI) — Directorio Estadístico Nacional de
 * Unidades Económicas. Fuente oficial principal prevista para negocios en
 * México. NO conectado en V3.
 *
 * Referencia de campos del API público de DENUE (subconjunto relevante).
 */
export interface DenueEstablecimiento {
  /** Id del establecimiento en DENUE. */
  Id: string;
  /** Clave Estadística Empresarial. */
  CLEE?: string;
  Nombre: string;
  Razon_social?: string;
  /** Código y descripción de actividad SCIAN. */
  Clase_actividad?: string;
  Codigo_actividad?: string;
  Calle?: string;
  Num_Exterior?: string;
  Colonia?: string;
  CP?: string;
  Ubicacion?: string;
  Telefono?: string;
  Correo_e?: string;
  Sitio_internet?: string;
  Latitud: string;
  Longitud: string;
}
