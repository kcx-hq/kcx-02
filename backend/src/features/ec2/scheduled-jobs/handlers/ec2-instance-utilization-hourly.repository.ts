import { QueryTypes } from "sequelize";

import { sequelize } from "../../../../models/index.js";
import type { UtilizationHourlyRow } from "./ec2-metrics-sync.types.js";

const chunk = <T>(items: T[], size: number): T[][] => {
  if (size <= 0) return [items];
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
};

export class Ec2InstanceUtilizationHourlyRepository {
  async upsertMany(rows: UtilizationHourlyRow[], { chunkSize = 200 }: { chunkSize?: number } = {}): Promise<number> {
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

const buildUpsertSql = (rows: UtilizationHourlyRow[]): { sql: string; bind: unknown[] } => {
  const columns = [
    "tenant_id",
    "cloud_connection_id",
    "provider_id",
    "instance_id",
    "hour_start",
    "usage_date",
    "metric_source",
    "cpu_avg",
    "cpu_max",
    "cpu_min",
    "network_in_bytes",
    "network_out_bytes",
    "network_packets_in",
    "network_packets_out",
    "disk_read_bytes",
    "disk_write_bytes",
    "disk_read_ops",
    "disk_write_ops",
    "status_check_failed_max",
    "status_check_failed_instance_max",
    "status_check_failed_system_max",
    "ebs_read_bytes",
    "ebs_write_bytes",
    "ebs_read_ops",
    "ebs_write_ops",
    "ebs_queue_length_max",
    "ebs_idle_time_avg",
    "ebs_burst_balance_avg",
    "sample_count",
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
    push(row.instanceId);
    push(row.hourStart);
    push(row.usageDate);
    push(row.metricSource);
    push(row.cpuAvg);
    push(row.cpuMax);
    push(row.cpuMin);
    push(row.networkInBytes);
    push(row.networkOutBytes);
    push(row.networkPacketsIn);
    push(row.networkPacketsOut);
    push(row.diskReadBytes);
    push(row.diskWriteBytes);
    push(row.diskReadOps);
    push(row.diskWriteOps);
    push(row.statusCheckFailedMax);
    push(row.statusCheckFailedInstanceMax);
    push(row.statusCheckFailedSystemMax);
    push(row.ebsReadBytes);
    push(row.ebsWriteBytes);
    push(row.ebsReadOps);
    push(row.ebsWriteOps);
    push(row.ebsQueueLengthMax);
    push(row.ebsIdleTimeAvg);
    push(row.ebsBurstBalanceAvg);
    push(row.sampleCount);
    push(row.createdAt);
    push(row.updatedAt);

    valuesSql.push(`(${placeholders.join(", ")})`);
  }

  const sql = `
    INSERT INTO ec2_instance_utilization_hourly (${columns.join(", ")})
    VALUES
      ${valuesSql.join(",\n      ")}
    ON CONFLICT (instance_id, hour_start)
    DO UPDATE SET
      tenant_id = COALESCE(EXCLUDED.tenant_id, ec2_instance_utilization_hourly.tenant_id),
      cloud_connection_id = COALESCE(EXCLUDED.cloud_connection_id, ec2_instance_utilization_hourly.cloud_connection_id),
      provider_id = COALESCE(EXCLUDED.provider_id, ec2_instance_utilization_hourly.provider_id),
      usage_date = EXCLUDED.usage_date,
      metric_source = COALESCE(EXCLUDED.metric_source, ec2_instance_utilization_hourly.metric_source),

      cpu_avg = COALESCE(EXCLUDED.cpu_avg, ec2_instance_utilization_hourly.cpu_avg),
      cpu_max = COALESCE(EXCLUDED.cpu_max, ec2_instance_utilization_hourly.cpu_max),
      cpu_min = COALESCE(EXCLUDED.cpu_min, ec2_instance_utilization_hourly.cpu_min),

      network_in_bytes = COALESCE(EXCLUDED.network_in_bytes, ec2_instance_utilization_hourly.network_in_bytes),
      network_out_bytes = COALESCE(EXCLUDED.network_out_bytes, ec2_instance_utilization_hourly.network_out_bytes),
      network_packets_in = COALESCE(EXCLUDED.network_packets_in, ec2_instance_utilization_hourly.network_packets_in),
      network_packets_out = COALESCE(EXCLUDED.network_packets_out, ec2_instance_utilization_hourly.network_packets_out),

      disk_read_bytes = COALESCE(EXCLUDED.disk_read_bytes, ec2_instance_utilization_hourly.disk_read_bytes),
      disk_write_bytes = COALESCE(EXCLUDED.disk_write_bytes, ec2_instance_utilization_hourly.disk_write_bytes),
      disk_read_ops = COALESCE(EXCLUDED.disk_read_ops, ec2_instance_utilization_hourly.disk_read_ops),
      disk_write_ops = COALESCE(EXCLUDED.disk_write_ops, ec2_instance_utilization_hourly.disk_write_ops),

      status_check_failed_max = COALESCE(EXCLUDED.status_check_failed_max, ec2_instance_utilization_hourly.status_check_failed_max),
      status_check_failed_instance_max = COALESCE(EXCLUDED.status_check_failed_instance_max, ec2_instance_utilization_hourly.status_check_failed_instance_max),
      status_check_failed_system_max = COALESCE(EXCLUDED.status_check_failed_system_max, ec2_instance_utilization_hourly.status_check_failed_system_max),

      ebs_read_bytes = COALESCE(EXCLUDED.ebs_read_bytes, ec2_instance_utilization_hourly.ebs_read_bytes),
      ebs_write_bytes = COALESCE(EXCLUDED.ebs_write_bytes, ec2_instance_utilization_hourly.ebs_write_bytes),
      ebs_read_ops = COALESCE(EXCLUDED.ebs_read_ops, ec2_instance_utilization_hourly.ebs_read_ops),
      ebs_write_ops = COALESCE(EXCLUDED.ebs_write_ops, ec2_instance_utilization_hourly.ebs_write_ops),
      ebs_queue_length_max = COALESCE(EXCLUDED.ebs_queue_length_max, ec2_instance_utilization_hourly.ebs_queue_length_max),
      ebs_idle_time_avg = COALESCE(EXCLUDED.ebs_idle_time_avg, ec2_instance_utilization_hourly.ebs_idle_time_avg),
      ebs_burst_balance_avg = COALESCE(EXCLUDED.ebs_burst_balance_avg, ec2_instance_utilization_hourly.ebs_burst_balance_avg),

      sample_count = COALESCE(EXCLUDED.sample_count, ec2_instance_utilization_hourly.sample_count),
      updated_at = EXCLUDED.updated_at;
  `;

  return { sql, bind };
};

