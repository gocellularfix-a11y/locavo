# GEN-1 — Hybrid Local Decision Intelligence Architecture

**Status:** architecture proposal. **No code written, nothing implemented, nothing committed.**
This document is the output of a full read-only audit of the repository (`main`, HEAD
`5a05737`) plus the target architecture derived from it.

**Authority:** subordinate to [`docs/PROTOCOL.md`](../PROTOCOL.md). Where this document and the
Protocol disagree, the Protocol wins until the owner ratifies a change.

- **Related:** [`PLACE-KNOWLEDGE-ENGINE.md`](PLACE-KNOWLEDGE-ENGINE.md),
  [`CITY-PIPELINE-V1.md`](CITY-PIPELINE-V1.md),
  [`OSM-ENRICHMENT-ARCHITECTURE.md`](OSM-ENRICHMENT-ARCHITECTURE.md),
  [`DETERMINISTIC-INTELLIGENCE-FOUNDATION.md`](DETERMINISTIC-INTELLIGENCE-FOUNDATION.md)

---

## 1. The finding that governs every decision below

The platform's problem is **not** a shortage of intelligence. It is a shortage of **facts**.

Measured state of the live Culiacán City Pack (500 places):

| Attribute | Populated | Coverage |
|---|---|---|
| Address | 500 / 500 | 100% |
| Search terms | 500 / 500 | 100% |
| Phone | 258 / 500 | 51.6% |
| Email | 128 / 500 | 25.6% |
| **Website** | **52 / 500** | **10.4%** |
| **Opening hours** | **0 / 500** | **0%** |
| **Accessibility / amenities** | **0 / 500** | **0%** |
| Price level | 0 / 500 | 0% |

`CityPackPlace` (`src/data/import/denue/CityPackBuilder.ts:43-59`) has no `hours` and no
`features` field at all — the data is not merely empty, the shape does not carry it.

The existing OSM enrichment pipeline was built to close this gap and did not:
3 AUTO-SAFE matches out of 500, contributing **4 fields total** (2 wheelchair, 1 phone,
1 website) and **zero opening hours**
(`data/osm/culiacan/osm-enrichment-report.json`).

### Consequences that must be stated plainly

1. **"Hours not confirmed" is displayed on 100% of places because hours exist for 0% of
   places.** No language model can fix this. An LLM does not know when a taquería in
   Culiacán opens; if it produces hours, it fabricates them, which every governing rule in
   this project forbids.
2. **Build-time extraction AI can reach at most ~11% of the pack today** — the 52 places
   with a website, plus a negligible OSM contribution. Extraction is real and valuable, but
   it is not a coverage strategy on its own.
3. **The only source that scales for hours in Culiacán is the business owner.** DENUE does
   not publish hours, OSM has none for this city, and 89.6% of places have no website to
   read. Source priority #1 in the owner's specification is therefore also the only
   unbounded one — and it has zero infrastructure today (`enableOwnerData: false`,
   `src/config/featureFlags.ts:26`).
4. **A narrative layer built before the facts exist produces fluent emptiness.** Rephrasing
   "hours unknown, category food, 400 m away" in better prose still communicates nothing.

**Therefore GEN-1 sequences facts before narrative.** This is not a rejection of the AI
layer; it is the ordering that makes the AI layer worth having.

---

## 2. Audit: what already exists

### 2.1 Engines that are built, frozen, and correct

| Engine | Location | Notes |
|---|---|---|
| Intelligence core (V5.0) | `src/intelligence/` | Pure. Clock injected, never read (`context.ts:31`). No `Math.random`. 16 explanation codes, zero prose. Weights frozen, sum 1.0 (`config.ts`). |
| Evidence model | `src/intelligence/evidence.ts` | `CandidateEvidence` with genuine tri-state: `EvidenceStatus = 'known'\|'unknown'\|'conflict'\|'unsupported'`, `boolean \| 'unknown'` features, `distanceMeters: number \| null`. Unknown is never coerced to false. |
| Confidence | `src/intelligence/confidence.ts` | Ordinal `'unknown'\|'low'\|'medium'\|'high'`; aggregate is the **weakest** known dimension (conservative). |
| Context (V5.2) | `src/context/` | Time bands + 9 profiles, category-level multipliers only, never per-business. |
| Decision (V5.6) | `src/decision/` | `DecisionSet {primary, alternatives ≤2, diagnostics}`; degrades to fewer alternatives rather than filler. No clock, no randomness. |
| Preferences (V5.4) | `src/preferences/` | AsyncStorage only, never transmitted, deterministic serialization. |
| Place Knowledge (PKE-0) | `src/placeKnowledge/` | Models + precedence + confidence derivation. **Contract only — zero implementations.** |
| City Pipeline V1 | `src/data/pipeline/` | Provider-neutral adapters, merge engine, license tiers, single trust scale. |
| City Pack runtime | `src/data/places/citypack/` | Quadtree chunks, inverted-index shards, per-file SHA-256 in manifest, byte-identical rebuilds. |

