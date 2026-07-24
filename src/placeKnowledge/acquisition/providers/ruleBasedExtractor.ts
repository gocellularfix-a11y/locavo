/**
 * EXTRACTOR LOCAL POR REGLAS (GEN-1 · Fase C).
 *
 * Proveedor real, completamente determinista y sin conexión: es el que hace
 * posible la adquisición offline y el que sirve de referencia contra la que se
 * comparan los proveedores generativos.
 *
 * Cada regla produce la cita EXACTA que la disparó, con sus desplazamientos
 * reales sobre el documento, así que sus candidatos superan la verificación
 * literal por construcción. No infiere nada: si el patrón no aparece, no hay
 * afirmación.
 */
import type { KnowledgeFieldKey } from '../../model/knowledgeField';
import {
  BUSINESS_TYPE_FAMILY_OWNED,
  PAYMENT_CREDIT_CARD,
  SERVICE_DELIVERY,
  SERVICE_DRIVE_THRU,
  SERVICE_OUTDOOR_SEATING,
  SERVICE_RESERVATIONS,
  SERVICE_TAKEOUT,
  SERVICE_WIFI,
} from '../../model/knowledgeField';
import {
  DOCUMENT_FORMAT_HTML,
  DOCUMENT_FORMAT_JSON,
  DOCUMENT_FORMAT_MARKDOWN,
  DOCUMENT_FORMAT_OCR_TEXT,
  DOCUMENT_FORMAT_PDF,
  DOCUMENT_FORMAT_PLAIN_TEXT,
} from '../../model/evidenceSpan';
import type {
  ExtractionProvider,
  ExtractionRequest,
  ProviderClaim,
  ProviderExtraction,
} from '../providerModel';

interface ExtractionRule {
  readonly field: KnowledgeFieldKey;
  readonly pattern: RegExp;
  /** Deriva el valor a partir de la coincidencia. */
  readonly value: (match: RegExpExecArray) => unknown;
}

/**
 * Reglas en español e inglés. El orden es fijo y el recorrido exhaustivo, de
 * modo que el conjunto de afirmaciones no depende del orden de evaluación.
 */
const RULES: readonly ExtractionRule[] = [
  { field: 'services', pattern: /\b(?:free\s+wi-?fi|wi-?fi\s+gratis|internet\s+gratis|wi-?fi)\b/gi, value: () => SERVICE_WIFI },
  { field: 'services', pattern: /\b(?:outdoor\s+seating|terraza|mesas\s+al\s+aire\s+libre)\b/gi, value: () => SERVICE_OUTDOOR_SEATING },
  { field: 'services', pattern: /\b(?:servicio\s+a\s+domicilio|entrega\s+a\s+domicilio|delivery)\b/gi, value: () => SERVICE_DELIVERY },
  { field: 'services', pattern: /\b(?:para\s+llevar|take-?away|take-?out)\b/gi, value: () => SERVICE_TAKEOUT },
  { field: 'services', pattern: /\b(?:drive-?thru|drive-?through|autoservicio)\b/gi, value: () => SERVICE_DRIVE_THRU },
  { field: 'services', pattern: /\b(?:aceptamos\s+reservaciones|reservaciones|reservations)\b/gi, value: () => SERVICE_RESERVATIONS },
  { field: 'paymentMethods', pattern: /\b(?:aceptamos\s+tarjetas|tarjetas\s+de\s+cr[ée]dito|credit\s+cards?)\b/gi, value: () => PAYMENT_CREDIT_CARD },
  { field: 'accessibility', pattern: /\b(?:acceso\s+para\s+sillas\s+de\s+ruedas|silla\s+de\s+ruedas|wheelchair\s+accessible)\b/gi, value: () => ({ wheelchairAccessible: true }) },
  { field: 'parking', pattern: /\b(?:estacionamiento\s+gratuito|estacionamiento|parking)\b/gi, value: () => ({ available: true }) },
  { field: 'businessType', pattern: /\b(?:negocio\s+familiar|empresa\s+familiar|family[-\s]owned)\b/gi, value: () => BUSINESS_TYPE_FAMILY_OWNED },
  {
    field: 'establishedYear',
    pattern: /\b(?:desde|since)\s+(1[5-9]\d{2}|2[01]\d{2})\b/gi,
    value: (match) => Number.parseInt(match[1], 10),
  },
];

const SUPPORTED_FIELDS: readonly KnowledgeFieldKey[] = [
  'services',
  'paymentMethods',
  'accessibility',
  'parking',
  'businessType',
  'establishedYear',
];

export const RULE_BASED_PROVIDER_ID = 'local-rule-extractor';

/**
 * Construye el extractor por reglas. `version` viaja a los metadatos de
 * adquisición: cambiar las reglas obliga a subirla para poder invalidar en
 * bloque lo producido por la versión anterior.
 */
export function createRuleBasedExtractor(version = '1.0.0'): ExtractionProvider {
  return {
    id: RULE_BASED_PROVIDER_ID,
    version,
    kind: 'rule_based',
    capabilities: {
      formats: [
        DOCUMENT_FORMAT_PLAIN_TEXT,
        DOCUMENT_FORMAT_HTML,
        DOCUMENT_FORMAT_MARKDOWN,
        DOCUMENT_FORMAT_JSON,
        DOCUMENT_FORMAT_PDF,
        DOCUMENT_FORMAT_OCR_TEXT,
      ],
      fields: SUPPORTED_FIELDS,
      offline: true,
      deterministic: true,
      maxDocumentChars: 0,
    },
    async extract(request: ExtractionRequest): Promise<ProviderExtraction> {
      const claims: ProviderClaim[] = [];
      const text = request.document.text;

      for (const rule of RULES) {
        if (!request.fields.includes(rule.field)) {
          continue;
        }
        // Instancia propia del patrón: `lastIndex` nunca se comparte entre
        // documentos ni entre corridas.
        const pattern = new RegExp(rule.pattern.source, rule.pattern.flags);
        let match: RegExpExecArray | null;
        while ((match = pattern.exec(text)) !== null) {
          claims.push({
            field: rule.field,
            value: rule.value(match),
            quote: match[0],
            start: match.index,
            end: match.index + match[0].length,
          });
          if (match[0].length === 0) {
            pattern.lastIndex += 1;
          }
        }
      }

      return {
        claims,
        diagnostics: { rulesEvaluated: RULES.length, claimsFound: claims.length },
      };
    },
  };
}
