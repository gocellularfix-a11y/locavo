import { trustRankOfLevel } from '../../data/pipeline/sourceTrust';
import type { VerificationLevel } from '../../data/pipeline/providerMetadata';
import {
  deriveKnowledgeConfidence,
  EVIDENCE_CONFIDENCE_DELTA,
  SOURCE_CONFIDENCE_BASE,
} from '../model/confidence';
import { EVIDENCE_LEVEL_RANK, type EvidenceLevel } from '../model/evidence';
import { KNOWLEDGE_FIELD_KEYS } from '../model/knowledgeField';
import { KNOWLEDGE_SCHEMA_VERSION, knowledgeFragmentIdOf } from '../model/knowledgeFragment';
import { compareFragmentPrecedence, type FragmentPrecedence } from '../model/precedence';

const VERIFICATION_LEVELS = Object.keys(SOURCE_CONFIDENCE_BASE) as VerificationLevel[];
const EVIDENCE_LEVELS = Object.keys(EVIDENCE_LEVEL_RANK) as EvidenceLevel[];

function fragment(overrides: Partial<FragmentPrecedence>): FragmentPrecedence {
  return {
    fragmentId: 'place-1::website::src-a::2026-01-01',
    sourceId: 'src-a',
    verificationLevel: 'source_verified',
    evidenceLevel: 'dataset_record',
    capturedAt: '2026-01-01',
    ...overrides,
  };
}

describe('PKE-0 field catalog', () => {
  it('has no duplicate keys and covers the milestone fields', () => {
    expect(new Set(KNOWLEDGE_FIELD_KEYS).size).toBe(KNOWLEDGE_FIELD_KEYS.length);
    expect(KNOWLEDGE_FIELD_KEYS).toEqual([
      'hours',
      'phones',
      'website',
      'email',
      'socialMedia',
      'services',
      'paymentMethods',
      'accessibility',
      'parking',
      'extraCategories',
      'description',
    ]);
  });
});

describe('PKE-0 deterministic ranks', () => {
  it('evidence ranks are total, positive and unique', () => {
    const ranks = EVIDENCE_LEVELS.map((level) => EVIDENCE_LEVEL_RANK[level]);
    expect(ranks.every((rank) => rank > 0)).toBe(true);
    expect(new Set(ranks).size).toBe(ranks.length);
  });

  it('source trust reuses the single pipeline authority scale', () => {
    expect(trustRankOfLevel('official')).toBeGreaterThan(trustRankOfLevel('curated'));
    expect(trustRankOfLevel('curated')).toBeGreaterThan(trustRankOfLevel('source_verified'));
    expect(trustRankOfLevel('source_verified')).toBeGreaterThan(trustRankOfLevel('unverified'));
  });
});

