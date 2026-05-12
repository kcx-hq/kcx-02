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

export type InstanceDailyCostPopulateResult = {
  costSourceRows: number;
  factRowsUpserted: number;
};

export type InstanceDailyUsagePopulateResult = {
  usageSourceRows: number;
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
            CASE
              WHEN NULLIF(TRIM(COALESCE(eis.tags_json->>'Name', '')), '') IS NOT NULL THEN TRIM(eis.tags_json->>'Name')
              ELSE NULL
            END AS instance_name,
            eis.instance_type,
            eis.availability_zone,
            CASE
              WHEN LOWER(COALESCE(eis.instance_lifecycle, '')) = 'spot' THEN TRUE
              WHEN NULLIF(TRIM(COALESCE(eis.spot_instance_request_id, '')), '') IS NOT NULL THEN TRUE
              ELSE FALSE
            END AS is_spot,
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
          instance_name,
          instance_type,
          availability_zone,
          is_spot,
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
          instance_name,
          instance_type,
          availability_zone,
          is_spot,
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
          instance_name = EXCLUDED.instance_name,
          instance_type = EXCLUDED.instance_type,
          availability_zone = EXCLUDED.availability_zone,
          is_spot = EXCLUDED.is_spot,
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

  async populateUsageFromCostHistory(input: PopulateRangeInput): Promise<InstanceDailyCostPopulateResult> {
    const cloudConnectionId = normalizeTrim(input.cloudConnectionId);
    if (!cloudConnectionId) {
      throw new Error("cloudConnectionId is required for EC2 instance daily cost population");
    }

    const whereParts: string[] = [];
    const bind: unknown[] = [];
    let idx = 1;

    const push = (sql: string, value: unknown) => {
      whereParts.push(sql.replace("?", `$${idx}`));
      bind.push(value);
      idx += 1;
    };

    push("d.cloud_connection_id = ?", cloudConnectionId);
    if (input.tenantId) push("d.tenant_id = ?", input.tenantId);
    if (input.providerId) push("d.provider_id = ?", input.providerId);
    push("d.usage_date >= ?::date", input.startDate);
    push("d.usage_date <= ?::date", input.endDate);
    push("d.charge_category = ?", "compute");

    const whereClause = [
      ...whereParts,
      "d.instance_id IS NOT NULL",
      "NULLIF(TRIM(d.instance_id), '') IS NOT NULL",
    ].join(" AND ");

    const countRows = await sequelize.query<{ count: string }>(
      `
        SELECT COUNT(*)::text AS count
        FROM ec2_cost_history_daily d
        WHERE ${whereClause};
      `,
      {
        bind,
        type: QueryTypes.SELECT,
      },
    );
    const costSourceRows = Number(countRows[0]?.count ?? 0) || 0;

    const upsertedRows = await sequelize.query<{ instance_id: string }>(
      `
        WITH daily_compute AS (
          SELECT
            d.tenant_id,
            d.cloud_connection_id,
            d.provider_id,
            d.usage_date,
            d.instance_id,
            MIN(d.resource_key) AS resource_key,
            MIN(d.sub_account_key) AS sub_account_key,
            MIN(d.region_key) AS region_key,
            MAX(d.instance_type) FILTER (WHERE NULLIF(TRIM(COALESCE(d.instance_type, '')), '') IS NOT NULL) AS instance_type,
            BOOL_OR(d.pricing_model = 'spot') AS is_spot,
            SUM(COALESCE(d.usage_quantity, 0))::numeric(18,6) AS total_hours,
            SUM(
              CASE
                WHEN COALESCE(d.effective_cost, 0) > 0 THEN d.effective_cost
                ELSE COALESCE(d.billed_cost, 0)
              END
            )::numeric(18,6) AS compute_cost
          FROM ec2_cost_history_daily d
          WHERE ${whereClause}
          GROUP BY
            d.tenant_id,
            d.cloud_connection_id,
            d.provider_id,
            d.usage_date,
            d.instance_id
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
          is_spot,
          total_hours,
          compute_cost,
          source,
          created_at,
          updated_at
        )
        SELECT
          dc.tenant_id,
          dc.cloud_connection_id,
          dc.provider_id,
          dc.usage_date,
          dc.instance_id,
          dc.resource_key,
          dc.region_key,
          dc.sub_account_key,
          dc.instance_type,
          'running'::text AS state,
          CASE WHEN dc.total_hours > 0 THEN TRUE ELSE FALSE END AS is_running,
          dc.is_spot,
          dc.total_hours,
          dc.compute_cost,
          'ec2_compute_cost_history',
          NOW(),
          NOW()
        FROM daily_compute dc
        ON CONFLICT (instance_id, usage_date)
        DO UPDATE SET
          tenant_id = EXCLUDED.tenant_id,
          cloud_connection_id = EXCLUDED.cloud_connection_id,
          provider_id = EXCLUDED.provider_id,
          resource_key = COALESCE(fact_ec2_instance_daily.resource_key, EXCLUDED.resource_key),
          region_key = COALESCE(fact_ec2_instance_daily.region_key, EXCLUDED.region_key),
          sub_account_key = COALESCE(fact_ec2_instance_daily.sub_account_key, EXCLUDED.sub_account_key),
          instance_type = COALESCE(fact_ec2_instance_daily.instance_type, EXCLUDED.instance_type),
          is_spot = COALESCE(fact_ec2_instance_daily.is_spot, FALSE) OR EXCLUDED.is_spot,
          state = COALESCE(fact_ec2_instance_daily.state, EXCLUDED.state),
          is_running = CASE
            WHEN EXCLUDED.total_hours > 0 THEN TRUE
            ELSE fact_ec2_instance_daily.is_running
          END,
          total_hours = EXCLUDED.total_hours,
          compute_cost = EXCLUDED.compute_cost,
          source = COALESCE(fact_ec2_instance_daily.source, EXCLUDED.source),
          updated_at = NOW()
        RETURNING instance_id;
      `,
      {
        bind,
        type: QueryTypes.SELECT,
      },
    );

    return {
      costSourceRows,
      factRowsUpserted: upsertedRows.length,
    };
  }

  async populateUsageFromUtilizationDaily(input: PopulateRangeInput): Promise<InstanceDailyUsagePopulateResult> {
    const cloudConnectionId = normalizeTrim(input.cloudConnectionId);
    if (!cloudConnectionId) {
      throw new Error("cloudConnectionId is required for EC2 instance daily usage population");
    }

    const whereParts: string[] = [];
    const bind: unknown[] = [];
    let idx = 1;

    const push = (sql: string, value: unknown) => {
      whereParts.push(sql.replace("?", `$${idx}`));
      bind.push(value);
      idx += 1;
    };

    push("u.cloud_connection_id = ?", cloudConnectionId);
    if (input.tenantId) push("u.tenant_id = ?", input.tenantId);
    if (input.providerId) push("u.provider_id = ?", input.providerId);
    push("u.usage_date >= ?::date", input.startDate);
    push("u.usage_date <= ?::date", input.endDate);

    const whereClause = [
      ...whereParts,
      "u.instance_id IS NOT NULL",
      "NULLIF(TRIM(u.instance_id), '') IS NOT NULL",
    ].join(" AND ");

    const countRows = await sequelize.query<{ count: string }>(
      `
        SELECT COUNT(*)::text AS count
        FROM ec2_instance_utilization_daily u
        WHERE ${whereClause};
      `,
      {
        bind,
        type: QueryTypes.SELECT,
      },
    );
    const usageSourceRows = Number(countRows[0]?.count ?? 0) || 0;

    const upsertedRows = await sequelize.query<{ instance_id: string }>(
      `
        WITH daily_usage AS (
          SELECT
            u.tenant_id,
            u.cloud_connection_id,
            u.provider_id,
            u.usage_date,
            u.instance_id,
            MIN(COALESCE(u.resource_key, inv.resource_key)) AS resource_key,
            MIN(COALESCE(u.sub_account_key, inv.sub_account_key)) AS sub_account_key,
            MIN(COALESCE(u.region_key, inv.region_key)) AS region_key,
            MAX(inv.instance_type) FILTER (WHERE NULLIF(TRIM(COALESCE(inv.instance_type, '')), '') IS NOT NULL) AS instance_type,
            MAX(inv.availability_zone) FILTER (WHERE NULLIF(TRIM(COALESCE(inv.availability_zone, '')), '') IS NOT NULL) AS availability_zone,
            MAX(inv.instance_name) FILTER (WHERE NULLIF(TRIM(COALESCE(inv.instance_name, '')), '') IS NOT NULL) AS instance_name,
            BOOL_OR(COALESCE(inv.is_spot, FALSE)) AS is_spot,
            SUM(COALESCE(u.sample_count, 0))::numeric(18,6) AS total_hours
          FROM ec2_instance_utilization_daily u
          LEFT JOIN LATERAL (
            SELECT
              eis.resource_key,
              eis.sub_account_key,
              eis.region_key,
              eis.instance_type,
              eis.availability_zone,
              CASE
                WHEN NULLIF(TRIM(COALESCE(eis.tags_json->>'Name', '')), '') IS NOT NULL THEN TRIM(eis.tags_json->>'Name')
                ELSE NULL
              END AS instance_name,
              CASE
                WHEN LOWER(COALESCE(eis.instance_lifecycle, '')) = 'spot' THEN TRUE
                WHEN NULLIF(TRIM(COALESCE(eis.spot_instance_request_id, '')), '') IS NOT NULL THEN TRUE
                ELSE FALSE
              END AS is_spot
            FROM ec2_instance_inventory_snapshots eis
            WHERE eis.cloud_connection_id = u.cloud_connection_id
              AND eis.instance_id = u.instance_id
              AND eis.discovered_at < (u.usage_date::date + INTERVAL '1 day')
            ORDER BY eis.discovered_at DESC NULLS LAST, eis.updated_at DESC NULLS LAST
            LIMIT 1
          ) inv ON TRUE
          WHERE ${whereClause}
          GROUP BY
            u.tenant_id,
            u.cloud_connection_id,
            u.provider_id,
            u.usage_date,
            u.instance_id
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
          instance_name,
          instance_type,
          availability_zone,
          is_spot,
          state,
          is_running,
          total_hours,
          source,
          created_at,
          updated_at
        )
        SELECT
          du.tenant_id,
          du.cloud_connection_id,
          du.provider_id,
          du.usage_date,
          du.instance_id,
          du.resource_key,
          du.region_key,
          du.sub_account_key,
          du.instance_name,
          du.instance_type,
          du.availability_zone,
          du.is_spot,
          'unknown'::text AS state,
          FALSE AS is_running,
          du.total_hours,
          'ec2_utilization_daily',
          NOW(),
          NOW()
        FROM daily_usage du
        ON CONFLICT (instance_id, usage_date)
        DO UPDATE SET
          tenant_id = EXCLUDED.tenant_id,
          cloud_connection_id = EXCLUDED.cloud_connection_id,
          provider_id = EXCLUDED.provider_id,
          resource_key = COALESCE(fact_ec2_instance_daily.resource_key, EXCLUDED.resource_key),
          region_key = COALESCE(fact_ec2_instance_daily.region_key, EXCLUDED.region_key),
          sub_account_key = COALESCE(fact_ec2_instance_daily.sub_account_key, EXCLUDED.sub_account_key),
          instance_name = COALESCE(fact_ec2_instance_daily.instance_name, EXCLUDED.instance_name),
          instance_type = COALESCE(fact_ec2_instance_daily.instance_type, EXCLUDED.instance_type),
          availability_zone = COALESCE(fact_ec2_instance_daily.availability_zone, EXCLUDED.availability_zone),
          is_spot = COALESCE(fact_ec2_instance_daily.is_spot, FALSE) OR COALESCE(EXCLUDED.is_spot, FALSE),
          state = COALESCE(fact_ec2_instance_daily.state, EXCLUDED.state),
          is_running = fact_ec2_instance_daily.is_running,
          total_hours = GREATEST(COALESCE(fact_ec2_instance_daily.total_hours, 0), EXCLUDED.total_hours),
          source = COALESCE(fact_ec2_instance_daily.source, EXCLUDED.source),
          updated_at = NOW()
        RETURNING instance_id;
      `,
      {
        bind,
        type: QueryTypes.SELECT,
      },
    );

    return {
      usageSourceRows,
      factRowsUpserted: upsertedRows.length,
    };
  }
}
