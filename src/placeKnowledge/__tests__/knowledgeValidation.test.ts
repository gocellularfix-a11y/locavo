import { ACQUISITION_LANGUAGE_MODEL } from '../model/acquisition';
import { DOCUMENT_FORMAT_HTML } from '../model/evidenceSpan';
import {
  KNOWLEDGE_SCHEMA_VERSION,
  knowledgeFragmentIdOf,
  type KnowledgeFragment,
} from '../model/knowledgeFragment';
import type { KnowledgeSource, KnowledgeSourceRegistry } from '../model/source';
import { buildDocumentCorpus, verifyEvidenceSpan } from '../validation/evidenceDocument';
import { isKnownKnowledgeField, validateFieldValue } from '../validation/fieldValueValidation';
import {
  SPAN_REQUIRED_FIELDS,
  validateKnowledgeFragment,
  type ValidationContext,
} from '../validation/fragmentValidator';
import { quarantineIndex, serializeQuarantine } from '../validation/quarantine';
import { isClockTime, isIsoDateOnly, isIsoInstant } from '../validation/temporal';
import { VALIDATOR_VERSION, type ValidationErrorCode } from '../validation/validationModel';
import {
  accumulateRejections,
  runKnowledgeValidation,
  serializeValidationReport,
} from '../validation/validationRun';

const DOCUMENT_TEXT = 'Bienvenido. Free WiFi para clientes.';
const CORPUS = buildDocumentCorpus([
  { id: 'doc-1', format: DOCUMENT_FORMAT_HTML, text: DOCUMENT_TEXT },
]);

const OFFICIAL_SOURCE: KnowledgeSource = {
  id: 'sitio-oficial',
  kind: 'official_website',
  name: 'Sitio oficial del negocio',
  license: { name: 'CDLA-Permissive-2.0', tier: 'permissive-base', shareAlike: false },
  verificationLevel: 'curated',
};

const EXCLUDED_SOURCE: KnowledgeSource = {
  id: 'fuente-propietaria',
  kind: 'community_dataset',
  name: 'Proveedor propietario',
  license: { name: 'Proprietary', tier: 'proprietary-excluded', shareAlike: false },
  verificationLevel: 'unverified',
};

const SOURCES: KnowledgeSourceRegistry = new Map([
  [OFFICIAL_SOURCE.id, OFFICIAL_SOURCE],
  [EXCLUDED_SOURCE.id, EXCLUDED_SOURCE],
]);

const CONTEXT: ValidationContext = { corpus: CORPUS, sources: SOURCES };

const CAPTURED_AT = '2026-07-01';

function validFragment(overrides: Partial<KnowledgeFragment> = {}): KnowledgeFragment {
  const base: KnowledgeFragment = {
    id: knowledgeFragmentIdOf('place-1', 'services', 'sitio-oficial', CAPTURED_AT),
    schemaVersion: KNOWLEDGE_SCHEMA_VERSION,
    placeId: 'place-1',
    field: 'services',
    value: ['wifi'],
    sourceId: 'sitio-oficial',
    evidence: {
      level: 'official_publication',
      method: 'website-extraction',
      capturedAt: CAPTURED_AT,
      span: { documentId: 'doc-1', format: DOCUMENT_FORMAT_HTML, start: 12, end: 21, text: 'Free WiFi' },
    },
    retrievedAt: '2026-07-24',
    licenseTier: 'permissive-base',
    acquisition: {
      method: ACQUISITION_LANGUAGE_MODEL,
      toolId: 'extractor-a',
      toolVersion: '1.4.0',
      acquiredAt: '2026-07-24',
    },
    validatorVersion: VALIDATOR_VERSION,
    reviewHistory: [
      { status: 'accepted', reviewer: 'jorge', reviewedAt: '2026-07-24T10:00:00.000Z', version: 2 },
    ],
  };
  return { ...base, ...overrides } as KnowledgeFragment;
}

function codesOf(fragment: KnowledgeFragment, context: ValidationContext = CONTEXT): ValidationErrorCode[] {
  return validateKnowledgeFragment(fragment, context).issues.map((issue) => issue.code);
}

