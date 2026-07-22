# OSM Enrichment Architecture (V4F-0)

Canonical reference for the OpenStreetMap enrichment pipeline that augments the
Culiacán City Pack. This document is self-contained: it assumes no prior context
beyond the repository itself.

- **Status:** implemented, merged, runtime **disabled by default**.
- **Scope of this pilot:** Culiacán only (the 500-place DENUE City Pack).
- **Related docs:** [`LOCAVO_DATA_ARCHITECTURE.md`](../LOCAVO_DATA_ARCHITECTURE.md),
  [`CITY_PACK_RUNTIME.md`](../CITY_PACK_RUNTIME.md),
  [`DATA_SOURCE_POLICY.md`](../DATA_SOURCE_POLICY.md).

---

## 1. Overview

**What it is.** A deterministic, offline, build-time pipeline that matches an
existing DENUE-canonical place set against a frozen OpenStreetMap (OSM) snapshot
and, for high-confidence matches only, records a small set of OSM-derived fields
(phone, website, opening hours, accessibility) in a **separate sidecar file**.
At runtime the sidecar is optionally merged over the canonical places behind a
feature flag.

**Why it exists.** DENUE (INEGI) is authoritative for *which businesses exist and
where*, but sparse on operational detail. OSM carries that detail but with
variable quality and an Open Database License (ODbL) obligation. V4F-0 is the
minimal, safe experiment to enrich the official base with community data without
corrupting canonical facts or over-claiming accuracy.

**Problem it solves.** A reproducible, auditable way to attach OSM fields to
canonical places under a hard conservative bar, with full per-field provenance
and clean license separation — plus reusable infrastructure for future cities.

---

## 2. Design Principles

- **DENUE is canonical.** OSM never changes canonical identity, name, category,
  or coordinates. It only fills approved *empty* fields.
- **Offline-first.** No network at runtime. The pipeline consumes a frozen
  snapshot committed to the repository; the app never calls OSM/Overpass.
- **Deterministic builds.** Same inputs → same bytes. No wall-clock or randomness
  in the pipeline.
- **Reproducible artifacts.** Every generated file is fingerprinted or
  regenerable byte-for-byte from committed inputs.
- **Append-only enrichment.** OSM provenance is appended, never inserted at the
  primary position; DENUE remains the primary source.
- **Conservative matching.** A false enrichment is worse than a missed one;
  uncertainty resolves to *ambiguous*, not *auto-safe*.
- **Provenance.** Field-level provenance lives in the sidecar (the OSM-derived
  database), enabling attribution and removal.
- **Feature-flag safety.** Runtime enrichment is OFF by default and fails safe.

---

## 3. High-Level Architecture

```
 BUILD TIME (deterministic, offline)                         COMMITTED ARTIFACTS
 ┌──────────────────────────────────────────────┐
 │ Geofabrik Mexico PBF  (temporary, uncommitted)│
 │        │ clip to City Pack bounds (+250 m)     │
 │        ▼  scripts/osm/extract-culiacan-snapshot.py
 │ culiacan-osm-pilot.osm.pbf ───────────────────┼──▶ data/osm/culiacan/*.pbf + snapshot-metadata.json
 │        │ scripts/osm/extract-pois.py           │
 │        ▼                                        │
 │ osm-pois.json  (2,012 POIs) ──────────────────┼──▶ data/osm/culiacan/osm-pois.json
 │        │                                        │
 │  DENUE City Pack (500 places) ──┐               │
 │        ▼                        ▼               │
 │  buildOsmEnrichment():                          │
 │    candidate gen (≤150 m, category-compatible)  │
 │    → matchPlaces()  [canonical engine]          │
 │    → 3-tier classify (AUTO-SAFE wrapper)        │
 │    → 1:1 contention resolution                  │
 │    → field ingestion                            │
 │        │                     │                  │
 │        ▼                     ▼                  │
 │  osm-enrichment.json   osm-enrichment-report.json ─▶ data/osm/culiacan/
 └──────────────────────────────────────────────┘

 RUNTIME (behind feature flag `enableOpenStreetMapProvider`, OFF by default)
 ┌──────────────────────────────────────────────┐
 │ CityPackRepository.loadChunk():                │
 │   CityPackPlace → cityPackPlaceToLocavoPlace()  │
 │   → [flag ON] applyOsmEnrichment(place, entry)  │  append-only, fail-safe
 └──────────────────────────────────────────────┘
```

**Components**

