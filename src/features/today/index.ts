/** Sugerencias de hoy (V5.2): recomendaciones V5.1 reordenadas por contexto. */
export { buildTodayModels, type TodayCardModel } from './todayModel';
export { contextReasonLabelKey, contextBadgeLabelKey } from './todayLabels';
export { useToday, type UseTodayInput, type UseTodayResult } from './useToday';
export { TodaySection, type TodaySectionProps } from './TodaySection';
export { TodayCard } from './TodayCard';
export { ContextBadges } from './ContextBadges';
export {
  buildPersonalizedTodayModels,
  preferenceReasonLabelKey,
  type PersonalizedTodayCardModel,
  type PersonalizedTodayResult,
  type PreferenceEvaluationDiagnostics,
} from './personalizedToday';
export { PersonalizedTodaySection, type PersonalizedTodaySectionProps } from './PersonalizedTodaySection';
export { PersonalizedTodayCard } from './PersonalizedTodayCard';
export {
  buildIntentTodayModels,
  intentReasonLabelKey,
  intentChipLabelKey,
  type IntentTodayCardModel,
  type IntentTodayResult,
  type IntentTodayDiagnostics,
} from './intentToday';
export { IntentTodaySection, type IntentTodaySectionProps } from './IntentTodaySection';
export { IntentBar, type IntentBarProps } from './IntentBar';
