# Place Knowledge Engine (PKE-0) — Canonical Knowledge Architecture

**Status:** architecture only. Models and normative rules exist and are tested;
**no enricher is implemented, no data is fetched, no storage is wired, nothing
is integrated** with the Decision Engine, Home, search, City Packs, or any UI.
The frozen V5.0–V5.8 engines are untouched and keep consuming only
`LocavoPlace`.

- **Module:** `src/placeKnowledge/`
- **Related docs:** [`CITY-PIPELINE-V1.md`](CITY-PIPELINE-V1.md),
  [`OSM-ENRICHMENT-ARCHITECTURE.md`](OSM-ENRICHMENT-ARCHITECTURE.md),
  [`DETERMINISTIC-INTELLIGENCE-FOUNDATION.md`](DETERMINISTIC-INTELLIGENCE-FOUNDATION.md)

---

## 1. Philosophy

The recommendation brain (V5.0–V5.8) already exists, is approved, and is
frozen. Locavo's next intelligence gains come from **knowing more about each
place**, not from more complex algorithms. The Place Knowledge Engine (PKE)
exists solely to turn a basic canonical place into a place with structured,
evidence-backed knowledge.

The PKE **does not recommend, does not rank, and does not touch the UI**. It
produces knowledge; the existing engines (unchanged) get better automatically
when richer canonical data reaches them through future, separately-approved
projections.

## 2. Position in the architecture

```
                         ┌───────────────────────────────────────────┐
   FUTURE ENRICHERS      │        PLACE KNOWLEDGE ENGINE (PKE)        │
   (not built yet)       │                                            │
 DENUE re-read ─────┐    │  KnowledgeFragment log (append-only,       │
 Official websites ─┼──▶ │  immutable, fully traceable)               │
 Owners ────────────┤    │        │  deterministic precedence          │
 Government data ───┤    │        ▼                                    │
 Field visits ──────┘    │  PlaceKnowledge (recomputable projection)  │
                         │  + KnowledgeCoverage (what is known/missing)│
                         └───────────────────────────────────────────┘
                                        │
                                        ▼ (future milestone, flag-gated,
                                           separately approved)
                              Presentation / canonical projections
                                        │
        Frozen engines (V5.0–V5.8) keep reading ONLY LocavoPlace
```

**Relationship to existing layers — no duplication:**

| Layer | Responsibility | PKE relationship |
|---|---|---|
| City Pipeline V1 (`src/data/pipeline/`) | Ingest provider records into the canonical **identity + base fields** of `LocavoPlace` (who exists, where, base category) | PKE **reuses** its doctrines and types: open ids, `VerificationLevel`, the single trust scale (`trustRankOfLevel`), `LicenseTier` |
| OSM sidecar (V4F-0) | Build-time enrichment of specific empty fields for Culiacán | Its per-field provenance + sidecar separation is the precedent PKE generalizes; a future OSM enricher would emit fragments through the same contract |
| `LocavoPlace` | The only model engines and UI consume | PKE never mutates it; knowledge is keyed by `locavoPlaceId` and lives beside it |

The pipeline answers *"which places exist"*; the PKE answers *"what do we know
about each place, how well, and why"*.

## 3. Models

All models live in `src/placeKnowledge/model/` and are exported via
`src/placeKnowledge/index.ts`.

| Model | File | Responsibility |
|---|---|---|
| `KnowledgeFieldValueMap` / `KnowledgeFieldKey` | `knowledgeField.ts` | The **field catalog**: hours, phones, website, email, social media, services, payment methods, accessibility, parking, extra categories, description — each with a canonical value type. A compile-time exhaustiveness guard keeps the key list total. |
| `KnowledgeSource` | `source.ts` | Who asserts a fact: open `KnowledgeSourceId` resolved by a registry (never literals), a `kind` (mechanism: government dataset, official website, owner, field observation…), license, and authority on the **single** Locavo trust scale. |
| `Evidence` | `evidence.ts` | How the fact is known: `EvidenceLevel` (observed > owner_stated > official_publication > dataset_record > community_report > inferred), obtainment method, source-dated `capturedAt`, auditable reference. |
| `KnowledgeFragment` | `knowledgeFragment.ts` | The atomic, **immutable** unit: one field of one place per one source, with evidence, license tier, deterministic id, `retrievedAt`, and optional `supersedes` chain. |
| `KnowledgeConfidence` | `confidence.ts` | **Derived**, never subjective: a single deterministic formula over (source authority, evidence level), aligned with the historical provider confidences (DENUE 0.6, OSM 0.3) and the canonical `confidenceLevelOf` thresholds. |
| `PlaceKnowledge` | `placeKnowledge.ts` | The per-place **projection**: resolved field states with winner + preserved conflicts, monotonic `revision`, data-derived `updatedAt`. |
| `KnowledgeCoverage` | `coverage.ts` | What is known vs. missing, completeness ratio, freshness bounds — the audit surface that will prioritize future enrichment. |
| `FragmentPrecedence` | `precedence.ts` | The **normative conflict-resolution rule** as a pure, total comparator (see §6). |
| `KnowledgeEnricher` | `enricherContract.ts` | The contract every future feeder implements. Contract only — no implementation exists in PKE-0. |

