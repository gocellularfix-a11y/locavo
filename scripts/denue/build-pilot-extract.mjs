/**
 * DENUE — Extracto piloto determinista de Culiacán, Sinaloa (V4B).
 *
 * Fuente oficial (descarga masiva INEGI, NO se versiona en git):
 *   https://www.inegi.org.mx/contenidos/masiva/denue/denue_25_csv.zip
 *   Dataset: MEX-INEGI.EEC2.05-DENUE-2026 (publicado 2026-05-20,
 *   corregido 2026-07-01). Licencia: Términos de Libre Uso del INEGI.
 *
 * Uso:
 *   1. Descargar y extraer el zip en .cache/denue/extracted/ (gitignored):
 *        conjunto_de_datos/denue_inegi_25_.csv   (latin1)
 *   2. node scripts/denue/build-pilot-extract.mjs
 *
 * Produce data/denue/denue_culiacan_pilot.csv (UTF-8, columnas originales),
 * un extracto pequeño y reproducible que SÍ se versiona.
 *
 * Selección determinista:
 *   - cve_ent = 25 (Sinaloa) y cve_mun = 006 (Culiacán). Nada fuera del
 *     municipio piloto.
 *   - codigo_act debe existir en data/denue/scian-category-map.json.
 *   - id numérico y coordenadas válidas dentro de una caja envolvente laxa
 *     de Culiacán (lat 23.5–26.0, lng −108.5–−106.0).
 *   - Por categoría: orden por id DENUE ascendente y cuota fija.
 *   - Total máximo: 500 establecimientos.
 */
import { createReadStream, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SOURCE_CSV = join(ROOT, '.cache', 'denue', 'extracted', 'conjunto_de_datos', 'denue_inegi_25_.csv');
const MAP_JSON = join(ROOT, 'data', 'denue', 'scian-category-map.json');
const OUT_CSV = join(ROOT, 'data', 'denue', 'denue_culiacan_pilot.csv');

const CVE_ENT = '25';
const CVE_MUN = '006';
const BBOX = { minLat: 23.5, maxLat: 26.0, minLng: -108.5, maxLng: -106.0 };

/** Cuotas por categoría (orden de salida fijo). Total = 500. */
const QUOTAS = [
  ['food', 120],
  ['store', 80],
  ['coffee', 60],
  ['beer', 50],
  ['pharmacy', 50],
  ['nightlife', 50],
  ['lodging', 50],
  ['gas', 40],
];

const { mappings } = JSON.parse(readFileSync(MAP_JSON, 'utf8'));
const categoryOf = (code) => mappings[code]?.category;

function parseCsvLine(line) {
  const out = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQ) {
      if (c === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; } else inQ = false;
      } else cur += c;
    } else if (c === '"') inQ = true;
    else if (c === ',') { out.push(cur); cur = ''; }
    else cur += c;
  }
  out.push(cur);
  return out;
}

function toCsvField(value) {
  return /[",\n\r]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}

const rl = createInterface({
  input: createReadStream(SOURCE_CSV, { encoding: 'latin1' }),
  crlfDelay: Infinity,
});

let header = null;
const idx = {};
const byCategory = new Map(QUOTAS.map(([c]) => [c, []]));
let read = 0;
let culiacan = 0;
let pending = '';

for await (const rawLine of rl) {
  const line = pending ? pending + '\n' + rawLine : rawLine;
  if (((line.match(/"/g) || []).length) % 2 === 1) {
    pending = line;
    continue;
  }
  pending = '';
  if (!header) {
    header = parseCsvLine(line);
    header.forEach((h, i) => (idx[h.trim()] = i));
    continue;
  }
  const f = parseCsvLine(line);
  read++;
  if (f[idx.cve_ent] !== CVE_ENT || f[idx.cve_mun] !== CVE_MUN) continue;
  culiacan++;
  const category = categoryOf(f[idx.codigo_act]);
  if (!category) continue;
  const id = f[idx.id];
  if (!/^\d+$/.test(id)) continue;
  const lat = Number.parseFloat(f[idx.latitud]);
  const lng = Number.parseFloat(f[idx.longitud]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
  if (lat < BBOX.minLat || lat > BBOX.maxLat || lng < BBOX.minLng || lng > BBOX.maxLng) continue;
  byCategory.get(category).push({ id: Number(id), fields: f });
}

mkdirSync(dirname(OUT_CSV), { recursive: true });
const lines = [header.map((h) => h.trim()).join(',')];
const summary = [];
for (const [category, quota] of QUOTAS) {
  const rows = byCategory.get(category).sort((a, b) => a.id - b.id).slice(0, quota);
  summary.push(`${category}: ${rows.length}/${quota}`);
  for (const row of rows) lines.push(row.fields.map(toCsvField).join(','));
}
writeFileSync(OUT_CSV, lines.join('\n') + '\n', 'utf8');

console.log(`leídos (Sinaloa): ${read}`);
console.log(`Culiacán (cve_mun=${CVE_MUN}): ${culiacan}`);
console.log(`extracto: ${lines.length - 1} registros -> ${OUT_CSV}`);
console.log(summary.join('\n'));
