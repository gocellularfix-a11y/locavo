import { interpretQuery } from '../../../domain/queryInterpreter';
import type { CategoryId, Coordinates } from '../../../domain/place';
import type { LocavoPlace, PlaceHours } from '../../../domain/places/LocavoPlace';
import { normalizeText } from '../../../utils/text';
import { rankSearchResults } from '../SearchRankingService';

/**
 * V4D — Ranking de búsqueda: relevancia de nombre por encima de distancia,
 * determinista, explicable y sin datos inventados.
 */

const ORIGIN: Coordinates = { latitude: 24.8091, longitude: -107.394 };
const NOW = new Date('2026-07-20T18:00:00.000Z');

function place(opts: {
  id: string;
  name: string;
  category: CategoryId;
  km?: number; // desplazamiento aproximado al norte desde el origen
  terms?: string[];
  hours?: PlaceHours;
  complete?: boolean;
}): LocavoPlace {
  const latOffset = (opts.km ?? 1) / 111.32;
  const base: LocavoPlace = {
    id: opts.id,
    sourceRefs: { denueId: opts.id },
    name: opts.name,
    normalizedName: normalizeText(opts.name),
    category: opts.category,
    coordinates: { latitude: ORIGIN.latitude + latOffset, longitude: ORIGIN.longitude },
    verification: { status: 'source_verified', confidence: 0.6 },
    provenance: [{ source: 'denue' }],
    status: { active: true },
    createdAt: '2026-07-01T00:00:00.000Z',
    updatedAt: '2026-07-01T00:00:00.000Z',
  };
  if (opts.terms) base.searchTerms = opts.terms;
  if (opts.hours) base.hours = opts.hours;
  if (opts.complete) {
    base.contact = { phone: '6670000000', website: 'https://example.mx' };
    base.price = { level: 2 };
  }
  return base;
}

function rank(places: LocavoPlace[], query: string) {
  return rankSearchResults(places, interpretQuery(query), ORIGIN, NOW);
}

describe('ranking de búsqueda (V4D)', () => {
  it('coincidencia exacta de nombre supera a coincidencia solo de categoría', () => {
    const exact = place({ id: 'a', name: 'FARMACIA GUADALAJARA', category: 'pharmacy', km: 6 });
    const nameOnly = place({ id: 'b', name: 'FARMACIA DEL CENTRO', category: 'pharmacy', km: 1 });
    const categoryOnly = place({ id: 'c', name: 'BOTICA POPULAR', category: 'pharmacy', km: 0.2 });
    const ranked = rank([categoryOnly, nameOnly, exact], 'farmacia guadalajara');
    expect(ranked[0].place.id).toBe('a');
    expect(ranked[0].reasons).toContain('EXACT_NAME_MATCH');
    // La categoría-solo queda por debajo pese a estar mucho más cerca.
    expect(ranked[ranked.length - 1].place.id).toBe('c');
  });

  it('un resultado relevante lejano supera a uno irrelevante cercano', () => {
    const relevantFar = place({ id: 'far', name: 'MARISCOS LAS PALMAS', category: 'food', km: 7 });
    const irrelevantNear = place({ id: 'near', name: 'COCINA ECONOMICA', category: 'food', km: 0.1 });
    const ranked = rank([irrelevantNear, relevantFar], 'mariscos');
    expect(ranked[0].place.id).toBe('far'); // el nombre pesa más que la distancia
  });

  it('la completitud/《datos》 no supera a la relevancia de nombre (sin ratings)', () => {
    const nameMatch = place({ id: 'name', name: 'CAFE OBREGON', category: 'coffee', km: 5 });
    const richCategory = place({
      id: 'rich',
      name: 'RESTAURANTE LUJO',
      category: 'coffee',
      km: 0.1,
      complete: true, // teléfono, web, precio (máxima completitud)
    });
    const ranked = rank([richCategory, nameMatch], 'cafe obregon');
    expect(ranked[0].place.id).toBe('name');
  });

  it('orden determinista: misma entrada → mismo orden', () => {
    const places = [
      place({ id: 'p1', name: 'TAQUERIA UNO', category: 'food', km: 2 }),
      place({ id: 'p2', name: 'TAQUERIA DOS', category: 'food', km: 1 }),
      place({ id: 'p3', name: 'MARISCOS TRES', category: 'food', km: 3 }),
    ];
    const a = rank(places, 'taqueria').map((r) => r.place.id);
    const b = rank([...places].reverse(), 'taqueria').map((r) => r.place.id);
    expect(a).toEqual(b);
  });

  it('desempate estable: igual relevancia → nombre y luego id', () => {
    // Dos lugares solo-categoría a la MISMA distancia: desempata por nombre/id.
    const p1 = place({ id: 'z', name: 'BBB', category: 'food', km: 1 });
    const p2 = place({ id: 'a', name: 'AAA', category: 'food', km: 1 });
    const ranked = rank([p1, p2], 'comida');
    expect(ranked.map((r) => r.place.id)).toEqual(['a', 'z']); // AAA < BBB
  });

  it('nunca inventa "abierto ahora" sin horario real', () => {
    const noHours = place({ id: 'nh', name: 'FARMACIA SIN HORARIO', category: 'pharmacy' });
    const ranked = rank([noHours], 'farmacia');
    expect(ranked[0].status.state).not.toBe('open');
    expect(ranked[0].reasons).not.toContain('OPEN_NOW');
  });

  it('con horario real y abierto SÍ marca abierto (verdad, no invención)', () => {
    // Horario amplio (24 h todos los días) que cubre la hora de prueba.
    const allDay = [{ open: '00:00', close: '23:59' }];
    const openHours: PlaceHours = {
      weekly: [allDay, allDay, allDay, allDay, allDay, allDay, allDay],
    };
    const withHours = place({ id: 'wh', name: 'TIENDA 24', category: 'store', hours: openHours });
    const ranked = rank([withHours], 'tienda');
    expect(ranked[0].status.state).toBe('open');
    expect(ranked[0].reasons).toContain('OPEN_NOW');
  });
});