| Component | Location |
|---|---|
| Frozen snapshot + metadata + attribution | `data/osm/culiacan/culiacan-osm-pilot.osm.pbf`, `snapshot-metadata.json`, `ATTRIBUTION.md` |
| Snapshot extractor / integrity verifier | `scripts/osm/extract-culiacan-snapshot.py`, `src/data/osm/snapshotIntegrity.ts` (`npm run osm:snapshot:verify`) |
| POI extraction | `scripts/osm/extract-pois.py` → `data/osm/culiacan/osm-pois.json` |
| Canonical matching engine | `src/services/places/PlaceMergeService.ts` |
| Config (single source) | `src/data/osm/osmMatchConfig.ts` |
| Category mapping | `src/data/osm/osmCategoryMap.ts` |
| Signal parsers (phone/website/hours/booleans) | `src/data/osm/osmSignals.ts` |
| Candidate adapter | `src/data/osm/osmCandidates.ts` |
| AUTO-SAFE 3-tier wrapper | `src/data/osm/classifyOsmMatch.ts` |
| Pipeline orchestrator | `src/data/osm/buildOsmEnrichment.ts` (CLI: `scripts/osm/build-enrichment.ts`, `npm run osm:enrichment:build`) |
| Runtime merge | `src/data/osm/applyOsmEnrichment.ts`, wired in `src/data/places/citypack/CityPackRepository.ts` and `createPlaceRepository.ts` |
| Sidecar + POI + enrichment contracts | `src/data/osm/OsmEnrichment.ts` |
| Feature flag | `src/config/featureFlags.ts` (`enableOpenStreetMapProvider`) |

---

## 4. Matching Philosophy

- **One engine, reused.** All scoring goes through `PlaceMergeService.matchPlaces`
  (with `nameSimilarity`, `normalizedDigits`, `websiteDomain`). No second matcher,
  similarity metric, or normalizer exists. This keeps one doctrine and one
  calibration surface, and avoids drift. The engine's result was extended
  additively to expose `distanceMeters` and `nameSimilarity`; its thresholds
  (`MERGE_CONFIDENCE_THRESHOLD = 0.75`, `NEARBY_STRONG_M = 75`,
  `STRONG_NAME_SIMILARITY = 0.8`) are exported for reuse.
- **Contact-only matches are forbidden.** Shared phone and/or website — even
  combined with category — can push the engine's confidence over threshold, but
  such signals are shared across chains, franchises, corporate call centers, and
  aggregator domains (e.g. `facebook.com`). AUTO-SAFE therefore additionally
  requires **non-contact corroboration**: strong name similarity (`≥ 0.8`) *or*
  strong proximity (`≤ 75 m`), evaluated on the engine's computed values.
- **AUTO-SAFE is intentionally conservative.** It requires all of:
  `likelySamePlace` (engine confidence `≥ 0.75` + strong signal), category
  compatibility, non-contact corroboration, a unique best candidate, and no
  competitive alternative within `competitiveConfidenceDelta`.
- **Ambiguity is preferred over false positives.** Anything short of AUTO-SAFE
  that still shows meaningful signal is classified AMBIGUOUS (surfaced in
  diagnostics for future human review), never silently enriched.

---

## 5. Pipeline

1. **Snapshot acquisition.** A Geofabrik Mexico PBF is clipped to the canonical
   City Pack bounds (from `public/citypack/manifest.json`, expanded by a 250 m
   margin to cover the 150 m match radius at the edges) using libosmium
   (`BackReferenceWriter` for reference completeness). Output and full
   provenance are recorded in `snapshot-metadata.json`.
2. **POI extraction.** The frozen snapshot is reduced to a committed, sorted JSON
   list of category-bearing POIs (`osm-pois.json`) so all downstream steps run in
   pure Node with no PBF parser.
3. **Candidate generation.** For each DENUE place, OSM POIs are filtered to
   category-compatible candidates within `candidateRadiusMeters` (150 m).
4. **Scoring & classification.** Each candidate is scored by `matchPlaces`; the
   wrapper assigns AUTO-SAFE / AMBIGUOUS / NO-MATCH.
5. **Contention resolution.** One OSM object may enrich at most one DENUE place.
   Conflicts resolve deterministically: highest confidence wins, ties by lowest
   `locavoPlaceId`; losers are re-evaluated against remaining candidates.
6. **Field ingestion.** For AUTO-SAFE matches, approved fields are ingested
   (phone/website only when the DENUE value is empty; opening hours all-or-
   nothing; safe booleans). Conflicts are recorded as diagnostics, never applied.
7. **Emit artifacts.** `osm-enrichment.json` (sidecar) and
   `osm-enrichment-report.json` (metrics + diagnostics) are written
   deterministically.
8. **Runtime merge.** When the flag is on, `CityPackRepository.loadChunk` merges
   sidecar entries over hydrated places (see §7).

Regenerate: `npm run osm:enrichment:build` (POI regeneration requires the
documented pyosmium tooling; the enrichment build itself is pure Node).

---

## 6. Sidecar Architecture

The sidecar `data/osm/culiacan/osm-enrichment.json` **is** the OSM-derived
database. Rationale:

- **Separation.** OSM data lives entirely outside the DENUE/INEGI City Pack; the
  two layers never merge in a source artifact. The merge happens only in memory
  at runtime.
- **Licensing (ODbL).** Keeping the derived database physically separate makes
  attribution and share-alike obligations attach to that file alone. Attribution
  (`© OpenStreetMap contributors`, ODbL 1.0) is carried in the sidecar and
  `ATTRIBUTION.md`. *This is engineering separation, not a legal conclusion;
  owner legal review is required before any broader distribution.*
- **Removability.** Deleting the sidecar (or leaving the flag off) removes all
  OSM-derived enrichment with zero effect on the canonical pack.
