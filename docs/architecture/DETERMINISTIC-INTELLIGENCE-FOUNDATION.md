# Deterministic Intelligence Foundation (V5.0)

Canonical reference for Locavo's local, deterministic, explainable
recommendation core. Self-contained: assumes no prior context beyond the
repository.

- **Location:** `src/intelligence/`
- **Status:** foundation implemented; no UI wiring (developer-facing engine).
- **Related:** [`LOCAVO_DATA_ARCHITECTURE.md`](../LOCAVO_DATA_ARCHITECTURE.md),
  [`OSM-ENRICHMENT-ARCHITECTURE.md`](./OSM-ENRICHMENT-ARCHITECTURE.md),
  [`CITY_PACK_RUNTIME.md`](../CITY_PACK_RUNTIME.md).

---

## 1. Purpose

Locavo must evolve from *listing nearby places* to *helping users decide*
(where to eat, what is open now, what fits a family, what supports wheelchair
access, and — crucially — **why**, and **how trustworthy** the answer is).

V5.0 does not ship a consumer recommendation UI. It provides the domain models
and deterministic engines that future features build on **safely**: given
identical inputs, the engine returns byte-equivalent structured results. It is
**not** a chatbot and contains **no** LLM, embeddings, vector search, remote
inference, or nondeterministic behavior.

## 2. Architecture

A pure functional core (`src/intelligence/`), free of React, storage, and
network. One entry point orchestrates seven separable responsibilities:

| Module | Responsibility |
|---|---|
| `intent.ts` | Closed, typed intent vocabulary → canonical categories |
| `context.ts` | Typed request context + validation/normalization |
| `evidence.ts` | Read-only extraction of structured, source-tagged evidence |
| `confidence.ts` | How trustworthy the evidence is (levels + rules) |
| `eligibility.ts` | Hard candidacy decision with reason codes |
| `scoring.ts` | Deterministic ranking with typed, weighted components |
| `explanation.ts` | Machine-readable reason codes (no UI prose) |
| `result.ts` | Result + diagnostics shapes |
| `config.ts` | Centralized weights/limits (single source) |
| `surprise.ts` | Deterministic seeded ordering |
| `orchestrator.ts` | `evaluateRecommendations(context, places, config)` |

## 3. Separation of Concerns

These are **distinct channels** and must never be conflated:

