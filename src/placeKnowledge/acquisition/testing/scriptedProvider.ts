/**
 * INFRAESTRUCTURA DE PRUEBA (GEN-1 · Fase C) — proveedor y transporte guionados.
 *
 * NO es un proveedor de producción ni simula uno: son utilidades de prueba que
 * devuelven respuestas fijadas para poder ejercitar el pipeline sin red y sin
 * un motor real. Viven aparte, en `testing/`, para que nunca se confundan con
 * un adaptador real.
 */
import type {
  ExtractionProvider,
  ExtractionRequest,
  ProviderCapabilities,
  ProviderExtraction,
  ProviderKind,
} from '../providerModel';
import type { LanguageModelTransport } from '../providers/languageModelProvider';

export interface ScriptedProviderOptions {
  readonly id: string;
  readonly version?: string;
  readonly kind?: ProviderKind;
  readonly capabilities?: Partial<ProviderCapabilities>;
  /** Respuesta fija, o una función de la petición. */
  readonly response: ProviderExtraction | ((request: ExtractionRequest) => ProviderExtraction);
  /** Número de invocaciones iniciales que fallan (para probar reintentos). */
  readonly failuresBeforeSuccess?: number;
}

/** Proveedor con respuesta guionada para pruebas del pipeline. */
export function createScriptedProvider(options: ScriptedProviderOptions): ExtractionProvider & {
  readonly calls: () => number;
} {
  let calls = 0;
  let remainingFailures = options.failuresBeforeSuccess ?? 0;

  return {
    id: options.id,
    version: options.version ?? '1.0.0',
    kind: options.kind ?? 'language_model',
    capabilities: {
      formats: ['plain_text', 'html', 'markdown', 'json', 'pdf', 'ocr_text', 'image_text'],
      fields: ['services', 'paymentMethods', 'accessibility', 'parking', 'languages', 'businessType', 'establishedYear'],
      offline: false,
      deterministic: false,
      maxDocumentChars: 0,
      ...options.capabilities,
    },
    async extract(request: ExtractionRequest): Promise<ProviderExtraction> {
      calls += 1;
      if (remainingFailures > 0) {
        remainingFailures -= 1;
        throw new Error(`fallo transitorio guionado en ${options.id}`);
      }
      return typeof options.response === 'function' ? options.response(request) : options.response;
    },
    calls: () => calls,
  };
}

export interface ScriptedTransportOptions {
  readonly id: string;
  readonly version?: string;
  readonly offline?: boolean;
  /** Respuesta cruda del motor (normalmente JSON). */
  readonly response: string | ((prompt: string, request: ExtractionRequest) => string);
}

/** Transporte guionado: permite ejercitar el adaptador generativo sin red. */
export function createScriptedTransport(
  options: ScriptedTransportOptions,
): LanguageModelTransport & { readonly lastPrompt: () => string } {
  let lastPrompt = '';
  return {
    id: options.id,
    version: options.version ?? '1.0.0',
    offline: options.offline ?? false,
    async send(prompt: string, request: ExtractionRequest): Promise<string> {
      lastPrompt = prompt;
      return typeof options.response === 'function' ? options.response(prompt, request) : options.response;
    },
    lastPrompt: () => lastPrompt,
  };
}