- **Deterministic format** (`locavo-osm-enrichment`, schema v1): stable key
  order, entries sorted by `locavoPlaceId`, only AUTO-SAFE entries, per-field
  ingestion flags. Byte-identical on rebuild.

No canonical type shapes (`LocavoPlace`, `CityPackPlace`) were changed.

---

## 7. Runtime Behavior

Controlled by `enableOpenStreetMapProvider` in `src/config/featureFlags.ts`.

- **Flag OFF (default).** No enrichment provider is constructed; the sidecar is
  never loaded; `CityPackRepository` behaves exactly as before. No behavior
  change, no OSM dependency.
- **Flag ON.** `createPlaceRepository` injects a provider that loads and parses
  the sidecar once (memoized). In `CityPackRepository.loadChunk`, after hydrating
  each `CityPackPlace` into a `LocavoPlace`, entries matched by `locavoPlaceId`
  are merged via `applyOsmEnrichment`: approved empty fields filled, OSM
  provenance appended (never at index 0), verification tier untouched. If the
  sidecar is missing, malformed, or schema-incompatible, the provider degrades to
  "no enrichment" — pack loading never breaks.

---

## 8. Safety Rules (invariants)

These must not be broken without an explicit contract review:

1. OSM never changes canonical identity, name, category, coordinates, CLEE, or
   the DENUE source ordering.
2. Contact data alone (phone / website / phone+website / ±category) never
   promotes to AUTO-SAFE — strong name or strong proximity is required.
3. The matching engine remains single-source: no parallel matcher, similarity
   metric, phone/website normalizer, or competing thresholds.
4. Provenance is append-only; `primarySourceOf()` and the verification tier stay
   DENUE-derived; OSM is source-imported, not owner-confirmed.
5. Opening hours are all-or-nothing (unmentioned day → `null`, explicit `off` →
   `[]`, unsupported → not ingested). Booleans: absent/unknown/unsupported/
   limited → `undefined`; `wheelchair=no` is diagnostic-only.
6. Builds are deterministic; the pipeline uses no wall-clock or randomness.
7. Runtime enrichment stays behind the feature flag, OFF by default, fail-safe.

---

## 9. Final Metrics

| Metric | Value |
|---|---|
| Frozen snapshot | 3.2 MB, reference-complete (358,564 nodes / 36,066 ways / 99 relations) |
| OSM POIs (`osm-pois.json`) | 2,012 (998 nodes, 1,014 ways) |
| DENUE places | 500 |
| AUTO-SAFE / AMBIGUOUS / NO-MATCH | 3 / 24 / 473 |
| Places with ≥1 compatible candidate | 105 |
| NO-MATCH causes | 56% no nearby OSM, 27% nearby but category-incompatible, 16% below confidence floor |
| Determinism | sidecar and POI extraction byte-identical on rebuild |
| Tests | 60 suites / 598 passing |

The low AUTO-SAFE yield is expected for a first city: sparse OSM coverage near
DENUE points, block-level DENUE coordinate precision, and the conservative
canonical threshold. This is a measured, flagged outcome — not a defect.

---

## 10. Lessons Learned

- Reusing the canonical `0.75` threshold makes name+proximity-only pairs (the
  common DENUE case, lacking phone/website) resolve to AMBIGUOUS rather than
  AUTO-SAFE — correct, but low-yield on a first city.
- DENUE coordinate imprecision is the dominant limiter for otherwise-strong
  (exact-name) matches beyond the 75 m strong-proximity band.
- Category mapping is the highest-leverage, lowest-risk lever: it is a gate, not
  a confidence change.
- Sparse OSM coverage is the single largest NO-MATCH cause.
- The separate-sidecar design delivered clean license separation and removability
  with zero canonical-contract churn.
- Deterministic, byte-identical artifacts made auditing straightforward and
  trustworthy, and the snapshot/POI/matching/sidecar/diagnostics layers
  generalize to future cities with data swaps only.

---

## 11. Future Evolution

**Safe extensions (no engine change):**
- Expand and validate the OSM→Locavo category map (targets the ~27% nearby-but-
  incompatible NO-MATCH bucket).
- Investigate coverage gaps in specific categories (e.g. coffee, nightlife).
- Document a snapshot-refresh runbook.

**Research (requires a study before adoption):**
- Promote exact-name + very-strong-proximity pairs — needs a false-positive study
  on chain names first.
- Evaluate a larger candidate radius for contention side effects.
- DENUE coordinate refinement (deliberately excluded from V4F-0).

**Future milestones:**
- Runtime enablement with proper sidecar asset staging.
- A manual AMBIGUOUS-review workflow with persisted decisions.
- Rollout to additional cities; owner-claiming / verification tiers.

---

## 12. Non-Goals

Explicitly excluded from V4F-0: national/nationwide OSM import; live OSM/Overpass
requests; OSM-only canonical places; owner claiming; community moderation;
reviews; AI-generated facts; canonical wifi/cuisine fields; coordinate
replacement; UI changes; search-ranking changes; a manual-review UI; and any
V4F-1 work. Runtime staging of the sidecar into bundled assets is deferred until
a future milestone (the feature flag remains off in the interim).