describe('caso normal', () => {
  it('un fragmento íntegro se admite sin hallazgos', () => {
    const outcome = validateKnowledgeFragment(validFragment(), CONTEXT);
    expect(outcome.verdict).toBe('accepted');
    expect(outcome.issues).toEqual([]);
    expect(outcome.validatorVersion).toBe(VALIDATOR_VERSION);
  });

  it('sin revisión aún, se admite con aviso; con política estricta se rechaza', () => {
    const pendiente = validFragment({ reviewHistory: [] });
    const permisivo = validateKnowledgeFragment(pendiente, CONTEXT);
    expect(permisivo.verdict).toBe('accepted');
    expect(permisivo.issues.map((i) => i.code)).toEqual(['REVIEW_PENDING']);
    expect(permisivo.issues[0].severity).toBe('warning');

    const estricto = validateKnowledgeFragment(pendiente, {
      ...CONTEXT,
      requireAcceptedReview: true,
    });
    expect(estricto.verdict).toBe('rejected');
  });
});

describe('verificación de la cita — el mecanismo anti-fabricación', () => {
  it('la cita debe existir literalmente en el documento', () => {
    expect(
      verifyEvidenceSpan(
        { documentId: 'doc-1', format: DOCUMENT_FORMAT_HTML, start: 12, end: 21, text: 'Free WiFi' },
        CORPUS,
      ),
    ).toEqual({ ok: true });
  });

  it('un texto inventado se rechaza aunque los offsets sean válidos', () => {
    const mentira = validFragment({
      evidence: {
        level: 'official_publication',
        method: 'website-extraction',
        capturedAt: CAPTURED_AT,
        span: { documentId: 'doc-1', format: DOCUMENT_FORMAT_HTML, start: 12, end: 21, text: 'Estacionamiento gratis' },
      },
    });
    expect(codesOf(mentira)).toContain('SPAN_TEXT_MISMATCH');
  });

  it('offsets desplazados sobre texto real también se rechazan', () => {
    const desplazado = validFragment({
      evidence: {
        level: 'official_publication',
        method: 'website-extraction',
        capturedAt: CAPTURED_AT,
        span: { documentId: 'doc-1', format: DOCUMENT_FORMAT_HTML, start: 11, end: 20, text: 'Free WiFi' },
      },
    });
    expect(codesOf(desplazado)).toContain('SPAN_TEXT_MISMATCH');
  });

  it('documento desconocido, formato distinto, rango inválido y fuera de límites', () => {
    const span = { documentId: 'doc-1', format: DOCUMENT_FORMAT_HTML, start: 12, end: 21, text: 'Free WiFi' };
    expect(verifyEvidenceSpan({ ...span, documentId: 'doc-x' }, CORPUS)).toEqual({
      ok: false,
      reason: 'document_unknown',
    });
    expect(verifyEvidenceSpan({ ...span, format: 'pdf' }, CORPUS)).toEqual({
      ok: false,
      reason: 'format_mismatch',
    });
    expect(verifyEvidenceSpan({ ...span, start: 21, end: 12 }, CORPUS)).toEqual({
      ok: false,
      reason: 'range_invalid',
    });
    expect(verifyEvidenceSpan({ ...span, start: 0, end: 5000, text: 'x' }, CORPUS)).toEqual({
      ok: false,
      reason: 'out_of_bounds',
    });
  });

  it('un span vacío o con límites no enteros es inválido', () => {
    const span = { documentId: 'doc-1', format: DOCUMENT_FORMAT_HTML, start: 12, end: 21, text: 'Free WiFi' };
    expect(verifyEvidenceSpan({ ...span, text: '' }, CORPUS).ok).toBe(false);
    expect(verifyEvidenceSpan({ ...span, start: 1.5 }, CORPUS).ok).toBe(false);
    expect(verifyEvidenceSpan({ ...span, start: -1 }, CORPUS).ok).toBe(false);
  });
});

