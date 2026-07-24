/**
 * PLATAFORMA DE PROMPTS (GEN-1 · Fase C).
 *
 * Un prompt es un ARTEFACTO VERSIONADO, no una cadena suelta en el código: su
 * huella viaja en los metadatos de adquisición de cada hecho, de modo que un
 * lote producido por una plantilla defectuosa puede identificarse e
 * invalidarse en bloque.
 *
 * La plantilla es neutral: describe la tarea y el contrato de respuesta, nunca
 * un producto ni un proveedor concreto. La selección es determinista.
 */
import type { KnowledgeFieldKey } from '../model/knowledgeField';
import { fingerprintOf } from './fingerprint';
import type { ProviderKind } from './providerModel';

export interface PromptDefinition {
  readonly id: string;
  readonly version: string;
  /** Clases de proveedor compatibles; vacío = cualquiera. */
  readonly providerKinds: readonly ProviderKind[];
  /** Campos que la plantilla sabe solicitar. */
  readonly fields: readonly KnowledgeFieldKey[];
  readonly template: string;
}

export interface RegisteredPrompt extends PromptDefinition {
  /** Huella determinista de `template`: identifica la versión exacta usada. */
  readonly fingerprint: string;
}

export type PromptRegistry = ReadonlyMap<string, RegisteredPrompt>;

/** Clave canónica de un prompt: id + versión. */
export function promptKeyOf(id: string, version: string): string {
  return `${id}@${version}`;
}

export function registerPrompts(definitions: readonly PromptDefinition[]): PromptRegistry {
  const registry = new Map<string, RegisteredPrompt>();
  for (const definition of definitions) {
    const key = promptKeyOf(definition.id, definition.version);
    if (!registry.has(key)) {
      registry.set(key, { ...definition, fingerprint: fingerprintOf(definition.template) });
    }
  }
  return registry;
}

/**
 * Selección determinista: entre los prompts compatibles con la clase de
 * proveedor y que cubren algún campo pedido, gana el que cubre MÁS campos y,
 * en empate, la clave ascendente.
 */
export function selectPrompt(
  registry: PromptRegistry,
  kind: ProviderKind,
  fields: readonly KnowledgeFieldKey[],
): RegisteredPrompt | null {
  const compatible = [...registry.values()]
    .filter((prompt) => prompt.providerKinds.length === 0 || prompt.providerKinds.includes(kind))
    .map((prompt) => ({
      prompt,
      covered: fields.filter((field) => prompt.fields.includes(field)).length,
    }))
    .filter((entry) => entry.covered > 0);

  if (compatible.length === 0) {
    return null;
  }

  compatible.sort((a, b) => {
    if (a.covered !== b.covered) {
      return b.covered - a.covered;
    }
    const keyA = promptKeyOf(a.prompt.id, a.prompt.version);
    const keyB = promptKeyOf(b.prompt.id, b.prompt.version);
    return keyA < keyB ? -1 : keyA > keyB ? 1 : 0;
  });
  return compatible[0].prompt;
}

/**
 * Contrato de respuesta exigido a cualquier proveedor generativo. Vive junto
 * al prompt porque es parte del acuerdo: sin cita literal no hay candidato.
 */
export const EXTRACTION_RESPONSE_CONTRACT = [
  'Devuelve únicamente afirmaciones respaldadas por el documento.',
  'Cada afirmación debe incluir la cita LITERAL del documento que la respalda.',
  'La cita debe aparecer textualmente en el documento, sin reformular.',
  'Si un dato no aparece en el documento, omítelo: lo desconocido se queda desconocido.',
  'Nunca infieras horarios, precios, accesibilidad, servicios ni pagos.',
].join(' ');

/** Prompt base para extracción por modelo de lenguaje (neutral al proveedor). */
export const BASE_EXTRACTION_PROMPT: PromptDefinition = {
  id: 'extraction.base',
  version: '1',
  providerKinds: ['language_model'],
  fields: [
    'services',
    'paymentMethods',
    'accessibility',
    'parking',
    'languages',
    'products',
    'businessType',
    'establishedYear',
  ],
  template: [
    'Extrae hechos estructurados del documento de un negocio local.',
    EXTRACTION_RESPONSE_CONTRACT,
    'Campos solicitados: {fields}.',
    'Documento: {document}',
  ].join('\n'),
};

/** Interpola una plantilla de forma determinista. */
export function renderPrompt(
  prompt: RegisteredPrompt,
  values: Readonly<Record<string, string>>,
): string {
  return prompt.template.replace(/\{(\w+)\}/g, (match, key: string) =>
    Object.prototype.hasOwnProperty.call(values, key) ? values[key] : match,
  );
}
