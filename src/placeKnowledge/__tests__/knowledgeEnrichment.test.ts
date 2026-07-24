import { runAcquisition } from '../acquisition/acquisitionSession';
import { buildProviderRegistry } from '../acquisition/providerRegistry';
import { createRuleBasedExtractor } from '../acquisition/providers/ruleBasedExtractor';
import {
  contentFingerprintOf,
  createSourceBinding,
  resolveSourceBindings,
  serializeAcquisitionManifest,
  sourceBindingIdOf,
  type AcquisitionManifest,
  type SourceBinding,
} from '../acquisition/sourceBinding';
import { atomicPathsOf } from '../model/atomicPath';
import { KNOWLEDGE_SCHEMA_VERSION, knowledgeFragmentIdOf, type KnowledgeFragment } from '../model/knowledgeFragment';
import { serializeKnowledgeFragment } from '../model/serialization';
import type { KnowledgeSource, KnowledgeSourceRegistry } from '../model/source';
import { propagateConfidence } from '../enrichment/confidencePropagation';
import { detectContradictions, detectDuplicateFragments } from '../enrichment/contradictions';
import { buildEnrichmentRegistry, selectEnrichmentProviders } from '../enrichment/enrichmentProvider';
import { runEnrichment, serializeEnrichmentReport, serializeProposals } from '../enrichment/enrichmentSession';
import { resolveEntity } from '../enrichment/entityResolution';
import { assessFreshness, assessSupersession, daysBetween } from '../enrichment/freshness';
import { normalizePhone, normalizeUrl, rulesForField } from '../enrichment/normalization';
import { createLanguageModelEnricher } from '../enrichment/providers/languageModelEnricher';
import { createNormalizationProvider } from '../enrichment/providers/normalizationProvider';
import { buildDocumentCorpus } from '../validation/evidenceDocument';
import { validateKnowledgeFragment } from '../validation/fragmentValidator';
import { VALIDATOR_VERSION } from '../validation/validationModel';

const DOC_TEXT = 'Free WiFi y terraza. Aceptamos tarjetas. Tel 6671234567.';
const CORPUS = buildDocumentCorpus([{ id: 'doc-1', format: 'plain_text', text: DOC_TEXT }]);

const SITE: KnowledgeSource = {
  id: 'sitio-oficial',
  kind: 'official_website',
  name: 'Sitio oficial',
  license: { name: 'CDLA', tier: 'permissive-base', shareAlike: false },
  verificationLevel: 'curated',
};
const GOV: KnowledgeSource = {
  id: 'gobierno',
  kind: 'government_dataset',
  name: 'Dataset gubernamental',
  license: { name: 'CDLA', tier: 'permissive-base', shareAlike: false },
  verificationLevel: 'official',
};
const EXCLUDED: KnowledgeSource = {
  id: 'propietaria',
  kind: 'partner_feed' as KnowledgeSource['kind'],
  name: 'Propietaria',
  license: { name: 'Proprietary', tier: 'proprietary-excluded', shareAlike: false },
  verificationLevel: 'unverified',
};
const SOURCES: KnowledgeSourceRegistry = new Map([
  [SITE.id, SITE],
  [GOV.id, GOV],
  [EXCLUDED.id, EXCLUDED],
]);

function span(text: string) {
  const start = DOC_TEXT.indexOf(text);
  return { documentId: 'doc-1', format: 'plain_text', start, end: start + text.length, text };
}

function fragment(overrides: Partial<KnowledgeFragment> = {}): KnowledgeFragment {
  const base: KnowledgeFragment = {
    id: knowledgeFragmentIdOf('place-1', 'services', 'sitio-oficial', '2026-07-01'),
    schemaVersion: KNOWLEDGE_SCHEMA_VERSION,
    placeId: 'place-1',
    field: 'services',
    value: ['wifi'],
    sourceId: 'sitio-oficial',
    evidence: {
      level: 'official_publication',
      method: 'test',
      capturedAt: '2026-07-01',
      reference: 'doc-1',
      bindings: [{ path: '[wifi]', span: span('Free WiFi') }],
    },
    retrievedAt: '2026-07-24',
    licenseTier: 'permissive-base',
    acquisition: {
      method: 'rule_engine',
      toolId: 'local-rule-extractor',
      toolVersion: '1.0.0',
      acquiredAt: '2026-07-24',
    },
    validatorVersion: VALIDATOR_VERSION,
    reviewHistory: [],
  };
  return { ...base, ...overrides } as KnowledgeFragment;
}

