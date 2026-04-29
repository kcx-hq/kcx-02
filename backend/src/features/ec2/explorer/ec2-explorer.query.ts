import { QueryTypes } from "sequelize";

import { sequelize } from "../../../models/index.js";
import type {
  Ec2ExplorerAdditionalDailyCosts,
  Ec2ExplorerFactRow,
  Ec2ExplorerInput,
  Ec2ExplorerTagFilter,
} from "./ec2-explorer.types.js";

const toTagValueFilterSql = (input: { keyParam: string; valueParam: string }): string =>
  `LOWER(COALESCE(NULLIF(TRIM(lt.tags_json ->> :${input.keyParam}), ''), '')) = LOWER(:${input.valueParam})`;

const toScopeWhereClauses = (input: Ec2ExplorerInput): {
  whereSql: string;
  replacements: Record<string, unknown>;
} => {
  const whereClauses: string[] = [
    "fed.tenant_id = :tenantId",
    "fed.usage_date BETWEEN :startDate::date AND :endDate::date",
  ];
  const replacements: Record<string, unknown> = {
    tenantId: input.scope.tenantId,
    startDate: input.startDate,
    endDate: input.endDate,
  };

  if (input.scope.scopeType === "global") {
    if (typeof input.scope.providerId === "number") {
      whereClauses.push("fed.provider_id = :scopeProviderId");
      replacements.scopeProviderId = input.scope.providerId;
    }
    if (Array.isArray(input.scope.billingSourceIds) && input.scope.billingSourceIds.length > 0) {
      whereClauses.push("fed.billing_source_id IN (:scopeBillingSourceIds)");
      replacements.scopeBillingSourceIds = input.scope.billingSourceIds;
    }
    if (typeof input.scope.subAccountKey === "number") {
      whereClauses.push("fed.sub_account_key = :scopeSubAccountKey");
      replacements.scopeSubAccountKey = input.scope.subAccountKey;
    }
    if (typeof input.scope.regionKey === "number") {
      whereClauses.push("fed.region_key = :scopeRegionKey");
      replacements.scopeRegionKey = input.scope.regionKey;
    }
  } else if (Array.isArray(input.scope.rawBillingFileIds) && input.scope.rawBillingFileIds.length > 0) {
    whereClauses.push("fed.billing_source_id IN (:scopeRawBillingFileIds)");
    replacements.scopeRawBillingFileIds = input.scope.rawBillingFileIds;
  }

  if (input.filters.regions.length > 0) {
    whereClauses.push(
      "LOWER(COALESCE(dr.region_id, dr.region_name, fed.availability_zone, 'unknown')) IN (:regionsLower)",
    );
    replacements.regionsLower = input.filters.regions.map((item) => item.toLowerCase());
  }

  input.filters.tags.forEach((tagFilter: Ec2ExplorerTagFilter, index: number) => {
    const keyParam = `tagFilterKey${index}`;
    const valueParam = `tagFilterValue${index}`;
    whereClauses.push(toTagValueFilterSql({ keyParam, valueParam }));
    replacements[keyParam] = tagFilter.key;
    replacements[valueParam] = tagFilter.value;
  });

  return {
    whereSql: whereClauses.join("\n      AND "),
    replacements,
  };
};

type RawExplorerFactRow = {
  date: string;
  instanceId: string | null;
  instanceName: string | null;
  instanceType: string | null;
  region: string | null;
  account: string | null;
  state: string | null;
  computeCost: number | string | null;
  ebsCost: number | string | null;
  dataTransferCost: number | string | null;
  totalEffectiveCost: number | string | null;
  totalBilledCost: number | string | null;
  totalAmortizedCost: number | string | null;
  cpuAvg: number | string | null;
  cpuMax: number | string | null;
  diskUsedPercentAvg: number | string | null;
  diskUsedPercentMax: number | string | null;
  networkInBytes: number | string | null;
  networkOutBytes: number | string | null;
  isIdleCandidate: boolean | null;
  isUnderutilizedCandidate: boolean | null;
  isOverutilizedCandidate: boolean | null;
  reservationType: string | null;
  team: string | null;
  product: string | null;
  environment: string | null;
  tagsJson: Record<string, unknown> | null;
};

