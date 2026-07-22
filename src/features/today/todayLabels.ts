/**
 * Mapeo de códigos de contexto (V5.2) → claves i18n. Sin prosa en el dominio.
 */
import type { ContextBadge, ContextReasonCode } from '../../context';
import type { TranslationKey } from '../../i18n/locales/es';

const REASON_KEY: Readonly<Record<ContextReasonCode, TranslationKey>> = {
  CTX_BREAKFAST: 'ctx.reason.breakfast',
  CTX_LUNCH: 'ctx.reason.lunch',
  CTX_DINNER: 'ctx.reason.dinner',
  CTX_EVENING: 'ctx.reason.evening',
  CTX_LATE_NIGHT: 'ctx.reason.lateNight',
  CTX_MORNING_FAVORITE: 'ctx.reason.morningFavorite',
  CTX_WEEKEND_PICK: 'ctx.reason.weekendPick',
  CTX_FAMILY_TIME: 'ctx.reason.familyTime',
  CTX_GOOD_TIME_OF_DAY: 'ctx.reason.goodTimeOfDay',
};

const BADGE_KEY: Readonly<Record<ContextBadge, TranslationKey>> = {
  breakfast: 'ctx.badge.breakfast',
  lunch: 'ctx.badge.lunch',
  dinner: 'ctx.badge.dinner',
  openLate: 'ctx.badge.openLate',
  weekendPick: 'ctx.badge.weekendPick',
  morningFavorite: 'ctx.badge.morningFavorite',
  familyTime: 'ctx.badge.familyTime',
};

export function contextReasonLabelKey(code: ContextReasonCode): TranslationKey {
  return REASON_KEY[code];
}
export function contextBadgeLabelKey(badge: ContextBadge): TranslationKey {
  return BADGE_KEY[badge];
}
