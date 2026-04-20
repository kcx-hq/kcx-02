import { QueryTypes, Transaction } from "sequelize";

import { sequelize } from "../../../models/index.js";

type PeriodStatus = "open" | "frozen" | "adjusted";

type SyncEc2CostHistoryForIngestionRunParams = {
  ingestionRunId: string | number;
  tenantId: string;
  providerId: string | number;
  billingSourceId: string | number;
  correctionMode?: boolean;
};

type MonthRow = { month_start: string };
type CostPeriodStatusRow = {
  period_month: string;
  status: PeriodStatus;
  snapshot_version: number | string;
};

const EFFECTIVE_USAGE_DATE_SQL = `
COALESCE(
  dd_usage.full_date,
  DATE(COALESCE(f.usage_start_time, f.usage_end_time))
)
`;

const EC2_RELATED_FILTER_SQL = `
(
  LOWER(COALESCE(ds.service_name, '')) LIKE '%amazon ec2%'
  OR LOWER(COALESCE(ds.service_name, '')) LIKE '%elastic compute cloud%'
  OR LOWER(COALESCE(ds.service_name, '')) LIKE '%ebs%'
  OR LOWER(COALESCE(ds.service_name, '')) LIKE '%ec2%'
  OR LOWER(COALESCE(f.usage_type, '')) LIKE '%ec2%'
  OR LOWER(COALESCE(f.usage_type, '')) LIKE '%ebs%'
  OR LOWER(COALESCE(f.usage_type, '')) LIKE '%boxusage%'
  OR LOWER(COALESCE(f.usage_type, '')) LIKE '%spotusage%'
  OR LOWER(COALESCE(f.usage_type, '')) LIKE '%dedicatedusage%'
  OR LOWER(COALESCE(f.operation, '')) LIKE '%ec2%'
  OR LOWER(COALESCE(f.operation, '')) LIKE '%runinstances%'
  OR LOWER(COALESCE(f.operation, '')) LIKE '%datatransfer%'
  OR dres.resource_id ~ '^i-[a-z0-9]+$'
  OR dres.resource_name ~ '^i-[a-z0-9]+$'
  OR LOWER(COALESCE(dres.resource_id, '')) LIKE '%:instance/%'
  OR LOWER(COALESCE(dres.resource_name, '')) LIKE '%:instance/%'
)
`;

const PRICING_MODEL_SQL = `
CASE
  WHEN NULLIF(f.savings_plan_arn, '') IS NOT NULL
    OR NULLIF(f.savings_plan_type, '') IS NOT NULL
    OR LOWER(COALESCE(f.pricing_term, '')) LIKE '%savings%'
    OR LOWER(COALESCE(f.purchase_option, '')) LIKE '%savings%'
    THEN 'savings_plan'
  WHEN NULLIF(f.reservation_arn, '') IS NOT NULL
    OR LOWER(COALESCE(f.pricing_term, '')) LIKE '%reserved%'
    OR LOWER(COALESCE(f.purchase_option, '')) LIKE '%reserved%'
    THEN 'reserved'
  WHEN LOWER(COALESCE(f.pricing_term, '')) LIKE '%spot%'
    OR LOWER(COALESCE(f.purchase_option, '')) LIKE '%spot%'
    OR LOWER(COALESCE(f.line_item_type, '')) LIKE '%spot%'
    THEN 'spot'
  WHEN LOWER(COALESCE(f.pricing_term, '')) LIKE '%on demand%'
    OR LOWER(COALESCE(f.purchase_option, '')) LIKE '%on demand%'
    OR LOWER(COALESCE(f.purchase_option, '')) LIKE '%ondemand%'
    THEN 'on_demand'
  ELSE 'other'
END
`;

