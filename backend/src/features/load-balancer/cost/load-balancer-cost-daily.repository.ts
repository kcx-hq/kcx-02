import { QueryTypes } from "sequelize";

import { sequelize } from "../../../models/index.js";

export type LoadBalancerCostDailyRowUpsertInput = {
  cloudConnectionId: string | null;
  accountId: string;
  region: string;
  loadBalancerArn: string;
  usageDate: string;
  totalCost: string | number;
  fixedCost: string | number;
  lcuCost: string | number;
  dataProcessingCost: string | number;
  processedBytesGb: string | number;
  usageQuantity: string | number;
  currencyCode: string;
  lineItemCount: number;
};

export type LoadBalancerCostDailyQueryFilters = {
  startDate: string;
  endDate: string;
  cloudConnectionId?: string | null;
  accountId?: string | null;
  region?: string | null;
  loadBalancerArn?: string | null;
};

export type LoadBalancerCostDailyRow = {
  id: string;
  cloudConnectionId: string | null;
  accountId: string;
  region: string;
  loadBalancerArn: string;
  usageDate: string;
  totalCost: string;
  fixedCost: string;
  lcuCost: string;
  dataProcessingCost: string;
  processedBytesGb: string;
  usageQuantity: string;
  currencyCode: string;
  lineItemCount: number;
  createdAt: Date;
  updatedAt: Date;
};

const chunk = <T>(items: T[], size: number): T[][] => {
  if (size <= 0) return [items];
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
};

const toOptionalTrimmed = (value: string | null | undefined): string | null => {
  const trimmed = String(value ?? "").trim();
  return trimmed.length > 0 ? trimmed : null;
};

const toDateOnly = (value: string): string => String(value ?? "").trim();

type DeletedCountRow = { deleted_rows: number | string };

export class LoadBalancerCostDailyRepository {
  async upsertDailyRows(
    rows: LoadBalancerCostDailyRowUpsertInput[],
    { chunkSize = 300 }: { chunkSize?: number } = {},
  ): Promise<number> {
    if (!Array.isArray(rows) || rows.length === 0) return 0;

    let affected = 0;
    for (const batch of chunk(rows, chunkSize)) {
      const { sql, bind } = buildUpsertSql(batch);
      await sequelize.query(sql, { bind, type: QueryTypes.INSERT });
      affected += batch.length;
    }
    return affected;
  }

  async getByDateRange(filters: LoadBalancerCostDailyQueryFilters): Promise<LoadBalancerCostDailyRow[]> {
    const rows = await sequelize.query<LoadBalancerCostDailyRow>(
      `
SELECT
  id::text AS "id",
  cloud_connection_id::text AS "cloudConnectionId",
  account_id AS "accountId",
  region AS "region",
  load_balancer_arn AS "loadBalancerArn",
  usage_date::text AS "usageDate",
  total_cost::text AS "totalCost",
  fixed_cost::text AS "fixedCost",
  lcu_cost::text AS "lcuCost",
  data_processing_cost::text AS "dataProcessingCost",
  processed_bytes_gb::text AS "processedBytesGb",
  usage_quantity::text AS "usageQuantity",
  currency_code AS "currencyCode",
  line_item_count AS "lineItemCount",
  created_at AS "createdAt",
  updated_at AS "updatedAt"
FROM load_balancer_cost_daily
WHERE usage_date >= CAST(:startDate AS date)
  AND usage_date <= CAST(:endDate AS date)
  AND (CAST(:cloudConnectionId AS uuid) IS NULL OR cloud_connection_id = CAST(:cloudConnectionId AS uuid))
  AND (:accountId::text IS NULL OR account_id = :accountId::text)
  AND (:region::text IS NULL OR region = :region::text)
  AND (:loadBalancerArn::text IS NULL OR load_balancer_arn = :loadBalancerArn::text)
ORDER BY usage_date ASC, account_id ASC, region ASC, load_balancer_arn ASC;
      `,
      {
        replacements: {
          startDate: toDateOnly(filters.startDate),
          endDate: toDateOnly(filters.endDate),
          cloudConnectionId: toOptionalTrimmed(filters.cloudConnectionId),
          accountId: toOptionalTrimmed(filters.accountId),
          region: toOptionalTrimmed(filters.region),
          loadBalancerArn: toOptionalTrimmed(filters.loadBalancerArn),
        },
        type: QueryTypes.SELECT,
      },
    );

    return rows;
  }