### 2.2 Built but unreachable — significant latent value

- **`src/intelligence/place/` — "Rich Place Intelligence" (V5.8).**
  `buildPlaceIntelligence(place): PlaceIntelligenceReport` already produces `personalities`,
  `visitExperiences`, `audiences`, `bestTimes`, `noiseLevel`, `visitDuration`, `specialties`
  — each an `IntelligenceAttribute` with confidence and closed-vocabulary evidence. **No
  application code imports it.** Furthermore, its `computeEvidenceQuality` scores from hours
  (+1), a positive amenity (+1), price (+1) and name lexicon (+0.5); with hours, amenities
  and price at 0% coverage, only the lexicon signal can fire, so it would report
  `LOW`/`INSUFFICIENT` for essentially every place in the pack. It is a correct engine
  starved of input.
- **`src/intentEngine/` (22 intents, en/es/pt) is dead code** — consumed only by its own
  tests.
- **`src/intent/intentLexicon.ts` (17 intents, 7 languages)** reaches only the IntentBar
  chips (`src/features/today/IntentBar.tsx`). It already contains `ACCESSIBLE`
  ("silla de ruedas"), `FAMILY_ACTIVITY`, `QUICK_STOP`, `OPEN_LATE` — vocabulary the search
  path cannot see.

### 2.3 Conversational search: measured capability today

`PlaceSearchService` uses only `src/domain/searchLexicon.ts` — exact token matching, no
fuzziness, four output signals (`categories`, `nearby`, `openNow`, `terms`). Against the
owner's own example phrases:

| Phrase | Understood | Why |
|---|---|---|
| "tengo hambre" | ✅ → `food` | `hambre` is a subtype + intent-only token |
| "quiero tacos" | ✅ → `food` + term | alias table |
| "algo tranquilo" | ❌ | no ambience vocabulary exists |
| "traigo niños" | ❌ | `FAMILY_ACTIVITY` exists but only for chips |
| "uso silla de ruedas" | ❌ | `ACCESSIBLE` exists but only for chips |
| "solo tengo 30 minutos" | ❌ | no time-budget concept |
| "algo barato" | ❌ | price is read for completeness only, never as a filter |
| "voy manejando" | ❌ | no transport vocabulary |
| "no quiero el centro" | ❌ **inverted** | `no` is not a filler token; negation is never parsed, so `centro` survives as a positive term and *boosts* downtown results |

**Score: 2 of 9, with one active inversion.** The negation case is a live defect, not a
missing feature.

### 2.4 The exact string the owner wants replaced

`reason.fallback` — `'Es la opción más conveniente entre los resultados disponibles.'`
(`src/i18n/locales/es.ts:133`, and the six other locales). Selected at
`src/i18n/format.ts:219-221` when `reasons.length === 0`, rendered by
`src/components/RecommendedPlaceCard.tsx:72` and `src/app/place/[id].tsx:235`.

It is a **legacy V4 path**. The V5.6 decision surface already composes a better sentence via
`src/features/today/decisionWhy.ts` + `decision.why.template`. So part of the complaint is
an un-migrated surface, not an absent capability.

### 2.5 Runtime posture (the baseline AI must not damage)

- **Network reachable at runtime:** same-origin City Pack `fetch` (web only), OSM map tiles,
  and a `unpkg.com` CDN for Leaflet inside the map WebView. Supabase is unreachable
  (`useCloudPlaceRepository: false`).
- **Nothing about the user leaves the device.** Analytics is AsyncStorage-only, capped at
  200 events, with no transport implemented. Preferences are AsyncStorage-only. Telemetry
  is asserted not to contain coordinates.
- **i18n:** 397 keys × 7 locales, missing keys are a **compile error** (`TranslationKey =
  keyof typeof es`).
- **Offline:** service worker caches the app shell and, cache-first, the City Pack shards.

### 2.6 Defects found during the audit (independent of GEN-1)

