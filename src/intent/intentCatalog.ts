/**
 * Catálogo canónico de intenciones (V5.5). Solo categorías canónicas y
 * evidencia estructurada; nunca negocios concretos. Determinista.
 */
import type { CategoryId } from '../domain/place';
import type { ContextProfile } from '../context';
import type { IntentId, IntentReasonCode } from './intentModel';

export type IntentEvidenceKey = 'openNow' | 'openLate' | 'nearby' | 'accessible' | 'family';

export interface IntentDefinition {
  id: IntentId;
  /** Categorías primarias (vacío = intención modificadora, sin alcance propio). */
  categoryScope: readonly CategoryId[];
  supportingCategories?: readonly CategoryId[];
  requiredEvidence?: readonly IntentEvidenceKey[];
  preferredEvidence?: readonly IntentEvidenceKey[];
  contextAffinity?: readonly ContextProfile[];
  reasonCode: IntentReasonCode;
  /** Prioridad para elegir intención primaria (mayor gana; desempate por id). */
  priority: number;
}

const DEFS: Readonly<Record<IntentId, IntentDefinition>> = {
  MEDICAL: { id: 'MEDICAL', categoryScope: ['pharmacy'], reasonCode: 'INTENT_MEDICAL_MATCH', priority: 72, contextAffinity: [] },
  FUEL: { id: 'FUEL', categoryScope: ['gas'], reasonCode: 'INTENT_FUEL_MATCH', priority: 72 },
  PHARMACY: { id: 'PHARMACY', categoryScope: ['pharmacy'], reasonCode: 'INTENT_PHARMACY_MATCH', priority: 70 },
  LODGING: { id: 'LODGING', categoryScope: ['lodging'], reasonCode: 'INTENT_LODGING_MATCH', priority: 70 },
  BREAKFAST: { id: 'BREAKFAST', categoryScope: ['food', 'coffee'], reasonCode: 'INTENT_BREAKFAST_MATCH', priority: 62, contextAffinity: ['breakfast'] },
  LUNCH: { id: 'LUNCH', categoryScope: ['food'], reasonCode: 'INTENT_LUNCH_MATCH', priority: 61, contextAffinity: ['lunch'] },
  DINNER: { id: 'DINNER', categoryScope: ['food'], reasonCode: 'INTENT_DINNER_MATCH', priority: 60, contextAffinity: ['dinner'] },
  NIGHTLIFE: { id: 'NIGHTLIFE', categoryScope: ['nightlife', 'beer'], reasonCode: 'INTENT_ENTERTAINMENT_MATCH', priority: 59, contextAffinity: ['nightlife'] },
  ENTERTAINMENT: { id: 'ENTERTAINMENT', categoryScope: ['nightlife'], reasonCode: 'INTENT_ENTERTAINMENT_MATCH', priority: 58, contextAffinity: ['nightlife'] },
  COFFEE: { id: 'COFFEE', categoryScope: ['coffee'], reasonCode: 'INTENT_COFFEE_MATCH', priority: 56, contextAffinity: ['breakfast', 'coffee'] },
  SHOPPING: { id: 'SHOPPING', categoryScope: ['store'], reasonCode: 'INTENT_CATEGORY_MATCH', priority: 55 },
  FAMILY_ACTIVITY: { id: 'FAMILY_ACTIVITY', categoryScope: ['food', 'coffee', 'lodging'], preferredEvidence: ['family'], reasonCode: 'INTENT_FAMILY_MATCH', priority: 50, contextAffinity: ['familyAfternoon'] },
  QUICK_STOP: { id: 'QUICK_STOP', categoryScope: ['store', 'gas', 'pharmacy'], reasonCode: 'INTENT_QUICK_STOP_MATCH', priority: 45, contextAffinity: ['quickStop'] },
  // Modificadoras: sin alcance de categoría propio.
  OPEN_NOW: { id: 'OPEN_NOW', categoryScope: [], requiredEvidence: ['openNow'], reasonCode: 'INTENT_OPEN_NOW_MATCH', priority: 26 },
  OPEN_LATE: { id: 'OPEN_LATE', categoryScope: [], requiredEvidence: ['openLate'], reasonCode: 'INTENT_OPEN_LATE_MATCH', priority: 25 },
  ACCESSIBLE: { id: 'ACCESSIBLE', categoryScope: [], preferredEvidence: ['accessible'], reasonCode: 'INTENT_ACCESSIBILITY_MATCH', priority: 22 },
  NEARBY: { id: 'NEARBY', categoryScope: [], preferredEvidence: ['nearby'], reasonCode: 'INTENT_NEARBY_MATCH', priority: 20 },
};

export function intentDefinition(id: IntentId): IntentDefinition {
  return DEFS[id];
}

export function isModifierIntent(id: IntentId): boolean {
  return DEFS[id].categoryScope.length === 0;
}

/** ¿Comparten alcance de categoría dos intenciones con categoría? */
export function scopesOverlap(a: IntentId, b: IntentId): boolean {
  const sa = new Set<CategoryId>([...DEFS[a].categoryScope, ...(DEFS[a].supportingCategories ?? [])]);
  return [...DEFS[b].categoryScope, ...(DEFS[b].supportingCategories ?? [])].some((c) => sa.has(c));
}
