import type { DbRecommendationType, EligibleDbResource } from "../types/db-recommendations.types.js";

export type DbRecommendationIdentity = {
  tenantId: string;
  cloudConnectionId: string;
  resourceId: string;
  recommendationType: DbRecommendationType;
  resourceArn: string | null;
  sourceResourceId: string;
  inferredResourceKind: "RDS" | "AURORA" | "UNKNOWN";
};

export function inferDbResourceKind(resource: Pick<EligibleDbResource, "dbService" | "resourceType" | "dbEngine">): "RDS" | "AURORA" | "UNKNOWN" {
  const haystack = `${resource.dbService ?? ""} ${resource.resourceType ?? ""} ${resource.dbEngine ?? ""}`.toLowerCase();
  if (haystack.includes("aurora")) return "AURORA";
  if (haystack.includes("rds") || haystack.includes("db.instance")) return "RDS";
  return "UNKNOWN";
}

export function buildRecommendationIdentity(input: {
  tenantId: string;
  cloudConnectionId: string;
  resourceId: string;
  resourceArn: string | null;
  recommendationType: DbRecommendationType;
  dbService: string | null;
  resourceType: string | null;
  dbEngine: string | null;
}): DbRecommendationIdentity {
  return {
    tenantId: input.tenantId,
    cloudConnectionId: input.cloudConnectionId,
    resourceId: input.resourceId.trim(),
    sourceResourceId: input.resourceId,
    resourceArn: input.resourceArn,
    recommendationType: input.recommendationType,
    inferredResourceKind: inferDbResourceKind({
      dbService: input.dbService,
      resourceType: input.resourceType,
      dbEngine: input.dbEngine,
    }),
  };
}

export function buildStableIdentityKey(identity: DbRecommendationIdentity): string {
  return [
    identity.tenantId,
    identity.cloudConnectionId,
    identity.resourceId,
    identity.recommendationType,
  ].join("|");
}