| # | Severity | Finding |
|---|---|---|
| 1 | HIGH | Negation is unparsed: "no quiero X" boosts X (`src/domain/searchLexicon.ts:124-145`, `queryInterpreter.ts`). |
| 2 | MEDIUM | Layering violation: `src/intelligence/eligibility.ts:11` imports `isEligiblePlace` from `../features/home/surprise` — the deterministic core depends upward on the feature layer, and that module defaults to `Math.random` elsewhere. |
| 3 | MEDIUM | The OSM sidecar is loaded from `public/citypack/` (`createPlaceRepository.ts:50`) but no build script ever copies it there. Masked only because the flag is OFF. |
| 4 | LOW | `EvidenceStatus` values `'conflict'` and `'unsupported'` are consumed (`explanation.ts:123`, `orchestrator.ts:78`) but never produced — `SOURCE_CONFLICT` is a dead path. |
| 5 | LOW | Duplicate reason-prose implementation: `PlaceRankingService.explainReasons()` (hardcoded Spanish, non-i18n, currently unrendered) alongside `explainReasonsLocalized`. |

---

## 3. GEN-1 architecture

### 3.1 The two brains, and the boundary between them

```
 DETERMINISTIC BRAIN (authoritative)          │  AI BRAIN (interpretive)
 ─────────────────────────────────────────────┼───────────────────────────────────
 Identity, coordinates, distance              │  Semantic extraction from evidence
 Canonical IDs, licensing, provenance         │  Knowledge normalization proposals
 Evidence, confidence, conflict resolution    │  Place summaries and descriptions
 Eligibility, ranking, decision               │  Recommendation narratives
 Offline search, offline navigation           │  Natural-language intent parsing
 Business rules, safety, determinism          │  Conversation, comparison, advice
 ─────────────────────────────────────────────┼───────────────────────────────────
 OWNS TRUTH                                   │  NEVER OWNS TRUTH
```

The AI brain is always **downstream**. It never writes to a canonical store directly; it
writes *proposals* that a deterministic validator accepts or rejects.

### 3.2 Three AI stages, separated by time

The decisive architectural choice is that the AI is split not only by responsibility but by
**when it runs**. This is what preserves offline-first, cost, privacy and reproducibility.

```
BUILD TIME (on the founder's machine, offline for the user, reviewable, frozen into the pack)
  ①  Extraction AI      raw evidence text ──▶ proposed KnowledgeFragments
  ②  Narrative AI       fact bundle       ──▶ summaries/descriptions in 7 locales
                                              │
                                              ▼
                                   frozen City Pack artifacts
                                              │
RUNTIME (on the device)                       ▼
      Deterministic engines (unchanged) ──▶ decision + facts + frozen narrative
                                              │
  ③  Conversation AI (OPTIONAL, online only) ─┴─▶ live explanation / dialogue
      unavailable ──▶ deterministic sentence (today's decisionWhy) — no degradation of facts
```

| | Stage ① Extraction | Stage ② Narrative | Stage ③ Conversation |
|---|---|---|---|
| When | Build | Build | Runtime |
| Output | Facts (fragments) | Prose, frozen | Prose, ephemeral |
| Offline | N/A (user unaffected) | Yes — it is data | No — degrades |
| Per-user cost | None | None | Yes |
| Privacy exposure | None | None | Query + candidate facts only |
| Reproducible | Yes (pinned + reviewed) | Yes (pinned + reviewed) | No |
| Auditable | Yes | Yes | Logged locally only |

Stages ① and ② carry nearly all of the owner's "Place Knowledge AI" wish list at nearly none
of the operational risk. Stage ③ is the only one that introduces runtime cost, privacy
surface and non-determinism, and it is strictly optional by construction.

### 3.3 Facts vs Narrative — the enforced contract

**Facts** are `KnowledgeFragment`s in the existing PKE model. Every fact already carries
source, evidence, `capturedAt`, `retrievedAt`, licence tier and derived confidence.

**Narratives** are generated text that may only *refer to* facts present in a supplied
bundle. The contract is:

```
FactBundle (closed, structured, versioned)
   │  placeId, canonical fields, resolved KnowledgeFields,
   │  per-field {source, evidenceLevel, confidence, capturedAt},
   │  bundleHash  ← content hash of everything above
   ▼
NarrativeRequest ──▶ [AI] ──▶ NarrativeDraft
                                 │  text per locale
                                 │  claimRefs: which fact keys it used
                                 │  bundleHash it was generated from
                                 ▼
                        Deterministic validation (§3.5)
                                 ▼
                      Accepted narrative → pack artifact
```

Three invariants follow:

1. **The narrative layer never sees raw source documents at runtime.** It sees only the
   bundle. It cannot repeat something it read on a website that was not accepted as a fact.
2. **Every narrative stores the `bundleHash` it came from.** If any underlying fact changes,
   the hash changes and the narrative is automatically marked stale and regenerated. There
   is no way for prose to silently outlive the facts that justified it.
3. **Narratives are removable.** Deleting them degrades the product to today's deterministic
   sentences and loses no facts — exactly like the OSM sidecar precedent.

### 3.4 Extraction: why it is not hallucination, and how we prove it

The owner's framing is correct — pulling `WiFi = TRUE` out of "Free WiFi" is semantic
extraction, not invention. But that claim must be *mechanically verifiable*, not trusted.

**The verbatim-span rule.** Every proposed fragment must carry the exact substring of the
source document that supports it:

```
ProposedFragment {
  field: KnowledgeFieldKey        // must exist in the catalog
  value: <closed vocabulary for that field>
  sourceDocumentId: string
  evidenceSpan: { start: number, end: number, text: string }
  ...
}
```

A deterministic validator then checks, with no AI involved:

1. `field` exists in `KnowledgeFieldValueMap`.
2. `value` is in the closed vocabulary for that field (booleans tri-state; enums only).
3. `sourceDocument.slice(start, end) === evidenceSpan.text` — **the quoted evidence really
   exists in the source, byte for byte.**
4. The span is non-trivial and lies within the document.
5. For §24-restricted attributes (hours, accessibility, price, popularity, atmosphere,
   safety, availability), the span must be present and the fragment's `EvidenceLevel` may
   never be `inferred`.

A model that fabricates must fabricate a quotation that does not exist in the document, and
check 3 rejects it deterministically. This turns "trust the model" into "verify the citation".

**Normalization stays deterministic.** The AI may propose that "ADA entrance", "rampa
disponible" and "accessible entrance" all mean the same thing; the mapping table that
converts them to `accessibility.wheelchairAccessible = true` is committed code, reviewed,
and the same input always yields the same canonical value. The AI assists; the table decides.

### 3.5 Narrative containment — and its honest limit

For prose, three mechanisms in decreasing strength:

1. **Prefer composition over generation.** The existing mechanism
   (`explainReasonsLocalized`, `decisionWhy.ts`, `reason.separator`/`reason.and`/
   `decision.why.template`) already composes natural sentences from closed fragments across
   7 locales, deterministically and offline. Extending this catalog handles a large share of
   "Recommendation Explanations" with **no AI at all** and no fabrication risk.
2. **Claim linting for generated prose.** A deterministic linter rejects a draft containing
   any number, time, price, phone number, URL or superlative that does not appear in the
   fact bundle, and rejects §24-restricted vocabulary without a supporting fact.
3. **Human review before freeze.** For the first city, review is **required**, not optional.

**Stated limit:** containment of free-form text is not fully decidable. Mechanisms 1–3
reduce risk, they do not eliminate it. This is precisely why narrative generation is
build-time and reviewable rather than runtime and unseen, and why facts and narratives are
stored separately so a bad narrative can be deleted without touching a single fact.

### 3.6 Insertion points in the existing repository

Nothing below modifies a frozen engine.

| Stage | Inserts at | Artifact |
|---|---|---|
| Evidence acquisition | new `scripts/knowledge/fetch-evidence.ts` | committed raw evidence corpus per city, hashed |
| ① Extraction AI | new `scripts/knowledge/build-extraction.ts` | `data/knowledge/<city>/proposed-fragments.json` |
| Validation + precedence | `src/placeKnowledge/` (PKE-1: enricher runtime, registry, aggregator) | `data/knowledge/<city>/knowledge.json` (accepted facts) |
| ② Narrative AI | new `scripts/knowledge/build-narratives.ts` | `data/knowledge/<city>/narratives.json` (+ `bundleHash`) |
| Pack assembly | `src/data/places/citypack/buildBundledPack.ts:57-58`, between `buildCityPack` and `buildRuntimePack` | enriched `CityPackV1` |
| Runtime read | `CityPackRepository.loadChunk` (already has the append-only enrichment hook used by OSM) | merged `LocavoPlace` + narrative |
| ③ Conversation AI | new `src/services/ai/` behind a feature flag, called **after** the deterministic engines have produced candidates | ephemeral |

`CityPackPlace` must gain `hours` and `features` fields — a schema-version bump of the pack
format, which is a data-layer change, not an engine change.

### 3.7 Runtime AI: the rules that keep it optional

