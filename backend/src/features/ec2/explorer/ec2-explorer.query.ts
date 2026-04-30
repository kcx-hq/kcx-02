import { QueryTypes } from "sequelize";

import { sequelize } from "../../../models/index.js";
import type {
  Ec2ExplorerAdditionalDailyCosts,
  Ec2ExplorerFactRow,
  Ec2ExplorerInput,
  Ec2NetworkBreakdownCategory,
  Ec2ExplorerTagFilter,
} from "./ec2-explorer.types.js";
import { classifyNetworkCostType } from "./network-cost-classifier.js";

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

  async getNetworkBreakdown(input: Ec2ExplorerInput): Promise<{
    totalNetworkCost: number;
    totalNetworkUsageGb: number | null;
    categories: Ec2NetworkBreakdownCategory[];
  }> {
    const scoped = toScopeWhereClauses(input);
    const costExpression = input.costBasis === "billed_cost"
      ? "COALESCE(fcli.billed_cost, 0)"
      : input.costBasis === "amortized_cost"
        ? "COALESCE(fcli.effective_cost, fcli.billed_cost, 0)"
        : "COALESCE(fcli.effective_cost, fcli.billed_cost, 0)";
    type RawRow = {
      usageType: string | null;
      productUsageType: string | null;
      productFamily: string | null;
      operation: string | null;
      lineItemDescription: string | null;
      fromLocation: string | null;
      toLocation: string | null;
      fromRegionCode: string | null;
      toRegionCode: string | null;
      resourceKey: string | null;
      cost: number | string | null;
      usageQuantity: number | string | null;
      usageQuantityBytes: number | string | null;
    };
    const rows = await sequelize.query<RawRow>(
      `
        SELECT
          fcli.usage_type AS "usageType",
          fcli.product_usage_type AS "productUsageType",
          fcli.product_family AS "productFamily",
          fcli.operation AS operation,
          fcli.line_item_description AS "lineItemDescription",
          fcli.from_location AS "fromLocation",
          fcli.to_location AS "toLocation",
          fcli.from_region_code AS "fromRegionCode",
          fcli.to_region_code AS "toRegionCode",
          CAST(fcli.resource_key AS text) AS "resourceKey",
          SUM(${costExpression})::double precision AS cost,
          SUM(COALESCE(fcli.consumed_quantity, fcli.pricing_quantity, 0))::double precision AS "usageQuantity",
          SUM(
            CASE
              WHEN LOWER(COALESCE(fcli.usage_type, '')) LIKE '%byte%'
                OR LOWER(COALESCE(fcli.product_usage_type, '')) LIKE '%byte%'
              THEN COALESCE(fcli.consumed_quantity, fcli.pricing_quantity, 0)
              ELSE 0
            END
          )::double precision AS "usageQuantityBytes"
        FROM fact_cost_line_items fcli
        LEFT JOIN dim_date dd
          ON dd.id = fcli.usage_date_key
        WHERE fcli.tenant_id = :tenantId
          AND COALESCE(dd.full_date, DATE(COALESCE(fcli.usage_start_time, fcli.usage_end_time)))
              BETWEEN :startDate::date AND :endDate::date
          AND (
            LOWER(COALESCE(fcli.usage_type, '')) LIKE '%datatransfer%'
            OR LOWER(COALESCE(fcli.product_usage_type, '')) LIKE '%datatransfer%'
            OR LOWER(COALESCE(fcli.product_family, '')) LIKE '%data transfer%'
            OR LOWER(COALESCE(fcli.line_item_description, '')) LIKE '%data transfer%'
            OR LOWER(COALESCE(fcli.usage_type, '')) LIKE '%natgateway%'
            OR LOWER(COALESCE(fcli.usage_type, '')) LIKE '%elasticip%'
            OR LOWER(COALESCE(fcli.usage_type, '')) LIKE '%loadbalancer%'
            OR LOWER(COALESCE(fcli.usage_type, '')) LIKE '%lcu%'
            OR LOWER(COALESCE(fcli.operation, '')) LIKE '%natgateway%'
            OR LOWER(COALESCE(fcli.operation, '')) LIKE '%loadbalanc%'
          )
          ${input.scope.scopeType === "global" && typeof input.scope.providerId === "number" ? "AND fcli.provider_id = :scopeProviderId" : ""}
          ${input.scope.scopeType === "global" && Array.isArray(input.scope.billingSourceIds) && input.scope.billingSourceIds.length > 0 ? "AND fcli.billing_source_id IN (:scopeBillingSourceIds)" : ""}
          ${input.scope.scopeType === "global" && typeof input.scope.subAccountKey === "number" ? "AND fcli.sub_account_key = :scopeSubAccountKey" : ""}
          ${input.scope.scopeType === "global" && typeof input.scope.regionKey === "number" ? "AND fcli.region_key = :scopeRegionKey" : ""}
          ${input.scope.scopeType === "upload" && Array.isArray(input.scope.rawBillingFileIds) && input.scope.rawBillingFileIds.length > 0 ? "AND fcli.billing_source_id IN (:scopeRawBillingFileIds)" : ""}
          ${input.filters.regions.length > 0 ? "AND LOWER(COALESCE(fcli.from_region_code, fcli.to_region_code, 'unknown')) IN (:regionsLower)" : ""}
        GROUP BY
          fcli.usage_type,
          fcli.product_usage_type,
          fcli.product_family,
          fcli.operation,
          fcli.line_item_description,
          fcli.from_location,
          fcli.to_location,
          fcli.from_region_code,
          fcli.to_region_code,
          fcli.resource_key;
      `,
      {
        replacements: scoped.replacements,
        type: QueryTypes.SELECT,
      },
    );

    const categoryCost = new Map<string, number>();
    const categoryUsage = new Map<string, number>();
    const categoryResourceSets = new Map<string, Set<string>>();
    let totalNetworkCost = 0;
    let totalBilledUsage = 0;
    let totalUsageBytes = 0;
    for (const row of rows) {
      const category = classifyNetworkCostType(row);
      const cost = Math.max(0, toNumber(row.cost));
      const usage = Math.max(0, toNumber(row.usageQuantity));
      const usageBytes = Math.max(0, toNumber(row.usageQuantityBytes));
      totalNetworkCost += cost;
      totalBilledUsage += usage;
      totalUsageBytes += usageBytes;
      categoryCost.set(category, (categoryCost.get(category) ?? 0) + cost);
      categoryUsage.set(category, (categoryUsage.get(category) ?? 0) + usage);
      if (!categoryResourceSets.has(category)) categoryResourceSets.set(category, new Set<string>());
      const resourceKey = (row.resourceKey ?? "").trim();
      if (resourceKey.length > 0) {
        categoryResourceSets.get(category)?.add(resourceKey);
      }
    }
    const orderedTypes = [
      "Internet Data Transfer",
      "Inter-Region Data Transfer",
      "Inter-AZ Data Transfer",
      "NAT Gateway",
      "Elastic IP",
      "Load Balancer",
      "Other Network",
    ] as const;
    const categories: Ec2NetworkBreakdownCategory[] = orderedTypes.map((type) => {
      const cost = Number((categoryCost.get(type) ?? 0).toFixed(2));
      const usageQuantity = Number((categoryUsage.get(type) ?? 0).toFixed(2));
      const percentBase = input.metric === "usage" ? totalBilledUsage : totalNetworkCost;
      const numerator = input.metric === "usage" ? usageQuantity : cost;
      const percent = percentBase > 0 ? Number(((numerator / percentBase) * 100).toFixed(2)) : 0;
      const resourceCount = categoryResourceSets.get(type)?.size ?? 0;
      return {
        type,
        cost,
        percent,
        usageQuantity,
        resourceCount,
      };
    });

    return {
      totalNetworkCost: Number(totalNetworkCost.toFixed(2)),
      totalNetworkUsageGb: totalUsageBytes > 0 ? Number((totalUsageBytes / (1024 ** 3)).toFixed(2)) : null,
      categories,
    };
  }

  async getNetworkBreakdownDaily(input: Ec2ExplorerInput): Promise<Array<{
    date: string;
    category: string;
    cost: number;
    billedUsage: number;
  }>> {
    const scoped = toScopeWhereClauses(input);
    const costExpression = input.costBasis === "billed_cost"
      ? "COALESCE(fcli.billed_cost, 0)"
      : "COALESCE(fcli.effective_cost, fcli.billed_cost, 0)";
    type RawRow = {
      date: string;
      usageType: string | null;
      productUsageType: string | null;
      productFamily: string | null;
      operation: string | null;
      lineItemDescription: string | null;
      fromLocation: string | null;
      toLocation: string | null;
      fromRegionCode: string | null;
      toRegionCode: string | null;
      cost: number | string | null;
      billedUsage: number | string | null;
    };
    const rows = await sequelize.query<RawRow>(
      `
        SELECT
          COALESCE(dd.full_date, DATE(COALESCE(fcli.usage_start_time, fcli.usage_end_time)))::text AS date,
          fcli.usage_type AS "usageType",
          fcli.product_usage_type AS "productUsageType",
          fcli.product_family AS "productFamily",
          fcli.operation AS operation,
          fcli.line_item_description AS "lineItemDescription",
          fcli.from_location AS "fromLocation",
          fcli.to_location AS "toLocation",
          fcli.from_region_code AS "fromRegionCode",
          fcli.to_region_code AS "toRegionCode",
          SUM(${costExpression})::double precision AS cost,
          SUM(COALESCE(fcli.consumed_quantity, fcli.pricing_quantity, 0))::double precision AS "billedUsage"
        FROM fact_cost_line_items fcli
        LEFT JOIN dim_date dd
          ON dd.id = fcli.usage_date_key
        WHERE fcli.tenant_id = :tenantId
          AND COALESCE(dd.full_date, DATE(COALESCE(fcli.usage_start_time, fcli.usage_end_time)))
              BETWEEN :startDate::date AND :endDate::date
          AND (
            LOWER(COALESCE(fcli.usage_type, '')) LIKE '%datatransfer%'
            OR LOWER(COALESCE(fcli.product_usage_type, '')) LIKE '%datatransfer%'
            OR LOWER(COALESCE(fcli.product_family, '')) LIKE '%data transfer%'
            OR LOWER(COALESCE(fcli.line_item_description, '')) LIKE '%data transfer%'
            OR LOWER(COALESCE(fcli.usage_type, '')) LIKE '%natgateway%'
            OR LOWER(COALESCE(fcli.usage_type, '')) LIKE '%elasticip%'
            OR LOWER(COALESCE(fcli.usage_type, '')) LIKE '%loadbalancer%'
            OR LOWER(COALESCE(fcli.usage_type, '')) LIKE '%lcu%'
            OR LOWER(COALESCE(fcli.operation, '')) LIKE '%natgateway%'
            OR LOWER(COALESCE(fcli.operation, '')) LIKE '%loadbalanc%'
          )
          ${input.scope.scopeType === "global" && typeof input.scope.providerId === "number" ? "AND fcli.provider_id = :scopeProviderId" : ""}
          ${input.scope.scopeType === "global" && Array.isArray(input.scope.billingSourceIds) && input.scope.billingSourceIds.length > 0 ? "AND fcli.billing_source_id IN (:scopeBillingSourceIds)" : ""}
          ${input.scope.scopeType === "global" && typeof input.scope.subAccountKey === "number" ? "AND fcli.sub_account_key = :scopeSubAccountKey" : ""}
          ${input.scope.scopeType === "global" && typeof input.scope.regionKey === "number" ? "AND fcli.region_key = :scopeRegionKey" : ""}
          ${input.scope.scopeType === "upload" && Array.isArray(input.scope.rawBillingFileIds) && input.scope.rawBillingFileIds.length > 0 ? "AND fcli.billing_source_id IN (:scopeRawBillingFileIds)" : ""}
          ${input.filters.regions.length > 0 ? "AND LOWER(COALESCE(fcli.from_region_code, fcli.to_region_code, 'unknown')) IN (:regionsLower)" : ""}
        GROUP BY
          COALESCE(dd.full_date, DATE(COALESCE(fcli.usage_start_time, fcli.usage_end_time)))::text,
          fcli.usage_type,
          fcli.product_usage_type,
          fcli.product_family,
          fcli.operation,
          fcli.line_item_description,
          fcli.from_location,
          fcli.to_location,
          fcli.from_region_code,
          fcli.to_region_code;
      `,
      { replacements: scoped.replacements, type: QueryTypes.SELECT },
    );
    const out = new Map<string, { cost: number; billedUsage: number }>();
    for (const row of rows) {
      const category = classifyNetworkCostType(row);
      const date = row.date;
      const key = `${date}::${category}`;
      const current = out.get(key) ?? { cost: 0, billedUsage: 0 };
      current.cost += Math.max(0, toNumber(row.cost));
      current.billedUsage += Math.max(0, toNumber(row.billedUsage));
      out.set(key, current);
    }
    return [...out.entries()].map(([key, totals]) => {
      const [date, category] = key.split("::");
      return {
        date: date ?? "",
        category: category ?? "Other Network",
        cost: Number(totals.cost.toFixed(2)),
        billedUsage: Number(totals.billedUsage.toFixed(2)),
      };
    });
  }
}