// ─────────────────────────── PARTE 1 ───────────────────────────

describe('evidencia atómica', () => {
  it('enumera un átomo por valor afirmable', () => {
    expect(atomicPathsOf('services', ['wifi', 'terraza'])).toEqual(['[terraza]', '[wifi]']);
    expect(atomicPathsOf('accessibility', { wheelchairAccessible: true })).toEqual([
      '.wheelchairAccessible',
    ]);
    expect(atomicPathsOf('parking', { available: true, kinds: ['lot'] })).toEqual([
      '.available',
      '.kinds[lot]',
    ]);
    expect(atomicPathsOf('website', 'https://x.mx')).toEqual(['']);
    // El horario semanal es todo o nada: un solo átomo.
    expect(atomicPathsOf('hours', { weekly: [] })).toEqual(['']);
  });

  it('cada elemento conserva SU cita y ninguno la toma prestada', () => {
    const ok = fragment({
      value: ['terraza', 'wifi'],
      evidence: {
        level: 'official_publication',
        method: 'test',
        capturedAt: '2026-07-01',
        bindings: [
          { path: '[terraza]', span: span('terraza') },
          { path: '[wifi]', span: span('Free WiFi') },
        ],
      },
    });
    expect(validateKnowledgeFragment(ok, { corpus: CORPUS, sources: SOURCES }).verdict).toBe(
      'accepted',
    );
  });

  it('un elemento sin respaldo se señala con su ruta exacta', () => {
    const mixto = fragment({
      value: ['delivery', 'wifi'],
      evidence: {
        level: 'official_publication',
        method: 'test',
        capturedAt: '2026-07-01',
        bindings: [{ path: '[wifi]', span: span('Free WiFi') }],
      },
    });
    const outcome = validateKnowledgeFragment(mixto, { corpus: CORPUS, sources: SOURCES });
    expect(outcome.verdict).toBe('rejected');
    const missing = outcome.issues.filter((i) => i.code === 'BINDING_MISSING');
    expect(missing).toHaveLength(1);
    expect(missing[0].detail?.atomicPath).toBe('[delivery]');
  });

  it('una cita fabricada en un solo elemento rechaza el hecho', () => {
    const mentira = fragment({
      value: ['terraza', 'wifi'],
      evidence: {
        level: 'official_publication',
        method: 'test',
        capturedAt: '2026-07-01',
        bindings: [
          { path: '[terraza]', span: { ...span('terraza'), text: 'jardín botánico' } },
          { path: '[wifi]', span: span('Free WiFi') },
        ],
      },
    });
    const codes = validateKnowledgeFragment(mentira, { corpus: CORPUS, sources: SOURCES }).issues;
    expect(codes.some((i) => i.code === 'SPAN_TEXT_MISMATCH')).toBe(true);
    expect(codes.find((i) => i.code === 'SPAN_TEXT_MISMATCH')?.path).toBe(
      'evidence.bindings[[terraza]]',
    );
  });

  it('una ruta inexistente o duplicada se rechaza', () => {
    const rara = fragment({
      evidence: {
        level: 'official_publication',
        method: 'test',
        capturedAt: '2026-07-01',
        bindings: [
          { path: '[wifi]', span: span('Free WiFi') },
          { path: '[inventado]', span: span('Free WiFi') },
        ],
      },
    });
    expect(
      validateKnowledgeFragment(rara, { corpus: CORPUS, sources: SOURCES }).issues.map((i) => i.code),
    ).toContain('BINDING_PATH_UNKNOWN');

    const dup = fragment({
      evidence: {
        level: 'official_publication',
        method: 'test',
        capturedAt: '2026-07-01',
        bindings: [
          { path: '[wifi]', span: span('Free WiFi') },
          { path: '[wifi]', span: span('Free WiFi') },
        ],
      },
    });
    expect(
      validateKnowledgeFragment(dup, { corpus: CORPUS, sources: SOURCES }).issues.map((i) => i.code),
    ).toContain('BINDING_DUPLICATE');
  });

  it('compatibilidad: un hecho de un solo átomo sigue valiendo con span simple', () => {
    const legado = fragment({
      value: ['wifi'],
      evidence: {
        level: 'official_publication',
        method: 'test',
        capturedAt: '2026-07-01',
        span: span('Free WiFi'),
      },
    });
    expect(validateKnowledgeFragment(legado, { corpus: CORPUS, sources: SOURCES }).verdict).toBe(
      'accepted',
    );
  });

  it('un span simple NO puede respaldar varios valores', () => {
    const prestado = fragment({
      value: ['terraza', 'wifi'],
      evidence: {
        level: 'official_publication',
        method: 'test',
        capturedAt: '2026-07-01',
        span: span('Free WiFi'),
      },
    });
    const outcome = validateKnowledgeFragment(prestado, { corpus: CORPUS, sources: SOURCES });
    expect(outcome.verdict).toBe('rejected');
    expect(outcome.issues.filter((i) => i.code === 'BINDING_MISSING')).toHaveLength(2);
  });

  it('la serialización de ligaduras es determinista', () => {
    const a = fragment({
      value: ['terraza', 'wifi'],
      evidence: {
        level: 'official_publication',
        method: 'test',
        capturedAt: '2026-07-01',
        bindings: [
          { path: '[wifi]', span: span('Free WiFi') },
          { path: '[terraza]', span: span('terraza') },
        ],
      },
    });
    const b = fragment({
      value: ['terraza', 'wifi'],
      evidence: {
        level: 'official_publication',
        method: 'test',
        capturedAt: '2026-07-01',
        bindings: [
          { path: '[terraza]', span: span('terraza') },
          { path: '[wifi]', span: span('Free WiFi') },
        ],
      },
    });
    expect(serializeKnowledgeFragment(b)).toBe(serializeKnowledgeFragment(a));
  });
});