describe('política §24: lo restringido nunca se infiere', () => {
  it('los campos sensibles exigen cita', () => {
    for (const field of SPAN_REQUIRED_FIELDS) {
      expect(isKnownKnowledgeField(field)).toBe(true);
    }
    const sinSpan = validFragment({
      evidence: { level: 'official_publication', method: 'web', capturedAt: CAPTURED_AT },
    });
    expect(codesOf(sinSpan)).toContain('SPAN_REQUIRED');
  });

  it('un campo restringido no admite evidencia inferida', () => {
    const inferido = validFragment({
      evidence: {
        level: 'inferred',
        method: 'derivacion',
        capturedAt: CAPTURED_AT,
        span: { documentId: 'doc-1', format: DOCUMENT_FORMAT_HTML, start: 12, end: 21, text: 'Free WiFi' },
      },
    });
    expect(codesOf(inferido)).toContain('INFERENCE_NOT_ALLOWED');
  });

  it('un campo no restringido puede prescindir de cita', () => {
    const idiomas = validFragment({
      id: knowledgeFragmentIdOf('place-1', 'languages', 'sitio-oficial', CAPTURED_AT),
      field: 'languages',
      value: ['es-MX', 'en'],
      evidence: { level: 'owner_stated', method: 'formulario', capturedAt: CAPTURED_AT },
    });
    expect(validateKnowledgeFragment(idiomas, CONTEXT).verdict).toBe('accepted');
  });
});

describe('validación de valor por campo canónico', () => {
  it('acepta valores del vocabulario cerrado', () => {
    expect(validateFieldValue('establishedYear', 1998).ok).toBe(true);
    expect(validateFieldValue('extraCategories', ['coffee']).ok).toBe(true);
    expect(validateFieldValue('parking', { available: true, kinds: ['lot'] }).ok).toBe(true);
    expect(
      validateFieldValue('hours', { weekly: [null, null, null, null, null, null, []] }).ok,
    ).toBe(true);
  });

  it('rechaza valores fuera del vocabulario o mal formados', () => {
    expect(validateFieldValue('extraCategories', ['pizzeria']).ok).toBe(false);
    expect(validateFieldValue('parking', { kinds: ['helipuerto'] }).ok).toBe(false);
    expect(validateFieldValue('establishedYear', 1998.5).ok).toBe(false);
    expect(validateFieldValue('establishedYear', 900).ok).toBe(false);
    expect(validateFieldValue('hours', { weekly: [null] }).ok).toBe(false);
    expect(validateFieldValue('hours', { weekly: Array(7).fill([{ open: '25:00', close: '10:00' }]) }).ok).toBe(false);
    expect(validateFieldValue('phones', []).ok).toBe(false);
    expect(validateFieldValue('phones', ['+52', '+52']).ok).toBe(false);
    expect(validateFieldValue('accessibility', { wheelchairAccessible: 'si' }).ok).toBe(false);
    expect(validateFieldValue('accessibility', {}).ok).toBe(false);
  });

  it('las excepciones de horario respetan su forma', () => {
    expect(
      validateFieldValue('hoursExceptions', [
        { startDate: '2026-12-24', endDate: '2026-12-26', kind: 'closed' },
      ]).ok,
    ).toBe(true);
    expect(
      validateFieldValue('hoursExceptions', [
        { startDate: '2026-12-26', endDate: '2026-12-24', kind: 'closed' },
      ]).ok,
    ).toBe(false);
    expect(
      validateFieldValue('hoursExceptions', [
        { startDate: '2026-12-24', endDate: '2026-12-26', kind: 'closed', hours: [] },
      ]).ok,
    ).toBe(false);
    expect(
      validateFieldValue('hoursExceptions', [
        { startDate: '2027-01-01', endDate: '2027-01-01', kind: 'special_hours' },
      ]).ok,
    ).toBe(false);
  });

  it('un campo desconocido nunca se valida en silencio', () => {
    expect(isKnownKnowledgeField('precioSecreto')).toBe(false);
    // El tipo impide construirlo: solo un dato corrupto en disco llegaría así.
    const corrupto = { field: 'precioSecreto' } as unknown as Partial<KnowledgeFragment>;
    expect(codesOf(validFragment(corrupto))).toContain('FIELD_UNKNOWN');
  });
});

