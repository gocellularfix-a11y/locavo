# City Pipeline V1 — Provider-Neutral Ingestion Platform

**Status:** foundation only. No new datasets imported, no City Pack built, no
Santa Barbara. Culiacán behaves exactly as before (verified byte-identical over
the full 500-place pack). The intelligence engines are untouched and remain
provider-agnostic.

## 1. Purpose

Let Locavo ingest place data from *any* provider (DENUE, OpenStreetMap, Overture,
government open data, tourism, …) into the canonical model **without changing any
intelligence engine**. Adding a provider requires only: **register a descriptor +
implement an adapter** — never a pipeline edit.

Module: `src/data/pipeline/`. Nothing provider-specific lives outside an
adapter/descriptor.

## 2. Pipeline stages (single responsibility each)

```
Raw provider records
      ↓  Provider Adapter        (normalize → canonical fragments; pure, no IO)
Canonical Fragment[]
      ↓  Validation              (coordinate/PII checks in the adapter)
      ↓  Normalization           (canonical text/identity/units)
      ↓  Merge Engine            (dedup + field-level conflict + attribution)
Merged canonical place
      ↓  Classification          (existing category taxonomy)
      ↓  Enrichment sidecars     (ODbL / CC-BY, license-separated)
      ↓  City Pack Builder
Offline City Pack
```

Loading (files/API/extracts) is a **separate injected concern**, so adapters stay
pure and deterministic (no network, no disk, testable).

## 3. Provider Registry (`providerRegistry.ts`)

Single source of truth. The pipeline/runtime **consult the registry**; they never
hardcode provider names. A `ProviderDescriptor` is pure data:

- `id` (open `ProviderId` string — adding a provider never edits a union),
- `name`, `version`, `license`, `countries`,
- `capabilities` (coordinates/categories/hours/contact/accessibility/tourism/prices/multilingual),
- `verificationLevel` + `verification {status, confidence}` (authority of the data),
- `sourceRefSlots` (how the provider's refs map into `PlaceSourceRefs`).

Registered today: **DENUE** (`permissive-base`, MX, `source_verified`/0.6,
`externalId→denueId`, `clee→clee`) and **OpenStreetMap** (`odbl-sidecar`, global,
`unverified`/0.3, `externalId→osmId`). `verificationOf` / `sourceRefSlotsOf` fall
back to safe defaults for unknown providers.

## 4. Adapter contract (`providerAdapter.ts`)

Every provider implements exactly one interface:
`normalize(raw, meta): CanonicalFragment[]` — pure, deterministic. The DENUE
adapter (`providers/denue.ts`, `denueCandidateToFragment`) proves the contract:
a `DenueImportCandidate` becomes a canonical fragment carrying provenance
(incl. the raw SCIAN code) and `licenseTier: 'permissive-base'`. It does **not**
reroute the live Culiacán pack build — that path is left byte-identical.

## 5. Canonical Fragment (`canonicalFragment.ts`)

The single intermediate every adapter emits — never a final `LocavoPlace`, never
a provider DTO. Partial canonical fields + `provenance {providerId, externalId,
dataset?, edition?, extra?}` + `licenseTier`. `value`s are safe canonical
primitives; no raw business text leaks beyond documented `extra` signals.

## 6. Merge Engine (`mergeEngine.ts`)

Generic, deterministic `mergeFragments(fragments, {registry}): MergedPlace[]`:

- **Duplicate detection:** short-circuit on a shared `stableId` (Overture GERS,
  OSM `type/id`); otherwise deterministic match — spatial proximity (≤ ~60 m,
  configurable) **and** equal normalized name **and** compatible category.
  Grouping uses a coarse spatial-cell index + union-find (near-linear; no global
  O(n²) scan).
- **Field-level conflict resolution:** each field is won by the highest
  **source-trust** fragment (`official > curated > source_verified >
  unverified`, `sourceTrust.ts`), tie-broken by **edition recency** then stable
  key. Stronger evidence is never overwritten by weaker.
- **Confidence inheritance:** verification is inherited from the highest-trust
  contributor.
- **Source attribution:** all contributing provenances are kept, ordered by
  trust then key.
- **Stable ordering:** output ordered by group key; input order never affects
  results (verified by test).

Not wired into Culiacán's single-provider build (no merge needed for identical
output); it is the foundation for future multi-provider packs.

## 7. License Architecture (`licenseTier.ts`)

Legal separation is formalized: a pack is a **permissive base** plus **optional,
labeled, removable sidecars**.

```
Permissive base (CDLA/PD/gov)  →  ODbL sidecars (OSM)  →  CC-BY sidecars  →  City Pack
```

`isPermissiveBase` / `requiresSidecar` / `isExcluded` classify each provider.
Proprietary APIs that forbid caching/redistribution are `proprietary-excluded`
and never feed an offline pack.

## 8. Provider metadata (`providerMetadata.ts`)

Per-ingestion-run metadata that travels with the pack for traceability and
attribution: `providerId, name, datasetVersion, license, edition, downloadDate?,
coverage?, sourceUrl?, verificationLevel`. Deterministic (source dates, never
`Date.now()`).

## 9. Provider independence (engines untouched)

The intelligence engines (Search, Retrieval, Intent, Context, Ranking,
Recommendation, Decision, Preferences, Safe Actions, Rich Place Intelligence)
import nothing from `src/data/pipeline` and never see a `provider`. Enforced by a
source-scan test. Engines consume only the canonical `LocavoPlace`; provenance is
metadata.

## 10. De-hardcode / migration notes

- `CityPackSourceRef.provider` changed from the `'denue'` literal to the open
  `ProviderId`; the value is now sourced from `PROVIDER_DENUE`. Existing packs
  remain valid; behavior identical.
- Runtime hydration (`CityPackPlaceMapper`) no longer contains a DENUE literal or
  an inline verification map: it derives `sourceRefs` slots and verification from
  the **registry** by provider id. Verified byte-identical on all 500 real places
  (denueId, clee, `source_verified`/0.6, provenance `denue`) and on an unknown
  provider (default `unverified`/0.3, no refs).
- **Deferred (out of scope — frozen engine):** `src/intelligence/explanation.ts`
  keeps a V5.0 provenance allowlist (`sources.includes('denue')` →
  `OFFICIAL_SOURCE`). This is a canonical-provenance read, not ingestion coupling;
  the Engine Readiness Review already logged it as MINOR. Making the
  official-source bonus registry-driven is a separate, isolated V5.0 change and is
  **not** part of City Pipeline V1.
- **Deferred:** `PlaceProvenanceEntry.source` remains the `PlaceSource` enum
  (a current superset of the registered providers `denue`/`openstreetmap`). Adding
  a provider outside that enum (Overture/GeoNames) requires widening
  `PlaceProvenanceEntry.source` to `ProviderId` — a small, isolated domain change,
  not a pipeline change.

## 11. Adding a new provider (Santa Barbara-ready)

1. Register a `ProviderDescriptor` (id, license tier, capabilities, verification,
   ref slots).
2. Implement a `ProviderAdapter` (`normalize(raw, meta): CanonicalFragment[]`).
3. Done — validation, merge, classification, enrichment, and City Pack building
   are provider-agnostic and unchanged.

No intelligence engine, ranking, recommendation, decision, or UI change is
required to add a provider or a city.