const toNumber = (value: number | string | null | undefined): number => {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
};
const toNullableNumber = (value: number | string | null | undefined): number | null => {
  if (value === null || typeof value === "undefined") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const toExplorerFactRow = (row: RawExplorerFactRow): Ec2ExplorerFactRow => ({
  date: row.date,
  instanceId: (row.instanceId ?? "").trim(),
  instanceName: (row.instanceName ?? row.instanceId ?? "Unknown").trim(),
  instanceType: (row.instanceType ?? "Unknown").trim(),
  region: (row.region ?? "Unknown").trim(),
  account: (row.account ?? "Unknown").trim(),
  state: (row.state ?? "unknown").trim().toLowerCase(),
  computeCost: toNumber(row.computeCost),
  ebsCost: toNumber(row.ebsCost),
  dataTransferCost: toNumber(row.dataTransferCost),
  totalEffectiveCost: toNumber(row.totalEffectiveCost),
  totalBilledCost: toNumber(row.totalBilledCost),
  totalAmortizedCost: toNullableNumber(row.totalAmortizedCost),
  cpuAvg: toNumber(row.cpuAvg),
  cpuMax: toNumber(row.cpuMax),
  diskUsedPercentAvg: toNumber(row.diskUsedPercentAvg),
  diskUsedPercentMax: toNumber(row.diskUsedPercentMax),
  networkInBytes: toNumber(row.networkInBytes),
  networkOutBytes: toNumber(row.networkOutBytes),
  isIdleCandidate: Boolean(row.isIdleCandidate),
  isUnderutilizedCandidate: Boolean(row.isUnderutilizedCandidate),
  isOverutilizedCandidate: Boolean(row.isOverutilizedCandidate),
  reservationType: (row.reservationType ?? "on_demand").trim().toLowerCase(),
  team: (row.team ?? "Unassigned").trim(),
  product: (row.product ?? "Unassigned").trim(),
  environment: (row.environment ?? "Unassigned").trim(),
  tagsJson: row.tagsJson,
});

export class Ec2ExplorerQuery {
  private hasCheckedAmortized = false;
  private supportsAmortized = false;

  async supportsAmortizedCost(): Promise<boolean> {
    if (this.hasCheckedAmortized) return this.supportsAmortized;
    const rows = await sequelize.query<{ exists: boolean }>(
      `
        SELECT EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_name = 'fact_ec2_instance_daily'
            AND column_name = 'total_amortized_cost'
        ) AS exists;
      `,
      { type: QueryTypes.SELECT },
    );
    this.supportsAmortized = Boolean(rows[0]?.exists);
    this.hasCheckedAmortized = true;
    return this.supportsAmortized;
  }

  async getFactRows(input: Ec2ExplorerInput): Promise<Ec2ExplorerFactRow[]> {
    const scoped = toScopeWhereClauses(input);
    const amortizedSql = (await this.supportsAmortizedCost())
      ? "fed.total_amortized_cost"
      : "NULL::numeric";
    const rows = await sequelize.query<RawExplorerFactRow>(
      `
        WITH latest_tags AS (
          SELECT DISTINCT ON (eis.tenant_id, eis.instance_id)
            eis.tenant_id,
            eis.instance_id,
            eis.tags_json
          FROM ec2_instance_inventory_snapshots eis
          WHERE eis.tenant_id = :tenantId
            AND eis.deleted_at IS NULL
          ORDER BY
            eis.tenant_id,
            eis.instance_id,
            eis.is_current DESC,
            eis.discovered_at DESC NULLS LAST,
            eis.updated_at DESC NULLS LAST
        )
        SELECT
          fed.usage_date::text AS date,
          fed.instance_id::text AS "instanceId",
          COALESCE(NULLIF(TRIM(fed.instance_name), ''), fed.instance_id)::text AS "instanceName",
          COALESCE(NULLIF(TRIM(fed.instance_type), ''), 'Unknown')::text AS "instanceType",
          COALESCE(dr.region_id, dr.region_name, fed.availability_zone, 'Unknown')::text AS region,
          COALESCE(dsa.sub_account_name, CAST(fed.sub_account_key AS text), 'Unknown')::text AS account,
          LOWER(COALESCE(NULLIF(TRIM(fed.state), ''), 'unknown'))::text AS state,
          fed.compute_cost AS "computeCost",
          fed.ebs_cost AS "ebsCost",
          fed.data_transfer_cost AS "dataTransferCost",
          COALESCE(fed.total_effective_cost, fed.total_billed_cost, 0) AS "totalEffectiveCost",
          fed.total_billed_cost AS "totalBilledCost",
          ${amortizedSql} AS "totalAmortizedCost",
          fed.cpu_avg AS "cpuAvg",
          fed.cpu_max AS "cpuMax",
          fed.disk_used_percent_avg AS "diskUsedPercentAvg",
          fed.disk_used_percent_max AS "diskUsedPercentMax",
          fed.network_in_bytes AS "networkInBytes",
          fed.network_out_bytes AS "networkOutBytes",
          fed.is_idle_candidate AS "isIdleCandidate",
          fed.is_underutilized_candidate AS "isUnderutilizedCandidate",
          fed.is_overutilized_candidate AS "isOverutilizedCandidate",
          COALESCE(NULLIF(TRIM(fed.reservation_type), ''), NULLIF(TRIM(fed.pricing_model), ''), 'on_demand')::text AS "reservationType",
          COALESCE(NULLIF(TRIM(lt.tags_json ->> 'team'), ''), NULLIF(TRIM(lt.tags_json ->> 'Team'), ''), 'Unassigned')::text AS team,
          COALESCE(NULLIF(TRIM(lt.tags_json ->> 'product'), ''), NULLIF(TRIM(lt.tags_json ->> 'Product'), ''), 'Unassigned')::text AS product,
          COALESCE(NULLIF(TRIM(lt.tags_json ->> 'environment'), ''), NULLIF(TRIM(lt.tags_json ->> 'Environment'), ''), 'Unassigned')::text AS environment,
          lt.tags_json AS "tagsJson"
        FROM fact_ec2_instance_daily fed
        LEFT JOIN dim_sub_account dsa
          ON dsa.id = fed.sub_account_key
        LEFT JOIN dim_region dr
          ON dr.id = fed.region_key
        LEFT JOIN latest_tags lt
          ON lt.tenant_id = fed.tenant_id
         AND lt.instance_id = fed.instance_id
        WHERE ${scoped.whereSql}
        ORDER BY fed.usage_date ASC, fed.instance_id ASC;
      `,
      {
        replacements: scoped.replacements,
        type: QueryTypes.SELECT,
      },
    );

    return rows.map(toExplorerFactRow).filter((row) => row.instanceId.length > 0);
  }

  async getAdditionalDailyCosts(input: Ec2ExplorerInput): Promise<Ec2ExplorerAdditionalDailyCosts[]> {
    // Placeholder layer for snapshot/EIP cost sources.
    // Keep isolated in query layer so service/UI remain fully data-driven.
    const points: Ec2ExplorerAdditionalDailyCosts[] = [];
    let current = new Date(`${input.startDate}T00:00:00.000Z`);
    const end = new Date(`${input.endDate}T00:00:00.000Z`);
    while (current.getTime() <= end.getTime()) {
      points.push({
        date: current.toISOString().slice(0, 10),
        snapshotCost: 0,
        eipCost: 0,
      });
      current = new Date(current.getTime() + 24 * 60 * 60 * 1000);
    }
    return points;
  }
}
