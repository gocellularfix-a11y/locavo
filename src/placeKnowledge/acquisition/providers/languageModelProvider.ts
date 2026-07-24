/**
 * PROVEEDOR GENERATIVO (GEN-1 · Fase C) — adaptador neutral.
 *
 * Un solo adaptador sirve a cualquier motor de lenguaje —local o en la nube—
 * porque el TRANSPORTE se inyecta. Aquí no hay lógica de ningún producto
 * concreto: nombre de modelo, endpoint, autenticación y reintentos de red
 * viven en el transporte que provee el operador, fuera del pipeline
 * determinista.
 *
 * El adaptador solo hace tres cosas: renderizar el prompt versionado, pedir la
 * respuesta al transporte y traducirla al contrato de afirmaciones. Nada de lo
 * que devuelva el motor se cree: cada afirmación necesita su cita, y la
 * validación de la Fase B la comprueba contra el documento.
 */
import type { KnowledgeFieldKey } from '../../model/knowledgeField';
import { isKnownKnowledgeField } from '../../validation/fieldValueValidation';
import type { RegisteredPrompt } from '../promptRegistry';
import { renderPrompt } from '../promptRegistry';
import type {
  ExtractionProvider,
  ExtractionRequest,
  ProviderCapabilities,
  ProviderClaim,
  ProviderExtraction,
} from '../providerModel';

/**
 * Transporte inyectado: recibe el prompt renderizado y devuelve la respuesta
 * cruda del motor. Puede hablar con un modelo local o con una API remota; la
 * plataforma no lo sabe ni le importa.
 */
export interface LanguageModelTransport {
  readonly id: string;
  readonly version: string;
  /** ¿Corre en la máquina, sin red? Determina la selección local-first. */
  readonly offline: boolean;
  send(prompt: string, request: ExtractionRequest): Promise<string>;
}

export interface LanguageModelProviderOptions {
  readonly transport: LanguageModelTransport;
  readonly prompt: RegisteredPrompt;
  readonly fields?: readonly KnowledgeFieldKey[];
  readonly maxDocumentChars?: number;
  /** Un motor generativo no se declara determinista salvo prueba explícita. */
  readonly deterministic?: boolean;
}

/** Afirmación cruda esperada del motor; cualquier otra forma se descarta. */
interface RawClaim {
  readonly field?: unknown;
  readonly value?: unknown;
  readonly quote?: unknown;
  readonly start?: unknown;
  readonly end?: unknown;
}

function parseClaims(raw: string): { claims: ProviderClaim[]; malformed: number } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { claims: [], malformed: 1 };
  }
  const list = Array.isArray(parsed)
    ? parsed
    : typeof parsed === 'object' && parsed !== null && Array.isArray((parsed as { claims?: unknown }).claims)
      ? ((parsed as { claims: unknown[] }).claims)
      : null;
  if (!list) {
    return { claims: [], malformed: 1 };
  }

  const claims: ProviderClaim[] = [];
  let malformed = 0;
  for (const item of list) {
    const candidate = item as RawClaim;
    if (
      typeof candidate?.field !== 'string' ||
      !isKnownKnowledgeField(candidate.field) ||
      typeof candidate.quote !== 'string' ||
      candidate.quote.length === 0 ||
      candidate.value === undefined
    ) {
      malformed += 1;
      continue;
    }
    claims.push({
      field: candidate.field,
      value: candidate.value,
      quote: candidate.quote,
      ...(typeof candidate.start === 'number' ? { start: candidate.start } : {}),
      ...(typeof candidate.end === 'number' ? { end: candidate.end } : {}),
    });
  }
  return { claims, malformed };
}

export function createLanguageModelProvider(
  options: LanguageModelProviderOptions,
): ExtractionProvider {
  const capabilities: ProviderCapabilities = {
    formats: [],
    fields: options.fields ?? options.prompt.fields,
    offline: options.transport.offline,
    deterministic: options.deterministic ?? false,
    maxDocumentChars: options.maxDocumentChars ?? 0,
  };

  return {
    id: options.transport.id,
    version: `${options.transport.version}+${options.prompt.fingerprint}`,
    kind: 'language_model',
    capabilities: {
      ...capabilities,
      // Un motor de lenguaje trabaja sobre la capa de texto, así que acepta
      // cualquier formato ya ingerido.
      formats: ['plain_text', 'html', 'markdown', 'json', 'pdf', 'ocr_text', 'image_text'],
    },
    async extract(request: ExtractionRequest): Promise<ProviderExtraction> {
      const requested = request.fields.filter((field) => capabilities.fields.includes(field));
      const prompt = renderPrompt(options.prompt, {
        fields: requested.join(', '),
        document: request.document.text,
        placeId: request.placeId,
      });

      const raw = await options.transport.send(prompt, request);
      const { claims, malformed } = parseClaims(raw);

      // Solo se conservan afirmaciones de campos realmente solicitados: un
      // motor no puede ampliar por su cuenta el alcance de la extracción.
      const scoped = claims.filter((claim) => requested.includes(claim.field));

      return {
        claims: scoped,
        diagnostics: {
          promptId: options.prompt.id,
          promptVersion: options.prompt.version,
          promptFingerprint: options.prompt.fingerprint,
          claimsReturned: claims.length,
          claimsOutOfScope: claims.length - scoped.length,
          malformedClaims: malformed,
        },
      };
    },
  };
}