// ─────────────────────────── PARTE 2 ───────────────────────────

describe('ligadura de fuente', () => {
  const binding = createSourceBinding({
    documentId: 'doc-1',
    sourceId: 'sitio-oficial',
    documentText: DOC_TEXT,
    declaredEvidenceLevel: 'official_publication',
    licenseTier: 'permissive-base',
    acquisitionOrigin: 'official_website_fetch',
    attestedBy: 'jorge',
    attestedAt: '2026-07-24T10:00:00.000Z',
    bindingVersion: 1,
  });
  const documents = [...CORPUS.values()];
  const manifest = (bindings: readonly SourceBinding[]): AcquisitionManifest => ({
    manifestId: 'm1',
    retrievedAt: '2026-07-24',
    bindings,
  });

  it('una ligadura válida autoriza el documento', () => {
    const resolution = resolveSourceBindings(manifest([binding]), documents, SOURCES);
    expect(resolution.issues).toEqual([]);
    expect(resolution.authorized.get('doc-1')?.sourceId).toBe('sitio-oficial');
  });

  it('el id de ligadura es determinista', () => {
    expect(binding.id).toBe(
      sourceBindingIdOf('doc-1', 'sitio-oficial', contentFingerprintOf(DOC_TEXT), 1),
    );
    const manipulada = { ...binding, sourceId: 'gobierno' };
    expect(
      resolveSourceBindings(manifest([manipulada]), documents, SOURCES).issues.map((i) => i.code),
    ).toContain('BINDING_ID_MISMATCH');
  });

  it('un documento sin ligadura no autoriza nada', () => {
    const resolution = resolveSourceBindings(manifest([]), documents, SOURCES);
    expect(resolution.issues.map((i) => i.code)).toEqual(['BINDING_MISSING']);
    expect(resolution.authorized.size).toBe(0);
  });

  it('detecta contenido modificado bajo una ligadura vieja', () => {
    const modificado = buildDocumentCorpus([
      { id: 'doc-1', format: 'plain_text', text: `${DOC_TEXT} Ahora con alberca.` },
    ]);
    const resolution = resolveSourceBindings(manifest([binding]), [...modificado.values()], SOURCES);
    expect(resolution.issues.map((i) => i.code)).toContain('BINDING_CONTENT_MODIFIED');
    expect(resolution.authorized.size).toBe(0);
  });

  it('una fuente desconocida o excluida no autoriza', () => {
    const fantasma = createSourceBinding({
      documentId: 'doc-1',
      sourceId: 'no-registrada',
      documentText: DOC_TEXT,
      declaredEvidenceLevel: 'official_publication',
      licenseTier: 'permissive-base',
      acquisitionOrigin: 'operator_upload',
      attestedBy: 'jorge',
      attestedAt: '2026-07-24T10:00:00.000Z',
      bindingVersion: 1,
    });
    expect(
      resolveSourceBindings(manifest([fantasma]), documents, SOURCES).issues.map((i) => i.code),
    ).toContain('BINDING_SOURCE_UNKNOWN');

    const excluida = createSourceBinding({
      documentId: 'doc-1',
      sourceId: 'propietaria',
      documentText: DOC_TEXT,
      declaredEvidenceLevel: 'dataset_record',
      licenseTier: 'proprietary-excluded',
      acquisitionOrigin: 'partner_feed',
      attestedBy: 'jorge',
      attestedAt: '2026-07-24T10:00:00.000Z',
      bindingVersion: 1,
    });
    expect(
      resolveSourceBindings(manifest([excluida]), documents, SOURCES).issues.map((i) => i.code),
    ).toContain('BINDING_SOURCE_EXCLUDED');
  });

  it('una licencia que no coincide con el registro se rechaza', () => {
    const desalineada = createSourceBinding({
      documentId: 'doc-1',
      sourceId: 'sitio-oficial',
      documentText: DOC_TEXT,
      declaredEvidenceLevel: 'official_publication',
      licenseTier: 'odbl-sidecar',
      acquisitionOrigin: 'official_website_fetch',
      attestedBy: 'jorge',
      attestedAt: '2026-07-24T10:00:00.000Z',
      bindingVersion: 1,
    });
    expect(
      resolveSourceBindings(manifest([desalineada]), documents, SOURCES).issues.map((i) => i.code),
    ).toContain('BINDING_LICENSE_MISMATCH');
  });

  it('dos atribuciones contradictorias del mismo documento anulan ambas', () => {
    const otra = createSourceBinding({
      documentId: 'doc-1',
      sourceId: 'gobierno',
      documentText: DOC_TEXT,
      declaredEvidenceLevel: 'dataset_record',
      licenseTier: 'permissive-base',
      acquisitionOrigin: 'government_dataset',
      attestedBy: 'jorge',
      attestedAt: '2026-07-24T10:00:00.000Z',
      bindingVersion: 1,
    });
    const resolution = resolveSourceBindings(manifest([binding, otra]), documents, SOURCES);
    expect(resolution.issues.map((i) => i.code)).toContain('BINDING_CONFLICTING');
    expect(resolution.authorized.size).toBe(0);
  });

  it('una ligadura idéntica repetida es un aviso, no un error', () => {
    const resolution = resolveSourceBindings(manifest([binding, binding]), documents, SOURCES);
    const dup = resolution.issues.find((i) => i.code === 'BINDING_DUPLICATE');
    expect(dup?.severity).toBe('warning');
    expect(resolution.authorized.size).toBe(1);
  });

  it('una atestación vacía o con fecha inválida se rechaza', () => {
    const sinFirma = { ...binding, attestedBy: '   ' };
    expect(
      resolveSourceBindings(manifest([sinFirma]), documents, SOURCES).issues.map((i) => i.code),
    ).toContain('BINDING_ATTESTATION_INVALID');
  });

  it('evidencia duplicada entre documentos distintos se avisa', () => {
    const gemelos = buildDocumentCorpus([
      { id: 'doc-1', format: 'plain_text', text: DOC_TEXT },
      { id: 'doc-2', format: 'plain_text', text: DOC_TEXT },
    ]);
    const segunda = createSourceBinding({
      documentId: 'doc-2',
      sourceId: 'sitio-oficial',
      documentText: DOC_TEXT,
      declaredEvidenceLevel: 'official_publication',
      licenseTier: 'permissive-base',
      acquisitionOrigin: 'official_website_fetch',
      attestedBy: 'jorge',
      attestedAt: '2026-07-24T10:00:00.000Z',
      bindingVersion: 1,
    });
    const resolution = resolveSourceBindings(
      manifest([binding, segunda]),
      [...gemelos.values()],
      SOURCES,
    );
    // Documentos distintos de la MISMA fuente son legítimos: solo se avisa el
    // contenido idéntico, sin bloquear.
    expect(resolution.issues.map((i) => i.code)).toEqual(['BINDING_DUPLICATE_EVIDENCE']);
    expect(resolution.authorized.size).toBe(2);
  });

  it('el manifiesto se serializa de forma estable', () => {
    const uno = serializeAcquisitionManifest(manifest([binding]));
    const dos = serializeAcquisitionManifest(manifest([binding]));
    expect(dos).toBe(uno);
  });

  it('la adquisición exige ligadura cuando hay manifiesto', async () => {
    const run = await runAcquisition({
      targets: [
        {
          placeId: 'place-1',
          document: { id: 'doc-1', format: 'plain_text', content: DOC_TEXT },
          sourceId: 'sitio-oficial',
          licenseTier: 'permissive-base',
          evidenceLevel: 'official_publication',
          capturedAt: '2026-07-01',
        },
      ],
      fields: ['services'],
      providers: buildProviderRegistry([createRuleBasedExtractor()]),
      sources: SOURCES,
      retrievedAt: '2026-07-24',
      manifest: manifest([]),
    });
    expect(run.accepted).toEqual([]);
    expect(run.acquisitionReport.failures[0].code).toBe('BINDING_REJECTED');
    expect(run.acquisitionReport.bindingIssues.map((i) => i.code)).toContain('BINDING_MISSING');
  });
});