const CHARGE_CATEGORY_SQL = `
CASE
  WHEN COALESCE(f.tax_cost, 0) > 0
    OR LOWER(COALESCE(f.line_item_type, '')) LIKE '%tax%'
    THEN 'tax'
  WHEN COALESCE(f.refund_amount, 0) > 0
    OR LOWER(COALESCE(f.line_item_type, '')) LIKE '%refund%'
    THEN 'refund'
  WHEN COALESCE(f.credit_amount, 0) > 0
    OR LOWER(COALESCE(f.line_item_type, '')) LIKE '%credit%'
    THEN 'credit'
  WHEN LOWER(COALESCE(f.usage_type, '')) LIKE '%data%'
    AND LOWER(COALESCE(f.usage_type, '')) LIKE '%transfer%'
    OR LOWER(COALESCE(f.operation, '')) LIKE '%datatransfer%'
    OR LOWER(COALESCE(f.line_item_type, '')) LIKE '%data transfer%'
    THEN 'data_transfer'
  WHEN LOWER(COALESCE(f.usage_type, '')) LIKE '%ebs%'
    OR LOWER(COALESCE(f.operation, '')) LIKE '%ebs%'
    OR LOWER(COALESCE(f.usage_type, '')) LIKE '%snapshot%'
    OR LOWER(COALESCE(f.usage_type, '')) LIKE '%volume%'
    OR LOWER(COALESCE(f.usage_type, '')) LIKE '%iops%'
    OR LOWER(COALESCE(f.usage_type, '')) LIKE '%throughput%'
    THEN 'ebs'
  WHEN LOWER(COALESCE(f.line_item_type, '')) IN (
    'usage',
    'discountedusage',
    'savingsplancoveredusage',
    'savingsplannegation'
  )
    OR LOWER(COALESCE(f.operation, '')) LIKE '%runinstances%'
    THEN 'compute'
  ELSE 'other'
END
`;

const toMonthStart = (value: string): string => `${value.slice(0, 7)}-01`;
const toSnapshotVersion = (value: number | string): number => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
};

async function detectAffectedMonths({
  ingestionRunId,
}: {
  ingestionRunId: string;
}): Promise<string[]> {
  const rows = await sequelize.query<MonthRow>(
    `
SELECT DISTINCT
  DATE_TRUNC('month', ${EFFECTIVE_USAGE_DATE_SQL})::DATE AS month_start
FROM fact_cost_line_items f
LEFT JOIN dim_date dd_usage
  ON dd_usage.id = f.usage_date_key
WHERE f.ingestion_run_id = CAST(:ingestionRunId AS BIGINT)
  AND ${EFFECTIVE_USAGE_DATE_SQL} IS NOT NULL
ORDER BY 1 ASC;
`,
    {
      replacements: { ingestionRunId },
      type: QueryTypes.SELECT,
    },
  );

  return rows
    .map((row) => String(row.month_start))
    .map(toMonthStart)
    .filter((month, index, all) => all.indexOf(month) === index);
}

async function ensurePeriodStatusRows({
  tenantId,
  providerId,
  billingSourceId,
  ingestionRunId,
  monthStarts,
}: {
  tenantId: string;
  providerId: string;
  billingSourceId: string;
  ingestionRunId: string;
  monthStarts: string[];
}): Promise<void> {
  for (const monthStart of monthStarts) {
    await sequelize.query(
      `
INSERT INTO cost_period_status (
  tenant_id,
  provider_id,
  billing_source_id,
  period_month,
  status,
  snapshot_version,
  source_ingestion_run_id,
  created_at,
  updated_at
)
VALUES (
  CAST(:tenantId AS UUID),
  CAST(:providerId AS BIGINT),
  CAST(:billingSourceId AS BIGINT),
  CAST(:periodMonth AS DATE),
  'open',
  1,
  CAST(:ingestionRunId AS BIGINT),
  NOW(),
  NOW()
)
ON CONFLICT (tenant_id, provider_id, billing_source_id, period_month)
DO NOTHING;
`,
      {
        replacements: {
          tenantId,
          providerId,
          billingSourceId,
          periodMonth: monthStart,
          ingestionRunId,
        },
        type: QueryTypes.INSERT,
      },
    );
  }
}

