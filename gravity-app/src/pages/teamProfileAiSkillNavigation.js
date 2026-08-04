import {presentableRecommendations} from '../features/llm-summary/digestPresentation.js';

export function metricAiActionRecommendations(product) {
  const mappedSkills = Array.isArray(product?.ai_skill_mappings)
    ? product.ai_skill_mappings
    : [];
  const actualRecommendations = presentableRecommendations(product?.metric_recommendations);
  return [...mappedSkills, ...actualRecommendations];
}