// ─────────────────────────── PARTE 3 ───────────────────────────

describe('normalización determinista', () => {
  it('normaliza teléfonos mexicanos sin adivinar formas ambiguas', () => {
    expect(normalizePhone('667 123 4567')).toBe('+526671234567');
    expect(normalizePhone('+52 667 123 4567')).toBe('+526671234567');
    expect(normalizePhone('123')).toBeNull();
  });

  it('canoniza URLs y no propone cambios si ya es canónica', () => {
    expect(normalizeUrl('EJEMPLO.MX/menu/')).toBe('https://ejemplo.mx/menu');
    expect(normalizeUrl('https://ejemplo.mx')).toBeNull();
  });

  it('las reglas por campo salen en orden determinista', () => {
    expect(rulesForField('services').map((r) => r.id)).toEqual(['normalize.services.alias']);
    expect(rulesForField('hours')).toEqual([]);
  });
});

describe('propagación de confianza', () => {
  const site = { sourceId: 'sitio-oficial', documentId: 'doc-1', verificationLevel: 'curated' as const, evidenceLevel: 'official_publication' as const };
  const gov = { sourceId: 'gobierno', documentId: 'doc-2', verificationLevel: 'official' as const, evidenceLevel: 'dataset_record' as const };

  it('normalizar conserva la confianza', () => {
    const out = propagateConfidence({ witnesses: [site], derivation: 'normalization' });
    expect(out.result).toBe(out.basis);
    expect(out.rule).toBe('SINGLE_WITNESS');
  });

  it('una propuesta generativa baja la confianza', () => {
    const out = propagateConfidence({ witnesses: [site], derivation: 'generative_proposal' });
    expect(out.result).toBeLessThan(out.basis);
    expect(out.rule).toContain('DERIVATION_PENALTY');
  });

  it('repetir la MISMA evidencia no es corroboración', () => {
    const out = propagateConfidence({ witnesses: [site, site, site], derivation: 'normalization' });
    expect(out.rule).toBe('DUPLICATE_NOT_INDEPENDENT');
    expect(out.result).toBe(out.basis);
  });

  it('la corroboración independiente nunca supera a la evidencia más fuerte', () => {
    const out = propagateConfidence({ witnesses: [site, gov], derivation: 'normalization' });
    expect(out.rule).toBe('CORROBORATED_INDEPENDENT');
    expect(out.result).toBe(out.basis);
    expect(out.result).toBeLessThanOrEqual(1);
  });

  it('lo añejo nunca sube', () => {
    const out = propagateConfidence({ witnesses: [site, gov], derivation: 'normalization', stale: true });
    expect(out.rule).toContain('STALE_NO_INCREASE');
    expect(out.result).toBeLessThanOrEqual(out.basis);
  });

  it('sin evidencia no hay confianza', () => {
    expect(propagateConfidence({ witnesses: [], derivation: 'normalization' })).toEqual({
      basis: 0,
      result: 0,
      rule: 'NO_EVIDENCE',
    });
  });
});