- **Intent** — a closed enum (`food`, `coffee`, `beer`, `nightlife`, `hotel`,
  `pharmacy`, `gas`, `shopping`, `surprise`). Not free text (that is the search
  domain's `SearchIntent`). Maps deterministically to canonical `CategoryId`.
- **Context** — only deterministically-suppliable data (injected `now`, origin,
  radius, preferences, seed). No weather/traffic/popularity.
- **Evidence** — *what is known* about a candidate, per dimension, each item
  declaring status (`known`/`unknown`/`conflict`/`unsupported`), source, and
  confidence. Presence of a field is not proof of correctness.
- **Confidence** — *how trustworthy the evidence is* — never quality, ranking,
  preference, or popularity.
- **Eligibility** — *should this remain a candidate?* — hard include/exclude.
- **Score** — *how well it fits this request* — ranking only.
- **Explanation** — *why* — structured codes for later localization.

## 4. Deterministic Rules

- The core never reads the clock or `Math.random()`; `now` is injected and
  `surprise` uses a seeded FNV-1a hash over stable place IDs.
- Score weights (`config.ts`) sum to `1.0` → `total ∈ [0, 1]`. Components are
  summed in a fixed order.
- **Scoring dimensions** (weights): intent match `0.30`, distance `0.25`
  (`1/(1 + km/scale)`, `scale = 2 km`), open status `0.20`, preferences `0.15`,
  evidence completeness `0.05`, confidence adjustment `0.05`.
- Unknown evidence scores **neutral** (`0.5`); negative evidence scores **low**
  (`0`). Unknown is never silently treated as `false`.
- **Tie-breaking** is always the stable place `id` ascending, after the primary
  key (score descending, or surprise key ascending).
- Explanation items are emitted in a fixed canonical code order.

## 5. Data Flow

```
evaluateRecommendations(context, places, config)
  → validate/normalize context      (context.ts)
  → for each place (input copied, never mutated):
       gatherEvidence               (evidence.ts, read-only)
       evaluateEligibility          (eligibility.ts) → drop rejected
       scoreCandidate               (scoring.ts)
       buildExplanation             (explanation.ts)
  → sort deterministically (score desc | surprise asc; tie by id)
  → limit to maxResults
  → { results, diagnostics }
```

Candidate **retrieval** (who to consider) is intentionally the caller's job
(e.g. a City Pack nearby/category query); the engine only **evaluates** an
already-bounded candidate set. This keeps the core testable without any
repository, storage, or network dependency.

## 6. Extension Points

- Add an intent: extend the union and the `INTENT_CATEGORIES` map (must map to
  existing categories only).
- Tune ranking: edit weights/limits in `config.ts` (single source).
- New evidence dimension: add to `evidence.ts` with explicit `affects*` flags,
  then optionally to scoring/explanation.
- New explanation: add a code to the closed vocabulary and the canonical order.
- Surprise policy: `surprise.ts` currently defines the deterministic *order*;
  a blended ranking policy is a V5.1 extension point.

## 7. Safety Invariants

1. Canonical `Place` data is never mutated; evidence lives in separate
   structures. The input array is never mutated.
2. No LLM, embeddings, vector DB, remote inference, or runtime network.
3. Determinism: no `Date.now()`/`Math.random()`; identical inputs →
   byte-equivalent results.
4. **Score and confidence are separate channels.**
5. Unknown data is surfaced as unknown, never presented as confirmed; unknown
   warnings must not read as confirmed negatives.
6. Contact-only evidence (phone/website presence) never implies business
   suitability and does not affect ranking.
7. The engine emits **no executable or navigation sink**: results carry a
   `placeId` and structured values, never untrusted URLs/phone strings routed to
   a link/openURL sink.

## 8. Non-Goals

No chatbot, NL parsing, LLM/embeddings/vector search, cloud AI, remote
recommendation APIs, live traffic/weather, reviews, ratings, popularity, paid
placement, ads, personalization profiles, accounts, behavioral tracking,
notifications, migrations, new databases, new City Packs, OSM runtime
enablement, OSM threshold changes, UI/home/map redesign, releases, or version
bumps.

## 9. Test Strategy

Deterministic unit tests (`src/intelligence/__tests__/`) cover intent mapping,
context validation/clamping, evidence extraction (canonical, enriched, missing,
provenance, no-mutation), confidence rules (base/agreement/conflict/weakest),
eligibility (category, open-now-required, unknown-not-excluded, required
accessibility, malformed, radius), scoring (stable breakdown, distance/open/
preference behavior, neutral-unknown, determinism), explanation (evidence
fidelity, unknown warnings, deterministic order, no prose), and orchestration
(empty, unsupported intent, ranking, limit, all-ineligible, byte-stable repeat,
tie-break, no-mutation, seeded surprise). Assertions are explicit on numeric
components and reason codes — no opaque snapshots.

## 10. Relationship to City Packs and OSM Enrichment

The engine consumes canonical `LocavoPlace` objects — exactly what the City Pack
runtime produces. It reuses canonical logic rather than duplicating it:
`haversineKm`/`isValidCoordinates` (distance), `evaluateOpenStatus`
(opening hours), `isEligiblePlace` (canonical eligibility), `CATEGORIES`, and
`primarySourceOf`/`PlaceVerification` (provenance/confidence). If OSM enrichment
is ever enabled (a separate, still-disabled milestone), enriched fields and
their `openstreetmap` provenance flow through the same evidence/confidence path;
V5.0 changes nothing about OSM matching or its runtime flag.

## 11. Future Milestones

- **V5.1** — Surprise ranking policy (blend distance/open under the deterministic
  seed); optional richer distance curves; per-field OSM provenance in evidence.
- **Consumer surface** — wire the engine to a decision UI with localized
  explanation rendering (the structured codes already support it).
- **Prerequisite (carried from the prior OSM audit):** before OSM runtime
  enablement, untrusted OSM `website`/`phone` values must be scheme-validated
  before reaching `Linking.openURL` (`src/app/place/[id].tsx`). This is a hard
  gate for that separate milestone and is out of scope for V5.0.

## 12. Candidate Retrieval (V5.3)

Retrieval and ranking are **separate responsibilities** with a strict dependency
direction:

```
Place Repository → Candidate Retrieval → V5.0 evaluation → V5.2 context re-rank → UI
```

`retrieveRecommendationCandidates` (`src/recommendationCandidates/`) answers only
*which places the engine should evaluate*. It never computes scores, confidence,
explanations, context boosts, UI labels, or Surprise hashing, and it has no React
or UI dependency. It returns canonical `LocavoPlace[]` plus structured
`CandidateRetrievalDiagnostics`.

**Pipeline (deterministic):**
1. Explicit category scope (or all 8 canonical categories).
2. Complete per-category retrieval via cursor **pagination** (does not stop at
   the first shard); one repository operation stream per category, chunk-cached.
3. Canonical validation — reject records without a canonical id/category; when an
   origin is present (geographic evaluation), reject invalid coordinates.
4. **Deterministic deduplication by canonical id.** Identical duplicates collapse
   silently (counted). Conflicting duplicates (same id, different content) never
   use array position or sort stability: the winner is the lexicographically
   smaller `JSON.stringify` and the conflict is counted. In practice the City
   Pack guarantees unique canonical ids, so conflicts do not occur; the rule is
   defensive.
5. Explicit geographic radius filter (canonical `haversineKm`), applied only with
   a valid origin and a finite radius > 0. `NaN`/`Infinity`/negative radius are
   ignored (no crash); a missing origin skips distance filtering and ordering.
6. Deterministic ordering: by distance ascending with an origin, tie-broken by
   canonical id; without an origin, by canonical id.
7. **Explicit safety limit** applied last, over the distance-ordered population
   (default 100, ≤ the engine's `maxResultsCap`) — never hash truncation. This
   preserves the strongest geographically relevant population before scoring.

**Diagnostics** are returned separately and are testable/deterministic:
`received = emitted + malformedExcluded + categoryExcluded + duplicatesRemoved +
outsideRadiusExcluded + safetyLimitDropped` (plus `conflictingDuplicates` and
`safetyLimitApplied`). They are not shown in the UI.

**Repository failure** degrades safely: a category whose fetch throws contributes
no candidates and never aborts retrieval.

**Complexity:** `O(n)` validation/dedup/filter + `O(k log k)` only for the
deterministic geographic ordering; `c` paginated repository operations (one per
category), with chunks cached by the repository.

**Today no longer depends on Surprise ordering.** `useToday` now calls
`retrieveRecommendationCandidates` once, then V5.0 once over the full retrieved
pool (`maxResults = pool size`, so nothing is truncated by hash), then context
once, then `buildTodayModels` once. A strong nearby candidate can no longer be
excluded by hash order before ranking. The standalone **Surprise** feature
(`selectSurprisePlace`) is unchanged and still used elsewhere.

## 13. Private Preferences (V5.4)

A private, local-only preference layer (`src/preferences/`) personalizes Today
**without** accounts, remote profiles, analytics, ML, or network. Dependency
direction: Local Store → normalized Snapshot → bounded Adjustment → applied
after V5.0 quality + V5.2 context → deterministic order → UI. The layer never
retrieves candidates, replaces V5.0 scoring, modifies V5.0 confidence, modifies
V5.2 context multipliers, generates prose, or depends on React/UI (the store's
storage adapter and the React context are the only IO seams).

**Model & persistence.** `UserPreferenceProfile` (schemaVersion 1) stores only
canonical ids + bounded signals — never whole place records. `normalizeProfile`
recovers safely from malformed/unknown-schema data (→ canonical defaults),
dedupes and sorts categories, clamps distance to `[0.1, 50] km`, caps interaction
counters (`DETAIL_OPEN_CAP`/`DIRECTIONS_CAP = 5`), drops malformed/empty signals,
and bounds persisted places to `MAX_PLACE_SIGNALS = 500`. The store
(`AsyncStorage`, injectable adapter) is local-only with atomic key replacement,
safe failure, and no remote fallback. Actions mutate only through a **pure
reducer** (`reducePreference`); timestamps are passed in, never read from the
clock inside pure functions.

**Explicit vs interaction-derived signals.** Explicit: favorite/hidden place,
favorite/reduced category, distance, and open-now/accessibility/family/parking
preferences. Interaction-derived (only high-intent local actions): opening place
details and requesting directions — never impressions, scrolling, or view time.

**Adjustment model (multiplicative, bounded).** `evaluatePreferenceAdjustment`
returns a multiplier (never combined with an additive term — `additiveBoost` is
always 0) applied as `personalizedScore = contextualScore × multiplier`, clamped
to `[0.5, 1.6]`. Favorite place ×1.5; favorite category ×1.2; reduced category
×0.7; supporting matches ×1.05 each; interaction signals are **weaker**
(directions ×1.05, detail-open ×1.03) and count presence once (capped, never
unbounded). Hidden places are **excluded** (`PREF_PLACE_HIDDEN`). The V5.0 base
score and confidence are preserved for display/diagnostics; tie-break stays
canonical `placeId`.

**Explanations** are structured `PreferenceReasonCode`s mapped to typed i18n keys
in the presentation layer (all 7 locales). **Diagnostics**
(`PreferenceEvaluationDiagnostics`) are deterministic, not shown in the UI, no
telemetry.

**Stability/decay.** No time decay (no canonical decay utility exists):
explicit/favorite/hidden state does not decay, counters stay capped; stored
timestamps do not affect scoring in V5.4.

**Privacy.** Everything stays on the device (surfaced as *"Preferences stay on
this device."*). No accounts, network, analytics, tracking of impressions or
scrolling. The user can review, favorite/unfavorite, hide/unhide, and reset all
preferences (confirmation required; unrelated settings and City-Pack data are not
touched).

**Complexity:** normalization `O(p)`, per-place adjustment `O(1)` (normalized
sets/maps), full personalization pass `O(n)`, ordering preserves the existing
bounded `O(n log n)` stage. Today loads preferences once and evaluates once.

V5.0 quality/confidence, V5.2 context multipliers, and V5.3 retrieval remain
separate and unchanged; preferences are strictly an additional, bounded,
explainable layer.
