import { QueryTypes } from "sequelize";

import { sequelize } from "../../../../models/index.js";

type PopulateRangeInput = {
  cloudConnectionId: string;
  tenantId?: string | null;
  providerId?: string | null;
  startDate: string; // YYYY-MM-DD (UTC)
  endDate: string; // YYYY-MM-DD (UTC)
  source?: string;
};

export type InstanceDailyStatePopulateResult = {
  inventorySourceRows: number;
  factRowsUpserted: number;
};

const normalizeTrim = (value: string | null | undefined): string => String(value ?? "").trim();

export class Ec2InstanceDailyStateRepository {
  async populateFromInventorySnapshots(input: PopulateRangeInput): Promise<InstanceDailyStatePopulateResult> {
    const cloudConnectionId = normalizeTrim(input.cloudConnectionId);
    if (!cloudConnectionId) {
      throw new Error("cloudConnectionId is required for EC2 instance daily state population");
    }

    const source = normalizeTrim(input.source ?? "inventory_snapshot") || "inventory_snapshot";
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
    push("discovered_at >= ?::date", input.startDate);
    push("discovered_at < (?::date + INTERVAL '1 day')", input.endDate);

    const whereClause = whereParts.length > 0 ? `WHERE ${whereParts.join(" AND ")}` : "";

    const countRows = await sequelize.query<{ count: string }>(
      `
        SELECT COUNT(*)::text AS count
        FROM ec2_instance_inventory_snapshots
        ${whereClause};
      `,
      {
        bind,
        type: QueryTypes.SELECT,
      },
    );
    const inventorySourceRows = Number(countRows[0]?.count ?? 0) || 0;

    const upsertedRows = await sequelize.query<{ instance_id: string }>(
      `
        WITH latest_by_instance_day AS (
          SELECT DISTINCT ON (eis.instance_id, eis.discovered_at::date)
            eis.tenant_id,
            eis.cloud_connection_id,
            eis.provider_id,
            eis.discovered_at::date AS usage_date,
            eis.instance_id,
            eis.resource_key,
            eis.region_key,
            eis.sub_account_key,
            eis.instance_type,
            eis.state,
            CASE
              WHEN LOWER(COALESCE(eis.state, '')) = 'running' THEN TRUE
              ELSE FALSE
            END AS is_running,
            eis.launch_time,
            eis.deleted_at,
            $${idx}::varchar(50) AS source
          FROM ec2_instance_inventory_snapshots eis
          ${whereClause}
          ORDER BY
            eis.instance_id,
            eis.discovered_at::date,
            eis.discovered_at DESC NULLS LAST,
            eis.updated_at DESC NULLS LAST,
            eis.created_at DESC NULLS LAST
        )
        INSERT INTO fact_ec2_instance_daily (
          tenant_id,
          cloud_connection_id,
          provider_id,
          usage_date,
          instance_id,
          resource_key,
          region_key,
          sub_account_key,
          instance_type,
          state,
          is_running,
          launch_time,
          deleted_at,
          source,
          created_at,
          updated_at
        )
        SELECT
          tenant_id,
          cloud_connection_id,
          provider_id,
          usage_date,
          instance_id,
          resource_key,
          region_key,
          sub_account_key,
          instance_type,
          state,
          is_running,
          launch_time,
          deleted_at,
          source,
          NOW(),
          NOW()
        FROM latest_by_instance_day
        ON CONFLICT (instance_id, usage_date)
        DO UPDATE SET
          tenant_id = EXCLUDED.tenant_id,
          cloud_connection_id = EXCLUDED.cloud_connection_id,
          provider_id = EXCLUDED.provider_id,
          resource_key = EXCLUDED.resource_key,
          region_key = EXCLUDED.region_key,
          sub_account_key = EXCLUDED.sub_account_key,
          instance_type = EXCLUDED.instance_type,
          state = EXCLUDED.state,
          is_running = EXCLUDED.is_running,
          launch_time = EXCLUDED.launch_time,
          deleted_at = EXCLUDED.deleted_at,
          source = EXCLUDED.source,
          updated_at = NOW()
        RETURNING instance_id;
      `,
      {
        bind: [...bind, source],
        type: QueryTypes.SELECT,
      },
    );

    return {
      inventorySourceRows,
      factRowsUpserted: upsertedRows.length,
    };
  }
}
