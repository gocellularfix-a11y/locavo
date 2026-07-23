import { buildPlaceIntelligence } from '../placeIntelligenceEngine';
import { daily, makePlace } from './fixtures';

const codes = (attrs: readonly { code: string }[]) => attrs.map((a) => a.code);

describe('V5.8 — inteligencia derivada de categoría', () => {
  it('restaurante (food): comida completa; NO romántico/familiar/silencioso/citas sin evidencia', () => {
    const r = buildPlaceIntelligence(makePlace({ category: 'food', name: 'Cocina del Centro' }));
    expect(codes(r.visitExperiences)).toContain('FULL_MEAL');
    expect(r.visitDuration?.code).toBe('MIN_30_TO_60');
    expect(codes(r.personalities)).not.toContain('ROMANTIC');
    expect(codes(r.personalities)).not.toContain('FAMILY_FRIENDLY');
    expect(codes(r.experienceTags)).not.toContain('GOOD_FOR_DATES');
    expect(r.noiseLevel).toBeNull();
  });

  it('café (coffee): visita relajada + especialidad COFFEE; NO silencioso por estereotipo', () => {
    const r = buildPlaceIntelligence(makePlace({ category: 'coffee', name: 'La Cafetería' }));
    expect(codes(r.visitExperiences)).toContain('RELAXED_VISIT');
    expect(codes(r.specialties)).toContain('COFFEE');
    expect(r.noiseLevel).toBeNull();
  });

  it('farmacia (pharmacy): mandado/parada rápida + PHARMACY; NO servicio rápido por categoría', () => {
    const r = buildPlaceIntelligence(makePlace({ category: 'pharmacy', name: 'Farmacia del Ahorro' }));
    expect(codes(r.visitExperiences)).toEqual(expect.arrayContaining(['QUICK_STOP', 'ERRAND']));
    expect(codes(r.specialties)).toContain('PHARMACY');
    expect(r.visitDuration?.code).toBe('UNDER_15_MIN');
    expect(codes(r.personalities)).not.toContain('FAST_SERVICE');
  });

  it('abarrotes (store): compra + mandado', () => {
    const r = buildPlaceIntelligence(makePlace({ category: 'store', name: 'Super Abarrotes' }));
    expect(codes(r.visitExperiences)).toEqual(expect.arrayContaining(['SHOPPING_TRIP', 'ERRAND']));
    expect(r.visitDuration?.code).toBe('MIN_15_TO_30');
  });

  it('hotel (lodging): especialidad LODGING; sin experiencias forzadas ni duración', () => {
    const r = buildPlaceIntelligence(makePlace({ category: 'lodging', name: 'Hotel San Marcos' }));
    expect(codes(r.specialties)).toContain('LODGING');
    expect(r.visitExperiences).toEqual([]);
    expect(r.visitDuration).toBeNull();
  });

  it('reparación de celulares (store + léxico): PHONE_REPAIR y MOBILE_PHONES', () => {
    const r = buildPlaceIntelligence(makePlace({ category: 'store', name: 'Reparación de Celulares El Rápido' }));
    expect(codes(r.specialties)).toEqual(expect.arrayContaining(['MOBILE_PHONES', 'PHONE_REPAIR']));
  });

  it('antro (nightlife): NIGHTLIFE/ENTERTAINMENT, ruido LOUD, sin especialidad', () => {
    const r = buildPlaceIntelligence(makePlace({ category: 'nightlife', name: 'Club Central', hours: daily('20:00', '02:00') }));
    expect(codes(r.visitExperiences)).toEqual(expect.arrayContaining(['NIGHTLIFE', 'ENTERTAINMENT']));
    expect(r.noiseLevel?.code).toBe('LOUD');
  });

  it('gasolinera (gas): mandado/parada rápida corta', () => {
    const r = buildPlaceIntelligence(makePlace({ category: 'gas', name: 'Gasolinera Pemex' }));
    expect(codes(r.visitExperiences)).toEqual(expect.arrayContaining(['ERRAND', 'QUICK_STOP']));
    expect(r.visitDuration?.code).toBe('UNDER_15_MIN');
  });
});

describe('V5.8 — confianza derivada de la evidencia', () => {
  it('evidencia estructurada explícita ⇒ HIGH', () => {
    const r = buildPlaceIntelligence(makePlace({ category: 'food', features: { familyFriendly: true } }));
    expect(r.personalities.find((p) => p.code === 'FAMILY_FRIENDLY')?.confidence).toBe('HIGH');
  });

  it('múltiples señales consistentes ⇒ HIGH (categoría + nombre; categoría + horas)', () => {
    const r = buildPlaceIntelligence(makePlace({ category: 'coffee', name: 'Café Central', hours: daily('07:00', '12:00') }));
    expect(r.specialties.find((s) => s.code === 'COFFEE')?.confidence).toBe('HIGH');
    expect(r.bestTimes.find((b) => b.code === 'BREAKFAST')?.confidence).toBe('HIGH');
  });

  it('una señal indirecta débil (léxico solo) NO se vuelve HIGH', () => {
    const r = buildPlaceIntelligence(makePlace({ category: 'food', name: 'Tacos El Güero' }));
    expect(r.specialties.find((s) => s.code === 'TACOS')?.confidence).toBe('LOW');
  });

  it('una señal derivada de categoría sola ⇒ MEDIUM', () => {
    const r = buildPlaceIntelligence(makePlace({ category: 'food', name: 'Restaurante' }));
    expect(r.visitExperiences.find((e) => e.code === 'FULL_MEAL')?.confidence).toBe('MEDIUM');
  });

  it('afirmaciones no soportadas se omiten siempre', () => {
    const r = buildPlaceIntelligence(makePlace({ category: 'food', name: 'El Rincón', price: { level: 3 }, features: { familyFriendly: true } }));
    expect(codes(r.personalities)).not.toContain('LOCAL_FAVORITE');
    expect(codes(r.personalities)).not.toContain('TOURIST_ORIENTED');
    expect(codes(r.personalities)).not.toContain('ROMANTIC');
    expect(codes(r.experienceTags)).not.toContain('SCENIC');
    expect(codes(r.experienceTags)).not.toContain('HIDDEN_GEM');
  });
});
