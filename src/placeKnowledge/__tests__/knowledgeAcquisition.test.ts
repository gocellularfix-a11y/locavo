import {
  batchTargets,
  runAcquisition,
  serializeAcquisitionReport,
  type AcquisitionTarget,
} from '../acquisition/acquisitionSession';
import { buildCandidates } from '../acquisition/candidateBuilder';
import { ingestDocument, ingestDocuments, isSupportedFormat } from '../acquisition/documentIngestion';
import { htmlToText, markdownToText } from '../acquisition/documentNormalization';
import { fingerprintOf } from '../acquisition/fingerprint';
import {
  BASE_EXTRACTION_PROMPT,
  promptKeyOf,
  registerPrompts,
  renderPrompt,
  selectPrompt,
} from '../acquisition/promptRegistry';
import { buildProviderRegistry, selectProvider, selectProviders } from '../acquisition/providerRegistry';
import { createLanguageModelProvider } from '../acquisition/providers/languageModelProvider';
import { createRuleBasedExtractor } from '../acquisition/providers/ruleBasedExtractor';
import { withRetry } from '../acquisition/retryPolicy';
import {
  createScriptedProvider,
  createScriptedTransport,
} from '../acquisition/testing/scriptedProvider';
import type { KnowledgeSource, KnowledgeSourceRegistry } from '../model/source';
import { serializeQuarantine } from '../validation/quarantine';
import { serializeValidationReport } from '../validation/validationRun';

const SITE: KnowledgeSource = {
  id: 'sitio-oficial',
  kind: 'official_website',
  name: 'Sitio oficial',
  license: { name: 'CDLA-Permissive-2.0', tier: 'permissive-base', shareAlike: false },
  verificationLevel: 'curated',
};
const SOURCES: KnowledgeSourceRegistry = new Map([[SITE.id, SITE]]);

const HTML = `
  <html><head><style>.a{color:red}</style></head>
  <body><h1>Café del Río</h1>
  <p>Free WiFi para clientes. Negocio familiar desde 1998.</p>
  <p>Aceptamos tarjetas y contamos con estacionamiento.</p>
  <script>console.log('oculto')</script>
  </body></html>`;

function target(overrides: Partial<AcquisitionTarget> = {}): AcquisitionTarget {
  return {
    placeId: 'place-1',
    document: { id: 'doc-1', format: 'html', content: HTML },
    sourceId: 'sitio-oficial',
    licenseTier: 'permissive-base',
    evidenceLevel: 'official_publication',
    capturedAt: '2026-07-01',
    ...overrides,
  };
}

const RULE_PROVIDER = createRuleBasedExtractor();
const REGISTRY = buildProviderRegistry([RULE_PROVIDER]);
const FIELDS = ['services', 'paymentMethods', 'parking', 'businessType', 'establishedYear'] as const;

async function runWithRules(overrides: Partial<AcquisitionTarget> = {}) {
  return runAcquisition({
    targets: [target(overrides)],
    fields: [...FIELDS],
    providers: REGISTRY,
    sources: SOURCES,
    retrievedAt: '2026-07-24',
  });
}

