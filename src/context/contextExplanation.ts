/**
 * Explicaciones e insignias de CONTEXTO (V5.2), estructuradas y deterministas.
 *
 * Devuelve CÓDIGOS (nunca prosa); la capa de presentación los mapea a i18n. No
 * consume recomendaciones: solo (contexto, categoría, estado de apertura).
 */
import type { CategoryId } from '../domain/place';
import { contextMultiplier } from './contextBoost';
import type { ContextSnapshot } from './contextEngine';

export type ContextReasonCode =
  | 'CTX_BREAKFAST'
  | 'CTX_LUNCH'
  | 'CTX_DINNER'
  | 'CTX_EVENING'
  | 'CTX_LATE_NIGHT'
  | 'CTX_MORNING_FAVORITE'
  | 'CTX_WEEKEND_PICK'
  | 'CTX_FAMILY_TIME'
  | 'CTX_GOOD_TIME_OF_DAY';

export type ContextBadge =
  | 'breakfast'
  | 'lunch'
  | 'dinner'
  | 'openLate'
  | 'weekendPick'
  | 'morningFavorite'
  | 'familyTime';

export type OpenStateLike = 'open' | 'closed' | 'unknown';

const WEEKEND_PROFILES = new Set(['familyAfternoon', 'dinner', 'nightlife', 'lateNight']);

/** ¿Está la categoría contextualmente favorecida en el perfil actual? */
export function isContextuallyRelevant(snapshot: ContextSnapshot, category: CategoryId): boolean {
  return contextMultiplier(snapshot.profile, category) > 1;
}

/** Códigos de explicación contextual (solo si la categoría está favorecida). */
export function contextReasonCodes(
  snapshot: ContextSnapshot,
  category: CategoryId,
): ContextReasonCode[] {
  if (!isContextuallyRelevant(snapshot, category)) {
    return [];
  }
  const codes: ContextReasonCode[] = [];
  switch (snapshot.profile) {
    case 'breakfast':
      codes.push('CTX_BREAKFAST');
      if (category === 'coffee') codes.push('CTX_MORNING_FAVORITE');
      break;
    case 'coffee':
      codes.push('CTX_MORNING_FAVORITE');
      break;
    case 'lunch':
      codes.push('CTX_LUNCH');
      break;
    case 'dinner':
      codes.push('CTX_DINNER');
      break;
    case 'nightlife':
      codes.push('CTX_EVENING');
      break;
    case 'lateNight':
      codes.push('CTX_LATE_NIGHT');
      break;
    case 'familyAfternoon':
      codes.push('CTX_FAMILY_TIME');
      break;
    case 'shopping':
    case 'quickStop':
      codes.push('CTX_GOOD_TIME_OF_DAY');
      break;
  }
  if (snapshot.isWeekend && WEEKEND_PROFILES.has(snapshot.profile)) {
    codes.push('CTX_WEEKEND_PICK');
  }
  return [...new Set(codes)];
}

/** Insignias contextuales deterministas. */
export function contextBadgesFor(
  snapshot: ContextSnapshot,
  category: CategoryId,
  openState: OpenStateLike,
): ContextBadge[] {
  if (!isContextuallyRelevant(snapshot, category)) {
    return [];
  }
  const badges: ContextBadge[] = [];
  switch (snapshot.profile) {
    case 'breakfast':
      badges.push('breakfast');
      if (category === 'coffee') badges.push('morningFavorite');
      break;
    case 'coffee':
      badges.push('morningFavorite');
      break;
    case 'lunch':
      badges.push('lunch');
      break;
    case 'dinner':
      badges.push('dinner');
      break;
    case 'nightlife':
    case 'lateNight':
      if (openState === 'open') badges.push('openLate');
      break;
    case 'familyAfternoon':
      badges.push('familyTime');
      break;
    case 'shopping':
    case 'quickStop':
      break;
  }
  if (snapshot.isWeekend && WEEKEND_PROFILES.has(snapshot.profile)) {
    badges.push('weekendPick');
  }
  return [...new Set(badges)];
}
