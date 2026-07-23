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
- **Prerequisite (carried from the prior OSM audit) — RESOLVED in V5.7:**
  untrusted `website`/`phone` values are now scheme/format-validated by the pure
  action policy (`src/actions`) before any `Linking.openURL`, and the place-detail
  screen no longer passes raw fields to an opener (see §16). The hard gate for OSM
  runtime enablement is satisfied; OSM runtime enrichment itself remains off.

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

## 14. Intent Intelligence (V5.5)

A deterministic Intent Engine (`src/intent/`) converts a user's immediate goal
into structured recommendation constraints and boosts — **no** LLM, NLG, ML,
embeddings, or remote classification. Dependency direction: user input → parser
→ resolver → snapshot → candidate scope / intent adjustment → applied after V5.0
quality + V5.2 context + V5.4 preferences → final order → UI. The engine never
loads places, replaces retrieval, modifies V5.0/V5.2/V5.4 formulas, persists
search text, generates prose, or depends on React/network.

**Parser vs resolver (separate responsibilities).** `parseIntentText(input,
locale)` normalizes (reusing `normalizeQuery`; input bounded to 120 chars / 24
tokens, ReDoS-safe), then matches curated catalog phrases longest-first with
overlap prevention — token-subsequence for Latin scripts, catalog-substring for
Chinese (whitespace tokenization is not assumed for zh). It returns structured
matches, never recommendations, and never throws. `resolveIntent(parse,
explicitSelection?)` picks one primary intent by deterministic priority, retains
compatible secondaries, flags conflicting primaries as `AMBIGUOUS`, prefers an
explicit UI chip over parsed text, and returns `null` for UNKNOWN.

**Catalog & lexicon.** `IntentDefinition` per intent (category scope, supporting
categories, evidence preferences, context affinity, priority) — canonical
categories only, never businesses. Curated per-intent phrase lexicons cover all
7 locales (every intent has ≥1 phrase per locale; no conflicting phrases).

**Confidence** (`EXACT | STRONG | PARTIAL | AMBIGUOUS | UNKNOWN`) is a separate
enum — never a percentage — distinct from recommendation confidence, score,
data quality, and preference strength.

**Candidate scope.** Only EXACT/STRONG intents with a reliable scope (≤4
categories) narrow retrieval by passing explicit `categories` into the **same**
V5.3 `retrieveRecommendationCandidates` (no retrieval logic is duplicated).
Partial/ambiguous/unknown intents use the canonical broad retrieval and degrade
safely.

**Adjustment (bounded multiplicative).** `finalScore = contextualScore ×
preferenceMultiplier × intentMultiplier`, clamped to `[0.5, 1.6]`. In-scope
category ×1.3; out-of-scope ×0.7 (down-rank, never hard-exclude); modifier
matches (open-now/open-late/nearby/accessible/family) ×1.1; closed under an
open-now/open-late intent ×0.6 — strong intent makes the task relevant but does
not let clearly unsuitable or closed places win. Base score, confidence,
contextual score, and preference multiplier are all preserved; tie-break stays
canonical `placeId`. Reason codes map to typed i18n keys (7 locales); `null`
intent → identical personalized order (clearing intent restores normal Today).

**Ambiguity/unknown.** Ambiguous input surfaces a small deterministic choice;
unknown input shows a localized "not recognized" message and keeps normal
suggestions — never an invented intent.

**Privacy & state.** Session-local only: no raw intent text, prior searches,
unresolved tokens, histories, or timestamps are persisted; the active resolved
intent lives in React state while the screen is open and clears on restart.

**Runtime.** Per submitted intent: parse once, resolve once, retrieve once,
V5.0 once, context once, preferences once, intent once. **Complexity:**
normalization `O(t)`, phrase matching bounded by catalog size, resolution
`O(m log m)`, per-candidate intent `O(1)`, full pass `O(n)`, ordering the
existing `O(n log n)`.

V5.0 quality/confidence, V5.2 context, V5.3 retrieval, and V5.4 preferences
remain separate and unchanged; intent is strictly an additional, bounded,
explainable layer.

## 15. Decision Experience (V5.6)