describe('normalización e ingesta', () => {
  it('HTML descarta script y style, decodifica entidades y colapsa espacio', () => {
    const text = htmlToText('<p>Caf&eacute; &amp; T&eacute;</p><script>x</script><style>y</style>');
    expect(text).not.toContain('x');
    expect(text).not.toContain('y');
    expect(text).toContain('&');
    expect(text).not.toMatch(/\s{2,}/);
  });

  it('Markdown conserva el texto del enlace y descarta la URL', () => {
    expect(markdownToText('# Título\n[Locavo](https://ejemplo.mx) **fuerte**')).toBe(
      'Título Locavo fuerte',
    );
  });

  it('la ingesta produce documentos inmutables con huella', () => {
    const outcome = ingestDocument({ id: 'd', format: 'plain_text', content: '  hola   mundo ' });
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.document.text).toBe('hola mundo');
    expect(outcome.document.sha256).toBe(fingerprintOf('hola mundo'));
    expect(Object.isFrozen(outcome.document)).toBe(true);
  });

  it('PDF, OCR e imagen exigen un motor de capa de texto inyectado', () => {
    expect(isSupportedFormat('pdf')).toBe(false);
    const engine = { id: 'ocr', version: '1', extract: () => 'texto extraido' };
    expect(isSupportedFormat('pdf', { textLayerEngine: engine })).toBe(true);
    const sinMotor = ingestDocument({ id: 'p', format: 'pdf', content: '%PDF' });
    expect(sinMotor).toEqual({ ok: false, reason: 'formato pdf requiere un motor de capa de texto' });
    const conMotor = ingestDocument({ id: 'p', format: 'pdf', content: '%PDF' }, { textLayerEngine: engine });
    expect(conMotor.ok).toBe(true);
  });

  it('rechaza formatos no soportados y documentos sin texto citable', () => {
    expect(ingestDocument({ id: 'x', format: 'audio', content: 'a' }).ok).toBe(false);
    expect(ingestDocument({ id: 'x', format: 'plain_text', content: '   ' }).ok).toBe(false);
    expect(ingestDocument({ id: '', format: 'plain_text', content: 'a' }).ok).toBe(false);
  });

  it('un lote se ordena por id sin importar el orden de entrada', () => {
    const raws = [
      { id: 'b', format: 'plain_text', content: 'dos' },
      { id: 'a', format: 'plain_text', content: 'uno' },
    ];
    expect(ingestDocuments(raws).documents.map((d) => d.id)).toEqual(['a', 'b']);
    expect(ingestDocuments([...raws].reverse()).documents.map((d) => d.id)).toEqual(['a', 'b']);
  });
});

describe('registro y selección de proveedores', () => {
  const offline = createScriptedProvider({
    id: 'a-offline',
    response: { claims: [] },
    capabilities: { offline: true, deterministic: true },
  });
  const cloud = createScriptedProvider({ id: 'b-cloud', response: { claims: [] } });
  const registry = buildProviderRegistry([cloud, offline]);
  const request = {
    placeId: 'p',
    document: { id: 'd', format: 'plain_text' as const, text: 'texto' },
    fields: ['services' as const],
  };

  it('local-first: prefiere el proveedor sin conexión', () => {
    expect(selectProvider(registry, request, { preferOffline: true })?.id).toBe('a-offline');
  });

  it('puede exigir determinismo declarado', () => {
    const ids = selectProviders(registry, request, { requireDeterministic: true }).map((p) => p.id);
    expect(ids).toEqual(['a-offline']);
  });

  it('puede fijarse a un proveedor concreto', () => {
    expect(selectProvider(registry, request, { providerId: 'b-cloud' })?.id).toBe('b-cloud');
  });

  it('devuelve null cuando ninguno soporta el formato o el campo', () => {
    const limitado = buildProviderRegistry([
      createScriptedProvider({ id: 'solo-html', response: { claims: [] }, capabilities: { formats: ['html'] } }),
    ]);
    expect(selectProvider(limitado, request)).toBeNull();
  });

  it('ids duplicados conservan el primero registrado', () => {
    const dup = buildProviderRegistry([offline, createScriptedProvider({ id: 'a-offline', response: { claims: [] } })]);
    expect(dup.size).toBe(1);
    expect(dup.get('a-offline')?.capabilities.offline).toBe(true);
  });
});

