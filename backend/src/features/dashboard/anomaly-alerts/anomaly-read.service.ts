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
  usage_date: string;
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
        fa.usage_date,
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
        fa.severity,
        fa.status,
        fa.root_cause_hint,
        fa.explanation_json,
        fa.metadata_json,
        fa.first_seen_at,
        fa.last_seen_at,
        fa.resolved_at,
        fa.ignored_reason,
        fa.created_at
      FROM fact_anomalies fa
      LEFT JOIN billing_sources bs ON bs.id = fa.billing_source_id
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
