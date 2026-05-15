import { QueryTypes } from "sequelize";

import { sequelize } from "../../../models/index.js";

type UpsertCostAggregationsForRunParams = {
  ingestionRunId?: string | number | null;
  tenantId: string;
  providerId: string | number;
  billingSourceId?: string | number | null;
  uploadedBy?: string | null;
  affectedUsageDates: string[];
};

const UPSERT_HOURLY_SQL = `
INSERT INTO agg_cost_hourly (
  hour_start,
  usage_date,
  billing_period_start_date,
  tenant_id,
  billing_source_id,
  ingestion_run_id,
  provider_id,
  uploaded_by,
  service_key,
  sub_account_key,
  region_key,
  billed_cost,
  effective_cost,
  list_cost,
  usage_quantity,
  currency_code,
  created_at,
  updated_at
)
SELECT
  DATE_TRUNC('hour', COALESCE(f.usage_start_time, f.usage_end_time)) AS hour_start,
  DATE(COALESCE(f.usage_start_time, f.usage_end_time)) AS usage_date,
  COALESCE(
    dd_start.full_date,
    dd_usage.full_date,
    DATE(COALESCE(f.usage_start_time, f.usage_end_time))
  ) AS billing_period_start_date,
  CAST(:tenantId AS UUID) AS tenant_id,
  CAST(:billingSourceId AS BIGINT) AS billing_source_id,
  CAST(:ingestionRunId AS BIGINT) AS ingestion_run_id,
  CAST(:providerId AS BIGINT) AS provider_id,
  CAST(:uploadedBy AS UUID) AS uploaded_by,
  COALESCE(f.service_key, 0)::BIGINT AS service_key,
  COALESCE(f.sub_account_key, 0)::BIGINT AS sub_account_key,
  COALESCE(f.region_key, 0)::BIGINT AS region_key,
  COALESCE(SUM(f.billed_cost), 0)::DECIMAL(18,4) AS billed_cost,
  COALESCE(SUM(f.effective_cost), 0)::DECIMAL(18,4) AS effective_cost,
  COALESCE(SUM(f.list_cost), 0)::DECIMAL(18,4) AS list_cost,
  COALESCE(SUM(f.consumed_quantity), 0)::DECIMAL(18,4) AS usage_quantity,
  COALESCE(NULLIF(dba.billing_currency, ''), 'USD') AS currency_code,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM fact_cost_line_items f
LEFT JOIN dim_date dd_start
  ON dd_start.id = f.billing_period_start_date_key
LEFT JOIN dim_date dd_usage
  ON dd_usage.id = f.usage_date_key
LEFT JOIN dim_billing_account dba
  ON dba.id = f.billing_account_key
WHERE f.tenant_id = CAST(:tenantId AS UUID)
  AND f.billing_source_id = CAST(:billingSourceId AS BIGINT)
  AND DATE(COALESCE(f.usage_start_time, f.usage_end_time)) IN (:affectedUsageDates)
  AND COALESCE(f.usage_start_time, f.usage_end_time) IS NOT NULL
GROUP BY
  1, 2, 3, 9, 10, 11, 16
ON CONFLICT (
  tenant_id,
  hour_start,
  service_key,
  sub_account_key,
  region_key,
  currency_code
)
DO UPDATE SET
  billed_cost = agg_cost_hourly.billed_cost + EXCLUDED.billed_cost,
  effective_cost = agg_cost_hourly.effective_cost + EXCLUDED.effective_cost,
  list_cost = agg_cost_hourly.list_cost + EXCLUDED.list_cost,
  usage_quantity = agg_cost_hourly.usage_quantity + EXCLUDED.usage_quantity,
  billing_source_id = EXCLUDED.billing_source_id,
  ingestion_run_id = EXCLUDED.ingestion_run_id,
  provider_id = EXCLUDED.provider_id,
  uploaded_by = EXCLUDED.uploaded_by,
  updated_at = CURRENT_TIMESTAMP;
`;

