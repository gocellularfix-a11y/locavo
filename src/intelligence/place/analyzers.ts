/**
 * ANALIZADORES de inteligencia de lugar (V5.8) — puros, deterministas y
 * CONSERVADORES: prefieren el silencio a la invención. Cada uno devuelve
 * candidatos `{code, evidence}` que el ensamblador fusiona, deduplica, ordena y
 * les calcula la confianza. Reglas documentadas junto a cada analizador.
 */
import type { CategoryId } from '../../domain/place';
import type {
  AccessibilityTrait,
  BestVisitTime,
  ExperienceTag,
  NoiseLevel,
  PlaceAudience,
  PlaceIntelligenceEvidence,
  PlaceIntelligenceEvidenceCode,
  PlacePersonality,
  PlaceSpecialty,
  VisitDuration,
  VisitExperience,
} from './placeIntelligenceTypes';
import type { PlaceSignals } from './placeSignals';
import type { TimeBandCode } from './hoursWindows';

type Candidate<TCode extends string> = { readonly code: TCode; readonly evidence: readonly PlaceIntelligenceEvidence[] };

// ── Constructores de evidencia ──
const catEv = (category: CategoryId): PlaceIntelligenceEvidence => ({ source: 'CATEGORY', code: 'CATEGORY_PRIMARY', value: category });
const featEv = (code: PlaceIntelligenceEvidenceCode): PlaceIntelligenceEvidence => ({ source: 'FEATURE', code, value: true });
const priceEv = (level: number): PlaceIntelligenceEvidence => ({ source: 'PRICE', code: 'PRICE_LEVEL', value: level });
const bandEv = (band: TimeBandCode): PlaceIntelligenceEvidence => ({ source: 'HOURS', code: 'HOURS_OPEN_WINDOW', value: band });
const weekdayEv: PlaceIntelligenceEvidence = { source: 'HOURS', code: 'HOURS_OPEN_WEEKDAY', value: true };
const weekendEv: PlaceIntelligenceEvidence = { source: 'HOURS', code: 'HOURS_OPEN_WEEKEND', value: true };
const tokenEv = (token: string): PlaceIntelligenceEvidence => ({ source: 'NAME_LEXICON', code: 'NAME_TOKEN', value: token });

// ── Personalidad ──
// Solo desde evidencia estructurada explícita (amenidad/precio). NUNCA reputación
// (LOCAL_FAVORITE/TOURIST_ORIENTED) ni estereotipos de categoría.
export function analyzePersonalities(s: PlaceSignals): Candidate<PlacePersonality>[] {
  const out: Candidate<PlacePersonality>[] = [];
  if (s.features.familyFriendly === true) {
    out.push({ code: 'FAMILY_FRIENDLY', evidence: [featEv('FEATURE_FAMILY_FRIENDLY')] });
  }
  if (s.priceLevel !== null && s.priceLevel >= 3) {
    out.push({ code: 'PREMIUM', evidence: [priceEv(s.priceLevel)] });
  }
  if (s.priceLevel === 1) {
    out.push({ code: 'BUDGET_FRIENDLY', evidence: [priceEv(1)] });
  }
  return out;
}

// ── Experiencia de visita ── (afinidad de categoría; el ejemplo del spec la
// considera defendible, p. ej. restaurante ⇒ FULL_MEAL).
const CATEGORY_EXPERIENCE: Readonly<Record<CategoryId, readonly VisitExperience[]>> = {
  food: ['FULL_MEAL'],
  coffee: ['RELAXED_VISIT'],
  pharmacy: ['ERRAND', 'QUICK_STOP'],
  gas: ['ERRAND', 'QUICK_STOP'],
  store: ['SHOPPING_TRIP', 'ERRAND'],
  beer: ['ERRAND', 'QUICK_STOP'],
  nightlife: ['NIGHTLIFE', 'ENTERTAINMENT'],
  lodging: [],
};

export function analyzeVisitExperiences(s: PlaceSignals): Candidate<VisitExperience>[] {
  return CATEGORY_EXPERIENCE[s.category].map((code) => ({ code, evidence: [catEv(s.category)] }));
}

// ── Audiencia ── Solo desde evidencia explícita; nunca atributos personales
// sensibles ni reputación.
export function analyzeAudiences(s: PlaceSignals): Candidate<PlaceAudience>[] {
  const out: Candidate<PlaceAudience>[] = [];
  if (s.features.familyFriendly === true) {
    out.push({ code: 'FAMILIES', evidence: [featEv('FEATURE_FAMILY_FRIENDLY')] });
    out.push({ code: 'CHILDREN', evidence: [featEv('FEATURE_FAMILY_FRIENDLY')] });
  }
  return out;
}

// ── Mejor momento ── Ventana orientada a la experiencia; NUNCA fuera de las
// horas conocidas. Con horas: se exige que el lugar esté ABIERTO en la banda
// (si está cerrado, se omite). Sin horas: banda típica de categoría (derivada).
const CATEGORY_BEST_BANDS: Readonly<Record<CategoryId, readonly TimeBandCode[]>> = {
  coffee: ['BREAKFAST', 'MORNING'],
  food: ['LUNCH', 'DINNER'],
  nightlife: ['EVENING', 'LATE_NIGHT'],
  beer: ['EVENING'],
  pharmacy: [],
  gas: [],
  store: [],
  lodging: [],
};