async function getPeriodStatusRow({
  tenantId,
  providerId,
  billingSourceId,
  periodMonth,
}: {
  tenantId: string;
  providerId: string;
  billingSourceId: string;
  periodMonth: string;
}): Promise<CostPeriodStatusRow | null> {
  const rows = await sequelize.query<CostPeriodStatusRow>(
    `
SELECT
  period_month,
  status,
  snapshot_version
FROM cost_period_status
WHERE tenant_id = CAST(:tenantId AS UUID)
  AND provider_id = CAST(:providerId AS BIGINT)
  AND billing_source_id = CAST(:billingSourceId AS BIGINT)
  AND period_month = CAST(:periodMonth AS DATE)
LIMIT 1;
`,
    {
      replacements: {
        tenantId,
        providerId,
        billingSourceId,
        periodMonth,
      },
      type: QueryTypes.SELECT,
    },
  );

  return rows[0] ?? null;
}

async function rebuildEc2DailyHistoryForMonth({
  transaction,
  monthStart,
  tenantId,
  providerId,
  billingSourceId,
  ingestionRunId,
  snapshotVersion,
}: {
  transaction: Transaction;
  monthStart: string;
  tenantId: string;
  providerId: string;
  billingSourceId: string;
  ingestionRunId: string;
  snapshotVersion: number;
}): Promise<void> {
  await sequelize.query(
    `
DELETE FROM ec2_cost_history_daily
WHERE tenant_id = CAST(:tenantId AS UUID)
  AND provider_id = CAST(:providerId AS BIGINT)
  AND billing_source_id = CAST(:billingSourceId AS BIGINT)
  AND month_start = CAST(:monthStart AS DATE);
`,
    {
      replacements: { tenantId, providerId, billingSourceId, monthStart },
      type: QueryTypes.DELETE,
      transaction,
    },
  );

  await sequelize.query(
    `
INSERT INTO ec2_cost_history_daily (
  usage_date,
  month_start,
  tenant_id,
  provider_id,
  billing_source_id,
  cloud_connection_id,
  service_key,
  sub_account_key,
  region_key,
  resource_key,
  instance_id,
  instance_type,
  state,
  pricing_model,
  charge_category,
  line_item_type,
  billed_cost,
  effective_cost,
  list_cost,
  usage_quantity,
  currency_code,
  ingestion_run_id,
  snapshot_version,
  created_at,
  updated_at
)
SELECT
  x.usage_date,
  DATE_TRUNC('month', x.usage_date)::DATE AS month_start,
  x.tenant_id,
  x.provider_id,
  x.billing_source_id,
  x.cloud_connection_id,
  x.service_key,
  x.sub_account_key,
  x.region_key,
  x.resource_key,
  x.instance_id,
  x.instance_type,
  x.state,
  x.pricing_model,
  x.charge_category,
  x.line_item_type,
  COALESCE(SUM(x.billed_cost), 0)::DECIMAL(18,6) AS billed_cost,
  COALESCE(SUM(x.effective_cost), 0)::DECIMAL(18,6) AS effective_cost,
  COALESCE(SUM(x.list_cost), 0)::DECIMAL(18,6) AS list_cost,
  COALESCE(SUM(x.usage_quantity), 0)::DECIMAL(18,6) AS usage_quantity,
  x.currency_code,
  CAST(:ingestionRunId AS BIGINT),
  CAST(:snapshotVersion AS INTEGER),
  NOW(),
  NOW()
FROM (
  WITH ranked_facts AS (
    SELECT
      f.*,
      COALESCE(
        dd_usage.full_date,
        DATE(COALESCE(f.usage_start_time, f.usage_end_time))
      ) AS effective_usage_date,
      ROW_NUMBER() OVER (
        PARTITION BY
          f.tenant_id,
          f.provider_id,
          f.billing_source_id,
          COALESCE(dd_usage.full_date, DATE(COALESCE(f.usage_start_time, f.usage_end_time))),
          COALESCE(f.service_key, -1),
          COALESCE(f.sub_account_key, -1),
          COALESCE(f.region_key, -1),
          COALESCE(f.resource_key, -1),
          COALESCE(f.billing_account_key, -1),
          COALESCE(f.usage_type, ''),
          COALESCE(f.operation, ''),
          COALESCE(f.line_item_type, ''),
          COALESCE(f.pricing_term, ''),
          COALESCE(f.purchase_option, ''),
          COALESCE(f.reservation_arn, ''),
          COALESCE(f.savings_plan_arn, ''),
          COALESCE(f.savings_plan_type, ''),
          COALESCE(f.billed_cost, 0),
          COALESCE(f.effective_cost, 0),
          COALESCE(f.list_cost, 0),
          COALESCE(f.consumed_quantity, 0),
          COALESCE(f.usage_start_time, f.usage_end_time)
        ORDER BY
          f.ingestion_run_id DESC NULLS LAST,
          f.id DESC
      ) AS dedupe_rank
    FROM fact_cost_line_items f
    LEFT JOIN dim_date dd_usage
      ON dd_usage.id = f.usage_date_key
    WHERE f.tenant_id = CAST(:tenantId AS UUID)
      AND f.provider_id = CAST(:providerId AS BIGINT)
      AND f.billing_source_id = CAST(:billingSourceId AS BIGINT)
      AND COALESCE(dd_usage.full_date, DATE(COALESCE(f.usage_start_time, f.usage_end_time))) >= CAST(:monthStart AS DATE)
      AND COALESCE(dd_usage.full_date, DATE(COALESCE(f.usage_start_time, f.usage_end_time))) < (CAST(:monthStart AS DATE) + INTERVAL '1 month')
  )
  SELECT
    f.effective_usage_date AS usage_date,
    f.tenant_id,
    f.provider_id,
    f.billing_source_id,
    bs.cloud_connection_id,
    f.service_key,
    f.sub_account_key,
    f.region_key,
    f.resource_key,
    COALESCE(
      NULLIF(inv.instance_id, ''),
      CASE
        WHEN dres.resource_id ~ '^i-[a-z0-9]+' THEN dres.resource_id
        WHEN dres.resource_name ~ '^i-[a-z0-9]+' THEN dres.resource_name
        ELSE NULL
      END
    ) AS instance_id,
    COALESCE(inv.instance_type, NULL) AS instance_type,
    COALESCE(inv.state, NULL) AS state,
    ${PRICING_MODEL_SQL} AS pricing_model,
    ${CHARGE_CATEGORY_SQL} AS charge_category,
    COALESCE(f.line_item_type, 'Unknown') AS line_item_type,
    COALESCE(f.billed_cost, 0) AS billed_cost,
    COALESCE(f.effective_cost, 0) AS effective_cost,
    COALESCE(f.list_cost, 0) AS list_cost,
    COALESCE(f.consumed_quantity, 0) AS usage_quantity,
    COALESCE(NULLIF(dba.billing_currency, ''), 'USD') AS currency_code
  FROM ranked_facts f
  LEFT JOIN dim_service ds
    ON ds.id = f.service_key
  LEFT JOIN dim_resource dres
    ON dres.id = f.resource_key
  LEFT JOIN dim_billing_account dba
    ON dba.id = f.billing_account_key
  LEFT JOIN billing_sources bs
    ON bs.id = f.billing_source_id
  LEFT JOIN LATERAL (
    SELECT
      eis.instance_id,
      eis.instance_type,
      eis.state
    FROM ec2_instance_inventory_snapshots eis
    WHERE eis.tenant_id = f.tenant_id
      AND eis.provider_id = f.provider_id
      AND (
        (f.resource_key IS NOT NULL AND eis.resource_key = f.resource_key)
        OR (
          dres.resource_id ~ '^i-[a-z0-9]+'
          AND eis.instance_id = dres.resource_id
        )
      )
    ORDER BY eis.is_current DESC, eis.discovered_at DESC, eis.updated_at DESC
    LIMIT 1
  ) inv ON TRUE
  WHERE f.dedupe_rank = 1
    AND ${EC2_RELATED_FILTER_SQL}
) x
GROUP BY
  x.usage_date,
  x.tenant_id,
  x.provider_id,
  x.billing_source_id,
  x.cloud_connection_id,
  x.service_key,
  x.sub_account_key,
  x.region_key,
  x.resource_key,
  x.instance_id,
  x.instance_type,
  x.state,
  x.pricing_model,
  x.charge_category,
  x.line_item_type,
  x.currency_code;
`,
    {
      replacements: {
        monthStart,
        tenantId,
        providerId,
        billingSourceId,
        ingestionRunId,
        snapshotVersion,
      },
      type: QueryTypes.INSERT,
      transaction,
    },
  );
}

