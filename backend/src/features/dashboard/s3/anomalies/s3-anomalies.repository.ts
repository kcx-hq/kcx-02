import { QueryTypes } from "sequelize";

import { sequelize } from "../../../../models/index.js";
import type { DashboardScope } from "../../dashboard.types.js";

import type { S3AnomaliesFilters, S3AnomaliesResponse } from "./s3-anomalies.types.js";

type S3AnomalyDbRow = {
  id: string;
  usage_date: string;
  anomaly_type: string | null;
  root_cause_hint: string | null;
  explanation_json: Record<string, unknown> | null;
  account_id: string | null;
  region_name: string | null;
  delta_cost: string | null;
  delta_percent: string | null;
  actual_cost: string | null;
  severity: "low" | "medium" | "high";
  status: "open" | "resolved" | "ignored";
  total_count: string | number | null;
};

const toNumber = (value: string | number | null | undefined): number => {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
};

export class S3AnomaliesRepository {
  async getS3Anomalies(scope: DashboardScope, filters: S3AnomaliesFilters): Promise<S3AnomaliesResponse> {
    if (scope.scopeType !== "global") {
      return {
        section: "s3-anomalies",
        items: [],
        pagination: {
          limit: filters.limit,
          offset: filters.offset,
          total: 0,
        },
      };
    }

    const params: unknown[] = [scope.tenantId, scope.from, scope.to];
    const where: string[] = [
      "fa.tenant_id = $1::uuid",
      "fa.usage_date BETWEEN $2::date AND $3::date",
      "fa.anomaly_scope = 'service_category'",
      "fa.source_table = 's3_cost_daily'",
    ];

    if (Array.isArray(scope.billingSourceIds) && scope.billingSourceIds.length > 0) {
      params.push(scope.billingSourceIds);
      where.push(`fa.billing_source_id = ANY($${params.length}::bigint[])`);
    }
    if (typeof scope.regionKey === "number") {
      params.push(scope.regionKey);
      where.push(`fa.region_key = $${params.length}`);
    }
    if (typeof scope.subAccountKey === "number") {
      params.push(scope.subAccountKey);
      where.push(`fa.sub_account_key = $${params.length}`);
    }
    if (filters.severity) {
      params.push(filters.severity);
      where.push(`fa.severity = $${params.length}`);
    }
    if (filters.status) {
      params.push(filters.status);
      where.push(`fa.status = $${params.length}`);
    }

    params.push(filters.limit);
    params.push(filters.offset);

    const rows = await sequelize.query<S3AnomalyDbRow>(
      `
        SELECT
          fa.id,
          fa.usage_date::text AS usage_date,
          fa.anomaly_type,
          fa.root_cause_hint,
          fa.explanation_json,
          dsa.sub_account_id AS account_id,
          COALESCE(dr.region_name, dr.region_id, 'global') AS region_name,
          fa.delta_cost::text AS delta_cost,
          fa.delta_percent::text AS delta_percent,
          fa.actual_cost::text AS actual_cost,
          fa.severity,
          fa.status,
          COUNT(*) OVER() AS total_count
        FROM fact_anomalies fa
        LEFT JOIN dim_region dr ON dr.id = fa.region_key
        LEFT JOIN dim_sub_account dsa ON dsa.id = fa.sub_account_key
        WHERE ${where.join("\n          AND ")}
        ORDER BY fa.usage_date DESC, fa.created_at DESC
        LIMIT $${params.length - 1} OFFSET $${params.length};
      `,
      { bind: params, type: QueryTypes.SELECT },
    );

    const total = toNumber(rows[0]?.total_count);
    const items = rows.map((row) => {
      const explanation = row.explanation_json && typeof row.explanation_json === "object" ? row.explanation_json : {};
      const recommendation =
        typeof (explanation as Record<string, unknown>).recommendation === "string"
          ? String((explanation as Record<string, unknown>).recommendation)
          : null;
      const insightDescription =
        typeof (explanation as Record<string, unknown>).insightDescription === "string"
          ? String((explanation as Record<string, unknown>).insightDescription)
          : row.root_cause_hint ?? "";
      const costImpact = toNumber(row.delta_cost);
      const totalCost = toNumber(row.actual_cost);
      return {
        id: row.id,
        startDate: row.usage_date,
        insightTitle:
          typeof (explanation as Record<string, unknown>).insightTitle === "string"
            ? String((explanation as Record<string, unknown>).insightTitle)
            : row.anomaly_type ?? "Unknown",
        insightDescription,
        recommendation,
        duration: "1 Day",
        accountId: row.account_id,
        service: "Amazon S3",
        region: row.region_name,
        costImpactType: "Increase" as const,
        costImpact,
        impactPercent: toNumber(row.delta_percent),
        cost: totalCost,
        severity: row.severity,
        status: row.status,
      };
    });

    return {
      section: "s3-anomalies",
      items,
      pagination: {
        limit: filters.limit,
        offset: filters.offset,
        total,
      },
    };
  }
}
