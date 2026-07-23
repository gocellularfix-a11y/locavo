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
import { matchNameLexicon } from '../nameLexicon';
import { daily, makePlace, weekly } from './fixtures';

const bestOf = (o: Parameters<typeof makePlace>[0]) => buildPlaceIntelligence(makePlace(o)).bestTimes;
const bestCodes = (o: Parameters<typeof makePlace>[0]) => bestOf(o).map((b) => b.code);
const conf = (o: Parameters<typeof makePlace>[0], code: string) => bestOf(o).find((b) => b.code === code)?.confidence;

const ALL_ORDERS = [
  ['PERSONALITY_ORDER', PERSONALITY_ORDER], ['VISIT_EXPERIENCE_ORDER', VISIT_EXPERIENCE_ORDER],
  ['AUDIENCE_ORDER', AUDIENCE_ORDER], ['BEST_TIME_ORDER', BEST_TIME_ORDER], ['NOISE_ORDER', NOISE_ORDER],
  ['VISIT_DURATION_ORDER', VISIT_DURATION_ORDER], ['ACCESSIBILITY_ORDER', ACCESSIBILITY_ORDER],
  ['EXPERIENCE_TAG_ORDER', EXPERIENCE_TAG_ORDER], ['SPECIALTY_ORDER', SPECIALTY_ORDER],
] as const;

describe('V5.8.1 — inmutabilidad de catálogos en runtime', () => {
  it('todos los arreglos de orden exportados están congelados', () => {
    for (const [, arr] of ALL_ORDERS) {
      expect(Object.isFrozen(arr)).toBe(true);
    }
  });

  it('push / splice / asignación de índice no mutan el arreglo', () => {
    for (const [, arr] of ALL_ORDERS) {
      const before = [...arr];
      expect(() => (arr as unknown as string[]).push('HACK')).toThrow();
      expect(() => (arr as unknown as string[]).splice(0, 1)).toThrow();
      // La asignación de índice lanza en modo estricto y es no-op en modo laxo;
      // en ambos casos el arreglo congelado permanece intacto (garantía clave).
      try {
        (arr as unknown as string[])[0] = 'HACK';
      } catch {
        /* congelado: TypeError en modo estricto */
      }
      expect([...arr]).toEqual(before);
    }
  });

  it('un intento de mutación externa no altera el orden de salida del motor', () => {
    const p = makePlace({ category: 'coffee', name: 'Café', hours: daily('06:00', '23:00') });
    const before = JSON.stringify(buildPlaceIntelligence(p).bestTimes.map((b) => b.code));
    try { (BEST_TIME_ORDER as unknown as string[]).push('HACK'); } catch { /* congelado */ }
    const after = JSON.stringify(buildPlaceIntelligence(p).bestTimes.map((b) => b.code));
    expect(after).toBe(before);
  });
});

describe('V5.8.1 — confianza de BestVisitTime calibrada', () => {
  it('categoría + horas compatibles ⇒ MEDIUM', () => {
    expect(conf({ category: 'coffee', name: 'Café', hours: daily('07:00', '12:00') }, 'BREAKFAST')).toBe('MEDIUM');
    expect(conf({ category: 'food', name: 'X', hours: daily('13:00', '16:00') }, 'LUNCH')).toBe('MEDIUM');
    expect(conf({ category: 'nightlife', name: 'X', hours: daily('20:00', '02:00') }, 'LATE_NIGHT')).toBe('MEDIUM');
  });

  it('categoría sin horas ⇒ LOW', () => {
    expect(conf({ category: 'coffee', name: 'Café' }, 'BREAKFAST')).toBe('LOW');
  });

  it('ninguna combinación categoría/horas produce HIGH para mejor momento', () => {
    for (const c of ['coffee', 'food', 'nightlife'] as const) {
      const r = buildPlaceIntelligence(makePlace({ category: c, name: 'X', hours: daily('06:00', '23:59') }));
      expect(r.bestTimes.every((b) => b.confidence !== 'HIGH')).toBe(true);
    }
  });

  it('intervalos duplicados no elevan la confianza', () => {
    const dup = weekly(...Array.from({ length: 7 }, () => [{ open: '07:00', close: '12:00' }, { open: '07:00', close: '12:00' }]));
    expect(conf({ category: 'coffee', name: 'Café', hours: dup }, 'BREAKFAST')).toBe('MEDIUM');
  });

  it('ventana cerrada sigue excluida; overnight sigue correcto', () => {
    expect(bestCodes({ category: 'coffee', name: 'Café', hours: daily('18:00', '23:00') })).not.toContain('BREAKFAST');
    expect(bestCodes({ category: 'nightlife', name: 'X', hours: daily('20:00', '02:00') })).toContain('LATE_NIGHT');
  });
});