  async deleteByDateRange(filters: LoadBalancerCostDailyQueryFilters): Promise<number> {
    const rows = await sequelize.query<DeletedCountRow>(
      `
WITH deleted AS (
  DELETE FROM load_balancer_cost_daily
  WHERE usage_date >= CAST(:startDate AS date)
    AND usage_date <= CAST(:endDate AS date)
    AND (CAST(:cloudConnectionId AS uuid) IS NULL OR cloud_connection_id = CAST(:cloudConnectionId AS uuid))
    AND (:accountId::text IS NULL OR account_id = :accountId::text)
    AND (:region::text IS NULL OR region = :region::text)
    AND (:loadBalancerArn::text IS NULL OR load_balancer_arn = :loadBalancerArn::text)
  RETURNING 1
)
SELECT COUNT(*)::int AS deleted_rows
FROM deleted;
      `,
      {
        replacements: {
          startDate: toDateOnly(filters.startDate),
          endDate: toDateOnly(filters.endDate),
          cloudConnectionId: toOptionalTrimmed(filters.cloudConnectionId),
          accountId: toOptionalTrimmed(filters.accountId),
          region: toOptionalTrimmed(filters.region),
          loadBalancerArn: toOptionalTrimmed(filters.loadBalancerArn),
        },
        type: QueryTypes.SELECT,
      },
    );

    return Number(rows[0]?.deleted_rows ?? 0) || 0;
  }
}

const buildUpsertSql = (
  rows: LoadBalancerCostDailyRowUpsertInput[],
): { sql: string; bind: unknown[] } => {
  const columns = [
    "cloud_connection_id",
    "account_id",
    "region",
    "load_balancer_arn",
    "usage_date",
    "total_cost",
    "fixed_cost",
    "lcu_cost",
    "data_processing_cost",
    "processed_bytes_gb",
    "usage_quantity",
    "currency_code",
    "line_item_count",
    "created_at",
    "updated_at",
  ] as const;

  const bind: unknown[] = [];
  const valuesSql: string[] = [];
  let p = 1;

  for (const row of rows) {
    const placeholders: string[] = [];
    const push = (value: unknown) => {
      bind.push(value);
      placeholders.push(`$${p}`);
      p += 1;
    };

    push(row.cloudConnectionId);
    push(row.accountId);
    push(row.region);
    push(row.loadBalancerArn);
    push(row.usageDate);
    push(row.totalCost);
    push(row.fixedCost);
    push(row.lcuCost);
    push(row.dataProcessingCost);
    push(row.processedBytesGb);
    push(row.usageQuantity);
    push(row.currencyCode);
    push(row.lineItemCount);
    push(new Date());
    push(new Date());

    valuesSql.push(`(${placeholders.join(", ")})`);
  }

  const sql = `
    INSERT INTO load_balancer_cost_daily (${columns.join(", ")})
    VALUES
      ${valuesSql.join(",\n      ")}
    ON CONFLICT (cloud_connection_id, account_id, region, load_balancer_arn, usage_date)
    DO UPDATE SET
      total_cost = EXCLUDED.total_cost,
      fixed_cost = EXCLUDED.fixed_cost,
      lcu_cost = EXCLUDED.lcu_cost,
      data_processing_cost = EXCLUDED.data_processing_cost,
      processed_bytes_gb = EXCLUDED.processed_bytes_gb,
      usage_quantity = EXCLUDED.usage_quantity,
      currency_code = EXCLUDED.currency_code,
      line_item_count = EXCLUDED.line_item_count,
      updated_at = EXCLUDED.updated_at;
  `;

  return { sql, bind };
};

