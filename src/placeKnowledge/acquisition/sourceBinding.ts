/**
 * LIGADURA DE FUENTE (GEN-1 · Fase D) — atribución auditable y detección de
 * manipulación.
 *
 * Un documento NO prueba de qué fuente proviene: su texto puede decir
 * cualquier cosa. Lo que sí puede hacerse es exigir que alguien haya
 * DECLARADO esa atribución de forma explícita, versionada y verificable, y
 * detectar después cuando el contenido cambió, cuando la fuente es
 * desconocida, cuando dos declaraciones se contradicen o cuando la licencia
 * dejó de permitir su uso.
 *
 * El propósito es trazabilidad y detección de alteraciones, no adivinar el
 * origen. Sin ligadura válida ningún documento autoriza conocimiento.
 */
import type { LicenseTier } from '../../data/pipeline/licenseTier';
import { isExcluded } from '../../data/pipeline/licenseTier';
import type { EvidenceLevel } from '../model/evidence';
import { EVIDENCE_LEVEL_RANK } from '../model/evidence';
import type { KnowledgeSourceRegistry } from '../model/source';
import type { EvidenceDocument } from '../validation/evidenceDocument';
import { isIsoInstant } from '../validation/temporal';
import { fingerprintOf } from './fingerprint';

/** Cómo llegó el documento al corpus. */
export type AcquisitionOrigin =
  | 'operator_upload'
  | 'official_website_fetch'
  | 'owner_submission'
  | 'government_dataset'
  | 'community_submission'
  | 'partner_feed';

export interface SourceBinding {
  /** Id determinista; ver `sourceBindingIdOf`. */
  readonly id: string;
  readonly documentId: string;
  readonly sourceId: string;
  /** Huella del TEXTO del documento en el momento de declarar la ligadura. */
  readonly contentFingerprint: string;
  /** Nivel de evidencia que el operador declara para este documento. */
  readonly declaredEvidenceLevel: EvidenceLevel;
  readonly licenseTier: LicenseTier;
  readonly acquisitionOrigin: AcquisitionOrigin;
  /** Persona o proceso que responde por la atribución. */
  readonly attestedBy: string;
  readonly attestedAt: string;
  readonly bindingVersion: number;
}

export interface AcquisitionManifest {
  readonly manifestId: string;
  /** Fecha de la corrida de ingesta (dato, nunca reloj). */
  readonly retrievedAt: string;
  readonly bindings: readonly SourceBinding[];
}

/** Huella canónica del contenido de un documento. */
export function contentFingerprintOf(text: string): string {
  return fingerprintOf(text);
}

/** Id determinista de ligadura: mismos insumos → mismo id. */
export function sourceBindingIdOf(
  documentId: string,
  sourceId: string,
  contentFingerprint: string,
  bindingVersion: number,
): string {
  return `${documentId}::${sourceId}::${contentFingerprint}::v${bindingVersion}`;
}

export type BindingIssueCode =
  | 'BINDING_ID_MISMATCH'
  | 'BINDING_SOURCE_UNKNOWN'
  | 'BINDING_LICENSE_MISMATCH'
  | 'BINDING_SOURCE_EXCLUDED'
  | 'BINDING_EVIDENCE_LEVEL_INVALID'
  | 'BINDING_ATTESTATION_INVALID'
  | 'BINDING_CONTENT_MODIFIED'
  | 'BINDING_CONFLICTING'
  | 'BINDING_DUPLICATE'
  | 'BINDING_MISSING'
  | 'BINDING_DUPLICATE_EVIDENCE';

export interface BindingIssue {
  readonly code: BindingIssueCode;
  readonly severity: 'error' | 'warning';
  readonly documentId: string;
  readonly detail?: Readonly<Record<string, string | number | boolean>>;
}

const BINDING_CODE_ORDER: readonly BindingIssueCode[] = [
  'BINDING_MISSING',
  'BINDING_ID_MISMATCH',
  'BINDING_SOURCE_UNKNOWN',
  'BINDING_LICENSE_MISMATCH',
  'BINDING_SOURCE_EXCLUDED',
  'BINDING_EVIDENCE_LEVEL_INVALID',
  'BINDING_ATTESTATION_INVALID',
  'BINDING_CONTENT_MODIFIED',
  'BINDING_CONFLICTING',
  'BINDING_DUPLICATE',
  'BINDING_DUPLICATE_EVIDENCE',
];

function compareIssues(a: BindingIssue, b: BindingIssue): number {
  const byCode =
    BINDING_CODE_ORDER.indexOf(a.code) - BINDING_CODE_ORDER.indexOf(b.code);
  if (byCode !== 0) {
    return byCode;
  }
  return a.documentId < b.documentId ? -1 : a.documentId > b.documentId ? 1 : 0;
}

export interface BindingResolution {
  /** Ligaduras utilizables, indexadas por documento. */
  readonly authorized: ReadonlyMap<string, SourceBinding>;
  readonly issues: readonly BindingIssue[];
}

/**
 * Valida el manifiesto contra el registro de fuentes y los documentos
 * realmente ingeridos.
 *
 * Distingue: ligadura válida; documento sin ligadura; fuente desconocida;
 * contenido modificado bajo una ligadura vieja; el mismo documento ligado de
 * forma contradictoria; ligadura duplicada idéntica; licencia que dejó de
 * permitir el uso; y evidencia duplicada (documentos distintos con contenido
 * idéntico). Documentos distintos de una misma fuente son legítimos y no
 * generan hallazgo.
 */