describe('procedencia y licencia', () => {
  it('una fuente no registrada invalida el fragmento', () => {
    const codes = codesOf(validFragment({ sourceId: 'fuente-fantasma' }));
    expect(codes).toContain('SOURCE_UNKNOWN');
    expect(codes).toContain('CONFIDENCE_NOT_DERIVABLE');
  });

  it('una licencia propietaria nunca entra al conocimiento canónico', () => {
    expect(codesOf(validFragment({ licenseTier: 'proprietary-excluded' }))).toContain('LICENSE_EXCLUDED');
    const desdeFuenteExcluida = validFragment({
      id: knowledgeFragmentIdOf('place-1', 'services', 'fuente-propietaria', CAPTURED_AT),
      sourceId: 'fuente-propietaria',
    });
    expect(codesOf(desdeFuenteExcluida)).toContain('LICENSE_EXCLUDED');
  });

  it('la licencia del fragmento debe coincidir con la de su fuente', () => {
    expect(codesOf(validFragment({ licenseTier: 'odbl-sidecar' }))).toContain('LICENSE_TIER_MISMATCH');
  });

  it('un nivel de licencia inexistente se rechaza', () => {
    const corrupto = { licenseTier: 'inventada' } as unknown as Partial<KnowledgeFragment>;
    expect(codesOf(validFragment(corrupto))).toContain('LICENSE_TIER_INVALID');
  });
});

describe('adquisición, versión de validador y esquema', () => {
  it('la adquisición incompleta se rechaza', () => {
    expect(
      codesOf(
        validFragment({
          acquisition: { method: '', toolId: '', toolVersion: '', acquiredAt: '2026-07-24' },
        }),
      ),
    ).toContain('ACQUISITION_INCOMPLETE');
  });

  it('una fecha de adquisición inválida se rechaza', () => {
    expect(
      codesOf(
        validFragment({
          acquisition: {
            method: ACQUISITION_LANGUAGE_MODEL,
            toolId: 'x',
            toolVersion: '1',
            acquiredAt: '24/07/2026',
          },
        }),
      ),
    ).toContain('ACQUISITION_ACQUIRED_AT_INVALID');
  });

  it('una versión de validador ajena se rechaza', () => {
    expect(codesOf(validFragment({ validatorVersion: 'otro-validador' }))).toContain(
      'VALIDATOR_VERSION_MISMATCH',
    );
  });

  it('una versión de esquema no soportada se rechaza', () => {
    expect(codesOf(validFragment({ schemaVersion: 1 }))).toContain('SCHEMA_VERSION_UNSUPPORTED');
    expect(codesOf(validFragment({ schemaVersion: 99 }))).toContain('SCHEMA_VERSION_UNSUPPORTED');
  });

  it('el id debe derivarse determinísticamente de sus insumos', () => {
    expect(codesOf(validFragment({ id: 'id-inventado' }))).toContain('FRAGMENT_ID_MISMATCH');
  });
});

describe('historial de revisión', () => {
  it('un rechazo previo bloquea la entrada al grafo canónico', () => {
    const rechazado = validFragment({
      reviewHistory: [
        { status: 'rejected', reviewer: 'jorge', reviewedAt: '2026-07-24T10:00:00.000Z', version: 2 },
      ],
    });
    expect(validateKnowledgeFragment(rechazado, CONTEXT).verdict).toBe('rejected');
    expect(codesOf(rechazado)).toContain('REVIEW_REJECTED');
  });

  it('un historial desordenado en el tiempo se rechaza', () => {
    const desordenado = validFragment({
      reviewHistory: [
        { status: 'pending', reviewer: 'jorge', reviewedAt: '2026-07-25T10:00:00.000Z', version: 2 },
        { status: 'accepted', reviewer: 'jorge', reviewedAt: '2026-07-24T10:00:00.000Z', version: 2 },
      ],
    });
    expect(codesOf(desordenado)).toContain('REVIEW_HISTORY_UNORDERED');
  });

  it('una entrada mal formada se rechaza', () => {
    const invalida = validFragment({
      reviewHistory: [
        { status: 'aprobado', reviewer: '', reviewedAt: 'ayer', version: 2 },
      ] as unknown as KnowledgeFragment['reviewHistory'],
    });
    expect(codesOf(invalida)).toContain('REVIEW_ENTRY_INVALID');
  });
});

