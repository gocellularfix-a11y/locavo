import { buildPlaceIntelligence } from '../placeIntelligenceEngine';
import { normalizeEvidence } from '../confidence';
import { BEST_TIME_ORDER } from '../placeIntelligenceCatalogs';
import type { IntelligenceAttribute, PlaceIntelligenceReport } from '../placeIntelligenceTypes';
import { daily, makePlace } from './fixtures';

const allAttributes = (r: PlaceIntelligenceReport): IntelligenceAttribute<string>[] => [
  ...r.personalities, ...r.visitExperiences, ...r.audiences, ...r.bestTimes,
  ...(r.noiseLevel ? [r.noiseLevel] : []), ...(r.visitDuration ? [r.visitDuration] : []),
  ...r.accessibility, ...r.experienceTags, ...r.specialties,
];

describe('V5.8 — datos vacíos y limitados', () => {
  it('un lugar mínimo produce un reporte válido', () => {
    const r = buildPlaceIntelligence(makePlace({ id: 'x', name: 'Negocio', category: 'store' }));
    expect(r.placeId).toBe('x');
    expect(r.schemaVersion).toBe('5.8.0');
    expect(Array.isArray(r.personalities)).toBe(true);
    expect(Array.isArray(r.specialties)).toBe(true);
  });

  it('metadatos ausentes no fabrican atributos', () => {
    const r = buildPlaceIntelligence(makePlace({ name: 'Cocina Lupita', category: 'food' }));
    expect(r.personalities).toEqual([]);
    expect(r.audiences).toEqual([]);
    expect(r.accessibility).toEqual([]);
    expect(r.noiseLevel).toBeNull();
  });

  it('accesibilidad ausente permanece desconocida (vacía, no false)', () => {
    const r = buildPlaceIntelligence(makePlace({ category: 'coffee' }));
    expect(r.accessibility).toEqual([]);
  });

  it('la calidad de evidencia INSUFFICIENT es posible', () => {
    const r = buildPlaceIntelligence(makePlace({ name: 'Local', category: 'food' }));
    expect(r.evidenceQuality).toBe('INSUFFICIENT');
  });

  it('no truena con campos opcionales ausentes', () => {
    expect(() => buildPlaceIntelligence(makePlace({ category: 'gas' }))).not.toThrow();
  });

  it('horario malformado no truena (se ignora esa señal)', () => {
    const bad = makePlace({ category: 'coffee', hours: { weekly: Array.from({ length: 7 }, () => [{ open: '99:99', close: 'xx' }]) } });
    expect(() => buildPlaceIntelligence(bad)).not.toThrow();
  });
});

describe('V5.8 — determinismo', () => {
  it('la misma entrada produce salida profundamente igual', () => {
    const p = makePlace({ category: 'coffee', name: 'Café Central', hours: daily('07:00', '13:00') });
    expect(buildPlaceIntelligence(p)).toEqual(buildPlaceIntelligence(p));
  });

  it('el orden de claves del objeto de entrada no afecta la salida', () => {
    const a = makePlace({ id: 'z', name: 'Café Central', category: 'coffee', hours: daily('07:00', '13:00') });
    const b = makePlace({ hours: daily('07:00', '13:00'), category: 'coffee', name: 'Café Central', id: 'z' });
    expect(buildPlaceIntelligence(a)).toEqual(buildPlaceIntelligence(b));
  });

  it('la evidencia duplicada se deduplica', () => {
    const dup = normalizeEvidence([
      { source: 'CATEGORY', code: 'CATEGORY_PRIMARY', value: 'coffee' },
      { source: 'CATEGORY', code: 'CATEGORY_PRIMARY', value: 'coffee' },
      { source: 'NAME_LEXICON', code: 'NAME_TOKEN', value: 'cafe' },
    ]);
    expect(dup).toHaveLength(2);
  });

  it('los arreglos tienen orden canónico estable', () => {
    const r = buildPlaceIntelligence(makePlace({ category: 'coffee', name: 'Café', hours: daily('06:00', '23:59') }));
    const idx = r.bestTimes.map((b) => BEST_TIME_ORDER.indexOf(b.code));
    expect(idx).toEqual([...idx].sort((a, b) => a - b));
  });

  it('no muta la entrada', () => {
    const p = makePlace({ category: 'coffee', name: 'Café Central', hours: daily('07:00', '13:00') });
    const snapshot = JSON.stringify(p);
    buildPlaceIntelligence(p);
    expect(JSON.stringify(p)).toBe(snapshot);
  });
});

describe('V5.8 — evidencia', () => {
  it('todo atributo emitido tiene al menos una evidencia estructurada', () => {
    const r = buildPlaceIntelligence(makePlace({ category: 'food', name: 'Mariscos La Perla', price: { level: 3 }, hours: daily('12:00', '22:00'), features: { familyFriendly: true, wheelchairAccessible: true } }));
    for (const attr of allAttributes(r)) {
      expect(attr.evidence.length).toBeGreaterThan(0);
    }
  });

  it('los valores de evidencia son primitivos y sin prosa (sin espacios)', () => {
    const r = buildPlaceIntelligence(makePlace({ category: 'coffee', name: 'Café Central', hours: daily('07:00', '13:00') }));
    for (const attr of allAttributes(r)) {
      for (const e of attr.evidence) {
        expect(['string', 'number', 'boolean', 'undefined']).toContain(typeof e.value);
        if (typeof e.value === 'string') {
          expect(e.value).not.toMatch(/\s/); // códigos/tokens canónicos, jamás frases
        }
      }
    }
  });

  it('el léxico de nombre expone el token canónico, no el nombre crudo', () => {
    const r = buildPlaceIntelligence(makePlace({ category: 'food', name: 'Gran Taquería El Súper Especial Del Centro' }));
    const tacos = r.specialties.find((s) => s.code === 'TACOS');
    const token = tacos?.evidence.find((e) => e.code === 'NAME_TOKEN');
    expect(token?.value).toBe('taqueria');
  });
});
