import { QueryTypes } from "sequelize";

import { sequelize } from "../../../../models/index.js";
import type { EbsVolumeUtilizationHourlyRow } from "./ebs-volume-metrics-sync.types.js";

const chunk = <T>(items: T[], size: number): T[][] => {
  if (size <= 0) return [items];
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
};

export class EbsVolumeUtilizationHourlyRepository {
  async upsertMany(rows: EbsVolumeUtilizationHourlyRow[], { chunkSize = 200 }: { chunkSize?: number } = {}): Promise<number> {
    if (rows.length === 0) return 0;

    let affected = 0;
    for (const batch of chunk(rows, chunkSize)) {
      const { sql, bind } = buildUpsertSql(batch);
      await sequelize.query(sql, { bind, type: QueryTypes.INSERT });
      affected += batch.length;
    }

    return affected;
  }
}

const buildUpsertSql = (rows: EbsVolumeUtilizationHourlyRow[]): { sql: string; bind: unknown[] } => {
  const columns = [
    "tenant_id",
    "cloud_connection_id",
    "provider_id",
    "volume_id",
    "hour_start",
    "usage_date",
    "resource_key",
    "region_key",
    "sub_account_key",
    "read_bytes",
    "write_bytes",
    "read_ops",
    "write_ops",
    "queue_length_max",
    "burst_balance_avg",
    "idle_time_avg",
    "sample_count",
    "metric_source",
    "created_at",
    "updated_at",
  ] as const;

  const bind: unknown[] = [];
  const valuesSql: string[] = [];
  let paramIndex = 1;

  for (const row of rows) {
    const placeholders: string[] = [];
    const push = (value: unknown) => {
      bind.push(value);
      placeholders.push(`$${paramIndex}`);
      paramIndex += 1;
    };

    push(row.tenantId);
    push(row.cloudConnectionId);
    push(row.providerId);
    push(row.volumeId);
    push(row.hourStart);
    push(row.usageDate);
    push(row.resourceKey);
    push(row.regionKey);
    push(row.subAccountKey);
    push(row.readBytes);
    push(row.writeBytes);
    push(row.readOps);
    push(row.writeOps);
    push(row.queueLengthMax);
    push(row.burstBalanceAvg);
    push(row.idleTimeAvg);
    push(row.sampleCount);
    push(row.metricSource);
    push(row.createdAt);
    push(row.updatedAt);

    valuesSql.push(`(${placeholders.join(", ")})`);
  }

  const sql = `
    INSERT INTO ebs_volume_utilization_hourly (${columns.join(", ")})
    VALUES
      ${valuesSql.join(",\n      ")}
    ON CONFLICT (tenant_id, volume_id, hour_start)
    DO UPDATE SET
      cloud_connection_id = COALESCE(EXCLUDED.cloud_connection_id, ebs_volume_utilization_hourly.cloud_connection_id),
      provider_id = COALESCE(EXCLUDED.provider_id, ebs_volume_utilization_hourly.provider_id),
      usage_date = EXCLUDED.usage_date,
      resource_key = COALESCE(EXCLUDED.resource_key, ebs_volume_utilization_hourly.resource_key),
      region_key = COALESCE(EXCLUDED.region_key, ebs_volume_utilization_hourly.region_key),
      sub_account_key = COALESCE(EXCLUDED.sub_account_key, ebs_volume_utilization_hourly.sub_account_key),
      read_bytes = COALESCE(EXCLUDED.read_bytes, ebs_volume_utilization_hourly.read_bytes),
      write_bytes = COALESCE(EXCLUDED.write_bytes, ebs_volume_utilization_hourly.write_bytes),
      read_ops = COALESCE(EXCLUDED.read_ops, ebs_volume_utilization_hourly.read_ops),
      write_ops = COALESCE(EXCLUDED.write_ops, ebs_volume_utilization_hourly.write_ops),
      queue_length_max = COALESCE(EXCLUDED.queue_length_max, ebs_volume_utilization_hourly.queue_length_max),
      burst_balance_avg = COALESCE(EXCLUDED.burst_balance_avg, ebs_volume_utilization_hourly.burst_balance_avg),
      idle_time_avg = COALESCE(EXCLUDED.idle_time_avg, ebs_volume_utilization_hourly.idle_time_avg),
      sample_count = COALESCE(EXCLUDED.sample_count, ebs_volume_utilization_hourly.sample_count),
      metric_source = COALESCE(EXCLUDED.metric_source, ebs_volume_utilization_hourly.metric_source),
      updated_at = EXCLUDED.updated_at;
  `;

  return { sql, bind };
};
