import type { DbRecommendationCandidate } from "../types/db-recommendations.types.js";
import { buildRecommendationIdentity, buildStableIdentityKey } from "./db-recommendation-identity.js";

export function buildRecommendationDedupeKey(candidate: DbRecommendationCandidate): string {
  const identity = buildRecommendationIdentity({
    tenantId: candidate.tenantId,
    cloudConnectionId: candidate.cloudConnectionId,
    resourceId: candidate.resourceId,
    resourceArn: candidate.resourceArn,
    recommendationType: candidate.recommendationType,
    dbService: null,
    resourceType: candidate.resourceType,
    dbEngine: null,
  });
  return buildStableIdentityKey(identity);
}

export function dedupeDbRecommendationCandidates(
  candidates: DbRecommendationCandidate[],
): DbRecommendationCandidate[] {
  const map = new Map<string, DbRecommendationCandidate>();
  for (const candidate of candidates) {
    map.set(buildRecommendationDedupeKey(candidate), candidate);
  }
  return [...map.values()];
}