describe('frescura con fecha inyectada', () => {
  it('sin fecha de evaluación el veredicto es desconocido', () => {
    expect(assessFreshness(fragment(), {}).verdict).toBe('unknown');
  });

  it('con umbral y fecha decide fresco o añejo', () => {
    const policy = { evaluationDate: '2026-07-24', freshnessDays: { services: 30 } };
    expect(assessFreshness(fragment(), policy).verdict).toBe('fresh');
    const viejo = fragment({
      evidence: { level: 'official_publication', method: 't', capturedAt: '2020-01-01' },
    });
    const out = assessFreshness(viejo, policy);
    expect(out.verdict).toBe('stale');
    expect(out.ageDays).toBeGreaterThan(2000);
  });

  it('calcula días entre fechas y rechaza las inválidas', () => {
    expect(daysBetween('2026-07-01', '2026-07-24')).toBe(23);
    expect(daysBetween('ayer', '2026-07-24')).toBeNull();
  });

  it('marca como superado el hecho viejo de la MISMA fuente', () => {
    const viejo = fragment({
      id: 'f-viejo',
      evidence: { level: 'official_publication', method: 't', capturedAt: '2026-01-01' },
    });
    const nuevo = fragment({ id: 'f-nuevo' });
    const out = assessSupersession([viejo, nuevo], {});
    expect(out.find((e) => e.fragmentId === 'f-viejo')?.verdict).toBe('superseded');
  });
});

