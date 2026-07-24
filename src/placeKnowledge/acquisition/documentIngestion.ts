/**
 * INGESTA DE EVIDENCIA (GEN-1 · Fase C).
 *
 * Convierte documentos crudos en `EvidenceDocument` inmutables listos para el
 * corpus de validación. Cada formato tiene su adaptador; ninguno hace red ni
 * disco: los formatos que requieren un motor externo (PDF, OCR, imagen)
 * reciben ese motor INYECTADO, de modo que el pipeline sigue siendo puro y
 * comprobable.
 *
 * Regla central: el texto normalizado ES el documento canónico. Todo span
 * indexa esa cadena, así que la comprobación literal de la Fase B aplica por
 * igual a HTML, Markdown, PDF, OCR o imagen.
 */
import {
  DOCUMENT_FORMAT_HTML,
  DOCUMENT_FORMAT_IMAGE_TEXT,
  DOCUMENT_FORMAT_JSON,
  DOCUMENT_FORMAT_MARKDOWN,
  DOCUMENT_FORMAT_OCR_TEXT,
  DOCUMENT_FORMAT_PDF,
  DOCUMENT_FORMAT_PLAIN_TEXT,
  type DocumentFormat,
} from '../model/evidenceSpan';
import type { EvidenceDocument } from '../validation/evidenceDocument';
import { htmlToText, markdownToText, plainToText } from './documentNormalization';
import { fingerprintOf } from './fingerprint';

/** Documento tal como llega del corpus, antes de normalizar. */
export interface RawDocument {
  readonly id: string;
  readonly format: DocumentFormat;
  /** Contenido textual original (o la capa de texto ya extraída). */
  readonly content: string;
  /** Hash del insumo original, si el operador lo registró. */
  readonly sha256?: string;
}

/**
 * Motor que convierte un insumo sin capa de texto nativa (PDF, imagen) en
 * texto. Se inyecta: la plataforma no incorpora ningún parser ni OCR concreto.
 * Debe ser determinista para el mismo insumo.
 */
export interface TextLayerEngine {
  readonly id: string;
  readonly version: string;
  extract(document: RawDocument): string;
}

export interface IngestionOptions {
  /** Motor para PDF, OCR e imágenes. Sin él esos formatos no se ingieren. */
  readonly textLayerEngine?: TextLayerEngine;
}

export type IngestionOutcome =
  | { readonly ok: true; readonly document: EvidenceDocument }
  | { readonly ok: false; readonly reason: string };

/** Formatos con capa de texto nativa: se normalizan sin motor externo. */
const NATIVE_NORMALIZERS: Readonly<Record<string, (raw: string) => string>> = {
  [DOCUMENT_FORMAT_HTML]: htmlToText,
  [DOCUMENT_FORMAT_MARKDOWN]: markdownToText,
  [DOCUMENT_FORMAT_PLAIN_TEXT]: plainToText,
  [DOCUMENT_FORMAT_JSON]: plainToText,
};

/** Formatos que EXIGEN un motor de capa de texto inyectado. */
const ENGINE_FORMATS: readonly DocumentFormat[] = [
  DOCUMENT_FORMAT_PDF,
  DOCUMENT_FORMAT_OCR_TEXT,
  DOCUMENT_FORMAT_IMAGE_TEXT,
];

export function isSupportedFormat(format: DocumentFormat, options: IngestionOptions = {}): boolean {
  if (Object.prototype.hasOwnProperty.call(NATIVE_NORMALIZERS, format)) {
    return true;
  }
  return ENGINE_FORMATS.includes(format) && options.textLayerEngine !== undefined;
}

/**
 * Ingiere un documento. Nunca lanza: un formato no soportado o un contenido
 * vacío devuelven un motivo estructurado, de modo que un documento defectuoso
 * no interrumpe el lote.
 */
export function ingestDocument(
  raw: RawDocument,
  options: IngestionOptions = {},
): IngestionOutcome {
  if (typeof raw.id !== 'string' || raw.id.trim().length === 0) {
    return { ok: false, reason: 'documento sin id' };
  }
  if (typeof raw.content !== 'string') {
    return { ok: false, reason: 'contenido no textual' };
  }

  let text: string;
  const nativeNormalizer = NATIVE_NORMALIZERS[raw.format];
  if (nativeNormalizer) {
    text = nativeNormalizer(raw.content);
  } else if (ENGINE_FORMATS.includes(raw.format)) {
    if (!options.textLayerEngine) {
      return { ok: false, reason: `formato ${raw.format} requiere un motor de capa de texto` };
    }
    text = plainToText(options.textLayerEngine.extract(raw));
  } else {
    return { ok: false, reason: `formato no soportado: ${raw.format}` };
  }

  if (text.length === 0) {
    return { ok: false, reason: 'el documento no aporta texto citable' };
  }

  // Inmutable: un documento del corpus no puede cambiar bajo los spans que ya
  // lo citan.
  return {
    ok: true,
    document: Object.freeze({
      id: raw.id,
      format: raw.format,
      text,
      sha256: raw.sha256 ?? fingerprintOf(text),
    }),
  };
}

export interface IngestionResult {
  readonly documents: readonly EvidenceDocument[];
  readonly rejected: readonly { readonly id: string; readonly reason: string }[];
}

/**
 * Ingiere un lote y ordena la salida por id: el orden de entrada no altera el
 * corpus resultante.
 */
export function ingestDocuments(
  raws: readonly RawDocument[],
  options: IngestionOptions = {},
): IngestionResult {
  const documents: EvidenceDocument[] = [];
  const rejected: { id: string; reason: string }[] = [];
  for (const raw of raws) {
    const outcome = ingestDocument(raw, options);
    if (outcome.ok) {
      documents.push(outcome.document);
    } else {
      rejected.push({ id: String(raw.id ?? ''), reason: outcome.reason });
    }
  }
  documents.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  rejected.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return { documents, rejected };
}