describe('plataforma de prompts', () => {
  const registry = registerPrompts([
    BASE_EXTRACTION_PROMPT,
    { ...BASE_EXTRACTION_PROMPT, version: '2', fields: ['services'] },
  ]);

  it('calcula huellas deterministas por plantilla', () => {
    const uno = registerPrompts([BASE_EXTRACTION_PROMPT]);
    const dos = registerPrompts([BASE_EXTRACTION_PROMPT]);
    const key = promptKeyOf(BASE_EXTRACTION_PROMPT.id, BASE_EXTRACTION_PROMPT.version);
    expect(uno.get(key)?.fingerprint).toBe(dos.get(key)?.fingerprint);
    expect(uno.get(key)?.fingerprint).toBe(fingerprintOf(BASE_EXTRACTION_PROMPT.template));
  });

  it('una plantilla distinta produce una huella distinta', () => {
    const otro = registerPrompts([{ ...BASE_EXTRACTION_PROMPT, template: 'otra cosa' }]);
    const key = promptKeyOf(BASE_EXTRACTION_PROMPT.id, BASE_EXTRACTION_PROMPT.version);
    expect(otro.get(key)?.fingerprint).not.toBe(fingerprintOf(BASE_EXTRACTION_PROMPT.template));
  });

  it('selecciona el prompt que cubre más campos, con desempate estable', () => {
    const elegido = selectPrompt(registry, 'language_model', ['services', 'parking']);
    expect(elegido?.version).toBe('1');
    expect(selectPrompt(registry, 'ocr', ['services'])).toBeNull();
  });

  it('renderiza de forma determinista y deja intactos los marcadores desconocidos', () => {
    const prompt = registry.get(promptKeyOf('extraction.base', '1'));
    const rendered = renderPrompt(prompt!, { fields: 'services', document: 'texto' });
    expect(rendered).toContain('Campos solicitados: services.');
    expect(rendered).toContain('Documento: texto');
    expect(renderPrompt(prompt!, {})).toContain('{fields}');
  });
});

describe('extractor local por reglas', () => {
  it('propone hechos con la cita exacta que los dispara', async () => {
    const doc = ingestDocument({ id: 'd', format: 'html', content: HTML });
    if (!doc.ok) throw new Error('ingesta fallida');
    const extraction = await RULE_PROVIDER.extract({
      placeId: 'place-1',
      document: doc.document,
      fields: [...FIELDS],
    });
    for (const claim of extraction.claims) {
      expect(doc.document.text.slice(claim.start, claim.end)).toBe(claim.quote);
    }
    expect(extraction.claims.map((c) => c.field)).toContain('services');
    expect(extraction.claims.find((c) => c.field === 'establishedYear')?.value).toBe(1998);
  });

  it('no afirma nada cuando el patrón no aparece', async () => {
    const doc = ingestDocument({ id: 'd', format: 'plain_text', content: 'Solo el nombre del negocio.' });
    if (!doc.ok) throw new Error('ingesta fallida');
    const extraction = await RULE_PROVIDER.extract({
      placeId: 'p',
      document: doc.document,
      fields: [...FIELDS],
    });
    expect(extraction.claims).toEqual([]);
  });

  it('solo propone campos solicitados', async () => {
    const doc = ingestDocument({ id: 'd', format: 'html', content: HTML });
    if (!doc.ok) throw new Error('ingesta fallida');
    const extraction = await RULE_PROVIDER.extract({
      placeId: 'p',
      document: doc.document,
      fields: ['establishedYear'],
    });
    expect([...new Set(extraction.claims.map((c) => c.field))]).toEqual(['establishedYear']);
  });
});

