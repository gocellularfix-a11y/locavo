/** Experiencia de recomendaciones inteligentes (V5.1). Consume el motor V5.0. */
export {
  buildRecommendationModels,
  scoreToStars,
  badgesForResult,
  explanationLabelKey,
  badgeLabelKey,
  confidenceLabelKey,
  type RecommendationCardModel,
  type RecommendationBadge,
  type RecommendationOpenState,
  type StarRating,
  type RecommendationModelsResult,
} from './recommendationModel';
export {
  useRecommendations,
  type UseRecommendationsInput,
  type UseRecommendationsResult,
  type RecommendationStatus,
} from './useRecommendations';
export { RecommendationCard } from './RecommendationCard';
export { RecommendationScore } from './RecommendationScore';
export { RecommendationBadges } from './RecommendationBadges';
export { RecommendationReasons } from './RecommendationReasons';
export { RecommendationConfidence } from './RecommendationConfidence';
export { RecommendationEmptyState } from './RecommendationEmptyState';
export { RecommendationSection } from './RecommendationSection';
