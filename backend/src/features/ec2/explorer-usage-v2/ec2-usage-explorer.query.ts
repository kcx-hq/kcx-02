import { QueryTypes } from "sequelize";
import { sequelize } from "../../../models/index.js";
import type { Ec2UsageExplorerInput, Ec2UsageExplorerRawRow } from "./ec2-usage-explorer.types.js";

const BYTES_TO_GB = 1024 * 1024 * 1024;

export class Ec2UsageExplorerQuery {
  async getRows(input: Ec2UsageExplorerInput): Promise<Ec2UsageExplorerRawRow[]> {
    const replacements: Record<string, unknown> = {
      tenantId: input.scope.tenantId,
      startDate: input.startDate,
      endDate: input.endDate,
    };
    const where: string[] = [
      "u.tenant_id = :tenantId",
      "u.usage_date BETWEEN :startDate::date AND :endDate::date",
    ];

    if (input.scope.scopeType === "global") {
      if (typeof input.scope.providerId === "number") {
        where.push("u.provider_id = :providerId");
        replacements.providerId = input.scope.providerId;
      }
      if (typeof input.scope.subAccountKey === "number") {
        where.push("u.sub_account_key = :subAccountKey");
        replacements.subAccountKey = input.scope.subAccountKey;
      }
      if (typeof input.scope.regionKey === "number") {
        where.push("u.region_key = :regionKey");
        replacements.regionKey = input.scope.regionKey;
      }
    }

    type RawUsageRow = {
      date: string;
      account: string | null;
      region: string | null;
      instanceType: string | null;
      instanceId: string | null;
      instanceName: string | null;
      tagsJson: Record<string, unknown> | null;
      avgCpu: number | string | null;
      maxCpu: number | string | null;
      networkInBytes: number | string | null;
      networkOutBytes: number | string | null;
    };

    const rows = await sequelize.query<RawUsageRow>(
      `
        WITH latest_instance AS (
          SELECT DISTINCT ON (i.tenant_id, i.instance_id)
            i.tenant_id,
            i.instance_id,
            i.instance_type,
            i.tags_json
          FROM ec2_instance_inventory_snapshots i
          WHERE i.tenant_id = :tenantId
            AND i.deleted_at IS NULL
          ORDER BY i.tenant_id, i.instance_id, i.is_current DESC, i.discovered_at DESC NULLS LAST, i.updated_at DESC NULLS LAST
        )
        SELECT
          u.usage_date::text AS date,
          COALESCE(dsa.sub_account_name, CAST(u.sub_account_key AS text), 'Unknown')::text AS account,
          COALESCE(dr.region_id, dr.region_name, 'Unknown')::text AS region,
          COALESCE(NULLIF(TRIM(li.instance_type), ''), 'Unknown')::text AS "instanceType",
          u.instance_id::text AS "instanceId",
          COALESCE(
            NULLIF(TRIM(li.tags_json ->> 'Name'), ''),
            NULLIF(TRIM(li.tags_json ->> 'name'), ''),
            u.instance_id,
            'Unknown'
          )::text AS "instanceName",
          li.tags_json AS "tagsJson",
          COALESCE(u.cpu_avg, 0)::double precision AS "avgCpu",
          COALESCE(u.cpu_max, 0)::double precision AS "maxCpu",
          COALESCE(u.network_in_bytes, 0)::double precision AS "networkInBytes",
          COALESCE(u.network_out_bytes, 0)::double precision AS "networkOutBytes"
        FROM ec2_instance_utilization_daily u
        LEFT JOIN dim_sub_account dsa
          ON dsa.id = u.sub_account_key
        LEFT JOIN dim_region dr
          ON dr.id = u.region_key
        LEFT JOIN latest_instance li
          ON li.tenant_id = u.tenant_id
         AND li.instance_id = u.instance_id
        WHERE ${where.join("\n          AND ")}
        ORDER BY u.usage_date ASC, u.instance_id ASC;
      `,
      {
        replacements,
        type: QueryTypes.SELECT,
      },
    );

    return rows.map((row) => ({
      date: row.date,
      account: String(row.account ?? "Unknown"),
      region: String(row.region ?? "Unknown"),
      instanceType: String(row.instanceType ?? "Unknown"),
      instanceId: String(row.instanceId ?? "unknown"),
      instanceName: String(row.instanceName ?? row.instanceId ?? "Unknown"),
      tagsJson: row.tagsJson,
      avgCpu: Number(row.avgCpu ?? 0),
      maxCpu: Number(row.maxCpu ?? 0),
      networkInGb: Number(row.networkInBytes ?? 0) / BYTES_TO_GB,
      networkOutGb: Number(row.networkOutBytes ?? 0) / BYTES_TO_GB,
    }));
  }
}
