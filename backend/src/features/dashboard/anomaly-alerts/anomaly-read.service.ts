import { QueryTypes } from "sequelize";

import { NotFoundError } from "../../../errors/http-errors.js";
import { sequelize } from "../../../models/index.js";

import type { AnomalyListQuery } from "./anomaly.schema.js";

type AnomalyRow = {
  id: string;
  tenant_id: string | null;
  billing_source_id: number | null;
  billing_source_name: string | null;
  cloud_connection_id: string | null;
  cloud_connection_name: string | null;
  usage_date: string;
  account_name: string | null;
  service: string | null;
  region: string | null;
  detected_at: string;
  anomaly_type: string | null;
  anomaly_scope: string | null;
  baseline_type: string | null;
  source_granularity: string | null;
  source_table: string | null;
  expected_cost: string | null;
  actual_cost: string | null;
  delta_cost: string | null;
  delta_percent: string | null;
  confidence_score: string | null;
  severity: string;
  status: string;
  root_cause_hint: string | null;
  explanation_json: Record<string, unknown> | null;
  metadata_json: Record<string, unknown> | null;
  first_seen_at: string | null;
  last_seen_at: string | null;
  resolved_at: string | null;
  ignored_reason: string | null;
  created_at: string;
  service_name: string | null;
  region_name: string | null;
  resource_id: string | null;
  resource_name: string | null;
  sub_account_id: string | null;
  sub_account_name: string | null;
  contributors: Array<{
    id: string;
    dimension_type: string;
    dimension_key: string | null;
    dimension_value: string | null;
    contribution_cost: string | null;
    contribution_percent: string | null;
    rank: number | null;
    created_at: string;
  }>;
};

type TotalCountRow = {
  total: string | number;
};

type AnomaliesListResponse = {
  items: AnomalyRow[];
  pagination: {
    limit: number;
    offset: number;
    total: number;
  };
};

async function assertTenantBillingSourceOrThrow({
  tenantId,
  billingSourceId,
}: {
  tenantId: string;
  billingSourceId: number;
}): Promise<void> {
  const [row] = await sequelize.query<{ id: number }>(
    `
      SELECT bs.id
      FROM billing_sources bs
      WHERE bs.id = CAST(:billingSourceId AS BIGINT)
        AND bs.tenant_id = :tenantId
      LIMIT 1
    `,
    {
      replacements: { billingSourceId, tenantId },
      type: QueryTypes.SELECT,
    },
  );

  if (!row?.id) {
    throw new NotFoundError("Billing source not found");
  }
}

export async function getAnomaliesForTenant({
  tenantId,
  query,
}: {
  tenantId: string;
  query: AnomalyListQuery;
}): Promise<AnomaliesListResponse> {
  if (typeof query.billing_source_id === "number") {
    await assertTenantBillingSourceOrThrow({
      tenantId,
      billingSourceId: query.billing_source_id,
    });
  }

  const whereClauses: string[] = ["fa.tenant_id = :tenantId"];
  const replacements: Record<string, unknown> = {
    tenantId,
    limit: query.limit,
    offset: query.offset,
  };

  if (typeof query.billing_source_id === "number") {
    whereClauses.push("fa.billing_source_id = CAST(:billingSourceId AS BIGINT)");
    replacements.billingSourceId = query.billing_source_id;
  }

  if (query.status) {
    whereClauses.push("fa.status = :status");
    replacements.status = query.status;
  }

  if (query.severity) {
    whereClauses.push("fa.severity = :severity");
    replacements.severity = query.severity;
  }

  if (query.anomaly_type) {
    whereClauses.push("fa.anomaly_type = :anomalyType");
    replacements.anomalyType = query.anomaly_type;
  }

  if (query.date_from) {
    whereClauses.push("fa.usage_date >= :dateFrom");
    replacements.dateFrom = query.date_from;
  }

  if (query.date_to) {
    whereClauses.push("fa.usage_date <= :dateTo");
    replacements.dateTo = query.date_to;
  }

  const whereSql = `WHERE ${whereClauses.join(" AND ")}`;

  const [countRow] = await sequelize.query<TotalCountRow>(
    `
      SELECT COUNT(*)::bigint AS total
      FROM fact_anomalies fa
      ${whereSql}
    `,
    {
      replacements,
      type: QueryTypes.SELECT,
    },
  );

  const items = await sequelize.query<AnomalyRow>(
    `
      SELECT
        fa.id,
        fa.tenant_id,
        fa.billing_source_id,
        bs.source_name AS billing_source_name,
        fa.cloud_connection_id,
        cc.connection_name AS cloud_connection_name,
        fa.usage_date,
        dsa.sub_account_name AS account_name,
        ds.service_name AS service,
        dr.region_name AS region,
        fa.detected_at,
        fa.anomaly_type,
        fa.anomaly_scope,
        fa.baseline_type,
        fa.source_granularity,
        fa.source_table,
        fa.expected_cost,
        fa.actual_cost,
        fa.delta_cost,
        fa.delta_percent,
        fa.confidence_score,
        fa.severity,
        fa.status,
        fa.root_cause_hint,
        fa.explanation_json,
        fa.metadata_json,
        fa.first_seen_at,
        fa.last_seen_at,
        fa.resolved_at,
        fa.ignored_reason,
        fa.created_at,
        ds.service_name,
        dr.region_name,
        dres.resource_id,
        dres.resource_name,
        dsa.sub_account_id,
        dsa.sub_account_name,
        COALESCE(ac.contributors, '[]'::json) AS contributors
      FROM fact_anomalies fa
      LEFT JOIN billing_sources bs ON bs.id = fa.billing_source_id
      LEFT JOIN cloud_connections cc ON cc.id = fa.cloud_connection_id
      LEFT JOIN dim_service ds ON ds.id = fa.service_key
      LEFT JOIN dim_region dr ON dr.id = fa.region_key
      LEFT JOIN dim_resource dres ON dres.id = fa.resource_key
      LEFT JOIN dim_sub_account dsa ON dsa.id = fa.sub_account_key
      LEFT JOIN LATERAL (
        SELECT json_agg(
          json_build_object(
            'id', ac.id,
            'dimension_type', ac.dimension_type,
            'dimension_key', ac.dimension_key::text,
            'dimension_value', ac.dimension_value,
            'contribution_cost', ac.contribution_cost::text,
            'contribution_percent', ac.contribution_percent::text,
            'rank', ac.rank,
            'created_at', ac.created_at
          )
          ORDER BY ac.rank ASC NULLS LAST, ac.created_at ASC
        ) AS contributors
        FROM anomaly_contributors ac
        WHERE ac.anomaly_id = fa.id
      ) ac ON TRUE
      ${whereSql}
      ORDER BY fa.usage_date DESC, fa.created_at DESC
      LIMIT :limit OFFSET :offset
    `,
    {
      replacements,
      type: QueryTypes.SELECT,
    },
  );

  return {
    items,
    pagination: {
      limit: query.limit,
      offset: query.offset,
      total: Number(countRow?.total ?? 0),
    },
  };
}