const UPSERT_DAILY_SQL = `
INSERT INTO agg_cost_daily (
  usage_date,
  billing_period_start_date,
  tenant_id,
  billing_source_id,
  ingestion_run_id,
  provider_id,
  uploaded_by,
  service_key,
  sub_account_key,
  region_key,
  billed_cost,
  effective_cost,
  list_cost,
  usage_quantity,
  currency_code,
  created_at,
  updated_at
)
SELECT
  COALESCE(
    dd_usage.full_date,
    DATE(COALESCE(f.usage_start_time, f.usage_end_time))
  ) AS usage_date,
  COALESCE(
    dd_start.full_date,
    dd_usage.full_date,
    DATE(COALESCE(f.usage_start_time, f.usage_end_time))
  ) AS billing_period_start_date,
  CAST(:tenantId AS UUID) AS tenant_id,
  CAST(:billingSourceId AS BIGINT) AS billing_source_id,
  CAST(:ingestionRunId AS BIGINT) AS ingestion_run_id,
  CAST(:providerId AS BIGINT) AS provider_id,
  CAST(:uploadedBy AS UUID) AS uploaded_by,
  COALESCE(f.service_key, 0)::BIGINT AS service_key,
  COALESCE(f.sub_account_key, 0)::BIGINT AS sub_account_key,
  COALESCE(f.region_key, 0)::BIGINT AS region_key,
  COALESCE(SUM(f.billed_cost), 0)::DECIMAL(18,4) AS billed_cost,
  COALESCE(SUM(f.effective_cost), 0)::DECIMAL(18,4) AS effective_cost,
  COALESCE(SUM(f.list_cost), 0)::DECIMAL(18,4) AS list_cost,
  COALESCE(SUM(f.consumed_quantity), 0)::DECIMAL(18,4) AS usage_quantity,
  COALESCE(NULLIF(dba.billing_currency, ''), 'USD') AS currency_code,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM fact_cost_line_items f
LEFT JOIN dim_date dd_start
  ON dd_start.id = f.billing_period_start_date_key
LEFT JOIN dim_date dd_usage
  ON dd_usage.id = f.usage_date_key
LEFT JOIN dim_billing_account dba
  ON dba.id = f.billing_account_key
WHERE f.tenant_id = CAST(:tenantId AS UUID)
  AND f.billing_source_id = CAST(:billingSourceId AS BIGINT)
  AND COALESCE(
    dd_usage.full_date,
    DATE(COALESCE(f.usage_start_time, f.usage_end_time))
  ) IN (:affectedUsageDates)
  AND COALESCE(
    dd_usage.full_date,
    DATE(COALESCE(f.usage_start_time, f.usage_end_time))
  ) IS NOT NULL
GROUP BY
  1, 2, 8, 9, 10, 15
ON CONFLICT (
  tenant_id,
  usage_date,
  service_key,
  sub_account_key,
  region_key,
  currency_code
)
DO UPDATE SET
  billed_cost = agg_cost_daily.billed_cost + EXCLUDED.billed_cost,
  effective_cost = agg_cost_daily.effective_cost + EXCLUDED.effective_cost,
  list_cost = agg_cost_daily.list_cost + EXCLUDED.list_cost,
  usage_quantity = agg_cost_daily.usage_quantity + EXCLUDED.usage_quantity,
  billing_source_id = EXCLUDED.billing_source_id,
  ingestion_run_id = EXCLUDED.ingestion_run_id,
  provider_id = EXCLUDED.provider_id,
  uploaded_by = EXCLUDED.uploaded_by,
  updated_at = CURRENT_TIMESTAMP;
`;

