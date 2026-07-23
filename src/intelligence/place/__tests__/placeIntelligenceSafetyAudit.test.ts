import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';

import { buildPlaceIntelligence } from '../placeIntelligenceEngine';
import {
  ACCESSIBILITY_ORDER,
  AUDIENCE_ORDER,
  BEST_TIME_ORDER,
  EXPERIENCE_TAG_ORDER,
  NOISE_ORDER,
  PERSONALITY_ORDER,
  SPECIALTY_ORDER,
  VISIT_DURATION_ORDER,
  VISIT_EXPERIENCE_ORDER,
} from '../placeIntelligenceCatalogs';
import type { PlaceIntelligenceReport } from '../placeIntelligenceTypes';
import { daily, makePlace } from './fixtures';

describe('V5.8 — seguridad y arquitectura del dominio', () => {
  it('ningún archivo del motor importa React/RN/Linking/red/almacenamiento/analítica/tiempo/aleatoriedad', () => {
    const dir = join(__dirname, '..');
    const files = readdirSync(dir).filter((f) => f.endsWith('.ts'));
    expect(files.length).toBeGreaterThan(5);
    for (const file of files) {
      const src = readFileSync(join(dir, file), 'utf8');
      expect(src).not.toMatch(/from ['"]react['"]/);
      expect(src).not.toMatch(/from ['"]react-native['"]/);
      expect(src).not.toMatch(/Linking/);
      expect(src).not.toMatch(/\bfetch\(/);
      expect(src).not.toMatch(/XMLHttpRequest/);
      expect(src).not.toMatch(/AsyncStorage|localStorage/);
      expect(src).not.toMatch(/analytics/i);
      expect(src).not.toMatch(/Math\.random/);
      expect(src).not.toMatch(/Date\.now|new Date\(/);
      expect(src).not.toMatch(/setTimeout|setInterval/);
    }
  });

  it('sin hardcodeo específico de negocio (no `place.id ===` ni ids literales en reglas)', () => {
    const dir = join(__dirname, '..');
    for (const file of readdirSync(dir).filter((f) => f.endsWith('.ts'))) {
      const src = readFileSync(join(dir, file), 'utf8');
      expect(src).not.toMatch(/place\.id\s*===/);
      expect(src).not.toMatch(/\.id\s*===\s*['"]/);
    }
  });
});

describe('V5.8 — auditoría de muestra estilo Culiacán', () => {
  const sampleInputs = () => [
    makePlace({ id: 'c1', category: 'coffee', name: 'Café Marino', hours: daily('07:00', '21:00') }),
    makePlace({ id: 'f1', category: 'food', name: 'Taquería Los Compas' }),
    makePlace({ id: 'f2', category: 'food', name: 'Mariscos El Muelle', price: { level: 2 }, hours: daily('11:00', '19:00') }),
    makePlace({ id: 'p1', category: 'pharmacy', name: 'Farmacia Similares', contact: { phone: '6679990000' } }),
    makePlace({ id: 'l1', category: 'lodging', name: 'Hotel San Luis' }),
    makePlace({ id: 's1', category: 'store', name: 'Reparación de Celulares MovilFix' }),
    makePlace({ id: 's2', category: 'store', name: 'Abarrotes La Esquina' }),
    makePlace({ id: 'g1', category: 'gas', name: 'Gasolinera del Valle' }),
    makePlace({ id: 'n1', category: 'nightlife', name: 'Antro Skyline', hours: daily('21:00', '03:00') }),
    makePlace({ id: 'b1', category: 'beer', name: 'Depósito La Fría' }),
    makePlace({ id: 'r1', category: 'food', name: 'Restaurante Familiar', features: { familyFriendly: true, wheelchairAccessible: true }, price: { level: 3 } }),
    makePlace({ id: 'x1', category: 'store', name: 'Local Sin Datos' }),
  ];
  const SAMPLE: PlaceIntelligenceReport[] = sampleInputs().map(buildPlaceIntelligence);

  const CATALOG = {
    personalities: new Set<string>(PERSONALITY_ORDER),
    visitExperiences: new Set<string>(VISIT_EXPERIENCE_ORDER),
    audiences: new Set<string>(AUDIENCE_ORDER),
    bestTimes: new Set<string>(BEST_TIME_ORDER),
    accessibility: new Set<string>(ACCESSIBILITY_ORDER),
    experienceTags: new Set<string>(EXPERIENCE_TAG_ORDER),
    specialties: new Set<string>(SPECIALTY_ORDER),
    noise: new Set<string>(NOISE_ORDER),
    duration: new Set<string>(VISIT_DURATION_ORDER),
  };

  it('todo código pertenece a un catálogo canónico', () => {
    for (const r of SAMPLE) {
      for (const p of r.personalities) expect(CATALOG.personalities.has(p.code)).toBe(true);
      for (const e of r.visitExperiences) expect(CATALOG.visitExperiences.has(e.code)).toBe(true);
      for (const a of r.audiences) expect(CATALOG.audiences.has(a.code)).toBe(true);
      for (const b of r.bestTimes) expect(CATALOG.bestTimes.has(b.code)).toBe(true);
      for (const a of r.accessibility) expect(CATALOG.accessibility.has(a.code)).toBe(true);
      for (const t of r.experienceTags) expect(CATALOG.experienceTags.has(t.code)).toBe(true);
      for (const s of r.specialties) expect(CATALOG.specialties.has(s.code)).toBe(true);
      if (r.noiseLevel) expect(CATALOG.noise.has(r.noiseLevel.code)).toBe(true);
      if (r.visitDuration) expect(CATALOG.duration.has(r.visitDuration.code)).toBe(true);
    }
  });

  it('sin atributos duplicados, sin evidencia duplicada, y toda evidencia presente; identidad preservada', () => {
    const groups = (r: PlaceIntelligenceReport) => [
      r.personalities, r.visitExperiences, r.audiences, r.bestTimes, r.accessibility, r.experienceTags, r.specialties,
    ];
    for (const r of SAMPLE) {
      expect(typeof r.placeId).toBe('string');
      for (const group of groups(r)) {
        const groupCodes = group.map((a) => a.code);
        expect(new Set(groupCodes).size).toBe(groupCodes.length); // sin duplicados
        for (const attr of group) {
          expect(attr.evidence.length).toBeGreaterThan(0); // toda evidencia presente
          const keys = attr.evidence.map((e) => `${e.source}|${e.code}|${String(e.value)}`);
          expect(new Set(keys).size).toBe(keys.length); // evidencia deduplicada
        }
      }
    }
  });

  it('la salida es serializable y estable (sin estado mutable compartido)', () => {
    const first = JSON.stringify(SAMPLE);
    expect(() => JSON.parse(first)).not.toThrow();
    // Reconstruir todo desde cero da EXACTAMENTE el mismo resultado.
    const rebuilt = JSON.stringify(sampleInputs().map(buildPlaceIntelligence));
    expect(rebuilt).toBe(first);
  });
});