**Ranking vs. decision.** Ranking (V5.0–V5.5) answers "which candidate scored
highest?" — it produces `finalScore = contextualScore × preferenceMultiplier ×
intentMultiplier` and orders the population. Decision selection answers a
different question: "which meaningfully different options should the user
compare?" V5.6 **consumes** the ranked models; it never re-ranks.

**Dependency direction.** `src/decision` is a pure domain layer with no React
and no `features/` imports. It reads a structural supertype `RankedDecisionModel`
(which `IntentTodayCardModel` satisfies) plus a `placesById` map. It does **not**
retrieve places, evaluate V5.0, apply context/preference/intent multipliers,
parse text, or touch persistence. Flow: `buildIntentTodayModels(…)` →
`buildDecisionSet(…)` → `DecisionSection`.

**Comparison snapshot.** `buildDecisionSnapshots` normalizes each ranked model
to `DecisionCandidateSnapshot` using only already-evaluated values: `finalScore`,
`sourceRank`, `distanceKm`, `recommendationConfidence` (the canonical
evidence-quality signal — no new confidence model), `openState`, `category`, and
structured `accessible`/`familyFriendly` from the place record. `intentStrength`
= count of distinct `intent.reason.*` keys already merged; `preferenceStrength` =
badge weight (favorite 200 ≫ match 100 ≫ 0) plus distinct `pref.reason.*` count.
No prior formula is recomputed.

**Roles.** Implemented: `BEST_MATCH`, `CLOSEST`, `MOST_RELIABLE`,
`BEST_INTENT_FIT`, `BEST_PREFERENCE_FIT`, `OPEN_NOW`, `ACCESSIBLE`,
`FAMILY_PICK`, `ALTERNATIVE`. `BUDGET_FRIENDLY` is **not** implemented — price is
not part of the ranking evidence and inventing a budget role would fabricate
signal. `BEST_MATCH` is always the top ranked eligible candidate (primary).

**Meaningful differentiation (exact rules).** Business-name difference never
counts. Distance: alternative is CLOSEST only when `primary.distanceKm −
candidate.distanceKm ≥ 0.5 km`. Confidence: MOST_RELIABLE only when
`confidenceRank(candidate) > confidenceRank(primary)` (≥ one canonical level).
Intent: BEST_INTENT_FIT only when `candidate.intentStrength >
primary.intentStrength` and an intent is active. Preference: BEST_PREFERENCE_FIT
only when `candidate.preferenceStrength > primary.preferenceStrength`. Category:
ALTERNATIVE only when the category differs **and** is compatible with the active
intent scope (any category when no intent), and `finalScore ≥ 0.6 × primary`.
Open/accessible/family roles require explicit positive evidence and only add
value when the primary lacks it.

**Role priority.** `BEST_MATCH` (primary), then alternatives in the fixed order
CLOSEST → MOST_RELIABLE → BEST_INTENT_FIT → BEST_PREFERENCE_FIT → OPEN_NOW →
ACCESSIBLE → FAMILY_PICK → ALTERNATIVE. Each place fills at most one visible
role; each role appears at most once; deterministic tie-breaks by `sourceRank`
then `placeId`. **Maximum output: one primary + up to two alternatives.** Fewer
options are returned when differentiation is insufficient — never filler.

**Tradeoffs.** Emitted in canonical order only when a canonical datum supports
them and the difference is non-negligible: `TRADEOFF_FARTHER` (≥ 0.5 km),
`TRADEOFF_LOWER_CONFIDENCE`, `TRADEOFF_WEAKER_INTENT_MATCH`,
`TRADEOFF_WEAKER_PREFERENCE_MATCH`, `TRADEOFF_LIMITED_EVIDENCE` (confidence
`unknown`), `TRADEOFF_DIFFERENT_CATEGORY`. `TRADEOFF_CLOSED_SOON` is intentionally
absent: there is no canonical "closing soon" signal.

**Unknown-evidence semantics.** `distanceKm === null`, `openState === 'unknown'`,
and `accessible`/`familyFriendly === undefined` are preserved as unknown and
never treated as `false`; evidence-gated roles are never assigned from unknowns
(counted under `missingEvidenceRejected`).

**No-intent / ambiguity.** With no active intent, V5.6 still builds a general
decision set from personalized Today: `BEST_MATCH` reflects V5.0–V5.4 order and
alternatives may be closest/most-reliable/preference-fit; clearing intent
recomputes deterministically. Unknown or ambiguous intent (no resolved snapshot)
never creates an intent-specific role.

**Diagnostics.** `DecisionSelectionDiagnostics` (received, eligible, selected,
duplicatePlacesRejected, duplicateRolesRejected,
insufficientDifferentiationRejected, missingEvidenceRejected,
roleCandidatesEvaluated) are local, never shown in the consumer UI, never
persisted or transmitted, and arithmetic-consistent (`selected = (primary?1:0) +
alternatives`).

**Complexity.** Snapshot construction `O(n)`; role selection `O(n × r)` with `r`
a small fixed role count; deduplication `O(n)`; bounded constant output. The
decision set is built once per ranked-model change (a `useMemo` in `useToday`),
never per rendered card; no repository access, no re-execution of V5.0–V5.5, no
persistence, no network, no randomness.

**Privacy.** No accounts, network, analytics, telemetry, persistence, query or
place-history logging, or background tracking. Compare is pure local UI state and
records no preference signal; card impressions and role assignments are never
recorded.

V5.0–V5.5 remain separate and unchanged; decision selection is strictly an
additional, bounded, explainable layer on top of the ranked models.

## 16. Safe Decision Actions (V5.7)

**Milestone question.** Can the user *safely act* on a Locavo decision? V5.6
picks the best place; V5.7 makes the real-world actions (directions, call,
website) safe, deterministic, explicit, and consistent. It does not change how a
place was selected.

**Action-layer boundary.** `src/actions` is a pure domain (no React, no
`Linking`, no network, no persistence, no side effects, no randomness). It
consumes the canonical `LocavoPlace` fields (coordinates, phone, website) and
emits immutable structured `PlaceAction`s with typed reason codes. Presentation
maps codes to i18n keys; a separate platform boundary
(`src/services/placeActionExecutor.ts`) performs the external open. Pure action
construction is unit-testable without React Native (enforced by a source-scan
test).

**Model.** `PlaceActionType` = DIRECTIONS | CALL | WEBSITE; `availability` =
AVAILABLE | UNAVAILABLE | INVALID; `target` = canonical string (`tel:…`,
`https:…`, or `"lat,lng"`) or null; `reasonCode` ∈ {ACTION_AVAILABLE,
ACTION_MISSING_VALUE, ACTION_INVALID_COORDINATES, ACTION_INVALID_PHONE,
ACTION_INVALID_URL, ACTION_UNSUPPORTED_SCHEME}. Missing value → UNAVAILABLE;
malformed/unsafe → INVALID. `ACTION_OPEN_FAILED` is an execution outcome, not a
domain state.

**Coordinate policy.** Reuses `isValidCoordinates`: latitude/longitude finite,
`|lat| ≤ 90`, `|lng| ≤ 180`. Invalid coordinates never become directions and are
never silently coerced to zero. `(0,0)` is canonically valid and is **not**
treated as missing. Directions retain the existing approved Google Maps universal
provider (coordinate-validated, failure-catching) — no new map provider, no
runtime OSM enrichment.

**Phone normalization.** Trims; allows a single leading `+`; strips safe visual
separators (space, `(`, `)`, `.`, `-`); rejects letters, embedded schemes
(`tel:`), URL fragments/queries, control characters, and empty results; requires
7–15 digits (E.164 upper bound); emits a canonical `tel:` only after validation.
Country codes are never inferred; the stored record is never modified.

**URL validation (structural only, no network, no redirects, no `new URL`).**
Allowed schemes: `https:` and `http:` (the latter explicitly permitted by product
policy). Rejects `javascript:`, `data:`, `file:`, `intent:`, `content:`, `ftp:`,
`tel:`, `mailto:`, scheme-relative `//host`, embedded credentials, control
characters, empty/single-label hosts, and non-numeric ports. Bare domains are
normalized deterministically to `https://` (documented and tested). Host lowercased
and re-serialized into a canonical target.

