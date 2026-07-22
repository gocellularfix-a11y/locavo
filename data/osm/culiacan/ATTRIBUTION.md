# OpenStreetMap snapshot — attribution & license

© OpenStreetMap contributors

OpenStreetMap data is available under the Open Database License (ODbL) 1.0
(<https://opendatacommons.org/licenses/odbl/1-0/>).

This snapshot (`culiacan-osm-pilot.osm.pbf`) was supplied through a Geofabrik
regional extract of Mexico and clipped to the Culiacán City Pack bounds. See
`snapshot-metadata.json` for the exact source, fingerprints, bounds, and
extraction command.

## Engineering separation

- This directory holds the **OSM-derived** input only. It is physically and
  logically separate from the DENUE/INEGI-derived City Pack
  (`public/citypack/`, `android/app/src/main/assets/citypack/`), which carries
  its own INEGI terms.
- Runtime OSM enrichment is gated behind the `enableOpenStreetMapProvider`
  feature flag, which is **OFF by default**. With the flag off, this snapshot is
  not loaded and application behavior is unchanged.

## Scope note

This notice records attribution and license identification only. It is **not** a
legal conclusion, and field-level provenance alone does not by itself resolve all
downstream ODbL obligations. Owner legal review is still required before any
broader distribution of derived data.
