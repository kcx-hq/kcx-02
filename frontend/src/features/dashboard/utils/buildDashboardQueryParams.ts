import type { DashboardResolvedScope, DashboardScopeInput } from "../api/dashboardTypes";

const DASHBOARD_QUERY_KEYS: Array<keyof DashboardScopeInput> = [
  "tenantId",
  "rawBillingFileId",
  "billingSourceId",
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
    if (scopeOrInput.from) {
      params.set("from", scopeOrInput.from);
    }
    if (scopeOrInput.to) {
      params.set("to", scopeOrInput.to);
    }
    return params.toString();
  }

  const input = scopeOrInput as DashboardScopeInput;
  if (Array.isArray(input.rawBillingFileIds) && input.rawBillingFileIds.length > 0) {
    params.set("rawBillingFileIds", input.rawBillingFileIds.join(","));
    if (input.tenantId) {
      params.set("tenantId", String(input.tenantId));
    }
    if (input.from) {
      params.set("from", input.from);
    }
    if (input.to) {
      params.set("to", input.to);
    }
    return params.toString();
  }

  const billingSourceIds =
    "scopeType" in scopeOrInput && scopeOrInput.scopeType === "global"
      ? (scopeOrInput.billingSourceIds ?? undefined)
      : input.billingSourceIds;
  if (Array.isArray(billingSourceIds) && billingSourceIds.length > 0) {
    params.set("billingSourceIds", billingSourceIds.join(","));
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
  const from = params.get("from") ?? params.get("billingPeriodStart");
  const to = params.get("to") ?? params.get("billingPeriodEnd");
  const rawBillingFileIdsParamValues = params.getAll("rawBillingFileIds");
  const rawBillingFileIds = rawBillingFileIdsParamValues
    .flatMap((entry) => entry.split(","))
    .map((entry) => parseOptionalInteger(entry))
    .filter((entry): entry is number => typeof entry === "number");
  const billingSourceIdsParamValues = params.getAll("billingSourceIds");
  const billingSourceIds = billingSourceIdsParamValues
    .flatMap((entry) => entry.split(","))
    .map((entry) => parseOptionalInteger(entry))
    .filter((entry): entry is number => typeof entry === "number");

  return {
    tenantId: params.get("tenantId") ?? undefined,
    rawBillingFileId: parseOptionalInteger(params.get("rawBillingFileId")),
    rawBillingFileIds: rawBillingFileIds.length > 0 ? [...new Set(rawBillingFileIds)] : undefined,
    billingSourceId: parseOptionalInteger(params.get("billingSourceId")),
    billingSourceIds: billingSourceIds.length > 0 ? [...new Set(billingSourceIds)] : undefined,
    from: from ?? undefined,
    to: to ?? undefined,
    providerId: parseOptionalInteger(params.get("providerId")),
    billingAccountKey: parseOptionalInteger(params.get("billingAccountKey")),
    subAccountKey: parseOptionalInteger(params.get("subAccountKey")),
    serviceKey: parseOptionalInteger(params.get("serviceKey")),
    regionKey: parseOptionalInteger(params.get("regionKey")),
  };
}