async function rebuildEc2MonthlyHistoryForMonth({
  transaction,
  monthStart,
  tenantId,
  providerId,
  billingSourceId,
  ingestionRunId,
  snapshotVersion,
  status,
}: {
  transaction: Transaction;
  monthStart: string;
  tenantId: string;
  providerId: string;
  billingSourceId: string;
  ingestionRunId: string;
  snapshotVersion: number;
  status: PeriodStatus;
}): Promise<void> {
  await sequelize.query(
    `
DELETE FROM ec2_cost_history_monthly
WHERE tenant_id = CAST(:tenantId AS UUID)
  AND provider_id = CAST(:providerId AS BIGINT)
  AND billing_source_id = CAST(:billingSourceId AS BIGINT)
  AND month_start = CAST(:monthStart AS DATE);
`,
    {
      replacements: { tenantId, providerId, billingSourceId, monthStart },
      type: QueryTypes.DELETE,
      transaction,
    },
  );

  await sequelize.query(
    `
INSERT INTO ec2_cost_history_monthly (
  month_start,
  tenant_id,
  provider_id,
  billing_source_id,
  cloud_connection_id,
  service_key,
  sub_account_key,
  region_key,
  resource_key,
  instance_id,
  instance_type,
  state,
  pricing_model,
  charge_category,
  billed_cost,
  effective_cost,
  list_cost,
  usage_quantity,
  currency_code,
  is_final,
  finalized_at,
  snapshot_version,
  ingestion_run_id,
  created_at,
  updated_at
)
SELECT
  d.month_start,
  d.tenant_id,
  d.provider_id,
  d.billing_source_id,
  d.cloud_connection_id,
  d.service_key,
  d.sub_account_key,
  d.region_key,
  d.resource_key,
  d.instance_id,
  d.instance_type,
  d.state,
  d.pricing_model,
  d.charge_category,
  COALESCE(SUM(d.billed_cost), 0)::DECIMAL(18,6) AS billed_cost,
  COALESCE(SUM(d.effective_cost), 0)::DECIMAL(18,6) AS effective_cost,
  COALESCE(SUM(d.list_cost), 0)::DECIMAL(18,6) AS list_cost,
  COALESCE(SUM(d.usage_quantity), 0)::DECIMAL(18,6) AS usage_quantity,
  d.currency_code,
  CAST(:isFinal AS BOOLEAN),
  CASE WHEN CAST(:isFinal AS BOOLEAN) THEN NOW() ELSE NULL END,
  CAST(:snapshotVersion AS INTEGER),
  CAST(:ingestionRunId AS BIGINT),
  NOW(),
  NOW()
FROM ec2_cost_history_daily d
WHERE d.tenant_id = CAST(:tenantId AS UUID)
  AND d.provider_id = CAST(:providerId AS BIGINT)
  AND d.billing_source_id = CAST(:billingSourceId AS BIGINT)
  AND d.month_start = CAST(:monthStart AS DATE)
GROUP BY
  d.month_start,
  d.tenant_id,
  d.provider_id,
  d.billing_source_id,
  d.cloud_connection_id,
  d.service_key,
  d.sub_account_key,
  d.region_key,
  d.resource_key,
  d.instance_id,
  d.instance_type,
  d.state,
  d.pricing_model,
  d.charge_category,
  d.currency_code;
`,
    {
      replacements: {
        monthStart,
        tenantId,
        providerId,
        billingSourceId,
        ingestionRunId,
        snapshotVersion,
        isFinal: status === "frozen",
      },
      type: QueryTypes.INSERT,
      transaction,
    },
  );
}