1. It is called **after** the deterministic pipeline has already selected and ranked
   candidates. It may reorder nothing and exclude nothing.
2. It receives the query and the fact bundles of the already-selected candidates. It does
   **not** receive the preference profile, the analytics log, or raw coordinates — a coarse
   distance and a locale suffice.
3. Any failure, timeout, or absence of network yields today's deterministic sentence. The UI
   must never show a spinner that blocks a decision the deterministic engine already made.
4. It is behind a feature flag, default OFF, with the same fail-safe posture as
   `enableOpenStreetMapProvider`.
5. Enabling it requires a privacy-policy update and an explicit user-facing consent, because
   it changes the app from "nothing about you leaves the device" to "your query leaves the
   device".

For intent parsing specifically, the correct division is: AI proposes a structured intent
from the closed `IntentId` vocabulary that already exists; the deterministic engine validates
that intent and executes the search. The AI never returns places — only an intent.

---

## 4. What must not change

1. Frozen engines (§ CURRENT STATE of the owner's specification) keep their public contracts
   and remain the source of truth.
2. The app opens, searches, ranks, decides and navigates with no network.
3. Determinism: same inputs → same outputs, byte-identical pack rebuilds, explicit stable
   tie-breaks.
4. Unknown stays unknown. No attribute is inferred into existence.
5. Every visible attribute keeps source, confidence, timestamp, evidence and licence.
6. Licence separation: no proprietary source that forbids caching may enter an offline pack.
   Google Business Profile is **excluded** and is correctly absent from the owner's source
   priority list; the `proprietary-excluded` tier already exists for this case.
7. Nothing about the user leaves the device without explicit consent.

---

## 5. Proposed sequence

Ordering is dictated by §1: coverage first, prose second.

**GEN-1.0 — Deterministic wins, no AI.** Wire the already-written intent vocabulary into the
search path (fixes 4–5 of the 7 failing phrases), parse negation (fixes the inversion),
migrate the legacy `reason.fallback` surface onto the V5.6 explanation, and extend the
closed fragment catalog so explanations stop repeating themselves. Cheap, offline,
zero fabrication risk, and it removes a visible defect.

**GEN-1.1 — PKE-1, the fact runtime.** Source registry, enricher execution, validation gate,
precedence aggregation, storage and the projection into `LocavoPlace`. Still no AI. Without
this there is nowhere for extracted facts to land.

**GEN-1.2 — Owner channel.** The only unbounded source of hours for Culiacán. Highest
priority in the owner's own list and currently at zero infrastructure.

**GEN-1.3 — Extraction AI (build time).** Applies to the 52 places with websites plus any
new evidence corpus. Honest ceiling today: ~11% of the pack — real, but not a coverage
strategy by itself.

**GEN-1.4 — Narrative AI (build time).** Summaries and descriptions frozen into the pack,
in 7 locales, reviewed before freeze.

**GEN-1.5 — Conversation AI (runtime, flagged, optional).** Only after 1.0–1.4 have given it
facts worth talking about, and only with the privacy work done.

Wiring V5.8 Rich Place Intelligence into the UI becomes worthwhile after GEN-1.1/1.2 supply
hours, amenities and price; before that it reports `INSUFFICIENT` for nearly every place.

---

## 6. Decisions required from the owner

1. **Sequence.** Confirm facts-before-narrative, or direct otherwise with the ~11% ceiling
   understood.
2. **Owner channel.** GEN-1.2 implies a submission and verification flow — the highest
   ongoing maintenance item in this plan (§27 of the Protocol). It needs an explicit
   decision about how much founder time it may consume.
3. **Which model provider, and where the key lives.** Build-time only means the key never
   leaves the founder's machine; runtime means key management, cost and rate limits.
4. **Review policy.** This document assumes human review is mandatory before any generated
   content is frozen into a pack for the first city. Confirm or relax.
5. **Protocol §24.** Now consistent: the owner's STRICT PROHIBITIONS ratify §24. Atmosphere,
   price, popularity and safety may appear **only** as facts extracted from a real source
   with a verbatim span — never as inference. Confirm this reading.
6. **Process.** §20.3 and §31 reserve commit and push authorization to the owner, and §15
   requires independent audit. Confirm whether that gate is active for GEN-1 rounds.

---

## 7. Non-goals

Not part of GEN-1: replacing any deterministic engine; AI-authored facts without a verifiable
source span; on-device model inference; Google Places or any proprietary cached source;
public reviews, ratings or social content (§27 high-maintenance); real-time messaging; a
second city; and any runtime AI dependency on the critical path of opening the app.