describe('V5.8.1 — beer sin ventana por defecto', () => {
  it('sin horas no emite EVENING', () => {
    expect(bestCodes({ category: 'beer', name: 'Depósito' })).not.toContain('EVENING');
  });
  it('solo mañana no emite EVENING', () => {
    expect(bestCodes({ category: 'beer', name: 'Depósito', hours: daily('08:00', '11:00') })).not.toContain('EVENING');
  });
  it('con horario de tarde-noche tampoco fabrica EVENING (política conservadora), pero sí WEEKDAY/WEEKEND', () => {
    const codes = bestCodes({ category: 'beer', name: 'Depósito', hours: daily('18:00', '23:00') });
    expect(codes).not.toContain('EVENING');
    expect(codes).toEqual(expect.arrayContaining(['WEEKDAY', 'WEEKEND']));
  });
  it('las experiencias legítimas de beer se conservan', () => {
    const r = buildPlaceIntelligence(makePlace({ category: 'beer', name: 'Depósito' }));
    expect(r.visitExperiences.map((e) => e.code)).toEqual(expect.arrayContaining(['QUICK_STOP', 'ERRAND']));
  });
});

describe('V5.8.1 — calidad de evidencia endurecida', () => {
  const q = (o: Parameters<typeof makePlace>[0]) => buildPlaceIntelligence(makePlace(o)).evidenceQuality;
  it('horas vacías / null / cerradas / malformadas NO cuentan', () => {
    expect(q({ category: 'food', name: 'L', hours: { weekly: [] } })).toBe('INSUFFICIENT');
    expect(q({ category: 'food', name: 'L', hours: { weekly: [null, null, null, null, null, null, null] } })).toBe('INSUFFICIENT');
    expect(q({ category: 'food', name: 'L', hours: { weekly: [[], [], [], [], [], [], []] } })).toBe('INSUFFICIENT');
    expect(q({ category: 'food', name: 'L', hours: daily('99:99', 'zz') })).toBe('INSUFFICIENT');
  });
  it('al menos un intervalo válido cuenta (LOW)', () => {
    expect(q({ category: 'food', name: 'L', hours: daily('09:00', '18:00') })).toBe('LOW');
  });
  it('features vacías / all-false NO cuentan; una true cuenta', () => {
    expect(q({ category: 'food', name: 'L', features: {} })).toBe('INSUFFICIENT');
    expect(q({ category: 'food', name: 'L', features: { parking: false, delivery: false } })).toBe('INSUFFICIENT');
    expect(q({ category: 'food', name: 'L', features: { parking: true } })).toBe('LOW');
  });
  it('el contacto por sí solo NO eleva la calidad', () => {
    expect(q({ category: 'food', name: 'L', contact: { phone: '6670000000', website: 'https://x.com' } })).toBe('INSUFFICIENT');
  });
  it('el nombre sin coincidencia de léxico NO eleva la calidad; una coincidencia aporta cobertura limitada', () => {
    expect(q({ category: 'food', name: 'Cocina Económica' })).toBe('INSUFFICIENT');
    expect(q({ category: 'food', name: 'Tacos' })).toBe('LOW');
  });
  it('fronteras de cada umbral', () => {
    expect(q({ category: 'food', name: 'Local' })).toBe('INSUFFICIENT'); // 0
    expect(q({ category: 'food', name: 'Tacos' })).toBe('LOW'); // 0.5
    expect(q({ category: 'food', name: 'Tacos', hours: daily('09:00', '18:00') })).toBe('MEDIUM'); // 1.5
    expect(q({ category: 'food', name: 'Tacos', hours: daily('09:00', '18:00'), features: { familyFriendly: true } })).toBe('HIGH'); // 2.5
  });
});

describe('V5.8.1 — política de categorías secundarias (solo primaria)', () => {
  it('las categorías secundarias se ignoran: sin CATEGORY_SECONDARY y sin claims extra', () => {
    const withSecondary = buildPlaceIntelligence(makePlace({ category: 'food', name: 'Restaurante', secondaryCategories: ['coffee', 'coffee'] }));
    const without = buildPlaceIntelligence(makePlace({ category: 'food', name: 'Restaurante' }));
    expect(withSecondary).toEqual(without);
    const evidenceCodes = withSecondary.specialties.flatMap((s) => s.evidence.map((e) => e.code));
    expect(evidenceCodes).not.toContain('CATEGORY_SECONDARY');
    expect(withSecondary.specialties.map((s) => s.code)).not.toContain('COFFEE');
  });
});

describe('V5.8.1 — mejora acotada del léxico (sin falsos positivos)', () => {
  const lx = (n: string) => matchNameLexicon(n).map((m) => m.specialty);
  it('la puntuación y los guiones son límites de token', () => {
    expect(lx('Tacos, Tortas y Más')).toContain('TACOS');
    expect(lx('Farmacia-Guadalajara')).toContain('PHARMACY');
  });
  it('alias singular explícito (taco)', () => {
    expect(lx('Taco Loco')).toContain('TACOS');
  });
  it('los negativos por substring NO coinciden', () => {
    for (const neg of ['Barra', 'Europa', 'Posada', 'Hotelito', 'Marino', 'Cafeteriax', 'Taconazo']) {
      expect(matchNameLexicon(neg)).toEqual([]);
    }
  });
});