async function updatePeriodRowIngestionContext({
  transaction,
  tenantId,
  providerId,
  billingSourceId,
  periodMonth,
  ingestionRunId,
}: {
  transaction: Transaction;
  tenantId: string;
  providerId: string;
  billingSourceId: string;
  periodMonth: string;
  ingestionRunId: string;
}): Promise<void> {
  await sequelize.query(
    `
UPDATE cost_period_status
SET source_ingestion_run_id = CAST(:ingestionRunId AS BIGINT),
    updated_at = NOW()
WHERE tenant_id = CAST(:tenantId AS UUID)
  AND provider_id = CAST(:providerId AS BIGINT)
  AND billing_source_id = CAST(:billingSourceId AS BIGINT)
  AND period_month = CAST(:periodMonth AS DATE);
`,
    {
      replacements: {
        tenantId,
        providerId,
        billingSourceId,
        periodMonth,
        ingestionRunId,
      },
      type: QueryTypes.UPDATE,
      transaction,
    },
  );
}

async function syncEc2CostHistoryForIngestionRun({
  ingestionRunId,
  tenantId,
  providerId,
  billingSourceId,
  correctionMode = false,
}: SyncEc2CostHistoryForIngestionRunParams): Promise<{
  affectedMonths: string[];
  rebuiltMonths: string[];
  skippedMonths: Array<{ monthStart: string; status: PeriodStatus }>;
}> {
  const normalized = {
    ingestionRunId: String(ingestionRunId),
    tenantId: String(tenantId),
    providerId: String(providerId),
    billingSourceId: String(billingSourceId),
  };

  const affectedMonths = await detectAffectedMonths({
    ingestionRunId: normalized.ingestionRunId,
  });

  if (affectedMonths.length === 0) {
    return { affectedMonths: [], rebuiltMonths: [], skippedMonths: [] };
  }

  await ensurePeriodStatusRows({
    tenantId: normalized.tenantId,
    providerId: normalized.providerId,
    billingSourceId: normalized.billingSourceId,
    ingestionRunId: normalized.ingestionRunId,
    monthStarts: affectedMonths,
  });

  const rebuiltMonths: string[] = [];
  const skippedMonths: Array<{ monthStart: string; status: PeriodStatus }> = [];

  for (const monthStart of affectedMonths) {
    const periodStatus = await getPeriodStatusRow({
      tenantId: normalized.tenantId,
      providerId: normalized.providerId,
      billingSourceId: normalized.billingSourceId,
      periodMonth: monthStart,
    });

    const status = periodStatus?.status ?? "open";
    const snapshotVersion = toSnapshotVersion(periodStatus?.snapshot_version ?? 1);
    const canRebuild = status === "open" || (correctionMode && (status === "adjusted" || status === "frozen"));
    if (!canRebuild) {
      skippedMonths.push({ monthStart, status });
      continue;
    }

    await sequelize.transaction(async (transaction) => {
      await rebuildEc2DailyHistoryForMonth({
        transaction,
        monthStart,
        tenantId: normalized.tenantId,
        providerId: normalized.providerId,
        billingSourceId: normalized.billingSourceId,
        ingestionRunId: normalized.ingestionRunId,
        snapshotVersion,
      });

      await rebuildEc2MonthlyHistoryForMonth({
        transaction,
        monthStart,
        tenantId: normalized.tenantId,
        providerId: normalized.providerId,
        billingSourceId: normalized.billingSourceId,
        ingestionRunId: normalized.ingestionRunId,
        snapshotVersion,
        status,
      });

      await updatePeriodRowIngestionContext({
        transaction,
        tenantId: normalized.tenantId,
        providerId: normalized.providerId,
        billingSourceId: normalized.billingSourceId,
        periodMonth: monthStart,
        ingestionRunId: normalized.ingestionRunId,
      });
    });

    rebuiltMonths.push(monthStart);
  }

  return {
    affectedMonths,
    rebuiltMonths,
    skippedMonths,
  };
}

