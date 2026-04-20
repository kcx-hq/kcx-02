import { QueryTypes } from "sequelize";

import { sequelize } from "../../../models/index.js";
import type { Ec2InstanceHoursItem, Ec2InstanceHoursQuery } from "./ec2-instance-hours.types.js";

type Ec2InstanceHoursRow = {
  accountName: string | null;
  instanceId: string;
  instanceName: string | null;
  instanceType: string | null;
  availabilityZone: string | null;
  isSpot: boolean | null;
  totalHours: number | string | null;
  computeCost: number | string | null;
};

const toNumber = (value: number | string | null | undefined): number => {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
};

const toBoolean = (value: boolean | null | undefined): boolean => value === true;

export class Ec2InstanceHoursRepository {
  async getInstanceHours(input: Ec2InstanceHoursQuery): Promise<Ec2InstanceHoursItem[]> {
    const rows = await sequelize.query<Ec2InstanceHoursRow>(
      `
        WITH scoped AS (
          SELECT
            fed.usage_date,
            fed.instance_id,
            fed.sub_account_key,
            fed.instance_name,
            fed.instance_type,
            fed.availability_zone,
            fed.is_spot,
            COALESCE(fed.total_hours, 0)::double precision AS total_hours,
            COALESCE(fed.compute_cost, 0)::double precision AS compute_cost
          FROM fact_ec2_instance_daily fed
          WHERE fed.tenant_id = :tenantId
            AND fed.usage_date >= :startDate::date
            AND fed.usage_date < (:endDate::date + INTERVAL '1 day')
            AND (:cloudConnectionId::uuid IS NULL OR fed.cloud_connection_id = :cloudConnectionId::uuid)
            AND (:subAccountKey::bigint IS NULL OR fed.sub_account_key = :subAccountKey::bigint)
            AND (:regionKey::bigint IS NULL OR fed.region_key = :regionKey::bigint)
        ),
        totals AS (
          SELECT
            s.instance_id,
            SUM(s.total_hours)::double precision AS total_hours,
            SUM(s.compute_cost)::double precision AS compute_cost,
            BOOL_OR(COALESCE(s.is_spot, FALSE)) AS is_spot
          FROM scoped s
          GROUP BY s.instance_id
        ),
        attrs AS (
          SELECT DISTINCT ON (s.instance_id)
            s.instance_id,
            s.sub_account_key,
            s.instance_name,
            s.instance_type,
            s.availability_zone
          FROM scoped s
          ORDER BY
            s.instance_id,
            CASE WHEN s.sub_account_key IS NOT NULL THEN 1 ELSE 0 END DESC,
            CASE WHEN NULLIF(TRIM(COALESCE(s.instance_name, '')), '') IS NOT NULL THEN 1 ELSE 0 END DESC,
            CASE WHEN NULLIF(TRIM(COALESCE(s.instance_type, '')), '') IS NOT NULL THEN 1 ELSE 0 END DESC,
            CASE WHEN NULLIF(TRIM(COALESCE(s.availability_zone, '')), '') IS NOT NULL THEN 1 ELSE 0 END DESC,
            s.usage_date DESC
        )
        SELECT
          COALESCE(dsa.sub_account_name, 'Unspecified')::text AS "accountName",
          t.instance_id::text AS "instanceId",
          attrs.instance_name::text AS "instanceName",
          attrs.instance_type::text AS "instanceType",
          attrs.availability_zone::text AS "availabilityZone",
          t.is_spot AS "isSpot",
          t.total_hours::double precision AS "totalHours",
          t.compute_cost::double precision AS "computeCost"
        FROM totals t
        LEFT JOIN attrs
          ON attrs.instance_id = t.instance_id
        LEFT JOIN dim_sub_account dsa
          ON dsa.id = attrs.sub_account_key
        WHERE t.total_hours > 0 OR t.compute_cost > 0
        ORDER BY t.total_hours DESC, t.compute_cost DESC;
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
      accountName: row.accountName ?? "Unspecified",
      instanceId: row.instanceId,
      instanceName: row.instanceName ?? null,
      instanceType: row.instanceType ?? null,
      availabilityZone: row.availabilityZone ?? null,
      isSpot: toBoolean(row.isSpot),
      totalHours: toNumber(row.totalHours),
      computeCost: toNumber(row.computeCost),
    }));
  }
}
