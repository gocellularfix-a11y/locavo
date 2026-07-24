/**
 * CORPUS DE EVIDENCIA (GEN-1 · Fase B) — los documentos contra los que se
 * comprueban las citas.
 *
 * El corpus es de SOLO LECTURA y se inyecta: el validador nunca lee disco ni
 * red. Un documento es su texto exacto; la verificación de una cita es una
 * comparación literal de subcadena, sin normalizar, sin recortar y sin
 * interpretar formato. Esa literalidad es justamente lo que convierte
 * "confía en el extractor" en "verifica la cita".
 */
import type { DocumentFormat, EvidenceSpan } from '../model/evidenceSpan';

export interface EvidenceDocument {
  readonly id: string;
  readonly format: DocumentFormat;
  /**
   * Capa de texto del documento. Para PDF escaneado, OCR o imágenes es el
   * texto extraído: el span siempre indexa ESTA cadena.
   */
  readonly text: string;
  /** Hash del insumo original, si el corpus lo registró (trazabilidad). */
  readonly sha256?: string;
}

export type DocumentCorpus = ReadonlyMap<string, EvidenceDocument>;

/** Corpus vacío reutilizable (evita crear mapas nuevos en cada llamada). */
export const EMPTY_CORPUS: DocumentCorpus = new Map<string, EvidenceDocument>();

/**
 * Construye un corpus determinista. Ante ids duplicados gana el PRIMERO y el
 * resto se ignora, de modo que el orden de entrada no altera el resultado
 * silenciosamente para el mismo conjunto de documentos.
 */
export function buildDocumentCorpus(
  documents: readonly EvidenceDocument[],
): DocumentCorpus {
  const corpus = new Map<string, EvidenceDocument>();
  for (const document of documents) {
    if (!corpus.has(document.id)) {
      corpus.set(document.id, document);
    }
  }
  return corpus;
}

export type SpanCheck =
  | { readonly ok: true }
  | {
      readonly ok: false;
      readonly reason:
        | 'document_unknown'
        | 'format_mismatch'
        | 'range_invalid'
        | 'out_of_bounds'
        | 'text_mismatch';
    };

/**
 * Comprobación LITERAL de una cita contra su documento.
 *
 * Un extractor que fabrica un hecho tiene que fabricar también una cita que no
 * existe en el documento; esta función lo detecta sin IA y sin criterio
 * humano.
 */
export function verifyEvidenceSpan(span: EvidenceSpan, corpus: DocumentCorpus): SpanCheck {
  const document = corpus.get(span.documentId);
  if (!document) {
    return { ok: false, reason: 'document_unknown' };
  }
  if (document.format !== span.format) {
    return { ok: false, reason: 'format_mismatch' };
  }
  if (
    !Number.isInteger(span.start) ||
    !Number.isInteger(span.end) ||
    span.start < 0 ||
    span.end <= span.start ||
    span.text.length === 0
  ) {
    return { ok: false, reason: 'range_invalid' };
  }
  if (span.end > document.text.length) {
    return { ok: false, reason: 'out_of_bounds' };
  }
  if (document.text.slice(span.start, span.end) !== span.text) {
    return { ok: false, reason: 'text_mismatch' };
  }
  return { ok: true };
}