describe('construcción de candidatos', () => {
  const doc = { id: 'd', format: 'plain_text' as const, text: 'Free WiFi y terraza abierta.' };
  const provider = RULE_PROVIDER;
  const base = {
    placeId: 'p1',
    document: doc,
    provider,
    sourceId: 'sitio-oficial',
    licenseTier: 'permissive-base' as const,
    evidenceLevel: 'official_publication' as const,
    capturedAt: '2026-07-01',
    retrievedAt: '2026-07-24',
  };

  it('localiza la cita cuando el proveedor no da desplazamientos', () => {
    const built = buildCandidates([{ field: 'services', value: 'wifi', quote: 'Free WiFi' }], base);
    expect(built.candidates[0].evidence.span).toEqual({
      documentId: 'd',
      format: 'plain_text',
      start: 0,
      end: 9,
      text: 'Free WiFi',
    });
  });

  it('descarta desplazamientos del proveedor que no verifican y relocaliza', () => {
    const built = buildCandidates(
      [{ field: 'services', value: 'wifi', quote: 'Free WiFi', start: 99, end: 108 }],
      base,
    );
    expect(built.diagnostics.map((d) => d.code)).toContain('PROVIDER_OFFSETS_REJECTED');
    expect(built.candidates[0].evidence.span?.start).toBe(0);
  });

  it('una cita inexistente queda sin span y se diagnostica', () => {
    const built = buildCandidates(
      [{ field: 'services', value: 'wifi', quote: 'alberca climatizada' }],
      base,
    );
    expect(built.diagnostics.map((d) => d.code)).toContain('QUOTE_NOT_FOUND');
    expect(built.candidates[0].evidence.span).toBeUndefined();
  });

  it('acumula listas en un solo hecho y conserva la cita más temprana', () => {
    const built = buildCandidates(
      [
        { field: 'services', value: 'outdoor_seating', quote: 'terraza' },
        { field: 'services', value: 'wifi', quote: 'Free WiFi' },
      ],
      base,
    );
    expect(built.candidates).toHaveLength(1);
    expect(built.candidates[0].value).toEqual(['outdoor_seating', 'wifi']);
    expect(built.candidates[0].evidence.span?.text).toBe('Free WiFi');
  });

  it('adjunta procedencia, adquisición y versión de validador', () => {
    const prompt = registerPrompts([BASE_EXTRACTION_PROMPT]).get(
      promptKeyOf('extraction.base', '1'),
    );
    const built = buildCandidates([{ field: 'services', value: 'wifi', quote: 'Free WiFi' }], {
      ...base,
      prompt,
    });
    const candidate = built.candidates[0];
    expect(candidate.acquisition.method).toBe('rule_engine');
    expect(candidate.acquisition.toolId).toBe(provider.id);
    expect(candidate.acquisition.toolVersion).toBe(provider.version);
    expect(candidate.acquisition.parameters?.promptFingerprint).toBe(prompt?.fingerprint);
    expect(candidate.reviewHistory).toEqual([]);
    expect(candidate.evidence.reference).toBe('d');
  });
});

describe('adaptador generativo neutral', () => {
  const prompt = registerPrompts([BASE_EXTRACTION_PROMPT]).get(promptKeyOf('extraction.base', '1'))!;

  function providerWith(response: string, offline = false) {
    return createLanguageModelProvider({
      transport: createScriptedTransport({ id: 'motor-x', response, offline }),
      prompt,
    });
  }

  it('traduce una respuesta JSON válida a afirmaciones', async () => {
    const provider = providerWith(
      JSON.stringify([{ field: 'services', value: 'wifi', quote: 'Free WiFi' }]),
    );
    const extraction = await provider.extract({
      placeId: 'p',
      document: { id: 'd', format: 'plain_text', text: 'Free WiFi' },
      fields: ['services'],
    });
    expect(extraction.claims).toHaveLength(1);
    expect(extraction.diagnostics?.promptFingerprint).toBe(prompt.fingerprint);
  });

  it('una respuesta corrupta no lanza: cero afirmaciones y diagnóstico', async () => {
    const provider = providerWith('{no es json');
    const extraction = await provider.extract({
      placeId: 'p',
      document: { id: 'd', format: 'plain_text', text: 'x' },
      fields: ['services'],
    });
    expect(extraction.claims).toEqual([]);
    expect(extraction.diagnostics?.malformedClaims).toBe(1);
  });

  it('descarta afirmaciones sin cita, de campos desconocidos o fuera de alcance', async () => {
    const provider = providerWith(
      JSON.stringify([
        { field: 'services', value: 'wifi' },
        { field: 'campoInventado', value: 1, quote: 'x' },
        { field: 'parking', value: { available: true }, quote: 'estacionamiento' },
      ]),
    );
    const extraction = await provider.extract({
      placeId: 'p',
      document: { id: 'd', format: 'plain_text', text: 'estacionamiento' },
      fields: ['services'],
    });
    expect(extraction.claims).toEqual([]);
    expect(extraction.diagnostics?.malformedClaims).toBe(2);
    expect(extraction.diagnostics?.claimsOutOfScope).toBe(1);
  });

  it('la identidad del proveedor incorpora la huella del prompt', () => {
    expect(providerWith('[]').version).toContain(prompt.fingerprint);
  });

  it('un transporte local marca el proveedor como offline', () => {
    expect(providerWith('[]', true).capabilities.offline).toBe(true);
  });
});