const UPSERT_MONTHLY_SQL = `
INSERT INTO agg_cost_monthly (
  month_start,
  tenant_id,
  billing_source_id,
  ingestion_run_id,
  provider_id,
  uploaded_by,
  service_key,
  sub_account_key,
  region_key,
  billed_cost,
  effective_cost,
  list_cost,
  usage_quantity,
  currency_code,
  created_at,
  updated_at
)
SELECT
  DATE_TRUNC(
    'month',
    COALESCE(
      dd_usage.full_date,
      DATE(COALESCE(f.usage_start_time, f.usage_end_time))
    )
  )::DATE AS month_start,
  CAST(:tenantId AS UUID) AS tenant_id,
  CAST(:billingSourceId AS BIGINT) AS billing_source_id,
  CAST(:ingestionRunId AS BIGINT) AS ingestion_run_id,
  CAST(:providerId AS BIGINT) AS provider_id,
  CAST(:uploadedBy AS UUID) AS uploaded_by,
  COALESCE(f.service_key, 0)::BIGINT AS service_key,
  COALESCE(f.sub_account_key, 0)::BIGINT AS sub_account_key,
  COALESCE(f.region_key, 0)::BIGINT AS region_key,
  COALESCE(SUM(f.billed_cost), 0)::DECIMAL(18,4) AS billed_cost,
  COALESCE(SUM(f.effective_cost), 0)::DECIMAL(18,4) AS effective_cost,
  COALESCE(SUM(f.list_cost), 0)::DECIMAL(18,4) AS list_cost,
  COALESCE(SUM(f.consumed_quantity), 0)::DECIMAL(18,4) AS usage_quantity,
  COALESCE(NULLIF(dba.billing_currency, ''), 'USD') AS currency_code,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM fact_cost_line_items f
LEFT JOIN dim_date dd_usage
  ON dd_usage.id = f.usage_date_key
LEFT JOIN dim_billing_account dba
  ON dba.id = f.billing_account_key
WHERE f.tenant_id = CAST(:tenantId AS UUID)
  AND f.billing_source_id = CAST(:billingSourceId AS BIGINT)
  AND DATE_TRUNC(
    'month',
    COALESCE(
      dd_usage.full_date,
      DATE(COALESCE(f.usage_start_time, f.usage_end_time))
    )
  )::DATE IN (:affectedMonthStarts)
  AND COALESCE(
    dd_usage.full_date,
    DATE(COALESCE(f.usage_start_time, f.usage_end_time))
  ) IS NOT NULL
GROUP BY
  1, 7, 8, 9, 14
ON CONFLICT (
  tenant_id,
  month_start,
  service_key,
  sub_account_key,
  region_key,
  currency_code
)
DO UPDATE SET
  billed_cost = agg_cost_monthly.billed_cost + EXCLUDED.billed_cost,
  effective_cost = agg_cost_monthly.effective_cost + EXCLUDED.effective_cost,
  list_cost = agg_cost_monthly.list_cost + EXCLUDED.list_cost,
  usage_quantity = agg_cost_monthly.usage_quantity + EXCLUDED.usage_quantity,
  billing_source_id = EXCLUDED.billing_source_id,
  ingestion_run_id = EXCLUDED.ingestion_run_id,
  provider_id = EXCLUDED.provider_id,
  uploaded_by = EXCLUDED.uploaded_by,
  updated_at = CURRENT_TIMESTAMP;
`;