## 4. How knowledge is added

1. A **source** is registered in the `KnowledgeSourceRegistry` (id, kind,
   license, verification level). Adding a source never edits a type union or
   the models — same doctrine as the pipeline's provider registry.
2. An **enricher** implements `KnowledgeEnricher`: a pure, deterministic
   function from a `LocavoPlace` (plus pre-loaded inputs injected at
   construction) to `KnowledgeFragment[]`. Loading inputs (frozen extracts,
   files) is a separate injected concern; enrichers never touch network, disk,
   or clocks.
3. Fragments are **appended** to the place's fragment log. Fragment ids are
   deterministic (`placeId::field::sourceId::capturedAt`), so re-running an
   enricher over the same inputs produces the same fragments byte-for-byte and
   exact duplicates are trivially deduplicated.
4. A future aggregator (PKE-1) folds the log into the `PlaceKnowledge`
   projection using the normative precedence. The projection is a pure function
   of the log: it can be deleted and recomputed at any time with an identical
   result.

## 5. How multiple sources coexist

- Every source's assertion is kept as its own fragment — sources never
  overwrite each other's data. Coexistence is the default; resolution happens
  only in the projection.
- Per-fragment `licenseTier` preserves the pipeline's legal architecture:
  permissive-base knowledge can live in the base; ODbL/CC-BY knowledge stays in
  removable, labeled sidecars; proprietary-excluded sources never feed offline
  artifacts. Deleting a source's fragments removes its contribution completely
  (removability, as in V4F-0).
- Source authority comes from the **single** trust scale
  (`trustRankOfLevel` in `src/data/pipeline/sourceTrust.ts`) — no second
  calibration surface exists.

## 6. How conflicts are resolved

The normative rule is executable: `compareFragmentPrecedence` in
`model/precedence.ts` (property-tested). When two fragments assert the same
field of the same place, the winner is decided by, in order:

1. **Source authority** (official > curated > source_verified > unverified);
2. **Evidence level** (observed > owner_stated > official_publication >
   dataset_record > community_report > inferred);
3. **Recency** of `capturedAt` (ISO-8601, lexicographic);
4. Stable tie-break by `sourceId`, then fragment id (ascending).

Consequences:

- Weaker evidence **never** replaces stronger evidence, regardless of arrival
  order — the projection is input-order independent (tested).
- Losers are **preserved**, not deleted: each resolved field records its
  `conflictingFragmentIds`, so disagreements between sources remain auditable
  and can be re-resolved if a rank or rule ever changes (with an explicit
  schema-version bump).

## 7. How information is versioned

- **Fragments are append-only and immutable.** A correction is a new fragment
  whose `supersedes` points at the fragment it replaces, forming an auditable
  chain per (place, field, source). Nothing is ever edited or deleted.
- **`PlaceKnowledge.revision`** is a derived monotonic counter (fragments
  applied), and `updatedAt` is the maximum `retrievedAt` in the log — both are
  derived from data, never from a wall clock.
- **`KNOWLEDGE_SCHEMA_VERSION`** (currently 1) travels on every fragment and
  projection. Additive catalog growth (a new field key) does not bump it;
  changing the meaning of existing fields, ranks, or the precedence rule does,
  with an explicit migration.

## 8. Full traceability

Every resolved value answers the complete audit chain with no gaps:

```
value → winningFragmentId → KnowledgeFragment
      → evidence (level, method, capturedAt, reference)
      → sourceId → KnowledgeSource (kind, license, verificationLevel)
      → licenseTier / supersedes chain / conflictingFragmentIds
```

Answerable by construction: *what do we claim, who said it, how do they know,
when, under which license, what did it replace, and who disagreed*.

## 9. Determinism rules (invariants)

1. No network, no disk access, no `Date.now()`, no randomness anywhere in the
   PKE. All dates are source data (`capturedAt`) or process inputs
   (`retrievedAt`), recorded as values.
2. Same fragment log → same `PlaceKnowledge`, byte-for-byte; input order never
   affects the result.
3. Fragment ids, confidence scores, and precedence are pure functions of their
   inputs.
4. Provider/source independence: models hold only canonical value types; no
   provider DTO or raw text leaks into the knowledge layer.
5. The trust scale is single-sourced from the pipeline; the PKE never defines
   a competing authority ranking.

## 10. Extensibility (no model changes required)

| To add… | You do… | Models change? |
|---|---|---|
| A new knowledge field | Add one entry to `KnowledgeFieldValueMap` + the catalog guard | No structural change — the catalog *is* the extension point |
| A new source | Register a `KnowledgeSource` | No |
| A new enricher (DENUE re-read, official sites, owners, government) | Implement `KnowledgeEnricher` | No |
| A new evidence kind or trust level | Extend the rank tables + schema-version review | Only the affected table |

## 11. Non-goals of PKE-0

Explicitly excluded (future, separately-approved milestones): any enricher
implementation; the aggregator/projection implementation (PKE-1); scraping,
external APIs, or downloads; persistence/storage format; City Pack changes;
integration with Decision/Home/search; UI of any kind; freshness decay in the
confidence formula (needs an explicit reference-date design first).
