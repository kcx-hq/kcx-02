import { QueryTypes } from "sequelize";

import { sequelize } from "../../models/index.js";
import type { LoadBalancerDailyMetricRow } from "./load-balancer-metrics-fetcher.service.js";

export type LoadBalancerMetricsDailyUpsertInput = LoadBalancerDailyMetricRow;

export type LoadBalancerMetricsDailyQueryFilters = {
  tenantId: string;
  cloudConnectionId: string;
  startDate: string;
  endDate: string;
  loadBalancerArn?: string | null;
};

export type LoadBalancerMetricsDailyRow = {
  id: string;
  cloudConnectionId: string | null;
  accountId: string;
  region: string;
  loadBalancerArn: string;
  metricDate: string;
  requestCount: string;
  processedBytes: string;
  processedGb: string;
  activeConnectionCount: string;
  newConnectionCount: string;
  activeFlowCount: string;
  newFlowCount: string;
  healthyHostCount: string;
  unhealthyHostCount: string;
  targetResponseTimeAvg: string;
  elb5xxCount: string;
  target5xxCount: string;
  tcpTargetResetCount: string;
  lastSyncedAt: Date | null;
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

const toRequiredTrimmed = (value: string | null | undefined, field: string): string => {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) throw new Error(`${field} is required`);
  return trimmed;
};

async function assertTenantCloudConnectionScope(input: {
  tenantId: string;
  cloudConnectionId: string;
}): Promise<void> {
  const rows = await sequelize.query<{ id: string }>(
    `
SELECT id::text AS id
FROM cloud_connections
WHERE id = CAST(:cloudConnectionId AS uuid)
  AND tenant_id = CAST(:tenantId AS uuid)
LIMIT 1;
    `,
    {
      replacements: {
        tenantId: input.tenantId,
        cloudConnectionId: input.cloudConnectionId,
      },
      type: QueryTypes.SELECT,
    },
  );

  if (rows.length === 0) {
    throw new Error("cloud connection is not in tenant scope");
  }
}

export class LoadBalancerMetricsDailyRepository {
  async upsertDailyRows(
    input: {
      tenantId: string;
      cloudConnectionId: string;
      rows: LoadBalancerMetricsDailyUpsertInput[];
    },
    { chunkSize = 300 }: { chunkSize?: number } = {},
  ): Promise<number> {
    const tenantId = toRequiredTrimmed(input.tenantId, "tenantId");
    const cloudConnectionId = toRequiredTrimmed(input.cloudConnectionId, "cloudConnectionId");
    const rows = Array.isArray(input.rows) ? input.rows : [];
    if (rows.length === 0) return 0;

    await assertTenantCloudConnectionScope({ tenantId, cloudConnectionId });

    for (const row of rows) {
      if (toRequiredTrimmed(row.cloudConnectionId, "row.cloudConnectionId") !== cloudConnectionId) {
        throw new Error("row cloudConnectionId mismatch with scoped cloudConnectionId");
      }
    }

    let affected = 0;
    for (const batch of chunk(rows, chunkSize)) {
      const { sql, bind } = buildUpsertSql(batch);
      await sequelize.query(sql, { bind, type: QueryTypes.INSERT });
      affected += batch.length;
    }
    return affected;
  }