describe('resolución de entidad', () => {
  it('la identidad canónica es decisiva en ambos sentidos', () => {
    expect(resolveEntity({ placeId: 'a' }, { placeId: 'a' }).outcome).toBe('confirmed_same');
    expect(resolveEntity({ placeId: 'a' }, { placeId: 'b' }).outcome).toBe('confirmed_different');
  });

  it('dos señales fuertes coincidentes dan probable', () => {
    const out = resolveEntity(
      { phones: ['+526671234567'], websiteDomain: 'ejemplo.mx' },
      { phones: ['+526671234567'], websiteDomain: 'EJEMPLO.MX' },
    );
    expect(out.outcome).toBe('probable_same');
    expect(out.signals.map((s) => s.signal)).toEqual(['phone', 'website_domain']);
  });

  it('señales fuertes en conflicto se declaran, no se resuelven', () => {
    const out = resolveEntity(
      { phones: ['+521'], coordinates: { latitude: 24.8, longitude: -107.4 } },
      { phones: ['+521'], coordinates: { latitude: 25.9, longitude: -108.4 } },
    );
    expect(out.outcome).toBe('conflicting');
  });

  it('sin señales suficientes queda ambiguo', () => {
    expect(resolveEntity({ normalizedName: 'cafe rio' }, { normalizedName: 'cafe rio' }).outcome).toBe(
      'ambiguous',
    );
    expect(resolveEntity({}, {}).outcome).toBe('ambiguous');
  });
});

describe('contradicciones', () => {
  const a = fragment({ id: 'f-a', value: ['wifi'] });
  const b = fragment({ id: 'f-b', value: ['delivery'], sourceId: 'gobierno' });

  it('desacuerdo entre fuentes se reporta sin resolverse', () => {
    const out = detectContradictions([a, b]);
    expect(out.map((d) => d.code)).toContain('SOURCE_DISAGREEMENT');
  });

  it('misma fuente, misma fecha, valores distintos = autocontradicción', () => {
    const c = fragment({ id: 'f-c', value: ['delivery'] });
    expect(detectContradictions([a, c]).map((d) => d.code)).toContain(
      'SAME_SOURCE_SELF_CONTRADICTION',
    );
  });

  it('misma fuente y fecha distinta sugiere supersesión', () => {
    const viejo = fragment({
      id: 'f-viejo',
      value: ['delivery'],
      evidence: { level: 'official_publication', method: 't', capturedAt: '2026-01-01' },
    });
    expect(detectContradictions([a, viejo]).map((d) => d.code)).toContain('POTENTIAL_SUPERSESSION');
  });

  it('valores idénticos son duplicado equivalente', () => {
    const gemelo = fragment({ id: 'f-gemelo' });
    expect(detectContradictions([a, gemelo]).map((d) => d.code)).toContain('DUPLICATE_EQUIVALENT');
  });

  it('atributos mutuamente excluyentes se detectan', () => {
    const si = fragment({ id: 'p1', field: 'parking', value: { available: true }, evidence: { level: 'official_publication', method: 't', capturedAt: '2026-07-01' } });
    const no = fragment({ id: 'p2', field: 'parking', value: { available: false }, sourceId: 'gobierno', evidence: { level: 'dataset_record', method: 't', capturedAt: '2026-07-01' } });
    expect(detectContradictions([si, no]).map((d) => d.code)).toContain('VALUE_INCOMPATIBILITY');
  });

  it('detecta fragmentos idénticos byte a byte', () => {
    expect(detectDuplicateFragments([a, { ...a }])).toEqual([a.id]);
  });
});

