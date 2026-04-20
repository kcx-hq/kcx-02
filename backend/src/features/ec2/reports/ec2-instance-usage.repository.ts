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
          : "NULL::text AS category";
    const categoryJoin =
      input.category === "region"
        ? "LEFT JOIN dim_region dr ON dr.id = fed.region_key"
        : "";
    const categoryGroupBy = input.category === "none" ? "" : ", category";

    const rows = await sequelize.query<Ec2InstanceUsageRow>(
      `
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