describe('reintentos deterministas', () => {
  it('reintenta hasta el tope y devuelve el valor', async () => {
    let intentos = 0;
    const outcome = await withRetry(
      async () => {
        intentos += 1;
        if (intentos < 3) throw new Error('transitorio');
        return 'ok';
      },
      { attempts: 3 },
    );
    expect(outcome).toEqual({ ok: true, value: 'ok', attempts: 3 });
  });

  it('nunca lanza: devuelve el último error', async () => {
    const outcome = await withRetry(async () => {
      throw new Error('siempre falla');
    }, { attempts: 2 });
    expect(outcome.ok).toBe(false);
    expect(outcome.attempts).toBe(2);
  });

  it('respeta shouldRetry para no insistir con un fallo definitivo', async () => {
    let intentos = 0;
    await withRetry(
      async () => {
        intentos += 1;
        throw new Error('permanente');
      },
      { attempts: 5, shouldRetry: () => false },
    );
    expect(intentos).toBe(1);
  });
});

describe('pipeline completo de punta a punta', () => {
  it('un documento fluye hasta candidatos aceptados con span verificado', async () => {
    const run = await runWithRules();
    expect(run.acquisitionReport.totals.documentsIngested).toBe(1);
    expect(run.accepted.length).toBeGreaterThan(0);
    expect(run.quarantine).toEqual([]);

    const documento = run.corpus.get('doc-1');
    for (const fragment of run.accepted) {
      const span = fragment.evidence.span;
      expect(span).toBeDefined();
      expect(documento?.text.slice(span!.start, span!.end)).toBe(span!.text);
      expect(fragment.acquisition.toolId).toBe(RULE_PROVIDER.id);
      expect(fragment.validatorVersion).toBe(run.validationReport.validatorVersion);
    }
  });

  it('extrae los hechos reales del documento de ejemplo', async () => {
    const run = await runWithRules();
    const porCampo = new Map(run.accepted.map((f) => [f.field, f.value]));
    expect(porCampo.get('establishedYear')).toBe(1998);
    expect(porCampo.get('businessType')).toBe('family_owned');
    expect(porCampo.get('services')).toEqual(['wifi']);
    expect(porCampo.get('parking')).toEqual({ available: true });
  });

  it('una cita fabricada por el proveedor termina en cuarentena, no en conocimiento', async () => {
    const mentiroso = createScriptedProvider({
      id: 'proveedor-mentiroso',
      response: {
        claims: [{ field: 'services', value: 'wifi', quote: 'alberca olímpica climatizada' }],
      },
    });
    const run = await runAcquisition({
      targets: [target()],
      fields: ['services'],
      providers: buildProviderRegistry([mentiroso]),
      sources: SOURCES,
      retrievedAt: '2026-07-24',
    });
    expect(run.accepted).toEqual([]);
    expect(run.quarantine).toHaveLength(1);
    expect(run.quarantine[0].issues.map((i) => i.code)).toContain('SPAN_REQUIRED');
    expect(run.acquisitionReport.diagnostics.map((d) => d.code)).toContain('QUOTE_NOT_FOUND');
  });

  it('un documento ilegible se reporta como fallo sin interrumpir el lote', async () => {
    const run = await runAcquisition({
      targets: [
        target({ document: { id: 'malo', format: 'audio', content: 'x' } }),
        target({ placeId: 'place-2' }),
      ],
      fields: [...FIELDS],
      providers: REGISTRY,
      sources: SOURCES,
      retrievedAt: '2026-07-24',
    });
    expect(run.acquisitionReport.failures[0].code).toBe('DOCUMENT_REJECTED');
    expect(run.accepted.length).toBeGreaterThan(0);
  });

  it('sin proveedor apto se reporta el fallo y no se inventa conocimiento', async () => {
    const run = await runAcquisition({
      targets: [target()],
      fields: ['languages'],
      providers: REGISTRY,
      sources: SOURCES,
      retrievedAt: '2026-07-24',
    });
    expect(run.acquisitionReport.failures[0].code).toBe('NO_PROVIDER_AVAILABLE');
    expect(run.accepted).toEqual([]);
  });

  it('un proveedor que falla siempre se reporta tras agotar los reintentos', async () => {
    const roto = createScriptedProvider({
      id: 'roto',
      response: { claims: [] },
      failuresBeforeSuccess: 99,
    });
    const run = await runAcquisition({
      targets: [target()],
      fields: ['services'],
      providers: buildProviderRegistry([roto]),
      sources: SOURCES,
      retrievedAt: '2026-07-24',
      retry: { attempts: 2 },
    });
    expect(run.acquisitionReport.failures[0].code).toBe('PROVIDER_FAILED');
    expect(roto.calls()).toBe(2);
  });

  it('la memoria de cuarentena impide readmitir lo ya rechazado', async () => {
    const primera = await runWithRules();
    const rechazados = new Set(primera.accepted.map((f) => f.id));
    const segunda = await runAcquisition({
      targets: [target()],
      fields: [...FIELDS],
      providers: REGISTRY,
      sources: SOURCES,
      retrievedAt: '2026-07-24',
      previouslyRejected: rechazados,
    });
    expect(segunda.accepted).toEqual([]);
    expect(segunda.quarantine[0].issues.map((i) => i.code)).toContain('PREVIOUSLY_QUARANTINED');
  });

  it('el lote se divide en tandas deterministas', () => {
    const targets = [target(), target({ placeId: 'p2' }), target({ placeId: 'p3' })];
    expect(batchTargets(targets, 2).map((b) => b.length)).toEqual([2, 1]);
    expect(batchTargets(targets, 0).map((b) => b.length)).toEqual([1, 1, 1]);
  });
});

