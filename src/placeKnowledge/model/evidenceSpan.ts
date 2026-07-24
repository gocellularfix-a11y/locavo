/**
 * SPAN DE EVIDENCIA (GEN-1 · Fase A) — la porción EXACTA del documento fuente
 * que respalda un hecho.
 *
 * Sin span no existe forma mecánica de distinguir una extracción de una
 * invención. Con él, cualquiera puede comprobar —sin IA y sin criterio
 * humano— que el texto citado aparece literalmente en el documento original.
 *
 * Este módulo define ÚNICAMENTE la estructura. La comprobación
 * (`documento.slice(start, end) === text`) pertenece al validador de la Fase B
 * y aquí no se implementa.
 */

/**
 * Formato del documento citado (cadena abierta; constantes canónicas abajo).
 * Agregar un formato futuro es agregar una constante, nunca editar una unión.
 */
export type DocumentFormat = string;

export const DOCUMENT_FORMAT_PLAIN_TEXT: DocumentFormat = 'plain_text';
export const DOCUMENT_FORMAT_HTML: DocumentFormat = 'html';
export const DOCUMENT_FORMAT_MARKDOWN: DocumentFormat = 'markdown';
export const DOCUMENT_FORMAT_JSON: DocumentFormat = 'json';
export const DOCUMENT_FORMAT_PDF: DocumentFormat = 'pdf';
export const DOCUMENT_FORMAT_OCR_TEXT: DocumentFormat = 'ocr_text';
export const DOCUMENT_FORMAT_IMAGE_TEXT: DocumentFormat = 'image_text';

/**
 * Cita verificable dentro de un documento del corpus de evidencia.
 *
 * Los desplazamientos son SIEMPRE índices de carácter sobre la capa de texto
 * del documento identificado. Para formatos sin texto nativo (PDF escaneado,
 * OCR, imágenes) el documento del corpus es la capa de texto extraída y el
 * span apunta a ella, de modo que la comprobación literal sigue aplicando sin
 * excepción por formato.
 */
export interface EvidenceSpan {
  /** Identificador del documento en el corpus de evidencia. */
  readonly documentId: string;
  readonly format: DocumentFormat;
  /** Índice del primer carácter citado (base 0, inclusivo). */
  readonly start: number;
  /** Índice siguiente al último carácter citado (exclusivo). */
  readonly end: number;
  /** Texto citado, literal y sin normalizar. */
  readonly text: string;
}
