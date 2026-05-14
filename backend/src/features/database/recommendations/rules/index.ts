import type {
  DbRecommendationCandidate,
  DbRecommendationsGenerateInput,
  EligibleDbResource,
} from "../types/db-recommendations.types.js";
import { generateDbEngineDeploymentOptimizationRecommendations } from "./engine-deployment-optimization.rule.js";
import { generateDbHaCostOptimizationRecommendations } from "./hi-avl-cost-optimization.rule.js";
import { generateDbIdleCandidateRecommendations } from "./idle-candidate.rule.js";
import { generateDbStorageOptimizationRecommendations } from "./storage-optimization.rule.js";

export type DbRecommendationRule = (input: {
  scope: DbRecommendationsGenerateInput;
  resources: EligibleDbResource[];
}) => Promise<DbRecommendationCandidate[]>;

export const dbRecommendationRulesRegistry: DbRecommendationRule[] = [
  generateDbStorageOptimizationRecommendations,
  generateDbIdleCandidateRecommendations,
  generateDbHaCostOptimizationRecommendations,
  generateDbEngineDeploymentOptimizationRecommendations,
];