describe('determinismo y artefactos', () => {
  it('dos corridas idénticas producen los mismos bytes', async () => {
    const a = await runWithRules();
    const b = await runWithRules();
    expect(serializeAcquisitionReport(b.acquisitionReport)).toBe(
      serializeAcquisitionReport(a.acquisitionReport),
    );
    expect(serializeValidationReport(b.validationReport)).toBe(
      serializeValidationReport(a.validationReport),
    );
    expect(serializeQuarantine(b.quarantine)).toBe(serializeQuarantine(a.quarantine));
  });

  it('el orden de los objetivos no altera el conocimiento admitido', async () => {
    const base = {
      fields: [...FIELDS],
      providers: REGISTRY,
      sources: SOURCES,
      retrievedAt: '2026-07-24',
    };
    const uno = target();
    const dos = target({ placeId: 'place-2', document: { id: 'doc-2', format: 'html', content: HTML } });
    const directo = await runAcquisition({ ...base, targets: [uno, dos] });
    const invertido = await runAcquisition({ ...base, targets: [dos, uno] });
    expect(invertido.accepted.map((f) => f.id)).toEqual(directo.accepted.map((f) => f.id));
  });

  it('la adquisición nunca escribe conocimiento canónico: solo entrega candidatos', async () => {
    const run = await runWithRules();
    expect(Object.keys(run).sort()).toEqual([
      'accepted',
      'acquisitionReport',
      'corpus',
      'outcomes',
      'quarantine',
      'validationReport',
    ]);
    for (const fragment of run.accepted) {
      expect(fragment.reviewHistory).toEqual([]);
    }
  });
});
