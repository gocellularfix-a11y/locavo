#!/usr/bin/env python3
"""Deterministic bbox extract of a Geofabrik Mexico PBF for the Locavo V4F-0
Culiacán OSM enrichment pilot.

This is a ONE-TIME acquisition tool. It is not part of the application runtime
and is not required to build or run the app. The frozen output snapshot and its
metadata (data/osm/culiacan/) are the permanent, committed artifacts.

Why pyosmium: it wraps libosmium — the same library osmium-tool is built on.
`osmium.BackReferenceWriter` makes every written object reference-complete
(complete ways + referenced relation members), equivalent to osmium-tool's
`complete_ways` strategy. No global node-location cache is needed: we select
in-bbox nodes by their own coordinates, ways that reference a kept node, and
relations that reference a kept node/way; the library then back-fills every
referenced object. Memory stays bounded to the Culiacán-scoped id sets.

Requirements (isolated; do NOT install into a shared global environment):
    python -m venv .venv && .venv/Scripts/pip install osmium==4.3.1

Exact command used to produce the committed snapshot (bounds = canonical City
Pack GeoBounds from public/citypack/manifest.json; margin = 250 m):
    python scripts/osm/extract-culiacan-snapshot.py \
        <mexico-source.osm.pbf> \
        data/osm/culiacan/culiacan-osm-pilot.osm.pbf \
        24.41961065 24.91446309 -107.5854242 -107.2191345 250

Regenerating from a newer Mexico extract MUST produce a new snapshot fingerprint
and an explicit metadata update; never overwrite an existing fingerprint's
meaning silently.
"""
import json
import math
import sys

import osmium


def main() -> int:
    if len(sys.argv) != 8:
        print(__doc__)
        return 2

    infile, outfile = sys.argv[1], sys.argv[2]
    min_lat, max_lat = float(sys.argv[3]), float(sys.argv[4])
    min_lng, max_lng = float(sys.argv[5]), float(sys.argv[6])
    margin_m = float(sys.argv[7])

    # Expand the canonical City Pack bounds by `margin_m` (per axis) so OSM
    # candidates within the 150 m matching radius of boundary DENUE places are
    # retained. Longitude margin uses the mid-latitude cosine correction.
    mid_lat = (min_lat + max_lat) / 2.0
    lat_margin = margin_m / 111320.0
    lng_margin = margin_m / (111320.0 * math.cos(math.radians(mid_lat)))

    south = min_lat - lat_margin
    north = max_lat + lat_margin
    west = min_lng - lng_margin
    east = max_lng + lng_margin

    def in_bbox(lat: float, lon: float) -> bool:
        return south <= lat <= north and west <= lon <= east

    kept_nodes: set[int] = set()
    kept_ways: set[int] = set()
    n_nodes = n_ways = n_rels = 0

    writer = osmium.BackReferenceWriter(outfile, ref_src=infile, overwrite=True)
    for obj in osmium.FileProcessor(infile):
        if obj.is_node():
            loc = obj.location
            if loc.valid() and in_bbox(loc.lat, loc.lon):
                writer.add_node(obj)
                kept_nodes.add(obj.id)
                n_nodes += 1
        elif obj.is_way():
            if any(nd.ref in kept_nodes for nd in obj.nodes):
                writer.add_way(obj)
                kept_ways.add(obj.id)
                n_ways += 1
        elif obj.is_relation():
            keep = False
            for m in obj.members:
                mtype = getattr(m, "type", None)
                mref = getattr(m, "ref", None)
                if (mtype == "n" and mref in kept_nodes) or (mtype == "w" and mref in kept_ways):
                    keep = True
                    break
            if keep:
                writer.add_relation(obj)
                n_rels += 1

    writer.close()

    print(json.dumps({
        "expandedBounds": {"south": south, "west": west, "north": north, "east": east},
        "marginMeters": margin_m,
        "latMarginDeg": lat_margin,
        "lngMarginDeg": lng_margin,
        "primaryCounts": {"nodes": n_nodes, "ways": n_ways, "relations": n_rels},
    }, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