describe('datos corruptos', () => {
  it('un fragmento nulo no lanza: se rechaza con veredicto', () => {
    const outcome = validateKnowledgeFragment(null as unknown as KnowledgeFragment, CONTEXT);
    expect(outcome.verdict).toBe('rejected');
    expect(outcome.issues.map((i) => i.code)).toEqual(['FRAGMENT_MALFORMED']);
  });

  it('campos base vacíos o inválidos se detectan todos a la vez', () => {
    const roto = validFragment({ placeId: '', retrievedAt: 'no-es-fecha' });
    const codes = codesOf(roto);
    expect(codes).toContain('PLACE_ID_EMPTY');
    expect(codes).toContain('RETRIEVED_AT_INVALID');
  });

  it('la evidencia ausente no impide reportar el resto', () => {
    const codes = codesOf(validFragment({ evidence: undefined as unknown as KnowledgeFragment['evidence'] }));
    expect(codes).toContain('FRAGMENT_MALFORMED');
    expect(codes).toContain('CONFIDENCE_NOT_DERIVABLE');
  });

  it('un nivel de evidencia inexistente se rechaza', () => {
    const codes = codesOf(
      validFragment({
        evidence: {
          level: 'adivinado' as never,
          method: 'x',
          capturedAt: CAPTURED_AT,
          span: { documentId: 'doc-1', format: DOCUMENT_FORMAT_HTML, start: 12, end: 21, text: 'Free WiFi' },
        },
      }),
    );
    expect(codes).toContain('EVIDENCE_LEVEL_INVALID');
  });
});

describe('comprobaciones temporales sin reloj', () => {
  it('acepta fechas y marcas de tiempo ISO reales', () => {
    expect(isIsoDateOnly('2026-07-24')).toBe(true);
    expect(isIsoInstant('2026-07-24T10:00:00.000Z')).toBe(true);
    expect(isClockTime('23:59')).toBe(true);
  });

  it('rechaza fechas inexistentes y formatos ajenos', () => {
    expect(isIsoDateOnly('2026-02-30')).toBe(false);
    expect(isIsoDateOnly('2026-13-01')).toBe(false);
    expect(isIsoDateOnly('24-07-2026')).toBe(false);
    expect(isClockTime('24:00')).toBe(false);
  });

  it('acepta el 29 de febrero solo en año bisiesto', () => {
    expect(isIsoDateOnly('2028-02-29')).toBe(true);
    expect(isIsoDateOnly('2027-02-29')).toBe(false);
  });
});

describe('corrida por lotes, cuarentena e informe', () => {
  const bueno = validFragment();
  const malo = validFragment({
    id: knowledgeFragmentIdOf('place-2', 'services', 'sitio-oficial', CAPTURED_AT),
    placeId: 'place-2',
    evidence: {
      level: 'official_publication',
      method: 'web',
      capturedAt: CAPTURED_AT,
      span: { documentId: 'doc-1', format: DOCUMENT_FORMAT_HTML, start: 12, end: 21, text: 'Inventado' },
    },
  });

  it('separa admitidos de cuarentena y cuenta los hallazgos', () => {
    const run = runKnowledgeValidation([bueno, malo], CONTEXT);
    expect(run.accepted.map((f) => f.id)).toEqual([bueno.id]);
    expect(run.quarantine.map((q) => q.fragmentId)).toEqual([malo.id]);
    expect(run.report.totals).toEqual({
      evaluated: 2,
      accepted: 1,
      quarantined: 1,
      acceptedWithWarnings: 0,
    });
    expect(run.report.issueCounts).toEqual([{ code: 'SPAN_TEXT_MISMATCH', count: 1 }]);
  });

  it('la cuarentena conserva el fragmento íntegro y sus motivos', () => {
    const run = runKnowledgeValidation([malo], CONTEXT);
    const entry = run.quarantine[0];
    expect(entry.fragment).toEqual(malo);
    expect(entry.issues.map((i) => i.code)).toContain('SPAN_TEXT_MISMATCH');
    expect(entry.placeId).toBe('place-2');
  });

  it('la memoria de cuarentena impide re-proponer lo ya rechazado', () => {
    const primera = runKnowledgeValidation([malo], CONTEXT);
    const memoria = accumulateRejections(new Set(), primera.quarantine);
    expect(memoria.has(malo.id)).toBe(true);

    // El mismo id vuelve a proponerse, ahora incluso con una cita correcta.
    const reintento = validFragment({
      id: malo.id,
      placeId: 'place-2',
    });
    const segunda = runKnowledgeValidation([reintento], {
      ...CONTEXT,
      previouslyRejected: memoria,
    });
    expect(segunda.accepted).toEqual([]);
    expect(segunda.quarantine[0].issues.map((i) => i.code)).toContain('PREVIOUSLY_QUARANTINED');
  });

  it('quarantineIndex expone los ids rechazados', () => {
    const run = runKnowledgeValidation([bueno, malo], CONTEXT);
    expect([...quarantineIndex(run.quarantine)]).toEqual([malo.id]);
  });
});