async function markCostPeriodFrozen({
  tenantId,
  providerId,
  billingSourceId,
  periodMonth,
  notes,
}: {
  tenantId: string;
  providerId: string | number;
  billingSourceId: string | number;
  periodMonth: string;
  notes?: string | null;
}): Promise<void> {
  await sequelize.query(
    `
UPDATE cost_period_status
SET status = 'frozen',
    closed_at = NOW(),
    notes = :notes,
    updated_at = NOW()
WHERE tenant_id = CAST(:tenantId AS UUID)
  AND provider_id = CAST(:providerId AS BIGINT)
  AND billing_source_id = CAST(:billingSourceId AS BIGINT)
  AND period_month = CAST(:periodMonth AS DATE);

UPDATE ec2_cost_history_monthly
SET is_final = true,
    finalized_at = NOW(),
    updated_at = NOW()
WHERE tenant_id = CAST(:tenantId AS UUID)
  AND provider_id = CAST(:providerId AS BIGINT)
  AND billing_source_id = CAST(:billingSourceId AS BIGINT)
  AND month_start = CAST(:periodMonth AS DATE);
`,
    {
      replacements: {
        tenantId,
        providerId: String(providerId),
        billingSourceId: String(billingSourceId),
        periodMonth: toMonthStart(periodMonth),
        notes: notes ?? null,
      },
      type: QueryTypes.RAW,
    },
  );
}

