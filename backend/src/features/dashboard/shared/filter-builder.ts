import type { DashboardScope } from "../dashboard.types.js";

export type DashboardFilterResult = {
  whereClause: string;
  params: unknown[];
};

export function buildDashboardFilter(scope: DashboardScope): DashboardFilterResult {
  const conditions: string[] = [];
  const params: unknown[] = [];

  const pushCondition = (columnExpression: string, value: unknown): void => {
    params.push(value);
    const parameterIndex = params.length;
    conditions.push(`${columnExpression} = $${parameterIndex}`);
  };

  const pushBetweenDates = (columnExpression: string, from: string, to: string): void => {
    params.push(from);
    const fromIndex = params.length;
    params.push(to);
    const toIndex = params.length;
    conditions.push(`${columnExpression} BETWEEN $${fromIndex} AND $${toIndex}`);
  };

  const pushAnyArrayCondition = (columnExpression: string, values: unknown[]): void => {
    params.push(values);
    const parameterIndex = params.length;
    conditions.push(`${columnExpression} = ANY($${parameterIndex}::bigint[])`);
  };

  if (scope.scopeType === "upload") {
    pushAnyArrayCondition("fcli.ingestion_run_id", scope.ingestionRunIds);
  } else {
    pushCondition("fcli.tenant_id", scope.tenantId);
    pushBetweenDates("dd.full_date", scope.from, scope.to);

    if (typeof scope.providerId === "number") {
      pushCondition("fcli.provider_id", scope.providerId);
    }

    if (Array.isArray(scope.billingSourceIds) && scope.billingSourceIds.length > 0) {
      pushAnyArrayCondition("fcli.billing_source_id", scope.billingSourceIds);
    }

    if (typeof scope.billingAccountKey === "number") {
      pushCondition("fcli.billing_account_key", scope.billingAccountKey);
    }

    if (typeof scope.subAccountKey === "number") {
      pushCondition("fcli.sub_account_key", scope.subAccountKey);
    }

    if (typeof scope.serviceKey === "number") {
      pushCondition("fcli.service_key", scope.serviceKey);
    }

    if (typeof scope.regionKey === "number") {
      pushCondition("fcli.region_key", scope.regionKey);
    }
  }

  return {
    whereClause: conditions.join("\n  AND "),
    params,
  };
}
