import { QueryTypes } from "sequelize";

import { sequelize } from "../../../models/index.js";
import type { Ec2InstanceUsageItem, Ec2InstanceUsageQuery } from "./ec2-instance-usage.types.js";

type Ec2InstanceUsageRow = {
  date: string;
  category: string | null;
  value: number | string | null;
};

const toNumber = (value: number | string | null | undefined): number => {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
};

export class Ec2InstanceUsageRepository {
  async getDailyInstanceUsage(input: Ec2InstanceUsageQuery): Promise<Ec2InstanceUsageItem[]> {
    const categorySelect =
      input.category === "region"
        ? "COALESCE(dr.region_name, 'Unspecified')::text AS category"
        : input.category === "instance_type"
          ? "COALESCE(fed.instance_type, 'Unspecified')::text AS category"
          : input.category === "reservation_type"
            ? "COALESCE(ic.reservation_type, 'on_demand')::text AS category"
          : "NULL::text AS category";
    const categoryJoin =
      input.category === "region"
        ? "LEFT JOIN dim_region dr ON dr.id = fed.region_key"
        : input.category === "reservation_type"
          ? `LEFT JOIN instance_coverage ic
               ON ic.instance_id = fed.instance_id
              AND ic.usage_date = fed.usage_date
              AND (ic.sub_account_key IS NOT DISTINCT FROM fed.sub_account_key)
              AND (ic.region_key IS NOT DISTINCT FROM fed.region_key)`
        : "";
    const categoryGroupBy = input.category === "none" ? "" : ", category";
    const coverageCte =
      input.category === "reservation_type"
        ? `
          WITH instance_coverage AS (
            SELECT
              ranked.instance_id,
              ranked.usage_date,
              ranked.sub_account_key,
              ranked.region_key,
              ranked.reservation_type
            FROM (
              SELECT
                classified.instance_id,
                classified.usage_date,
                classified.sub_account_key,
                classified.region_key,
                classified.reservation_type,
                COUNT(*) AS row_count,
                ROW_NUMBER() OVER (
                  PARTITION BY classified.instance_id, classified.usage_date, classified.sub_account_key, classified.region_key
                  ORDER BY
                    COUNT(*) DESC,
                    CASE classified.reservation_type
                      WHEN 'savings_plan' THEN 1
                      WHEN 'reserved' THEN 2
                      WHEN 'spot' THEN 3
                      ELSE 4
                    END ASC
                ) AS rn
              FROM (
                SELECT
                  CASE
                    WHEN dres.resource_id ~ '^i-[a-z0-9]+' THEN dres.resource_id
                    WHEN dres.resource_name ~ '^i-[a-z0-9]+' THEN dres.resource_name
                    ELSE NULL
                  END AS instance_id,
                  DATE(COALESCE(fcli.usage_start_time, fcli.usage_end_time)) AS usage_date,
                  fcli.sub_account_key,
                  fcli.region_key,
                  CASE
                    WHEN fcli.savings_plan_arn IS NOT NULL
                      OR NULLIF(TRIM(COALESCE(fcli.savings_plan_type, '')), '') IS NOT NULL
                      OR LOWER(COALESCE(fcli.purchase_option, '')) LIKE '%savings%'
                      OR LOWER(COALESCE(fcli.pricing_term, '')) LIKE '%savings%'
                      OR LOWER(COALESCE(fcli.line_item_type, '')) LIKE '%savingsplan%'
                      THEN 'savings_plan'
                    WHEN fcli.reservation_arn IS NOT NULL
                      OR LOWER(COALESCE(fcli.purchase_option, '')) LIKE '%reserved%'
                      OR LOWER(COALESCE(fcli.pricing_term, '')) LIKE '%reserved%'
                      OR LOWER(COALESCE(fcli.line_item_type, '')) IN ('discountedusage', 'ri fee', 'rifee')
                      THEN 'reserved'
                    WHEN fcli.usage_type ILIKE '%Spot%' OR fcli.operation ILIKE '%Spot%' THEN 'spot'
                    ELSE 'on_demand'
                  END AS reservation_type
                FROM fact_cost_line_items fcli
                JOIN dim_service ds
                  ON ds.id = fcli.service_key
                LEFT JOIN dim_resource dres
                  ON dres.id = fcli.resource_key
                WHERE fcli.tenant_id = :tenantId
                  AND COALESCE(fcli.usage_start_time, fcli.usage_end_time) IS NOT NULL
                  AND DATE(COALESCE(fcli.usage_start_time, fcli.usage_end_time)) >= :startDate::date
                  AND DATE(COALESCE(fcli.usage_start_time, fcli.usage_end_time)) < (:endDate::date + INTERVAL '1 day')
                  AND ds.service_name ILIKE '%ec2%'
                  AND (
                    (dres.resource_id ~ '^i-[a-z0-9]+')
                    OR (dres.resource_name ~ '^i-[a-z0-9]+')
                  )
                  AND (:subAccountKey::bigint IS NULL OR fcli.sub_account_key = :subAccountKey::bigint)
                  AND (:regionKey::bigint IS NULL OR fcli.region_key = :regionKey::bigint)
              ) classified
              GROUP BY
                classified.instance_id,
                classified.usage_date,
                classified.sub_account_key,
                classified.region_key,
                classified.reservation_type
            ) ranked
            WHERE ranked.rn = 1
          )
        `
        : "";

    const rows = await sequelize.query<Ec2InstanceUsageRow>(
      `
        ${coverageCte}
        SELECT
          fed.usage_date::text AS date,
          ${categorySelect},
          COUNT(*)::double precision AS value
        FROM fact_ec2_instance_daily fed
        ${categoryJoin}
        WHERE fed.tenant_id = :tenantId
          AND fed.usage_date >= :startDate::date
          AND fed.usage_date < (:endDate::date + INTERVAL '1 day')
          AND fed.is_running = TRUE
          AND (:cloudConnectionId::uuid IS NULL OR fed.cloud_connection_id = :cloudConnectionId::uuid)
          AND (:subAccountKey::bigint IS NULL OR fed.sub_account_key = :subAccountKey::bigint)
          AND (:regionKey::bigint IS NULL OR fed.region_key = :regionKey::bigint)
        GROUP BY fed.usage_date${categoryGroupBy}
        ORDER BY fed.usage_date ASC;
      `,
      {
        replacements: {
          tenantId: input.tenantId,
          startDate: input.startDate,
          endDate: input.endDate,
          cloudConnectionId: input.cloudConnectionId,
          subAccountKey: input.subAccountKey,
          regionKey: input.regionKey,
        },
        type: QueryTypes.SELECT,
      },
    );

    return rows.map((row) => ({
      date: row.date,
      category: row.category,
      value: toNumber(row.value),
    }));
  }
}
