import { classifyDenuePlace } from '../classifyOsmMatch';
import { osmPoiToCandidate, type OsmCandidate } from '../osmCandidates';
import { makeDenue, makePoi, metersToLatOffset } from './helpers';

const DENUE_LAT = 24.8;
const DENUE_LON = -107.4;
const PHONE = '6671112233';
const WEBSITE = 'https://alfa.mx';

/** Candidato a `meters` al norte del lugar DENUE base. */
function candidate(
  osmId: string,
  meters: number,
  tags: Record<string, string>,
): OsmCandidate {
  const poi = makePoi(osmId, DENUE_LAT + metersToLatOffset(meters), DENUE_LON, tags);
  const c = osmPoiToCandidate(poi);
  if (!c) {
    throw new Error(`tags no mapean a categoría: ${JSON.stringify(tags)}`);
  }
  return c;
}

const pharmacy = makeDenue({
  category: 'pharmacy',
  name: 'Farmacia Alfa',
  phone: PHONE,
  website: WEBSITE,
  latitude: DENUE_LAT,
  longitude: DENUE_LON,
});

const CONTACT_TAGS = { amenity: 'pharmacy', phone: PHONE, website: 'http://alfa.mx' };

describe('classifyDenuePlace — regla de seguridad de contacto (V4F-0)', () => {
  it('solo teléfono, sin nombre ni cercanía fuerte → NO AUTO-SAFE', () => {
    const r = classifyDenuePlace(pharmacy, [
      candidate('n1', 120, { amenity: 'pharmacy', phone: PHONE, name: 'Beta Salud' }),
    ]);
    expect(r.classification).not.toBe('auto-safe');
  });

  it('solo website, sin nombre ni cercanía fuerte → NO AUTO-SAFE', () => {
    const r = classifyDenuePlace(pharmacy, [
      candidate('n1', 120, { amenity: 'pharmacy', website: 'http://alfa.mx', name: 'Beta Salud' }),
    ]);
    expect(r.classification).not.toBe('auto-safe');
  });

  it('phone + website + categoría, SIN nombre/cercanía fuerte → AMBIGUOUS (contact-only)', () => {
    const r = classifyDenuePlace(pharmacy, [candidate('n1', 120, { ...CONTACT_TAGS, name: 'Beta Salud' })]);
    expect(r.classification).toBe('ambiguous');
    expect(r.ambiguityReason).toBe('contact-only');
    expect(r.best?.result.confidence).toBeGreaterThanOrEqual(0.75);
  });

  it('phone + website + NOMBRE FUERTE → AUTO-SAFE permitido', () => {
    const r = classifyDenuePlace(pharmacy, [candidate('n1', 120, { ...CONTACT_TAGS, name: 'Farmacia Alfa' })]);
    expect(r.classification).toBe('auto-safe');
  });

  it('phone + website + CERCANÍA FUERTE → AUTO-SAFE permitido', () => {
    const r = classifyDenuePlace(pharmacy, [candidate('n1', 50, { ...CONTACT_TAGS, name: 'Beta Salud' })]);
    expect(r.classification).toBe('auto-safe');
  });

  it('nombre débil (0.5 ≤ sim < 0.8) no basta → AMBIGUOUS', () => {
    const r = classifyDenuePlace(pharmacy, [
      candidate('n1', 120, { ...CONTACT_TAGS, name: 'Alfa Farmacia Sur' }),
    ]);
    expect(r.classification).toBe('ambiguous');
  });

  it('cercanía débil (75 < d ≤ 200) no basta → AMBIGUOUS', () => {
    const r = classifyDenuePlace(pharmacy, [candidate('n1', 120, { ...CONTACT_TAGS, name: 'Beta Salud' })]);
    expect(r.classification).toBe('ambiguous');
  });

  it('categoría incompatible nunca es AUTO-SAFE', () => {
    const food = makeDenue({ category: 'food', name: 'Farmacia Alfa', phone: PHONE, website: WEBSITE });
    const r = classifyDenuePlace(food, [candidate('n1', 50, { ...CONTACT_TAGS, name: 'Farmacia Alfa' })]);
    expect(r.classification).not.toBe('auto-safe');
  });

  it('candidatos competitivos → AMBIGUOUS (no AUTO-SAFE)', () => {
    const r = classifyDenuePlace(pharmacy, [
      candidate('n1', 50, { ...CONTACT_TAGS, name: 'Farmacia Alfa' }),
      candidate('n2', 55, { ...CONTACT_TAGS, name: 'Farmacia Alfa' }),
    ]);
    expect(r.classification).toBe('ambiguous');
    expect(r.ambiguityReason).toBe('multiple-competitive');
  });

  it('determinista: el orden de los candidatos no cambia el resultado', () => {
    const a = candidate('n1', 50, { ...CONTACT_TAGS, name: 'Beta Salud' });
    const b = candidate('n2', 500, { amenity: 'pharmacy', name: 'Lejana' });
    const r1 = classifyDenuePlace(pharmacy, [a, b]);
    const r2 = classifyDenuePlace(pharmacy, [b, a]);
    expect(r2.classification).toBe(r1.classification);
    expect(r2.best?.osmId).toBe(r1.best?.osmId);
  });

  it('sin candidatos → NO-MATCH', () => {
    expect(classifyDenuePlace(pharmacy, []).classification).toBe('no-match');
  });
});