describe('determinismo y reproducibilidad', () => {
  const uno = validFragment();
  const dos = validFragment({
    id: knowledgeFragmentIdOf('place-2', 'languages', 'sitio-oficial', CAPTURED_AT),
    placeId: 'place-2',
    field: 'languages',
    value: ['es-MX'],
    evidence: { level: 'owner_stated', method: 'formulario', capturedAt: CAPTURED_AT },
  });
  const tres = validFragment({
    id: knowledgeFragmentIdOf('place-3', 'services', 'sitio-oficial', CAPTURED_AT),
    placeId: 'place-3',
    validatorVersion: 'viejo',
  });

  it('mismas entradas producen exactamente el mismo informe', () => {
    const a = runKnowledgeValidation([uno, dos, tres], CONTEXT);
    const b = runKnowledgeValidation([uno, dos, tres], CONTEXT);
    expect(serializeValidationReport(b.report)).toBe(serializeValidationReport(a.report));
    expect(serializeQuarantine(b.quarantine)).toBe(serializeQuarantine(a.quarantine));
  });

  it('el orden de entrada no altera el resultado', () => {
    const directo = runKnowledgeValidation([uno, dos, tres], CONTEXT);
    const invertido = runKnowledgeValidation([tres, dos, uno], CONTEXT);
    expect(invertido.accepted.map((f) => f.id)).toEqual(directo.accepted.map((f) => f.id));
    expect(serializeQuarantine(invertido.quarantine)).toBe(serializeQuarantine(directo.quarantine));
    expect(serializeValidationReport(invertido.report)).toBe(
      serializeValidationReport(directo.report),
    );
  });

  it('los hallazgos salen en orden canónico, no en orden de detección', () => {
    const multiple = validFragment({
      id: 'id-malo',
      schemaVersion: 99,
      validatorVersion: 'otro',
    });
    const codes = codesOf(multiple);
    expect(codes).toEqual([...codes].sort((a, b) => codes.indexOf(a) - codes.indexOf(b)));
    expect(codes.indexOf('SCHEMA_VERSION_UNSUPPORTED')).toBeLessThan(
      codes.indexOf('VALIDATOR_VERSION_MISMATCH'),
    );
  });

  it('la validación no muta el fragmento recibido', () => {
    const original = validFragment();
    const copia = JSON.parse(JSON.stringify(original));
    runKnowledgeValidation([original], CONTEXT);
    expect(JSON.parse(JSON.stringify(original))).toEqual(copia);
  });

  it('serializar el informe dos veces produce los mismos bytes', () => {
    const run = runKnowledgeValidation([uno, tres], CONTEXT);
    expect(serializeValidationReport(run.report)).toBe(serializeValidationReport(run.report));
    expect(serializeQuarantine(run.quarantine)).toBe(serializeQuarantine(run.quarantine));
  });
});

describe('compatibilidad hacia atrás', () => {
  it('el corpus vacío no rompe: solo invalida las citas', () => {
    const outcome = validateKnowledgeFragment(validFragment(), { sources: SOURCES });
    expect(outcome.verdict).toBe('rejected');
    expect(outcome.issues.map((i) => i.code)).toContain('SPAN_DOCUMENT_UNKNOWN');
  });

  it('un corpus determinista ignora ids duplicados conservando el primero', () => {
    const corpus = buildDocumentCorpus([
      { id: 'd', format: 'html', text: 'primero' },
      { id: 'd', format: 'html', text: 'segundo' },
    ]);
    expect(corpus.get('d')?.text).toBe('primero');
    expect(corpus.size).toBe(1);
  });

  it('el motor de precedencia sigue intacto y ajeno a la validación', () => {
    // La Fase B no resuelve conflictos ni fusiona: solo admite o rechaza.
    const run = runKnowledgeValidation([validFragment()], CONTEXT);
    expect(Object.keys(run)).toEqual(['accepted', 'quarantine', 'outcomes', 'report']);
  });
});