describe('PKE-0 fragment precedence', () => {
  it('higher source authority wins over evidence and recency', () => {
    const official = fragment({
      fragmentId: 'f-official',
      verificationLevel: 'official',
      evidenceLevel: 'inferred',
      capturedAt: '2020-01-01',
    });
    const community = fragment({
      fragmentId: 'f-community',
      verificationLevel: 'unverified',
      evidenceLevel: 'observed',
      capturedAt: '2026-06-01',
    });
    expect(compareFragmentPrecedence(official, community)).toBeLessThan(0);
  });

  it('at equal authority, stronger evidence wins over recency', () => {
    const observed = fragment({
      fragmentId: 'f-observed',
      evidenceLevel: 'observed',
      capturedAt: '2020-01-01',
    });
    const inferred = fragment({
      fragmentId: 'f-inferred',
      evidenceLevel: 'inferred',
      capturedAt: '2026-06-01',
    });
    expect(compareFragmentPrecedence(observed, inferred)).toBeLessThan(0);
  });

  it('at equal authority and evidence, the most recent capture wins', () => {
    const recent = fragment({ fragmentId: 'f-recent', capturedAt: '2026-06-01' });
    const old = fragment({ fragmentId: 'f-old', capturedAt: '2024-01-01' });
    expect(compareFragmentPrecedence(recent, old)).toBeLessThan(0);
  });

  it('breaks full ties deterministically by sourceId then fragmentId', () => {
    const a = fragment({ fragmentId: 'f-1', sourceId: 'src-a' });
    const b = fragment({ fragmentId: 'f-1', sourceId: 'src-b' });
    expect(compareFragmentPrecedence(a, b)).toBeLessThan(0);

    const c = fragment({ fragmentId: 'f-1' });
    const d = fragment({ fragmentId: 'f-2' });
    expect(compareFragmentPrecedence(c, d)).toBeLessThan(0);
  });

  it('is antisymmetric and zero only on identity', () => {
    const a = fragment({ fragmentId: 'f-a', evidenceLevel: 'observed' });
    const b = fragment({ fragmentId: 'f-b', evidenceLevel: 'dataset_record' });
    expect(compareFragmentPrecedence(a, b)).toBe(-compareFragmentPrecedence(b, a));
    expect(compareFragmentPrecedence(a, a)).toBe(0);
  });

  it('produces the same order regardless of input order', () => {
    const fragments = [
      fragment({ fragmentId: 'f-1', verificationLevel: 'unverified', evidenceLevel: 'observed' }),
      fragment({ fragmentId: 'f-2', verificationLevel: 'official', evidenceLevel: 'inferred' }),
      fragment({ fragmentId: 'f-3', evidenceLevel: 'owner_stated', capturedAt: '2025-05-05' }),
      fragment({ fragmentId: 'f-4', evidenceLevel: 'owner_stated', capturedAt: '2026-05-05' }),
      fragment({ fragmentId: 'f-5', verificationLevel: 'curated', evidenceLevel: 'community_report' }),
    ];
    const forward = [...fragments].sort(compareFragmentPrecedence);
    const backward = [...fragments].reverse().sort(compareFragmentPrecedence);
    expect(backward.map((f) => f.fragmentId)).toEqual(forward.map((f) => f.fragmentId));
    expect(forward.map((f) => f.fragmentId)).toEqual(['f-2', 'f-5', 'f-4', 'f-3', 'f-1']);
  });
});

describe('PKE-0 derived confidence', () => {
  it('is deterministic and bounded to [0, 1] for every combination', () => {
    for (const verificationLevel of VERIFICATION_LEVELS) {
      for (const evidenceLevel of EVIDENCE_LEVELS) {
        const first = deriveKnowledgeConfidence({ verificationLevel, evidenceLevel });
        const second = deriveKnowledgeConfidence({ verificationLevel, evidenceLevel });
        expect(second).toEqual(first);
        expect(first.score).toBeGreaterThanOrEqual(0);
        expect(first.score).toBeLessThanOrEqual(1);
        expect(first.inputs).toEqual({ verificationLevel, evidenceLevel });
      }
    }
  });

  it('maps extreme combinations to the expected readable levels', () => {
    expect(
      deriveKnowledgeConfidence({ verificationLevel: 'official', evidenceLevel: 'observed' }).level,
    ).toBe('high');
    expect(
      deriveKnowledgeConfidence({ verificationLevel: 'unverified', evidenceLevel: 'inferred' })
        .level,
    ).toBe('low');
  });

  it('dataset records inherit the historical source confidences', () => {
    expect(EVIDENCE_CONFIDENCE_DELTA.dataset_record).toBe(0);
    expect(
      deriveKnowledgeConfidence({
        verificationLevel: 'source_verified',
        evidenceLevel: 'dataset_record',
      }).score,
    ).toBe(0.6);
    expect(
      deriveKnowledgeConfidence({
        verificationLevel: 'unverified',
        evidenceLevel: 'dataset_record',
      }).score,
    ).toBe(0.3);
  });
});

describe('PKE-0 fragments', () => {
  it('builds deterministic fragment ids', () => {
    const first = knowledgeFragmentIdOf('place-1', 'hours', 'denue-2026', '2026-03-01');
    const second = knowledgeFragmentIdOf('place-1', 'hours', 'denue-2026', '2026-03-01');
    expect(second).toBe(first);
    expect(knowledgeFragmentIdOf('place-1', 'hours', 'denue-2026', '2026-04-01')).not.toBe(first);
  });

  it('pins the knowledge schema version', () => {
    expect(KNOWLEDGE_SCHEMA_VERSION).toBe(1);
  });
});
