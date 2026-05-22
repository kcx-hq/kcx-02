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
  service_key?: string | null;
  region_key?: string | null;
  sub_account_key?: string | null;
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
  insight_title?: string;
  insight_description?: string;
  recommendation?: string | null;
};

type TotalCountRow = {
  total: string | number;
};

type AnomalySummaryRow = {
  total_anomalies: string | number;
  critical_anomalies: string | number;
  total_cost_impact: string | number;
  potential_savings: string | number;
};

type AnomaliesListResponse = {
  items: AnomalyRow[];
  pagination: {
    limit: number;
    offset: number;
    total: number;
  };
  summary: {
    totalAnomalies: number;
    criticalAnomalies: number;
    totalCostImpact: number;
    potentialSavings: number;
  };
};

export type AnomalyDetailResponse = AnomalyRow;

export type AnomalyTimelinePoint = {
  date: string;
  cost: number;
  is_anomaly: boolean;
  cost_impact?: number;
  cost_impact_percentage?: number;
};

export type AnomalyTimelineResponse = {
  anomaly: AnomalyDetailResponse;
  timeline: AnomalyTimelinePoint[];
  related_anomalies: Array<{
    id: string;
    date: string;
    anomaly_type: string | null;
    status: string;
    cost_impact: number;
    cost_impact_percentage: number;
  }>;
};

const compareAnomalyRowsDesc = (a: AnomalyRow, b: AnomalyRow): number => {
  const aUsage = new Date(a.usage_date).getTime();
  const bUsage = new Date(b.usage_date).getTime();
  if (bUsage !== aUsage) {
    return bUsage - aUsage;
  }
  const aCreated = new Date(a.created_at).getTime();
  const bCreated = new Date(b.created_at).getTime();
  return bCreated - aCreated;
};