export function resolveSourceBindings(
  manifest: AcquisitionManifest,
  documents: readonly EvidenceDocument[],
  sources: KnowledgeSourceRegistry,
): BindingResolution {
  const issues: BindingIssue[] = [];
  const byDocument = new Map<string, SourceBinding>();
  const seenBindingIds = new Set<string>();

  for (const binding of manifest.bindings) {
    const expectedId = sourceBindingIdOf(
      binding.documentId,
      binding.sourceId,
      binding.contentFingerprint,
      binding.bindingVersion,
    );
    if (binding.id !== expectedId) {
      issues.push({
        code: 'BINDING_ID_MISMATCH',
        severity: 'error',
        documentId: binding.documentId,
        detail: { expected: expectedId },
      });
      continue;
    }

    if (seenBindingIds.has(binding.id)) {
      issues.push({
        code: 'BINDING_DUPLICATE',
        severity: 'warning',
        documentId: binding.documentId,
        detail: { bindingId: binding.id },
      });
      continue;
    }
    seenBindingIds.add(binding.id);

    const existing = byDocument.get(binding.documentId);
    if (existing) {
      // Mismo documento con atribución distinta: nadie decide por su cuenta
      // cuál gana; ambas quedan fuera y se reporta.
      issues.push({
        code: 'BINDING_CONFLICTING',
        severity: 'error',
        documentId: binding.documentId,
        detail: { first: existing.sourceId, second: binding.sourceId },
      });
      byDocument.delete(binding.documentId);
      continue;
    }

    const source = sources.get(binding.sourceId);
    if (!source) {
      issues.push({
        code: 'BINDING_SOURCE_UNKNOWN',
        severity: 'error',
        documentId: binding.documentId,
        detail: { sourceId: binding.sourceId },
      });
      continue;
    }
    if (isExcluded(source.license)) {
      issues.push({
        code: 'BINDING_SOURCE_EXCLUDED',
        severity: 'error',
        documentId: binding.documentId,
        detail: { sourceId: binding.sourceId },
      });
      continue;
    }
    if (source.license.tier !== binding.licenseTier) {
      issues.push({
        code: 'BINDING_LICENSE_MISMATCH',
        severity: 'error',
        documentId: binding.documentId,
        detail: { declared: binding.licenseTier, registry: source.license.tier },
      });
      continue;
    }
    if (!Object.prototype.hasOwnProperty.call(EVIDENCE_LEVEL_RANK, binding.declaredEvidenceLevel)) {
      issues.push({
        code: 'BINDING_EVIDENCE_LEVEL_INVALID',
        severity: 'error',
        documentId: binding.documentId,
        detail: { level: String(binding.declaredEvidenceLevel) },
      });
      continue;
    }
    if (
      typeof binding.attestedBy !== 'string' ||
      binding.attestedBy.trim().length === 0 ||
      !isIsoInstant(binding.attestedAt)
    ) {
      issues.push({
        code: 'BINDING_ATTESTATION_INVALID',
        severity: 'error',
        documentId: binding.documentId,
      });
      continue;
    }

    byDocument.set(binding.documentId, binding);
  }

  // Contraste con los documentos realmente ingeridos.
  const fingerprintOwners = new Map<string, string>();
  for (const document of documents) {
    const binding = byDocument.get(document.id);
    if (!binding) {
      issues.push({ code: 'BINDING_MISSING', severity: 'error', documentId: document.id });
      continue;
    }
    const actual = contentFingerprintOf(document.text);
    if (actual !== binding.contentFingerprint) {
      // El contenido cambió desde que se declaró la atribución.
      issues.push({
        code: 'BINDING_CONTENT_MODIFIED',
        severity: 'error',
        documentId: document.id,
        detail: { declared: binding.contentFingerprint, actual },
      });
      byDocument.delete(document.id);
      continue;
    }
    const owner = fingerprintOwners.get(actual);
    if (owner !== undefined) {
      issues.push({
        code: 'BINDING_DUPLICATE_EVIDENCE',
        severity: 'warning',
        documentId: document.id,
        detail: { identicalTo: owner },
      });
    } else {
      fingerprintOwners.set(actual, document.id);
    }
  }

  issues.sort(compareIssues);
  return { authorized: byDocument, issues };
}

/** Serializa un manifiesto con orden estable y auditable. */
export function serializeAcquisitionManifest(manifest: AcquisitionManifest): string {
  const bindings = [...manifest.bindings]
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    .map((binding) => ({
      id: binding.id,
      documentId: binding.documentId,
      sourceId: binding.sourceId,
      contentFingerprint: binding.contentFingerprint,
      declaredEvidenceLevel: binding.declaredEvidenceLevel,
      licenseTier: binding.licenseTier,
      acquisitionOrigin: binding.acquisitionOrigin,
      attestedBy: binding.attestedBy,
      attestedAt: binding.attestedAt,
      bindingVersion: binding.bindingVersion,
    }));
  return JSON.stringify({
    manifestId: manifest.manifestId,
    retrievedAt: manifest.retrievedAt,
    bindings,
  });
}

/** Construye una ligadura con su id determinista ya calculado. */
export function createSourceBinding(
  input: Omit<SourceBinding, 'id' | 'contentFingerprint'> & {
    readonly documentText: string;
  },
): SourceBinding {
  const contentFingerprint = contentFingerprintOf(input.documentText);
  return {
    id: sourceBindingIdOf(
      input.documentId,
      input.sourceId,
      contentFingerprint,
      input.bindingVersion,
    ),
    documentId: input.documentId,
    sourceId: input.sourceId,
    contentFingerprint,
    declaredEvidenceLevel: input.declaredEvidenceLevel,
    licenseTier: input.licenseTier,
    acquisitionOrigin: input.acquisitionOrigin,
    attestedBy: input.attestedBy,
    attestedAt: input.attestedAt,
    bindingVersion: input.bindingVersion,
  };
}
