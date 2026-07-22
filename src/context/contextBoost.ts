/**
 * Boosts contextuales deterministas (V5.2).
 *
 * Multiplicadores por CATEGORÍA según el perfil activo. Nunca por negocio; solo
 * por categoría canónica. No modifica la arquitectura de score de V5.0: se
 * aplica como reordenamiento contextual sobre resultados ya calculados. Valor
 * base neutro = 1.0 (sin cambio); >1 favorece, <1 resta relevancia.
 */
import type { CategoryId } from '../domain/place';
import type { ContextProfile } from './contextEngine';

const BOOSTS: Readonly<Record<ContextProfile, Partial<Record<CategoryId, number>>>> = {
  breakfast: { coffee: 1.2, food: 1.1, nightlife: 0.8, beer: 0.8 },
  coffee: { coffee: 1.2, food: 1.05 },
  lunch: { food: 1.2, coffee: 1.05, nightlife: 0.85 },
  dinner: { food: 1.15, nightlife: 1.05, beer: 1.05, coffee: 0.95 },
  nightlife: { nightlife: 1.25, beer: 1.2, food: 1.05, coffee: 0.8 },
  lateNight: { nightlife: 1.2, beer: 1.15, pharmacy: 1.1, gas: 1.1, lodging: 1.1, coffee: 0.8 },
  familyAfternoon: { food: 1.15, coffee: 1.1, store: 1.05, nightlife: 0.8, beer: 0.8 },
  shopping: { store: 1.2, coffee: 1.05, food: 1.05 },
  quickStop: { store: 1.1, gas: 1.1, pharmacy: 1.1 },
};

/** Multiplicador contextual determinista para (perfil, categoría). */
export function contextMultiplier(profile: ContextProfile, category: CategoryId): number {
  return BOOSTS[profile][category] ?? 1;
}