/**
 * V4E.1 — Explicación de búsqueda: aditiva, veraz y derivada de los MISMOS
 * hechos de matching que el score. Protege los invariantes aprobados; no
 * duplica escenarios de orden/relevancia ya cubiertos arriba.
 */
describe('explicación de búsqueda (V4E.1)', () => {
  it('INVARIANTE: sum(scoreBreakdown.points) === score para cada resultado', () => {
    const places = [
      place({ id: 'exact', name: 'FARMACIA', category: 'pharmacy', km: 3 }),
      place({ id: 'prefix', name: 'FARMACIA GUADALAJARA', category: 'pharmacy', km: 1 }),
      place({ id: 'cat', name: 'BOTICA POPULAR', category: 'pharmacy', km: 0.5, complete: true }),
    ];
    const ranked = rank(places, 'farmacia');
    expect(ranked).toHaveLength(3);
    for (const r of ranked) {
      const sum = r.explanation!.scoreBreakdown.reduce((s, c) => s + c.points, 0);
      expect(sum).toBeCloseTo(r.score, 9);
    }
  });

  it('matchConfidence refleja la solidez de la coincidencia (HIGH/MEDIUM/LOW)', () => {
    // Exacta → HIGH
    const exact = rank([place({ id: 'e', name: 'TACOS', category: 'food' })], 'tacos')[0];
    expect(exact.explanation!.matchConfidence).toBe('HIGH');
    // Solo categoría (sin coincidencia de nombre) → MEDIUM
    const catOnly = rank([place({ id: 'c', name: 'RESTAURANTE LUJO', category: 'food' })], 'comida')[0];
    expect(catOnly.explanation!.matchConfidence).toBe('MEDIUM');
    // Término parcial, categoría distinta → LOW
    const partial = rank(
      [place({ id: 'p', name: 'FARMACIA CENTRO', category: 'pharmacy', terms: ['pizza'] })],
      'pizza cerveza',
    )[0];
    expect(partial.explanation!.matchConfidence).toBe('LOW');
  });

  it('matchConfidence NO depende de verification.confidence (Match ≠ Verification)', () => {
    const low = place({ id: 'low', name: 'FARMACIA', category: 'pharmacy' });
    const high = place({ id: 'high', name: 'FARMACIA', category: 'pharmacy' });
    low.verification = { status: 'unverified', confidence: 0.1 };
    high.verification = { status: 'locavo_verified', confidence: 0.99 };
    const ranked = rank([low, high], 'farmacia');
    const confById = Object.fromEntries(
      ranked.map((r) => [r.place.id, r.explanation!.matchConfidence]),
    );
    expect(confById.low).toBe(confById.high); // misma coincidencia → misma confianza de match
    expect(confById.low).toBe('HIGH');
  });

  it('matchedTerms reporta dónde coincidió cada término', () => {
    const [r] = rank([place({ id: 'm', name: 'MARISCOS LAS PALMAS', category: 'food' })], 'mariscos');
    const term = r.explanation!.matchedTerms.find((t) => t.term === 'mariscos')!;
    expect(term.inName).toBe(true);
    expect(term.inIndex).toBe(true);
  });

  it('matchedSignals solo contiene señales con datos reales (sin popularity/price/attributes)', () => {
    const allowed = new Set([
      'NAME_EXACT', 'NAME_PREFIX', 'NAME_TOKEN', 'CATEGORY', 'CATEGORY_BONUS',
      'TERM', 'TERM_COVERAGE', 'MULTI_TERM', 'COMPLETENESS', 'DISTANCE', 'NEARBY', 'OPEN_NOW',
    ]);
    const ranked = rank(
      [place({ id: 'a', name: 'FARMACIA GUADALAJARA', category: 'pharmacy', km: 1 })],
      'farmacia',
    );
    for (const signal of ranked[0].explanation!.matchedSignals) {
      expect(allowed.has(signal)).toBe(true);
    }
  });
});