describe('registro y selección de enriquecedores', () => {
  const rule = createNormalizationProvider();
  const generative = createLanguageModelEnricher({
    transport: { id: 'motor-y', version: '1', offline: false, send: async () => '[]' },
    promptId: 'p', promptVersion: '1', promptFingerprint: 'abc', fields: ['products'],
  });
  const registry = buildEnrichmentRegistry([generative, rule]);

  it('prioriza los deterministas', () => {
    expect(selectEnrichmentProviders(registry).map((p) => p.id)).toEqual([rule.id, 'motor-y']);
  });

  it('puede exigir solo deterministas', () => {
    expect(
      selectEnrichmentProviders(registry, { requireDeterministic: true }).map((p) => p.id),
    ).toEqual([rule.id]);
  });
});

describe('pipeline de enriquecimiento de punta a punta', () => {
  const base = fragment({ value: ['wi-fi'], evidence: { level: 'official_publication', method: 't', capturedAt: '2026-07-01', bindings: [{ path: '[wi-fi]', span: span('Free WiFi') }] } });

  async function run(extra: Partial<Parameters<typeof runEnrichment>[0]> = {}) {
    return runEnrichment({
      targets: [{ placeId: 'place-1', fragments: [base] }],
      providers: buildEnrichmentRegistry([createNormalizationProvider()]),
      sources: SOURCES,
      corpus: CORPUS,
      context: { policy: {}, retrievedAt: '2026-07-24' },
      ...extra,
    });
  }

  it('normaliza un alias y produce una propuesta validada', async () => {
    const out = await run();
    expect(out.proposals).toHaveLength(1);
    const proposal = out.proposals[0];
    expect(proposal.value).toEqual(['wifi']);
    expect(proposal.derivation).toBe('normalization');
    expect(proposal.producerId).toBe('local-normalizer');
    expect(proposal.confidence.rule).toBe('SINGLE_WITNESS');
    expect(proposal.explanation).toContain('SERVICE_ALIAS');
  });

  it('la cita viaja al átomo normalizado y la propuesta se acepta', async () => {
    const out = await run();
    // Normalizar '[wi-fi]' → '[wifi]' mueve la ligadura al átomo nuevo: la
    // evidencia es la misma frase del mismo documento.
    expect(out.quarantine).toEqual([]);
    expect(out.accepted).toHaveLength(1);
    const accepted = out.accepted[0];
    expect(accepted.value).toEqual(['wifi']);
    expect(accepted.evidence.bindings?.map((b) => b.path)).toEqual(['[wifi]']);
    expect(accepted.evidence.bindings?.[0].span.text).toBe('Free WiFi');
  });

  it('la propuesta conserva la procedencia del hecho de origen', async () => {
    const out = await run();
    const accepted = out.accepted[0];
    expect(accepted.sourceId).toBe('sitio-oficial');
    expect(accepted.licenseTier).toBe('permissive-base');
    expect(accepted.supersedes).toBe(base.id);
    // Nace sin revisar: la revisión es humana y posterior.
    expect(accepted.reviewHistory).toEqual([]);
    expect(accepted.acquisition.toolId).toBe('local-normalizer');
  });

  it('un objetivo vacío se salta sin romper el lote', async () => {
    const out = await run({
      targets: [
        { placeId: 'vacio', fragments: [] },
        { placeId: 'place-1', fragments: [base] },
      ],
    });
    expect(out.report.totals.skipped).toBe(1);
    expect(out.proposals.length).toBeGreaterThan(0);
  });

  it('un proveedor que falla no interrumpe el lote', async () => {
    const roto = {
      id: 'roto',
      version: '1',
      kind: 'deterministic_rule' as const,
      capabilities: { fields: [], offline: true, deterministic: true },
      enrich: async () => {
        throw new Error('falla');
      },
    };
    const out = await run({
      providers: buildEnrichmentRegistry([roto, createNormalizationProvider()]),
      retry: { attempts: 2 },
    });
    expect(out.report.totals.failed).toBe(1);
    expect(out.report.diagnostics.map((d) => d.code)).toContain('PROVIDER_FAILED');
    expect(out.proposals.length).toBeGreaterThan(0);
  });

  it('los artefactos son deterministas byte a byte', async () => {
    const a = await run();
    const b = await run();
    expect(serializeEnrichmentReport(b.report)).toBe(serializeEnrichmentReport(a.report));
    expect(serializeProposals(b.proposals)).toBe(serializeProposals(a.proposals));
  });

  it('no muta los fragmentos de entrada', async () => {
    const copia = JSON.parse(JSON.stringify(base));
    await run();
    expect(JSON.parse(JSON.stringify(base))).toEqual(copia);
  });
});

