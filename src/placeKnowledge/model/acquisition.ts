/**
 * METADATOS DE ADQUISICIÓN (GEN-1 · Fase A) — CÓMO se obtuvo un hecho.
 *
 * Deliberadamente INDEPENDIENTE DE LA TECNOLOGÍA: el modelo no nombra ningún
 * proveedor, producto ni modelo concreto, y no debe hacerlo nunca. Un motor de
 * reglas, un parser determinista, OCR, visión por computadora, un modelo de
 * lenguaje, la captura manual o una API externa se registran todos con la
 * misma forma. La arquitectura representa CONOCIMIENTO, jamás
 * implementaciones.
 *
 * Solo registra procedencia. No ejecuta nada y no decide nada.
 */

/**
 * Método de adquisición (cadena abierta; constantes canónicas abajo). Describe
 * la CLASE de mecanismo, nunca la herramienta concreta —esa va en `toolId`.
 */
export type AcquisitionMethod = string;

export const ACQUISITION_RULE_ENGINE: AcquisitionMethod = 'rule_engine';
export const ACQUISITION_DETERMINISTIC_PARSER: AcquisitionMethod = 'deterministic_parser';
export const ACQUISITION_OCR: AcquisitionMethod = 'ocr';
export const ACQUISITION_COMPUTER_VISION: AcquisitionMethod = 'computer_vision';
export const ACQUISITION_LANGUAGE_MODEL: AcquisitionMethod = 'language_model';
export const ACQUISITION_MANUAL_ENTRY: AcquisitionMethod = 'manual_entry';
export const ACQUISITION_EXTERNAL_API: AcquisitionMethod = 'external_api';

export interface AcquisitionMetadata {
  readonly method: AcquisitionMethod;
  /**
   * Identificador OPACO de la herramienta que produjo el hecho, definido por
   * el operador de la corrida. El modelo no interpreta su contenido.
   */
  readonly toolId: string;
  /**
   * Versión de esa herramienta. Es lo que permite invalidar EN BLOQUE todos
   * los hechos producidos por una versión defectuosa sin tocar los demás; sin
   * este campo un lote malo sería irrastreable.
   */
  readonly toolVersion: string;
  /** Parámetros deterministas de la corrida; nunca texto libre del usuario. */
  readonly parameters?: Readonly<Record<string, string | number | boolean>>;
  /** Fecha de la corrida de adquisición (ISO-8601); dato de proceso. */
  readonly acquiredAt: string;
}
