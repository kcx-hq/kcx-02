import type { DashboardResolvedScope, DashboardScopeInput } from "../api/dashboardTypes";

const DASHBOARD_QUERY_KEYS: Array<keyof DashboardScopeInput> = [
  "tenantId",
  "rawBillingFileId",
  "from",
  "to",
  "providerId",
  "billingAccountKey",
  "subAccountKey",
  "serviceKey",
  "regionKey",
];

function parseOptionalInteger(value: string | null): number | undefined {
  if (!value) {
    return undefined;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed)) {
    return undefined;
  }

  return parsed;
}

export function buildDashboardQueryParams(
  scopeOrInput: DashboardScopeInput | DashboardResolvedScope,
): string {
  const params = new URLSearchParams();

  if ("scopeType" in scopeOrInput && scopeOrInput.scopeType === "upload") {
    params.set("tenantId", String(scopeOrInput.tenantId));
    if (scopeOrInput.rawBillingFileIds.length > 0) {
      params.set("rawBillingFileIds", scopeOrInput.rawBillingFileIds.join(","));
    }
    return params.toString();
  }

  const input = scopeOrInput as DashboardScopeInput;
  if (Array.isArray(input.rawBillingFileIds) && input.rawBillingFileIds.length > 0) {
    params.set("rawBillingFileIds", input.rawBillingFileIds.join(","));
    if (input.tenantId) {
      params.set("tenantId", String(input.tenantId));
    }
    return params.toString();
  }

  DASHBOARD_QUERY_KEYS.forEach((key) => {
    const value = input[key];
    if (typeof value === "undefined" || value === null || value === "") {
      return;
    }
    params.set(key, String(value));
  });

  return params.toString();
}

export function parseDashboardScopeInputFromSearch(search: string): DashboardScopeInput {
  const params = new URLSearchParams(search);
  const rawBillingFileIdsParamValues = params.getAll("rawBillingFileIds");
  const rawBillingFileIds = rawBillingFileIdsParamValues
    .flatMap((entry) => entry.split(","))
    .map((entry) => parseOptionalInteger(entry))
    .filter((entry): entry is number => typeof entry === "number");

  return {
    tenantId: params.get("tenantId") ?? undefined,
    rawBillingFileId: parseOptionalInteger(params.get("rawBillingFileId")),
    rawBillingFileIds: rawBillingFileIds.length > 0 ? [...new Set(rawBillingFileIds)] : undefined,
    from: params.get("from") ?? undefined,
    to: params.get("to") ?? undefined,
    providerId: parseOptionalInteger(params.get("providerId")),
    billingAccountKey: parseOptionalInteger(params.get("billingAccountKey")),
    subAccountKey: parseOptionalInteger(params.get("subAccountKey")),
    serviceKey: parseOptionalInteger(params.get("serviceKey")),
    regionKey: parseOptionalInteger(params.get("regionKey")),
  };
}