const toInsightDecoratedRow = (row: AnomalyRow): AnomalyRow => {
  const explanation = row.explanation_json && typeof row.explanation_json === "object" ? row.explanation_json : {};
  const insightTitle =
    typeof (explanation as Record<string, unknown>).insightTitle === "string"
      ? String((explanation as Record<string, unknown>).insightTitle)
      : row.anomaly_type ?? "Unknown Anomaly";
  const insightDescription =
    typeof (explanation as Record<string, unknown>).insightDescription === "string"
      ? String((explanation as Record<string, unknown>).insightDescription)
      : row.root_cause_hint ?? "";
  const recommendation =
    typeof (explanation as Record<string, unknown>).recommendation === "string"
      ? String((explanation as Record<string, unknown>).recommendation)
      : null;

  return {
    ...row,
    insight_title: insightTitle,
    insight_description: insightDescription,
    recommendation,
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

  const dbWindowLimit = Math.min(5000, Math.max(query.limit, query.offset + query.limit + 50));
  replacements.dbLimit = dbWindowLimit;

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

  const [summaryRow] = await sequelize.query<AnomalySummaryRow>(
    `
      SELECT
        COUNT(*)::bigint AS total_anomalies,
        SUM(CASE WHEN LOWER(fa.severity) IN ('high', 'critical') THEN 1 ELSE 0 END)::bigint AS critical_anomalies,
        COALESCE(SUM(ABS(COALESCE(fa.delta_cost, 0))), 0)::numeric AS total_cost_impact,
        COALESCE(
          SUM(
            CASE
              WHEN LOWER(fa.status) = 'open' THEN ABS(COALESCE(fa.delta_cost, 0))
              ELSE 0
            END
          ),
          0
        )::numeric AS potential_savings
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
        fa.service_key::text AS service_key,
        fa.region_key::text AS region_key,
        fa.sub_account_key::text AS sub_account_key,
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
      LIMIT :dbLimit OFFSET 0
    `,
    {
      replacements,
      type: QueryTypes.SELECT,
    },
  );

  const sortedItems = [...items.map(toInsightDecoratedRow)].sort(compareAnomalyRowsDesc);
  const paginatedItems = sortedItems.slice(query.offset, query.offset + query.limit);

  return {
    items: paginatedItems,
    pagination: {
      limit: query.limit,
      offset: query.offset,
      total: Number(countRow?.total ?? 0),
    },
    summary: {
      totalAnomalies: Number(summaryRow?.total_anomalies ?? 0),
      criticalAnomalies: Number(summaryRow?.critical_anomalies ?? 0),
      totalCostImpact: Number(summaryRow?.total_cost_impact ?? 0),
      potentialSavings: Number(summaryRow?.potential_savings ?? 0),
    },
  };
}

export async function getAnomalyByIdForTenant({
  tenantId,
  anomalyId,
}: {
  tenantId: string;
  anomalyId: string;
}): Promise<AnomalyDetailResponse> {
  const rows = await sequelize.query<AnomalyRow>(
    `
      SELECT
        fa.id,
        fa.tenant_id,
        fa.billing_source_id,
        bs.source_name AS billing_source_name,
        fa.cloud_connection_id,
        cc.connection_name AS cloud_connection_name,
        fa.usage_date,
        COALESCE(
          NULLIF(dsa.sub_account_name, ''),
          NULLIF(dsa.sub_account_id, ''),
          NULLIF(fa.metadata_json->>'subAccountName', ''),
          NULLIF(fa.metadata_json->>'subAccountId', ''),
          NULLIF(fa.metadata_json->>'accountName', ''),
          NULLIF(fa.metadata_json->>'accountId', ''),
          NULLIF(bs.source_name, ''),
          'Unspecified'
        ) AS account_name,
        ds.service_name AS service,
        COALESCE(
          NULLIF(dr.region_name, ''),
          NULLIF(dr.region_id, ''),
          NULLIF(fa.metadata_json->>'regionName', ''),
          NULLIF(fa.metadata_json->>'region', ''),
          'Global/Unknown'
        ) AS region,
        fa.detected_at,
        fa.anomaly_type,
        fa.anomaly_scope,
        fa.baseline_type,
        fa.source_granularity,
        fa.source_table,
        fa.service_key::text AS service_key,
        fa.region_key::text AS region_key,
        fa.sub_account_key::text AS sub_account_key,
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
        COALESCE(
          NULLIF(dr.region_name, ''),
          NULLIF(dr.region_id, ''),
          NULLIF(fa.metadata_json->>'regionName', ''),
          NULLIF(fa.metadata_json->>'region', ''),
          'Global/Unknown'
        ) AS region_name,
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
      WHERE fa.tenant_id = :tenantId
        AND fa.id = CAST(:anomalyId AS UUID)
      LIMIT 1
    `,
    {
      replacements: { tenantId, anomalyId },
      type: QueryTypes.SELECT,
    },
  );

  const row = rows[0];
  if (!row) {
    throw new NotFoundError("Anomaly not found");
  }
  return toInsightDecoratedRow(row);
}

const addDays = (dateOnly: string, deltaDays: number): string => {
  const d = new Date(`${dateOnly}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + deltaDays);
  return d.toISOString().slice(0, 10);
};

const buildDateRange = (fromDate: string, toDate: string): string[] => {
  const points: string[] = [];
  let cursor = fromDate;
  while (cursor <= toDate) {
    points.push(cursor);
    cursor = addDays(cursor, 1);
  }
  return points;
};

export async function getAnomalyTimelineByIdForTenant({
  tenantId,
  anomalyId,
  period,
}: {
  tenantId: string;
  anomalyId: string;
  period: 3 | 7 | 14 | 30 | 90;
}): Promise<AnomalyTimelineResponse> {
  const anomaly = await getAnomalyByIdForTenant({ tenantId, anomalyId });
  const usageDate = String(anomaly.usage_date);
  const dateFrom = addDays(usageDate, -(period - 1));
  const metadata = (anomaly.metadata_json && typeof anomaly.metadata_json === "object"
    ? anomaly.metadata_json
    : {}) as Record<string, unknown>;
  const usageType = typeof metadata.usageType === "string" && metadata.usageType.trim()
    ? metadata.usageType.trim()
    : null;
  const expectedCost = Number(anomaly.expected_cost ?? 0);
  const actualCost = Number(anomaly.actual_cost ?? 0);

  const serviceText = String(anomaly.service ?? anomaly.service_name ?? "").toLowerCase();
  const isS3 = serviceText.includes("s3") || String(anomaly.source_table ?? "").toLowerCase().includes("s3");

  let timeline: AnomalyTimelinePoint[] = [];

  if (isS3) {
    const accountId =
      (typeof metadata.accountId === "string" && metadata.accountId.trim()) ||
      (typeof metadata.subAccountId === "string" && metadata.subAccountId.trim()) ||
      anomaly.sub_account_id ||
      null;
    const regionText =
      (typeof metadata.region === "string" && metadata.region.trim()) ||
      (typeof metadata.regionName === "string" && metadata.regionName.trim()) ||
      anomaly.region ||
      anomaly.region_name ||
      null;

    const rows = await sequelize.query<{ usage_date: string; cost: string }>(
      `
        SELECT
          scd.usage_date::text AS usage_date,
          COALESCE(SUM(COALESCE(scd.total_cost, 0)), 0)::text AS cost
        FROM s3_cost_daily scd
        WHERE scd.tenant_id = CAST(:tenantId AS UUID)
          AND scd.usage_date BETWEEN :dateFrom AND :dateTo
          AND (:billingSourceId IS NULL OR scd.billing_source_id = CAST(:billingSourceId AS BIGINT))
          AND (
            (:subAccountKey IS NOT NULL AND scd.sub_account_key = CAST(:subAccountKey AS BIGINT))
            OR (:subAccountKey IS NULL AND (:accountId IS NULL OR scd.account_id = :accountId))
          )
          AND (
            (:regionKey IS NOT NULL AND scd.region_key = CAST(:regionKey AS BIGINT))
            OR (:regionKey IS NULL AND scd.region_key IS NULL)
          )
          AND (:usageType IS NULL OR scd.usage_type = :usageType)
        GROUP BY scd.usage_date
        ORDER BY scd.usage_date ASC
      `,
      {
        replacements: {
          tenantId,
          dateFrom,
          dateTo: usageDate,
          billingSourceId: anomaly.billing_source_id,
          subAccountKey: anomaly.sub_account_key ?? null,
          accountId,
          regionKey: anomaly.region_key ?? null,
          usageType,
        },
        type: QueryTypes.SELECT,
      },
    );

    // Fallback for anomalies like S3_PUBLIC_ACCESS_RISK where usage_type/key fields
    // may be absent or not aligned with daily aggregation rows.
    const fallbackRows =
      rows.length > 0
        ? rows
        : await sequelize.query<{ usage_date: string; cost: string }>(
            `
              SELECT
                scd.usage_date::text AS usage_date,
                COALESCE(SUM(COALESCE(scd.total_cost, 0)), 0)::text AS cost
              FROM s3_cost_daily scd
              WHERE scd.tenant_id = CAST(:tenantId AS UUID)
                AND scd.usage_date BETWEEN :dateFrom AND :dateTo
                AND (:billingSourceId IS NULL OR scd.billing_source_id = CAST(:billingSourceId AS BIGINT))
                AND (
                  (:subAccountKey IS NOT NULL AND scd.sub_account_key = CAST(:subAccountKey AS BIGINT))
                  OR (:subAccountKey IS NULL AND (:accountId IS NULL OR scd.account_id = :accountId))
                )
                AND (
                  (:regionKey IS NOT NULL AND scd.region_key = CAST(:regionKey AS BIGINT))
                  OR (
                    :regionKey IS NULL
                    AND (
                      :regionText IS NULL
                      OR LOWER(COALESCE(scd.region, '')) = LOWER(:regionText)
                    )
                  )
                )
              GROUP BY scd.usage_date
              ORDER BY scd.usage_date ASC
            `,
            {
              replacements: {
                tenantId,
                dateFrom,
                dateTo: usageDate,
                billingSourceId: anomaly.billing_source_id,
                subAccountKey: anomaly.sub_account_key ?? null,
                accountId,
                regionKey: anomaly.region_key ?? null,
                regionText,
              },
              type: QueryTypes.SELECT,
            },
          );

    const relaxedRows =
      fallbackRows.length > 0
        ? fallbackRows
        : await sequelize.query<{ usage_date: string; cost: string }>(
            `
              SELECT
                scd.usage_date::text AS usage_date,
                COALESCE(SUM(COALESCE(scd.total_cost, 0)), 0)::text AS cost
              FROM s3_cost_daily scd
              WHERE scd.tenant_id = CAST(:tenantId AS UUID)
                AND scd.usage_date BETWEEN :dateFrom AND :dateTo
                AND (:billingSourceId IS NULL OR scd.billing_source_id = CAST(:billingSourceId AS BIGINT))
                AND (:accountId IS NULL OR scd.account_id = :accountId)
                AND (
                  :regionText IS NULL
                  OR LOWER(COALESCE(scd.region, '')) = LOWER(:regionText)
                )
              GROUP BY scd.usage_date
              ORDER BY scd.usage_date ASC
            `,
            {
              replacements: {
                tenantId,
                dateFrom,
                dateTo: usageDate,
                billingSourceId: anomaly.billing_source_id,
                accountId,
                regionText,
              },
              type: QueryTypes.SELECT,
            },
          );

    timeline = relaxedRows.map((row) => ({
      date: row.usage_date,
      cost: Number(row.cost ?? 0),
      is_anomaly: row.usage_date === usageDate,
      ...(row.usage_date === usageDate
        ? {
            cost_impact: Number(anomaly.delta_cost ?? 0),
            cost_impact_percentage: Number(anomaly.delta_percent ?? 0),
          }
        : {}),
    }));

    // Final guard: show at least anomaly-day point from fact_anomalies if no daily rows exist.
    if (timeline.length === 0) {
      timeline = [
        {
          date: usageDate,
          cost: actualCost,
          is_anomaly: true,
          cost_impact: Number(anomaly.delta_cost ?? 0),
          cost_impact_percentage: Number(anomaly.delta_percent ?? 0),
        },
      ];
    }
  } else {
    const rows = await sequelize.query<{ usage_date: string; cost: string }>(
      `
        SELECT
          fcli.usage_date::text AS usage_date,
          COALESCE(SUM(COALESCE(fcli.billed_cost, 0)), 0)::text AS cost
        FROM fact_cost_line_items fcli
        WHERE fcli.tenant_id = CAST(:tenantId AS UUID)
          AND fcli.usage_date BETWEEN :dateFrom AND :dateTo
          AND (:serviceKey IS NULL OR fcli.service_key = CAST(:serviceKey AS BIGINT))
          AND (:subAccountKey IS NULL OR fcli.sub_account_key = CAST(:subAccountKey AS BIGINT))
          AND (
            (:regionKey IS NULL AND fcli.region_key IS NULL)
            OR (:regionKey IS NOT NULL AND fcli.region_key = CAST(:regionKey AS BIGINT))
          )
        GROUP BY fcli.usage_date
        ORDER BY fcli.usage_date ASC
      `,
      {
        replacements: {
          tenantId,
          dateFrom,
          dateTo: usageDate,
          serviceKey: anomaly.service_key ?? null,
          subAccountKey: anomaly.sub_account_key ?? null,
          regionKey: anomaly.region_key ?? null,
        },
        type: QueryTypes.SELECT,
      },
    );
    timeline = rows.map((row) => ({
      date: row.usage_date,
      cost: Number(row.cost ?? 0),
      is_anomaly: row.usage_date === usageDate,
      ...(row.usage_date === usageDate
        ? {
            cost_impact: Number(anomaly.delta_cost ?? 0),
            cost_impact_percentage: Number(anomaly.delta_percent ?? 0),
          }
        : {}),
    }));
  }

  // Normalize to dense daily points so chart always has continuous period context.
  const denseDates = buildDateRange(dateFrom, usageDate);
  const byDate = new Map(timeline.map((point) => [point.date, point]));
  let previousCost: number | null = null;
  const denseTimeline: AnomalyTimelinePoint[] = denseDates.map((date) => {
    const existing = byDate.get(date);
    if (existing) {
      previousCost = Number(existing.cost ?? 0);
      return existing;
    }
    if (date === usageDate) {
      return {
        date,
        cost: actualCost,
        is_anomaly: true,
        cost_impact: Number(anomaly.delta_cost ?? 0),
        cost_impact_percentage: Number(anomaly.delta_percent ?? 0),
      };
    }
    const fallbackCost = previousCost ?? expectedCost;
    previousCost = fallbackCost;
    return {
      date,
      cost: fallbackCost,
      is_anomaly: false,
    };
  });
  timeline = denseTimeline;

  const relatedRows = await sequelize.query<{
    id: string;
    usage_date: string;
    anomaly_type: string | null;
    status: string;
    delta_cost: string | null;
    delta_percent: string | null;
  }>(
    `
      SELECT
        fa.id::text AS id,
        fa.usage_date::text AS usage_date,
        fa.anomaly_type,
        fa.status,
        fa.delta_cost::text AS delta_cost,
        fa.delta_percent::text AS delta_percent
      FROM fact_anomalies fa
      WHERE fa.tenant_id = CAST(:tenantId AS UUID)
        AND fa.usage_date BETWEEN :dateFrom AND :dateTo
        AND fa.service_key IS NOT DISTINCT FROM (SELECT service_key FROM fact_anomalies WHERE id = CAST(:anomalyId AS UUID))
        AND fa.region_key IS NOT DISTINCT FROM (SELECT region_key FROM fact_anomalies WHERE id = CAST(:anomalyId AS UUID))
        AND fa.sub_account_key IS NOT DISTINCT FROM (SELECT sub_account_key FROM fact_anomalies WHERE id = CAST(:anomalyId AS UUID))
      ORDER BY fa.usage_date ASC, fa.created_at ASC
    `,
    {
      replacements: { tenantId, anomalyId, dateFrom, dateTo: usageDate },
      type: QueryTypes.SELECT,
    },
  );

  return {
    anomaly,
    timeline,
    related_anomalies: relatedRows.map((row) => ({
      id: row.id,
      date: row.usage_date,
      anomaly_type: row.anomaly_type,
      status: row.status,
      cost_impact: Number(row.delta_cost ?? 0),
      cost_impact_percentage: Number(row.delta_percent ?? 0),
    })),
  };
}