export function analyzeBestTimes(s: PlaceSignals): Candidate<BestVisitTime>[] {
  const out: Candidate<BestVisitTime>[] = [];
  for (const band of CATEGORY_BEST_BANDS[s.category]) {
    if (s.hours.hasHours) {
      if (s.hours.openBands.has(band)) {
        out.push({ code: band, evidence: [catEv(s.category), bandEv(band)] });
      }
      // horas presentes pero cerrado en la banda → se omite (no se afirma)
    } else {
      out.push({ code: band, evidence: [catEv(s.category)] });
    }
  }
  if (s.hours.hasHours && s.hours.openWeekday) {
    out.push({ code: 'WEEKDAY', evidence: [weekdayEv] });
  }
  if (s.hours.hasHours && s.hours.openWeekend) {
    out.push({ code: 'WEEKEND', evidence: [weekendEv] });
  }
  return out;
}

// ── Nivel de ruido ── Conservador: solo `nightlife` ⇒ LOUD (regla explícita y
// documentada). En cualquier otro caso, sin evidencia ⇒ el reporte devuelve null.
export function analyzeNoiseLevel(s: PlaceSignals): Candidate<NoiseLevel>[] {
  if (s.category === 'nightlife') {
    return [{ code: 'LOUD', evidence: [catEv('nightlife')] }];
  }
  return [];
}

// ── Duración de visita ── Expectativa amplia por categoría (no una predicción).
export function analyzeVisitDuration(s: PlaceSignals): Candidate<VisitDuration>[] {
  switch (s.category) {
    case 'food':
      return s.priceLevel !== null && s.priceLevel >= 3
        ? [{ code: 'HOUR_1_TO_2', evidence: [catEv('food'), priceEv(s.priceLevel)] }]
        : [{ code: 'MIN_30_TO_60', evidence: [catEv('food')] }];
    case 'coffee':
      return [{ code: 'MIN_30_TO_60', evidence: [catEv('coffee')] }];
    case 'pharmacy':
      return [{ code: 'UNDER_15_MIN', evidence: [catEv('pharmacy')] }];
    case 'gas':
      return [{ code: 'UNDER_15_MIN', evidence: [catEv('gas')] }];
    case 'store':
      return [{ code: 'MIN_15_TO_30', evidence: [catEv('store')] }];
    case 'beer':
      return [{ code: 'MIN_15_TO_30', evidence: [catEv('beer')] }];
    case 'nightlife':
      return [{ code: 'HOUR_1_TO_2', evidence: [catEv('nightlife')] }];
    case 'lodging':
    default:
      return [];
  }
}

// ── Accesibilidad ── SOLO desde evidencia estructurada explícita. La ausencia es
// UNKNOWN (se omite), jamás "accesible" ni "no accesible". Nunca desde categoría.
export function analyzeAccessibility(s: PlaceSignals): Candidate<AccessibilityTrait>[] {
  const out: Candidate<AccessibilityTrait>[] = [];
  if (s.features.wheelchairAccessible === true) {
    out.push({ code: 'WHEELCHAIR_ACCESSIBLE', evidence: [featEv('FEATURE_WHEELCHAIR_ACCESSIBLE')] });
  }
  if (s.features.parking === true) {
    out.push({ code: 'GENERAL_PARKING', evidence: [featEv('FEATURE_PARKING')] });
  }
  if (s.features.familyFriendly === true) {
    out.push({ code: 'KID_FRIENDLY', evidence: [featEv('FEATURE_FAMILY_FRIENDLY')] });
  }
  if (s.features.outdoorSeating === true) {
    out.push({ code: 'OUTDOOR_ACCESS', evidence: [featEv('FEATURE_OUTDOOR_SEATING')] });
  }
  return out;
}

// ── Etiquetas de experiencia ── Solo con evidencia defendible. SCENIC/HIDDEN_GEM
// nunca se infieren (no hay evidencia estructurada para ellas).
export function analyzeExperienceTags(s: PlaceSignals): Candidate<ExperienceTag>[] {
  const out: Candidate<ExperienceTag>[] = [];
  if (s.features.outdoorSeating === true) {
    out.push({ code: 'OUTDOOR_SEATING', evidence: [featEv('FEATURE_OUTDOOR_SEATING')] });
  }
  if (s.features.familyFriendly === true) {
    out.push({ code: 'GOOD_FOR_FAMILIES', evidence: [featEv('FEATURE_FAMILY_FRIENDLY')] });
  }
  const lateEvidence: PlaceIntelligenceEvidence[] = [];
  if (s.category === 'nightlife') {
    lateEvidence.push(catEv('nightlife'));
  }
  if (s.hours.openBands.has('LATE_NIGHT')) {
    lateEvidence.push(bandEv('LATE_NIGHT'));
  }
  if (lateEvidence.length > 0) {
    out.push({ code: 'LATE_NIGHT', evidence: lateEvidence });
  }
  return out;
}

// ── Especialidad ── Identidad de categoría (coffee/pharmacy/lodging) + léxico de
// nombre estrecho. Categoría + nombre coincidentes ⇒ mayor confianza; nombre
// solo ⇒ baja. Especialidades desconocidas se OMITEN.
const CATEGORY_SPECIALTY: Readonly<Partial<Record<CategoryId, PlaceSpecialty>>> = {
  coffee: 'COFFEE',
  pharmacy: 'PHARMACY',
  lodging: 'LODGING',
};

export function analyzeSpecialties(s: PlaceSignals): Candidate<PlaceSpecialty>[] {
  const out: Candidate<PlaceSpecialty>[] = [];
  const identity = CATEGORY_SPECIALTY[s.category];
  if (identity) {
    out.push({ code: identity, evidence: [catEv(s.category)] });
  }
  for (const match of s.lexicon) {
    out.push({ code: match.specialty, evidence: [tokenEv(match.token)] });
  }
  return out;
}