async function upsertCostAggregationsForRun({
  ingestionRunId,
  tenantId,
  providerId,
  billingSourceId,
  uploadedBy,
  affectedUsageDates,
}: UpsertCostAggregationsForRunParams): Promise<void> {
  const normalizedDates = Array.from(
    new Set(
      (Array.isArray(affectedUsageDates) ? affectedUsageDates : [])
        .map((value) => String(value ?? "").trim())
        .filter(Boolean),
    ),
  );
  if (normalizedDates.length === 0) {
    console.info("Aggregation refresh skipped: no affected usage dates", {
      tenantId: String(tenantId),
      billingSourceId: billingSourceId == null ? null : String(billingSourceId),
      ingestionRunId: ingestionRunId == null ? null : String(ingestionRunId),
    });
    return;
  }

  const affectedMonthStarts = Array.from(
    new Set(
      normalizedDates.map((dateText) => {
        const parsed = new Date(`${dateText}T00:00:00.000Z`);
        const monthStart = new Date(Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), 1));
        return monthStart.toISOString().slice(0, 10);
      }),
    ),
  );

  const replacements = {
    ingestionRunId: ingestionRunId == null ? null : String(ingestionRunId),
    tenantId,
    providerId: String(providerId),
    billingSourceId: billingSourceId === null || billingSourceId === undefined ? null : String(billingSourceId),
    uploadedBy: uploadedBy ?? null,
    affectedUsageDates: normalizedDates,
    affectedMonthStarts,
  };

  console.info("Aggregation refresh started", {
    tenantId: String(tenantId),
    billingSourceId: billingSourceId == null ? null : String(billingSourceId),
    ingestionRunId: ingestionRunId == null ? null : String(ingestionRunId),
    affectedUsageDates: normalizedDates,
  });

  try {
    const factCountRows = await sequelize.query(
      `
        SELECT COUNT(*)::bigint AS row_count
        FROM fact_cost_line_items
        WHERE tenant_id = CAST(:tenantId AS UUID)
          AND billing_source_id = CAST(:billingSourceId AS BIGINT)
          AND DATE(COALESCE(usage_start_time, usage_end_time)) IN (:affectedUsageDates)
      `,
      {
        replacements,
        type: QueryTypes.SELECT,
      },
    );
    const factRowCount = Number((factCountRows as Array<{ row_count?: number | string }>)[0]?.row_count ?? 0);
    console.info("Aggregation scope fact rows counted", {
      tenantId: String(tenantId),
      billingSourceId: billingSourceId == null ? null : String(billingSourceId),
      ingestionRunId: ingestionRunId == null ? null : String(ingestionRunId),
      affectedUsageDates: normalizedDates,
      factRowCountForAffectedDates: factRowCount,
    });

    const hourlyDeleteRows = await sequelize.query(
      `
        WITH deleted AS (
          DELETE FROM agg_cost_hourly
          WHERE tenant_id = CAST(:tenantId AS UUID)
            AND billing_source_id = CAST(:billingSourceId AS BIGINT)
            AND usage_date IN (:affectedUsageDates)
          RETURNING 1
        )
        SELECT COUNT(*)::bigint AS deleted_count
        FROM deleted;
      `,
      {
        replacements,
        type: QueryTypes.SELECT,
      },
    );
    const deletedHourlyRows = Number((hourlyDeleteRows as Array<{ deleted_count?: number | string }>)[0]?.deleted_count ?? 0);
    console.info("Aggregation hourly delete complete", {
      tenantId: String(tenantId),
      billingSourceId: billingSourceId == null ? null : String(billingSourceId),
      deletedHourlyRows,
    });

    const hourlyRows = await sequelize.query(UPSERT_HOURLY_SQL, {
      replacements,
      type: QueryTypes.INSERT,
    });
    const hourlyInserted = Array.isArray(hourlyRows) ? Number(hourlyRows[1] ?? 0) : 0;
    console.info("Aggregation hourly upsert complete", {
      tenantId: String(tenantId),
      billingSourceId: billingSourceId == null ? null : String(billingSourceId),
      hourlyRowsInserted: hourlyInserted,
    });

    const dailyDeleteRows = await sequelize.query(
      `
        WITH deleted AS (
          DELETE FROM agg_cost_daily
          WHERE tenant_id = CAST(:tenantId AS UUID)
            AND billing_source_id = CAST(:billingSourceId AS BIGINT)
            AND usage_date IN (:affectedUsageDates)
          RETURNING 1
        )
        SELECT COUNT(*)::bigint AS deleted_count
        FROM deleted;
      `,
      {
        replacements,
        type: QueryTypes.SELECT,
      },
    );
    const deletedDailyRows = Number((dailyDeleteRows as Array<{ deleted_count?: number | string }>)[0]?.deleted_count ?? 0);
    console.info("Aggregation daily delete complete", {
      tenantId: String(tenantId),
      billingSourceId: billingSourceId == null ? null : String(billingSourceId),
      deletedDailyRows,
    });

    const dailyRows = await sequelize.query(UPSERT_DAILY_SQL, {
      replacements,
      type: QueryTypes.INSERT,
    });
    const dailyInserted = Array.isArray(dailyRows) ? Number(dailyRows[1] ?? 0) : 0;
    console.info("Aggregation daily upsert complete", {
      tenantId: String(tenantId),
      billingSourceId: billingSourceId == null ? null : String(billingSourceId),
      dailyRowsInserted: dailyInserted,
    });

    const monthlyDeleteRows = await sequelize.query(
      `
        WITH deleted AS (
          DELETE FROM agg_cost_monthly
          WHERE tenant_id = CAST(:tenantId AS UUID)
            AND billing_source_id = CAST(:billingSourceId AS BIGINT)
            AND month_start IN (:affectedMonthStarts)
          RETURNING 1
        )
        SELECT COUNT(*)::bigint AS deleted_count
        FROM deleted;
      `,
      {
        replacements,
        type: QueryTypes.SELECT,
      },
    );
    const deletedMonthlyRows = Number((monthlyDeleteRows as Array<{ deleted_count?: number | string }>)[0]?.deleted_count ?? 0);
    console.info("Aggregation monthly delete complete", {
      tenantId: String(tenantId),
      billingSourceId: billingSourceId == null ? null : String(billingSourceId),
      deletedMonthlyRows,
    });

    const monthlyRows = await sequelize.query(UPSERT_MONTHLY_SQL, {
      replacements,
      type: QueryTypes.INSERT,
    });
    const monthlyInserted = Array.isArray(monthlyRows) ? Number(monthlyRows[1] ?? 0) : 0;
    console.info("Aggregation monthly upsert complete", {
      tenantId: String(tenantId),
      billingSourceId: billingSourceId == null ? null : String(billingSourceId),
      monthlyRowsInserted: monthlyInserted,
    });

    if (factRowCount > 0 && hourlyInserted + dailyInserted + monthlyInserted === 0) {
      console.warn("Aggregation produced zero rows despite matching fact rows", {
        tenantId: String(tenantId),
        billingSourceId: billingSourceId == null ? null : String(billingSourceId),
        ingestionRunId: ingestionRunId == null ? null : String(ingestionRunId),
        factRowCountForAffectedDates: factRowCount,
        groupingFilters: {
          scope: "billing_source_id + affected_usage_dates",
          tenantId: String(tenantId),
          billingSourceId: billingSourceId == null ? null : String(billingSourceId),
          affectedUsageDates: normalizedDates,
          affectedMonthStarts,
        },
        aggregateSql: {
          hourly: UPSERT_HOURLY_SQL,
          daily: UPSERT_DAILY_SQL,
          monthly: UPSERT_MONTHLY_SQL,
        },
      });
    }

    console.info("Aggregation refresh completed", {
      tenantId: String(tenantId),
      billingSourceId: billingSourceId == null ? null : String(billingSourceId),
      ingestionRunId: ingestionRunId == null ? null : String(ingestionRunId),
      affectedUsageDates: normalizedDates,
      factRowCountForAffectedDates: factRowCount,
      aggregateRowsDeleted: {
        hourly: deletedHourlyRows,
        daily: deletedDailyRows,
        monthly: deletedMonthlyRows,
      },
      aggregateRowsInserted: {
        hourly: hourlyInserted,
        daily: dailyInserted,
        monthly: monthlyInserted,
      },
    });
  } catch (error) {
    console.error("Aggregation refresh failed", {
      tenantId: String(tenantId),
      billingSourceId: billingSourceId == null ? null : String(billingSourceId),
      ingestionRunId: ingestionRunId == null ? null : String(ingestionRunId),
      affectedUsageDates: normalizedDates,
      errorName: error instanceof Error ? error.name : null,
      errorStack: error instanceof Error ? error.stack : null,
      sql: error && typeof error === "object" && "sql" in error ? String((error as { sql?: string }).sql ?? "") : null,
      reason: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

export { upsertCostAggregationsForRun };
