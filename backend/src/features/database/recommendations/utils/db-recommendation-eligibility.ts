import type { EligibleDbResource } from "../types/db-recommendations.types.js";

const EXCLUDED_PREFIXES = ["db-scope:", "db-unattributed:"];

export function isActionableDbResource(resource: EligibleDbResource): boolean {
  if (!resource.tenantId || !resource.cloudConnectionId) return false;
  if (!resource.resourceId || EXCLUDED_PREFIXES.some((prefix) => resource.resourceId.startsWith(prefix))) return false;
  if (!resource.awsAccountId) return false;
  if (resource.billingSourceId == null) return false;
  if (resource.totalEffectiveCost <= 0) return false;
  return true;
}
