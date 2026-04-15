import { QueryTypes } from "sequelize";

import { sequelize } from "../../../../models/index.js";

type RollupRangeInput = {
  cloudConnectionId: string;
  tenantId?: string | null;
  providerId?: string | null;
  startDate: string; // YYYY-MM-DD (UTC)
  endDate: string; // YYYY-MM-DD (UTC)
};

export type DailyRollupResult = {
  hourlySourceRows: number;
  dailyRowsUpserted: number;
};

const normalizeTrim = (value: string | null | undefined): string => String(value ?? "").trim();

export class Ec2InstanceUtilizationDailyRepository {
  async rollupFromHourly(input: RollupRangeInput): Promise<DailyRollupResult> {
    const cloudConnectionId = normalizeTrim(input.cloudConnectionId);
    if (!cloudConnectionId) {
      throw new Error("cloudConnectionId is required for daily rollup");
    }

    const whereParts: string[] = [];
    const bind: unknown[] = [];
    let idx = 1;

    const push = (sql: string, value: unknown) => {
      whereParts.push(sql.replace("?", `$${idx}`));
      bind.push(value);
      idx += 1;
    };

    push("cloud_connection_id = ?", cloudConnectionId);
    if (input.tenantId) push("tenant_id = ?", input.tenantId);
    if (input.providerId) push("provider_id = ?", input.providerId);
    push("usage_date >= ?::date", input.startDate);
    push("usage_date <= ?::date", input.endDate);

    const whereClause = whereParts.length > 0 ? `WHERE ${whereParts.join(" AND ")}` : "";

    const countRows = await sequelize.query<{ count: string }>(
      `
        SELECT COUNT(*)::text AS count
        FROM ec2_instance_utilization_hourly
        ${whereClause};
      `,
      {
        bind,
        type: QueryTypes.SELECT,
      },
    );
    const hourlySourceRows = Number(countRows[0]?.count ?? 0) || 0;

    const upserted = await sequelize.query<{ instance_id: string }>(
      `
        INSERT INTO ec2_instance_utilization_daily (
          tenant_id,
          cloud_connection_id,
          provider_id,
          instance_id,
          usage_date,

          cpu_avg,
          cpu_max,
          cpu_min,

          network_in_bytes,
          network_out_bytes,
          network_packets_in,
          network_packets_out,

          disk_read_bytes,
          disk_write_bytes,
          disk_read_ops,
          disk_write_ops,

          status_check_failed_max,
          status_check_failed_instance_max,
          status_check_failed_system_max,

          ebs_read_bytes,
          ebs_write_bytes,
          ebs_read_ops,
          ebs_write_ops,
          ebs_queue_length_max,
          ebs_idle_time_avg,
          ebs_burst_balance_avg,

          sample_count,
          metric_source,

          created_at,
          updated_at
        )
        SELECT
          tenant_id,
          cloud_connection_id,
          provider_id,
          instance_id,
          usage_date,

          AVG(cpu_avg) AS cpu_avg,
          MAX(cpu_max) AS cpu_max,
          MIN(cpu_min) AS cpu_min,

          SUM(network_in_bytes) AS network_in_bytes,
          SUM(network_out_bytes) AS network_out_bytes,
          SUM(network_packets_in) AS network_packets_in,
          SUM(network_packets_out) AS network_packets_out,

          SUM(disk_read_bytes) AS disk_read_bytes,
          SUM(disk_write_bytes) AS disk_write_bytes,
          SUM(disk_read_ops) AS disk_read_ops,
          SUM(disk_write_ops) AS disk_write_ops,

          MAX(status_check_failed_max) AS status_check_failed_max,
          MAX(status_check_failed_instance_max) AS status_check_failed_instance_max,
          MAX(status_check_failed_system_max) AS status_check_failed_system_max,

          SUM(ebs_read_bytes) AS ebs_read_bytes,
          SUM(ebs_write_bytes) AS ebs_write_bytes,
          SUM(ebs_read_ops) AS ebs_read_ops,
          SUM(ebs_write_ops) AS ebs_write_ops,
          MAX(ebs_queue_length_max) AS ebs_queue_length_max,
          AVG(ebs_idle_time_avg) AS ebs_idle_time_avg,
          AVG(ebs_burst_balance_avg) AS ebs_burst_balance_avg,

          COALESCE(SUM(sample_count), COUNT(*)::integer) AS sample_count,
          CASE
            WHEN MIN(metric_source) IS NULL AND MAX(metric_source) IS NULL THEN NULL
            WHEN MIN(metric_source) = MAX(metric_source) THEN MIN(metric_source)
            ELSE 'mixed'
          END AS metric_source,

          NOW() AS created_at,
          NOW() AS updated_at
        FROM ec2_instance_utilization_hourly
        ${whereClause}
        GROUP BY tenant_id, cloud_connection_id, provider_id, instance_id, usage_date
        ON CONFLICT (instance_id, usage_date)
        DO UPDATE SET
          tenant_id = EXCLUDED.tenant_id,
          cloud_connection_id = EXCLUDED.cloud_connection_id,
          provider_id = EXCLUDED.provider_id,

          cpu_avg = EXCLUDED.cpu_avg,
          cpu_max = EXCLUDED.cpu_max,
          cpu_min = EXCLUDED.cpu_min,

          network_in_bytes = EXCLUDED.network_in_bytes,
          network_out_bytes = EXCLUDED.network_out_bytes,
          network_packets_in = EXCLUDED.network_packets_in,
          network_packets_out = EXCLUDED.network_packets_out,

          disk_read_bytes = EXCLUDED.disk_read_bytes,
          disk_write_bytes = EXCLUDED.disk_write_bytes,
          disk_read_ops = EXCLUDED.disk_read_ops,
          disk_write_ops = EXCLUDED.disk_write_ops,

          status_check_failed_max = EXCLUDED.status_check_failed_max,
          status_check_failed_instance_max = EXCLUDED.status_check_failed_instance_max,
          status_check_failed_system_max = EXCLUDED.status_check_failed_system_max,

          ebs_read_bytes = EXCLUDED.ebs_read_bytes,
          ebs_write_bytes = EXCLUDED.ebs_write_bytes,
          ebs_read_ops = EXCLUDED.ebs_read_ops,
          ebs_write_ops = EXCLUDED.ebs_write_ops,
          ebs_queue_length_max = EXCLUDED.ebs_queue_length_max,
          ebs_idle_time_avg = EXCLUDED.ebs_idle_time_avg,
          ebs_burst_balance_avg = EXCLUDED.ebs_burst_balance_avg,

          sample_count = EXCLUDED.sample_count,
          metric_source = EXCLUDED.metric_source,
          updated_at = NOW()
        RETURNING instance_id;
      `,
      {
        bind,
        type: QueryTypes.SELECT,
      },
    );

    return {
      hourlySourceRows,
      dailyRowsUpserted: upserted.length,
    };
  }
}