describe('seguridad del enriquecimiento generativo', () => {
  const base = fragment();

  function enricherWith(response: string) {
    return createLanguageModelEnricher({
      transport: { id: 'motor-z', version: '1', offline: false, send: async () => response },
      promptId: 'p',
      promptVersion: '1',
      promptFingerprint: 'fp',
      fields: ['products', 'services'],
    });
  }

  async function runGenerative(response: string) {
    return runEnrichment({
      targets: [{ placeId: 'place-1', fragments: [base] }],
      providers: buildEnrichmentRegistry([enricherWith(response)]),
      sources: SOURCES,
      corpus: CORPUS,
      context: { policy: {}, retrievedAt: '2026-07-24' },
    });
  }

  it('una propuesta sin insumos validados se descarta', async () => {
    const out = await runGenerative(JSON.stringify([{ field: 'products', value: ['tacos'] }]));
    expect(out.proposals).toEqual([]);
    expect(out.report.diagnostics.map((d) => d.code)).toContain('UNSUPPORTED_PROPOSAL');
  });

  it('JSON corrupto y formas inesperadas no lanzan', async () => {
    expect((await runGenerative('{roto')).report.diagnostics.map((d) => d.code)).toContain(
      'MALFORMED_OUTPUT',
    );
    expect((await runGenerative('"prosa"')).report.diagnostics.map((d) => d.code)).toContain(
      'UNEXPECTED_SHAPE',
    );
  });

  it('campos desconocidos o fuera de alcance se descartan', async () => {
    const out = await runGenerative(
      JSON.stringify([
        { field: 'inventado', value: 1, basedOn: [base.id] },
        { field: 'website', value: 'x', basedOn: [base.id] },
      ]),
    );
    const codes = out.report.diagnostics.map((d) => d.code);
    expect(codes).toContain('UNKNOWN_FIELD');
    expect(codes).toContain('FIELD_OUT_OF_SCOPE');
    expect(out.proposals).toEqual([]);
  });

  it('un intento de dictar confianza o procedencia se ignora y se registra', async () => {
    const out = await runGenerative(
      JSON.stringify([
        {
          field: 'products',
          value: ['tacos'],
          basedOn: [base.id],
          confidence: 0.99,
          sourceId: 'inventada',
        },
      ]),
    );
    expect(out.report.diagnostics.map((d) => d.code)).toContain('PROVIDER_OVERREACH');
    const proposal = out.proposals[0];
    // La confianza la calcula la plataforma, nunca el proveedor.
    expect(proposal.confidence.result).toBeLessThanOrEqual(proposal.confidence.basis);
    expect(proposal.confidence.rule).toContain('DERIVATION_PENALTY');
    expect(proposal.reviewRequirement).toBe('required');
  });

  it('toda propuesta generativa exige revisión humana', async () => {
    const out = await runGenerative(
      JSON.stringify([{ field: 'products', value: ['tacos'], basedOn: [base.id] }]),
    );
    expect(out.proposals[0].reviewRequirement).toBe('required');
    // Y sin revisión no entra al conocimiento cuando la política lo exige.
    expect(out.accepted.every((f) => f.reviewHistory.length === 0)).toBe(true);
  });
});