  async getByDateRange(filters: LoadBalancerMetricsDailyQueryFilters): Promise<LoadBalancerMetricsDailyRow[]> {
    const tenantId = toRequiredTrimmed(filters.tenantId, "tenantId");
    const cloudConnectionId = toRequiredTrimmed(filters.cloudConnectionId, "cloudConnectionId");
    await assertTenantCloudConnectionScope({ tenantId, cloudConnectionId });

    const rows = await sequelize.query<LoadBalancerMetricsDailyRow>(
      `
SELECT
  m.id::text AS "id",
  m.cloud_connection_id::text AS "cloudConnectionId",
  m.account_id AS "accountId",
  m.region AS "region",
  m.load_balancer_arn AS "loadBalancerArn",
  m.metric_date::text AS "metricDate",
  m.request_count::text AS "requestCount",
  m.processed_bytes::text AS "processedBytes",
  m.processed_gb::text AS "processedGb",
  m.active_connection_count::text AS "activeConnectionCount",
  m.new_connection_count::text AS "newConnectionCount",
  m.active_flow_count::text AS "activeFlowCount",
  m.new_flow_count::text AS "newFlowCount",
  m.healthy_host_count::text AS "healthyHostCount",
  m.unhealthy_host_count::text AS "unhealthyHostCount",
  m.target_response_time_avg::text AS "targetResponseTimeAvg",
  m.elb_5xx_count::text AS "elb5xxCount",
  m.target_5xx_count::text AS "target5xxCount",
  m.tcp_target_reset_count::text AS "tcpTargetResetCount",
  m.last_synced_at AS "lastSyncedAt",
  m.created_at AS "createdAt",
  m.updated_at AS "updatedAt"
FROM load_balancer_metrics_daily m
JOIN cloud_connections cc
  ON cc.id = m.cloud_connection_id
WHERE cc.tenant_id = CAST(:tenantId AS uuid)
  AND m.cloud_connection_id = CAST(:cloudConnectionId AS uuid)
  AND m.metric_date >= CAST(:startDate AS date)
  AND m.metric_date <= CAST(:endDate AS date)
  AND (:loadBalancerArn::text IS NULL OR m.load_balancer_arn = :loadBalancerArn::text)
ORDER BY m.metric_date ASC, m.account_id ASC, m.region ASC, m.load_balancer_arn ASC;
      `,
      {
        replacements: {
          tenantId,
          cloudConnectionId,
          startDate: filters.startDate,
          endDate: filters.endDate,
          loadBalancerArn: toOptionalTrimmed(filters.loadBalancerArn),
        },
        type: QueryTypes.SELECT,
      },
    );

    return rows;
  }
}

const buildUpsertSql = (
  rows: LoadBalancerMetricsDailyUpsertInput[],
): { sql: string; bind: unknown[] } => {
  const columns = [
    "cloud_connection_id",
    "account_id",
    "region",
    "load_balancer_arn",
    "metric_date",
    "request_count",
    "processed_bytes",
    "processed_gb",
    "active_connection_count",
    "new_connection_count",
    "active_flow_count",
    "new_flow_count",
    "healthy_host_count",
    "unhealthy_host_count",
    "target_response_time_avg",
    "elb_5xx_count",
    "target_5xx_count",
    "tcp_target_reset_count",
    "last_synced_at",
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
    push(row.metricDate);
    push(row.requestCount ?? 0);
    push(row.processedBytes ?? 0);
    push(row.processedGb ?? 0);
    push(row.activeConnectionCount ?? 0);
    push(row.newConnectionCount ?? 0);
    push(row.activeFlowCount ?? 0);
    push(row.newFlowCount ?? 0);
    push(row.healthyHostCount ?? 0);
    push(row.unhealthyHostCount ?? 0);
    push(row.targetResponseTimeAvg ?? 0);
    push(row.elb5xxCount ?? 0);
    push(row.target5xxCount ?? 0);
    push(row.tcpTargetResetCount ?? 0);
    push(row.lastSyncedAt ?? null);
    push(new Date());
    push(new Date());

    valuesSql.push(`(${placeholders.join(", ")})`);
  }

  const sql = `
    INSERT INTO load_balancer_metrics_daily (${columns.join(", ")})
    VALUES
      ${valuesSql.join(",\n      ")}
    ON CONFLICT (cloud_connection_id, account_id, region, load_balancer_arn, metric_date)
    DO UPDATE SET
      request_count = EXCLUDED.request_count,
      processed_bytes = EXCLUDED.processed_bytes,
      processed_gb = EXCLUDED.processed_gb,
      active_connection_count = EXCLUDED.active_connection_count,
      new_connection_count = EXCLUDED.new_connection_count,
      active_flow_count = EXCLUDED.active_flow_count,
      new_flow_count = EXCLUDED.new_flow_count,
      healthy_host_count = EXCLUDED.healthy_host_count,
      unhealthy_host_count = EXCLUDED.unhealthy_host_count,
      target_response_time_avg = EXCLUDED.target_response_time_avg,
      elb_5xx_count = EXCLUDED.elb_5xx_count,
      target_5xx_count = EXCLUDED.target_5xx_count,
      tcp_target_reset_count = EXCLUDED.tcp_target_reset_count,
      last_synced_at = EXCLUDED.last_synced_at,
      updated_at = EXCLUDED.updated_at;
  `;

  return { sql, bind };
};