**UI execution gate.** All place-detail external opens route through one approved
boundary. The previously-unsafe `Linking.openURL(rawWebsite)` is removed; website
and call now execute the *validated* target via `executePlaceAction`, which
confirms `AVAILABLE` + non-null target, opens, and reports rejection/failure as
`ACTION_OPEN_FAILED` without crashing. Directions keep their existing
coordinate-validated provider gate (preserving the V5.4 `REQUEST_DIRECTIONS`
interaction and the failure/retry notice). Unavailable actions are omitted rather
than shown as broken buttons; present-but-invalid contact values may still be
displayed as plain (non-interactive) text — never as an enabled control and never
inventing missing data.

**Unknown/invalid data.** Missing phone/website → no action (omitted). Invalid
phone/website → INVALID, no enabled control. Invalid coordinates → no directions.
One invalid action never suppresses the other valid actions.

**Complexity & privacy.** Each policy is `O(n)` in the field length; building the
set is constant work over three fields, memoized once per loaded place. No
accounts, network, analytics, telemetry, persistence, action history, background
location, automatic calling/opening, or randomness.

**Frozen engines.** V5.0 quality/confidence, V5.1 presentation, V5.2 context,
V5.3 retrieval, V5.4 preferences, V5.5 intent, V5.6 decision, and Surprise are
untouched. V5.7 is an action-policy layer that consumes existing outputs; the only
integration edits are import-and-render changes in `src/app/place/[id].tsx`.
