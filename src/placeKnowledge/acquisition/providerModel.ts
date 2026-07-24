/**
 * CONTRATO DE PROVEEDOR DE EXTRACCIÓN (GEN-1 · Fase C).
 *
 * Un proveedor propone AFIRMACIONES; jamás produce conocimiento canónico y
 * jamás se le cree. Toda afirmación debe venir acompañada de la cita literal
 * que la respalda, y todo candidato pasa después por la validación de la Fase
 * B, que comprueba esa cita contra el documento.
 *
 * Ninguna lógica específica de un proveedor concreto vive fuera de su
 * adaptador: aquí solo hay la forma común. Un extractor local por reglas, un
 * OCR, un modelo local o uno en la nube implementan exactamente esta interfaz.
 */
import type { DocumentFormat } from '../model/evidenceSpan';
import type { KnowledgeFieldKey } from '../model/knowledgeField';
import type { EvidenceDocument } from '../validation/evidenceDocument';

/** Clase de mecanismo. Describe la NATURALEZA, nunca el producto comercial. */
export type ProviderKind =
  | 'rule_based'
  | 'language_model'
  | 'ocr'
  | 'computer_vision'
  | 'manual'
  | 'external_api';

export interface ProviderCapabilities {
  /** Formatos de documento que el proveedor puede procesar. */
  readonly formats: readonly DocumentFormat[];
  /** Campos del catálogo que sabe proponer. */
  readonly fields: readonly KnowledgeFieldKey[];
  /** ¿Funciona sin conexión? Determina la selección en modo local-first. */
  readonly offline: boolean;
  /** ¿La misma entrada produce siempre la misma salida? */
  readonly deterministic: boolean;
  /** Cota de tamaño del documento; 0 = sin cota declarada. */
  readonly maxDocumentChars: number;
}

/**
 * Afirmación propuesta por un proveedor. `quote` es obligatoria: sin cita no
 * hay forma de verificar nada y el candidato será rechazado.
 */
export interface ProviderClaim {
  readonly field: KnowledgeFieldKey;
  readonly value: unknown;
  /** Texto literal del documento que respalda la afirmación. */
  readonly quote: string;
  /** Desplazamientos propuestos; si no verifican, se localiza la cita. */
  readonly start?: number;
  readonly end?: number;
}

export interface ExtractionRequest {
  readonly placeId: string;
  readonly document: EvidenceDocument;
  /** Campos solicitados; el proveedor puede devolver un subconjunto. */
  readonly fields: readonly KnowledgeFieldKey[];
}

export interface ProviderExtraction {
  readonly claims: readonly ProviderClaim[];
  /** Diagnóstico estructurado del proveedor (nunca prosa para el usuario). */
  readonly diagnostics?: Readonly<Record<string, string | number | boolean>>;
}

export interface ExtractionProvider {
  readonly id: string;
  readonly version: string;
  readonly kind: ProviderKind;
  readonly capabilities: ProviderCapabilities;
  extract(request: ExtractionRequest): Promise<ProviderExtraction>;
}

/** ¿El proveedor puede atender esta petición? */
export function providerSupports(
  provider: ExtractionProvider,
  request: ExtractionRequest,
): boolean {
  const { capabilities } = provider;
  if (!capabilities.formats.includes(request.document.format)) {
    return false;
  }
  if (capabilities.maxDocumentChars > 0 && request.document.text.length > capabilities.maxDocumentChars) {
    return false;
  }
  return request.fields.some((field) => capabilities.fields.includes(field));
}