async function markCostPeriodAdjusted({
  tenantId,
  providerId,
  billingSourceId,
  periodMonth,
  notes,
  incrementSnapshotVersion = true,
}: {
  tenantId: string;
  providerId: string | number;
  billingSourceId: string | number;
  periodMonth: string;
  notes?: string | null;
  incrementSnapshotVersion?: boolean;
}): Promise<void> {
  await sequelize.query(
    `
UPDATE cost_period_status
SET status = 'adjusted',
    snapshot_version = CASE
      WHEN CAST(:incrementSnapshotVersion AS BOOLEAN) THEN COALESCE(snapshot_version, 1) + 1
      ELSE COALESCE(snapshot_version, 1)
    END,
    notes = :notes,
    updated_at = NOW()
WHERE tenant_id = CAST(:tenantId AS UUID)
  AND provider_id = CAST(:providerId AS BIGINT)
  AND billing_source_id = CAST(:billingSourceId AS BIGINT)
  AND period_month = CAST(:periodMonth AS DATE);
`,
    {
      replacements: {
        tenantId,
        providerId: String(providerId),
        billingSourceId: String(billingSourceId),
        periodMonth: toMonthStart(periodMonth),
        notes: notes ?? null,
        incrementSnapshotVersion,
      },
      type: QueryTypes.UPDATE,
    },
  );
}

export { markCostPeriodAdjusted, markCostPeriodFrozen, syncEc2CostHistoryForIngestionRun };
