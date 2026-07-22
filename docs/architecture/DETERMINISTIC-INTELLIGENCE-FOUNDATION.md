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
