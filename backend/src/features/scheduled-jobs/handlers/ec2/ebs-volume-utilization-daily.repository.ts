import { QueryTypes } from "sequelize";

import { sequelize } from "../../../../models/index.js";

type RollupRangeInput = {
  cloudConnectionId: string;
  tenantId?: string | null;
  providerId?: string | null;
  startDate: string; // YYYY-MM-DD (UTC)
  endDate: string; // YYYY-MM-DD (UTC)
};

export type EbsVolumeDailyRollupResult = {
  hourlySourceRows: number;
  dailyRowsUpserted: number;
};

const normalizeTrim = (value: string | null | undefined): string => String(value ?? "").trim();

export class EbsVolumeUtilizationDailyRepository {
  async rollupFromHourly(input: RollupRangeInput): Promise<EbsVolumeDailyRollupResult> {
    const cloudConnectionId = normalizeTrim(input.cloudConnectionId);
    if (!cloudConnectionId) {
      throw new Error("cloudConnectionId is required for EBS volume daily rollup");
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
        FROM ebs_volume_utilization_hourly
        ${whereClause};
      `,
      { bind, type: QueryTypes.SELECT },
    );
    const hourlySourceRows = Number(countRows[0]?.count ?? 0) || 0;

    const upserted = await sequelize.query<{ volume_id: string }>(
      `
        INSERT INTO ebs_volume_utilization_daily (
          tenant_id,
          cloud_connection_id,
          provider_id,
          volume_id,
          usage_date,
          resource_key,
          region_key,
          sub_account_key,
          read_bytes,
          write_bytes,
          read_ops,
          write_ops,
          queue_length_max,
          burst_balance_avg,
          idle_time_avg,
          is_idle_candidate,
          is_underutilized_candidate,
          sample_count,
          metric_source,
          created_at,
          updated_at
        )
        SELECT
          tenant_id,
          cloud_connection_id,
          provider_id,
          volume_id,
          usage_date,
          (ARRAY_AGG(resource_key ORDER BY hour_start DESC) FILTER (WHERE resource_key IS NOT NULL))[1] AS resource_key,
          (ARRAY_AGG(region_key ORDER BY hour_start DESC) FILTER (WHERE region_key IS NOT NULL))[1] AS region_key,
          (ARRAY_AGG(sub_account_key ORDER BY hour_start DESC) FILTER (WHERE sub_account_key IS NOT NULL))[1] AS sub_account_key,
          SUM(read_bytes) AS read_bytes,
          SUM(write_bytes) AS write_bytes,
          SUM(read_ops) AS read_ops,
          SUM(write_ops) AS write_ops,
          MAX(queue_length_max) AS queue_length_max,
          AVG(burst_balance_avg) AS burst_balance_avg,
          AVG(idle_time_avg) AS idle_time_avg,
          NULL::boolean AS is_idle_candidate,
          NULL::boolean AS is_underutilized_candidate,
          COALESCE(SUM(sample_count), COUNT(*)::integer) AS sample_count,
          CASE
            WHEN MIN(metric_source) IS NULL AND MAX(metric_source) IS NULL THEN NULL
            WHEN MIN(metric_source) = MAX(metric_source) THEN MIN(metric_source)
            ELSE 'mixed'
          END AS metric_source,
          NOW() AS created_at,
          NOW() AS updated_at
        FROM ebs_volume_utilization_hourly
        ${whereClause}
        GROUP BY tenant_id, cloud_connection_id, provider_id, volume_id, usage_date
        ON CONFLICT (tenant_id, volume_id, usage_date)
        DO UPDATE SET
          cloud_connection_id = EXCLUDED.cloud_connection_id,
          provider_id = EXCLUDED.provider_id,
          resource_key = COALESCE(EXCLUDED.resource_key, ebs_volume_utilization_daily.resource_key),
          region_key = COALESCE(EXCLUDED.region_key, ebs_volume_utilization_daily.region_key),
          sub_account_key = COALESCE(EXCLUDED.sub_account_key, ebs_volume_utilization_daily.sub_account_key),
          read_bytes = EXCLUDED.read_bytes,
          write_bytes = EXCLUDED.write_bytes,
          read_ops = EXCLUDED.read_ops,
          write_ops = EXCLUDED.write_ops,
          queue_length_max = EXCLUDED.queue_length_max,
          burst_balance_avg = EXCLUDED.burst_balance_avg,
          idle_time_avg = EXCLUDED.idle_time_avg,
          is_idle_candidate = COALESCE(EXCLUDED.is_idle_candidate, ebs_volume_utilization_daily.is_idle_candidate),
          is_underutilized_candidate = COALESCE(EXCLUDED.is_underutilized_candidate, ebs_volume_utilization_daily.is_underutilized_candidate),
          sample_count = EXCLUDED.sample_count,
          metric_source = EXCLUDED.metric_source,
          updated_at = NOW()
        RETURNING volume_id;
      `,
      { bind, type: QueryTypes.SELECT },
    );

    return {
      hourlySourceRows,
      dailyRowsUpserted: upserted.length,
    };
  }
}
