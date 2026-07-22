#!/usr/bin/env python3
"""Derive a deterministic, TS-consumable POI list from the frozen Culiacán OSM
snapshot (V4F-0).

One-time/regenerate tool (needs pyosmium, like extract-culiacan-snapshot.py). It
reads the committed snapshot PBF and emits data/osm/culiacan/osm-pois.json: a
sorted array of candidate POIs (nodes + ways carrying a category-bearing tag),
each with a type-prefixed stable osmId, a representative coordinate, and a small
whitelist of tags relevant to the pilot. Ways get their centroid from cached
node locations (the snapshot is small, so the location cache is cheap).

The JSON is the committed intermediate the pure-TypeScript enrichment pipeline
consumes, so the build/tests never need Python or a PBF parser. Deterministic:
same snapshot -> same bytes.

Usage:
    python scripts/osm/extract-pois.py \
        data/osm/culiacan/culiacan-osm-pilot.osm.pbf \
        data/osm/culiacan/osm-pois.json
"""
import json
import sys

import osmium

# Category-bearing tags: an object is a POI candidate if it carries any of these.
CATEGORY_KEYS = ("amenity", "shop", "tourism")
# Tags emitted for the pilot (signals + identity + matching).
TAG_WHITELIST = (
    "name",
    "amenity",
    "shop",
    "tourism",
    "cuisine",
    "opening_hours",
    "wheelchair",
    "internet_access",
    "outdoor_seating",
    "parking",
    "delivery",
    "phone",
    "contact:phone",
    "website",
    "contact:website",
)


def picked_tags(tags) -> dict:
    out = {}
    for k in TAG_WHITELIST:
        if k in tags:
            out[k] = tags[k]
    return out


def is_poi(tags) -> bool:
    return any(k in tags for k in CATEGORY_KEYS)


def main() -> int:
    infile, outfile = sys.argv[1], sys.argv[2]
    pois = []
    n_node = n_way = 0

    for obj in osmium.FileProcessor(infile).with_locations():
        if obj.is_node():
            if is_poi(obj.tags):
                loc = obj.location
                if loc.valid():
                    pois.append({
                        "osmId": f"n{obj.id}",
                        "lat": round(loc.lat, 7),
                        "lon": round(loc.lon, 7),
                        "tags": picked_tags(obj.tags),
                    })
                    n_node += 1
        elif obj.is_way():
            if is_poi(obj.tags):
                lats, lons = [], []
                for nd in obj.nodes:
                    if nd.location.valid():
                        lats.append(nd.location.lat)
                        lons.append(nd.location.lon)
                if lats:
                    pois.append({
                        "osmId": f"w{obj.id}",
                        "lat": round(sum(lats) / len(lats), 7),
                        "lon": round(sum(lons) / len(lons), 7),
                        "tags": picked_tags(obj.tags),
                    })
                    n_way += 1

    # Deterministic order: type-prefixed osmId ascending (stable tie-break).
    pois.sort(key=lambda p: p["osmId"])

    doc = {
        "format": "locavo-osm-pois",
        "schemaVersion": 1,
        "city": "Culiacán",
        "source": "data/osm/culiacan/culiacan-osm-pilot.osm.pbf",
        "attribution": "© OpenStreetMap contributors",
        "license": "ODbL 1.0",
        "counts": {"nodes": n_node, "ways": n_way, "total": len(pois)},
        "pois": pois,
    }
    with open(outfile, "w", encoding="utf-8", newline="\n") as f:
        json.dump(doc, f, ensure_ascii=False, indent=2, sort_keys=False)
        f.write("\n")
    print(json.dumps(doc["counts"]))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
