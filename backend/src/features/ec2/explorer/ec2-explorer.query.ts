import { QueryTypes } from "sequelize";

import { sequelize } from "../../../models/index.js";
import type {
  Ec2ExplorerAdditionalDailyCosts,
  Ec2ExplorerFactRow,
  Ec2ExplorerInput,
  Ec2ExplorerVolumeRow,
  Ec2NetworkBreakdownCategory,
  Ec2ExplorerTagFilter,
} from "./ec2-explorer.types.js";
import { classifyNetworkCostType } from "./network-cost-classifier.js";
import { classifyExplorerCostCategory } from "../classification/cost-category-classifier.js";

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
    const scoped = toScopeWhereClauses(input);
    const costExpression = input.costBasis === "billed_cost"
      ? "COALESCE(fcli.billed_cost, 0)"
      : "COALESCE(fcli.effective_cost, fcli.billed_cost, 0)";
    type RawRow = {
      date: string;
      instanceId: string | null;
      usageType: string | null;
      productUsageType: string | null;
      productFamily: string | null;
      operation: string | null;
      lineItemDescription: string | null;
      cost: number | string | null;
    };
    const rows = await sequelize.query<RawRow>(
      `
        SELECT
          COALESCE(dd.full_date, DATE(COALESCE(fcli.usage_start_time, fcli.usage_end_time)))::text AS date,
          dr.resource_id::text AS "instanceId",
          fcli.usage_type AS "usageType",
          fcli.product_usage_type AS "productUsageType",
          fcli.product_family AS "productFamily",
          fcli.operation AS operation,
          fcli.line_item_description AS "lineItemDescription",
          SUM(${costExpression})::double precision AS cost
        FROM fact_cost_line_items fcli
        LEFT JOIN dim_date dd
          ON dd.id = fcli.usage_date_key
        LEFT JOIN dim_resource dr
          ON dr.id = fcli.resource_key
         AND dr.tenant_id = fcli.tenant_id
        WHERE fcli.tenant_id = :tenantId
          AND COALESCE(dd.full_date, DATE(COALESCE(fcli.usage_start_time, fcli.usage_end_time)))
              BETWEEN :startDate::date AND :endDate::date
          ${input.scope.scopeType === "global" && typeof input.scope.providerId === "number" ? "AND fcli.provider_id = :scopeProviderId" : ""}
          ${input.scope.scopeType === "global" && Array.isArray(input.scope.billingSourceIds) && input.scope.billingSourceIds.length > 0 ? "AND fcli.billing_source_id IN (:scopeBillingSourceIds)" : ""}
          ${input.scope.scopeType === "global" && typeof input.scope.subAccountKey === "number" ? "AND fcli.sub_account_key = :scopeSubAccountKey" : ""}
          ${input.scope.scopeType === "global" && typeof input.scope.regionKey === "number" ? "AND fcli.region_key = :scopeRegionKey" : ""}
          ${input.scope.scopeType === "upload" && Array.isArray(input.scope.rawBillingFileIds) && input.scope.rawBillingFileIds.length > 0 ? "AND fcli.billing_source_id IN (:scopeRawBillingFileIds)" : ""}
          ${input.filters.regions.length > 0 ? "AND LOWER(COALESCE(fcli.from_region_code, fcli.to_region_code, 'unknown')) IN (:regionsLower)" : ""}
        GROUP BY
          COALESCE(dd.full_date, DATE(COALESCE(fcli.usage_start_time, fcli.usage_end_time)))::text,
          dr.resource_id,
          fcli.usage_type,
          fcli.product_usage_type,
          fcli.product_family,
          fcli.operation,
          fcli.line_item_description;
      `,
      { replacements: scoped.replacements, type: QueryTypes.SELECT },
    );

    const bucket = new Map<string, Ec2ExplorerAdditionalDailyCosts>();
    for (const row of rows) {
      const instanceId = (row.instanceId ?? "").trim();
      if (!instanceId) continue;
      const key = `${row.date}::${instanceId}`;
      const item = bucket.get(key) ?? {
        date: row.date,
        instanceId,
        snapshotCost: 0,
        natGatewayCost: 0,
        eipCost: 0,
        loadBalancerCost: 0,
      };
      const blob = [
        (row.usageType ?? "").toLowerCase(),
        (row.productUsageType ?? "").toLowerCase(),
        (row.productFamily ?? "").toLowerCase(),
        (row.operation ?? "").toLowerCase(),
        (row.lineItemDescription ?? "").toLowerCase(),
      ].join(" ");
      const cost = Math.max(0, toNumber(row.cost));

      if (blob.includes("snapshot")) {
        item.snapshotCost += cost;
      } else if (blob.includes("natgateway") || blob.includes("nat-gateway") || blob.includes("nat gateway") || blob.includes("dataprocessing-bytes")) {
        item.natGatewayCost += cost;
      } else if (blob.includes("elasticip") || blob.includes("elastic ip") || blob.includes("idleaddress") || blob.includes("inuseaddress")) {
        item.eipCost += cost;
      } else if (blob.includes("loadbalancer") || blob.includes("load balancer") || blob.includes("loadbalancing") || blob.includes("lcu")) {
        item.loadBalancerCost += cost;
      }
      bucket.set(key, item);
    }

    return [...bucket.values()].map((item) => ({
      ...item,
      snapshotCost: Number(item.snapshotCost.toFixed(2)),
      natGatewayCost: Number(item.natGatewayCost.toFixed(2)),
      eipCost: Number(item.eipCost.toFixed(2)),
      loadBalancerCost: Number(item.loadBalancerCost.toFixed(2)),
    }));
  }

  async getCurCostRows(input: Ec2ExplorerInput): Promise<Array<{
    date: string;
    category: "compute" | "ebs" | "snapshot" | "data_transfer" | "nat_gateway" | "elastic_ip" | "load_balancer" | "other";
    cost: number;
    usageQuantity: number;
    usageType: string | null;
    productUsageType: string | null;
    operation: string | null;
    productFamily: string | null;
    lineItemDescription: string | null;
    lineItemType: string | null;
    serviceName: string | null;
    lineItemResourceId: string | null;
    fromLocation: string | null;
    toLocation: string | null;
    fromRegionCode: string | null;
    toRegionCode: string | null;
    region: string;
    account: string;
    instanceType: string;
    reservationType: string;
    team: string;
    product: string;
    environment: string;
    instanceId: string | null;
    attachedInstanceId: string | null;
    tagsJson: Record<string, unknown> | null;
  }>> {
    const scoped = toScopeWhereClauses(input);
    const costExpression = input.costBasis === "billed_cost"
      ? "COALESCE(fcli.billed_cost, 0)"
      : input.costBasis === "amortized_cost"
        ? "COALESCE(fcli.amortized_cost, fcli.effective_cost, fcli.billed_cost, 0)"
        : input.costBasis === "net_amortized_cost"
          ? "COALESCE(fcli.net_amortized_cost, fcli.amortized_cost, fcli.effective_cost, fcli.billed_cost, 0)"
          : input.costBasis === "net_unblended_cost"
            ? "COALESCE(fcli.net_unblended_cost, fcli.effective_cost, fcli.billed_cost, 0)"
            : "COALESCE(fcli.effective_cost, fcli.billed_cost, 0)";
    type RawCurRow = {
      date: string;
      usageType: string | null;
      productUsageType: string | null;
      productFamily: string | null;
      operation: string | null;
    lineItemDescription: string | null;
    lineItemType: string | null;
    serviceName: string | null;
    lineItemResourceId: string | null;
    fromLocation: string | null;
      toLocation: string | null;
      fromRegionCode: string | null;
      toRegionCode: string | null;
      cost: number | string | null;
      usageQuantity: number | string | null;
      region: string | null;
      account: string | null;
      instanceType: string | null;
      reservationType: string | null;
      team: string | null;
      product: string | null;
      environment: string | null;
      instanceId: string | null;
      attachedInstanceId: string | null;
      tagsJson: Record<string, unknown> | null;
    };
    const rows = await sequelize.query<RawCurRow>(
      `
        WITH latest_instance AS (
          SELECT DISTINCT ON (i.tenant_id, i.instance_id)
            i.tenant_id, i.instance_id, i.instance_type, i.tags_json
          FROM ec2_instance_inventory_snapshots i
          WHERE i.tenant_id = :tenantId AND i.deleted_at IS NULL
          ORDER BY i.tenant_id, i.instance_id, i.is_current DESC, i.discovered_at DESC NULLS LAST, i.updated_at DESC NULLS LAST
        ),
        latest_volume AS (
          SELECT DISTINCT ON (v.tenant_id, v.volume_id)
            v.tenant_id, LOWER(v.volume_id) AS volume_id, v.attached_instance_id, v.tags_json
          FROM ec2_volume_inventory_snapshots v
          WHERE v.tenant_id = :tenantId AND v.deleted_at IS NULL
          ORDER BY v.tenant_id, v.volume_id, v.is_current DESC, v.discovered_at DESC NULLS LAST, v.updated_at DESC NULLS LAST
        )
        SELECT
          COALESCE(dd.full_date, DATE(COALESCE(fcli.usage_start_time, fcli.usage_end_time)))::text AS date,
          fcli.usage_type AS "usageType",
          fcli.product_usage_type AS "productUsageType",
          fcli.product_family AS "productFamily",
          fcli.operation AS operation,
          fcli.line_item_description AS "lineItemDescription",
          fcli.line_item_type AS "lineItemType",
          ds.service_name AS "serviceName",
          r.resource_id::text AS "lineItemResourceId",
          fcli.from_location AS "fromLocation",
          fcli.to_location AS "toLocation",
          fcli.from_region_code AS "fromRegionCode",
          fcli.to_region_code AS "toRegionCode",
          SUM(${costExpression})::double precision AS cost,
          SUM(COALESCE(fcli.consumed_quantity, fcli.pricing_quantity, 0))::double precision AS "usageQuantity",
          COALESCE(dr.region_id, dr.region_name, fcli.from_region_code, fcli.to_region_code, 'Unknown')::text AS region,
          COALESCE(dsa.sub_account_name, CAST(fcli.sub_account_key AS text), 'Unknown')::text AS account,
          COALESCE(NULLIF(TRIM(li.instance_type), ''), 'Unknown')::text AS "instanceType",
          LOWER(
            COALESCE(
              NULLIF(TRIM(fcli.purchase_option), ''),
              NULLIF(TRIM(fcli.pricing_term), ''),
              CASE
                WHEN NULLIF(TRIM(COALESCE(fcli.savings_plan_arn, '')), '') IS NOT NULL THEN 'savings_plan'
                WHEN NULLIF(TRIM(COALESCE(fcli.reservation_arn, '')), '') IS NOT NULL THEN 'reserved'
                ELSE 'on_demand'
              END
            )
          )::text AS "reservationType",
          COALESCE(NULLIF(TRIM(COALESCE(li.tags_json, lv.tags_json) ->> 'team'), ''), NULLIF(TRIM(COALESCE(li.tags_json, lv.tags_json) ->> 'Team'), ''), 'Unassigned')::text AS team,
          COALESCE(NULLIF(TRIM(COALESCE(li.tags_json, lv.tags_json) ->> 'product'), ''), NULLIF(TRIM(COALESCE(li.tags_json, lv.tags_json) ->> 'Product'), ''), 'Unassigned')::text AS product,
          COALESCE(NULLIF(TRIM(COALESCE(li.tags_json, lv.tags_json) ->> 'environment'), ''), NULLIF(TRIM(COALESCE(li.tags_json, lv.tags_json) ->> 'Environment'), ''), 'Unassigned')::text AS environment,
          li.instance_id::text AS "instanceId",
          lv.attached_instance_id::text AS "attachedInstanceId",
          COALESCE(li.tags_json, lv.tags_json) AS "tagsJson"
        FROM fact_cost_line_items fcli
        LEFT JOIN dim_date dd ON dd.id = fcli.usage_date_key
        LEFT JOIN dim_region dr ON dr.id = fcli.region_key
        LEFT JOIN dim_sub_account dsa ON dsa.id = fcli.sub_account_key
        LEFT JOIN dim_service ds ON ds.id = fcli.service_key
        LEFT JOIN dim_resource r ON r.id = fcli.resource_key AND r.tenant_id = fcli.tenant_id
        LEFT JOIN latest_instance li
          ON li.tenant_id = fcli.tenant_id
         AND li.instance_id = COALESCE(
          NULLIF(SUBSTRING(LOWER(COALESCE(r.resource_id, '')) FROM '(i-[a-z0-9-]+)'), ''),
          NULLIF(SUBSTRING(LOWER(COALESCE(fcli.line_item_description, '')) FROM '(i-[a-z0-9-]+)'), ''),
          NULLIF(SUBSTRING(LOWER(COALESCE(fcli.usage_type, '')) FROM '(i-[a-z0-9-]+)'), '')
         )
        LEFT JOIN latest_volume lv
          ON lv.tenant_id = fcli.tenant_id
         AND lv.volume_id = COALESCE(
          NULLIF(SUBSTRING(LOWER(COALESCE(r.resource_id, '')) FROM '(vol-[a-z0-9-]+)'), ''),
          NULLIF(SUBSTRING(LOWER(COALESCE(fcli.line_item_description, '')) FROM '(vol-[a-z0-9-]+)'), ''),
          NULLIF(SUBSTRING(LOWER(COALESCE(fcli.usage_type, '')) FROM '(vol-[a-z0-9-]+)'), ''),
          NULLIF(SUBSTRING(LOWER(COALESCE(fcli.product_usage_type, '')) FROM '(vol-[a-z0-9-]+)'), '')
         )
        WHERE fcli.tenant_id = :tenantId
          AND COALESCE(dd.full_date, DATE(COALESCE(fcli.usage_start_time, fcli.usage_end_time)))
              BETWEEN :startDate::date AND :endDate::date
          AND (
            LOWER(COALESCE(ds.service_name, '')) LIKE '%ec2%'
            OR LOWER(COALESCE(ds.service_name, '')) LIKE '%elastic compute cloud%'
            OR LOWER(COALESCE(fcli.usage_type, '')) LIKE '%boxusage%'
            OR LOWER(COALESCE(fcli.usage_type, '')) LIKE '%ebs:%'
            OR LOWER(COALESCE(fcli.usage_type, '')) LIKE '%snapshot%'
            OR LOWER(COALESCE(fcli.usage_type, '')) LIKE '%natgateway%'
            OR LOWER(COALESCE(fcli.usage_type, '')) LIKE '%elasticip%'
            OR LOWER(COALESCE(fcli.usage_type, '')) LIKE '%loadbalancer%'
            OR LOWER(COALESCE(fcli.usage_type, '')) LIKE '%datatransfer%'
          )
          ${input.scope.scopeType === "global" && typeof input.scope.providerId === "number" ? "AND fcli.provider_id = :scopeProviderId" : ""}
          ${input.scope.scopeType === "global" && Array.isArray(input.scope.billingSourceIds) && input.scope.billingSourceIds.length > 0 ? "AND fcli.billing_source_id IN (:scopeBillingSourceIds)" : ""}
          ${input.scope.scopeType === "global" && typeof input.scope.subAccountKey === "number" ? "AND fcli.sub_account_key = :scopeSubAccountKey" : ""}
          ${input.scope.scopeType === "global" && typeof input.scope.regionKey === "number" ? "AND fcli.region_key = :scopeRegionKey" : ""}
          ${input.scope.scopeType === "upload" && Array.isArray(input.scope.rawBillingFileIds) && input.scope.rawBillingFileIds.length > 0 ? "AND fcli.billing_source_id IN (:scopeRawBillingFileIds)" : ""}
          ${input.filters.regions.length > 0 ? "AND LOWER(COALESCE(dr.region_id, dr.region_name, fcli.from_region_code, fcli.to_region_code, 'unknown')) IN (:regionsLower)" : ""}
        GROUP BY
          COALESCE(dd.full_date, DATE(COALESCE(fcli.usage_start_time, fcli.usage_end_time)))::text,
          fcli.usage_type, fcli.product_usage_type, fcli.product_family, fcli.operation, fcli.line_item_description, fcli.line_item_type,
          fcli.from_location, fcli.to_location, fcli.from_region_code, fcli.to_region_code,
          COALESCE(dr.region_id, dr.region_name, fcli.from_region_code, fcli.to_region_code, 'Unknown'),
          COALESCE(dsa.sub_account_name, CAST(fcli.sub_account_key AS text), 'Unknown'),
          ds.service_name,
          COALESCE(NULLIF(TRIM(li.instance_type), ''), 'Unknown'),
          LOWER(
            COALESCE(
              NULLIF(TRIM(fcli.purchase_option), ''),
              NULLIF(TRIM(fcli.pricing_term), ''),
              CASE
                WHEN NULLIF(TRIM(COALESCE(fcli.savings_plan_arn, '')), '') IS NOT NULL THEN 'savings_plan'
                WHEN NULLIF(TRIM(COALESCE(fcli.reservation_arn, '')), '') IS NOT NULL THEN 'reserved'
                ELSE 'on_demand'
              END
            )
          ),
          COALESCE(NULLIF(TRIM(COALESCE(li.tags_json, lv.tags_json) ->> 'team'), ''), NULLIF(TRIM(COALESCE(li.tags_json, lv.tags_json) ->> 'Team'), ''), 'Unassigned'),
          COALESCE(NULLIF(TRIM(COALESCE(li.tags_json, lv.tags_json) ->> 'product'), ''), NULLIF(TRIM(COALESCE(li.tags_json, lv.tags_json) ->> 'Product'), ''), 'Unassigned'),
          COALESCE(NULLIF(TRIM(COALESCE(li.tags_json, lv.tags_json) ->> 'environment'), ''), NULLIF(TRIM(COALESCE(li.tags_json, lv.tags_json) ->> 'Environment'), ''), 'Unassigned'),
          li.instance_id, lv.attached_instance_id, COALESCE(li.tags_json, lv.tags_json), r.resource_id;
      `,
      { replacements: scoped.replacements, type: QueryTypes.SELECT },
    );

    return rows.map((row) => ({
      date: row.date,
      category: classifyExplorerCostCategory(row),
      cost: Math.max(0, toNumber(row.cost)),
      usageQuantity: Math.max(0, toNumber(row.usageQuantity)),
      usageType: row.usageType,
      productUsageType: row.productUsageType,
      operation: row.operation,
      productFamily: row.productFamily,
      lineItemDescription: row.lineItemDescription,
      lineItemType: row.lineItemType,
      serviceName: row.serviceName,
      lineItemResourceId: row.lineItemResourceId ? row.lineItemResourceId.trim() : null,
      fromLocation: row.fromLocation,
      toLocation: row.toLocation,
      fromRegionCode: row.fromRegionCode,
      toRegionCode: row.toRegionCode,
      region: (row.region ?? "Unknown").trim(),
      account: (row.account ?? "Unknown").trim(),
      instanceType: (row.instanceType ?? "Unknown").trim(),
      reservationType: (row.reservationType ?? "on_demand").trim().toLowerCase(),
      team: (row.team ?? "Unassigned").trim(),
      product: (row.product ?? "Unassigned").trim(),
      environment: (row.environment ?? "Unassigned").trim(),
      instanceId: row.instanceId ? row.instanceId.trim() : null,
      attachedInstanceId: row.attachedInstanceId ? row.attachedInstanceId.trim() : null,
      tagsJson: row.tagsJson,
    }));
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
        ? "COALESCE(fcli.amortized_cost, fcli.effective_cost, fcli.billed_cost, 0)"
        : input.costBasis === "net_amortized_cost"
          ? "COALESCE(fcli.net_amortized_cost, fcli.amortized_cost, fcli.effective_cost, fcli.billed_cost, 0)"
          : input.costBasis === "net_unblended_cost"
            ? "COALESCE(fcli.net_unblended_cost, fcli.effective_cost, fcli.billed_cost, 0)"
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

  async getVolumeRows(input: Ec2ExplorerInput): Promise<Ec2ExplorerVolumeRow[]> {
    const scoped = toScopeWhereClauses(input);
    const costExpression = input.costBasis === "billed_cost"
      ? "COALESCE(fcli.billed_cost, 0)"
      : input.costBasis === "amortized_cost"
        ? "COALESCE(fcli.amortized_cost, fcli.effective_cost, fcli.billed_cost, 0)"
        : input.costBasis === "net_amortized_cost"
          ? "COALESCE(fcli.net_amortized_cost, fcli.amortized_cost, fcli.effective_cost, fcli.billed_cost, 0)"
          : input.costBasis === "net_unblended_cost"
            ? "COALESCE(fcli.net_unblended_cost, fcli.effective_cost, fcli.billed_cost, 0)"
            : "COALESCE(fcli.effective_cost, fcli.billed_cost, 0)";
    type RawRow = {
      date: string;
      volumeId: string | null;
      volumeName: string | null;
      volumeType: string | null;
      region: string | null;
      account: string | null;
      state: string | null;
      attachedInstanceId: string | null;
      attachedInstanceName: string | null;
      isAttached: boolean | null;
      sizeGb: number | string | null;
      storageCost: number | string | null;
      ioCost: number | string | null;
      throughputCost: number | string | null;
      totalCost: number | string | null;
      team: string | null;
      product: string | null;
      environment: string | null;
      tagsJson: Record<string, unknown> | null;
    };
    const rows = await sequelize.query<RawRow>(
      `
        WITH latest_volume AS (
          SELECT DISTINCT ON (v.tenant_id, v.volume_id)
            v.tenant_id,
            v.volume_id,
            v.tags_json,
            v.volume_type,
            v.state,
            COALESCE(v.size_gb, 0)::double precision AS size_gb,
            v.attached_instance_id
          FROM ec2_volume_inventory_snapshots v
          WHERE v.tenant_id = :tenantId
            AND v.is_current = TRUE
            AND v.deleted_at IS NULL
          ORDER BY v.tenant_id, v.volume_id, v.discovered_at DESC NULLS LAST, v.updated_at DESC NULLS LAST
        ),
        latest_instance AS (
          SELECT DISTINCT ON (i.tenant_id, i.instance_id)
            i.tenant_id,
            i.instance_id,
            i.tags_json
          FROM ec2_instance_inventory_snapshots i
          WHERE i.tenant_id = :tenantId
            AND i.is_current = TRUE
            AND i.deleted_at IS NULL
          ORDER BY i.tenant_id, i.instance_id, i.discovered_at DESC NULLS LAST, i.updated_at DESC NULLS LAST
        ),
        ebs_cost_by_volume_date AS (
          SELECT
            COALESCE(dd.full_date, DATE(COALESCE(fcli.usage_start_time, fcli.usage_end_time)))::text AS date,
            NULLIF(
              COALESCE(
                SUBSTRING(LOWER(COALESCE(dr.resource_id, '')) FROM '(vol-[a-z0-9-]+)'),
                SUBSTRING(LOWER(COALESCE(fcli.line_item_description, '')) FROM '(vol-[a-z0-9-]+)'),
                SUBSTRING(LOWER(COALESCE(fcli.usage_type, '')) FROM '(vol-[a-z0-9-]+)'),
                SUBSTRING(LOWER(COALESCE(fcli.product_usage_type, '')) FROM '(vol-[a-z0-9-]+)')
              ),
              ''
            )::text AS volume_id,
            fcli.sub_account_key,
            fcli.region_key,
            SUM(
              CASE
                WHEN LOWER(COALESCE(fcli.usage_type, '')) LIKE '%ebs:volumeusage%'
                  OR LOWER(COALESCE(fcli.product_usage_type, '')) LIKE '%ebs:volumeusage%'
                THEN ${costExpression}
                ELSE 0
              END
            )::double precision AS storage_cost,
            SUM(
              CASE
                WHEN LOWER(COALESCE(fcli.usage_type, '')) LIKE '%ebs:volumep-iops%'
                  OR LOWER(COALESCE(fcli.product_usage_type, '')) LIKE '%ebs:volumep-iops%'
                THEN ${costExpression}
                ELSE 0
              END
            )::double precision AS piops_cost,
            SUM(
              CASE
                WHEN LOWER(COALESCE(fcli.usage_type, '')) LIKE '%ebs:volumeiousage%'
                  OR LOWER(COALESCE(fcli.product_usage_type, '')) LIKE '%ebs:volumeiousage%'
                THEN ${costExpression}
                ELSE 0
              END
            )::double precision AS io_cost,
            SUM(
              CASE
                WHEN LOWER(COALESCE(fcli.usage_type, '')) LIKE '%ebs:volumethroughput%'
                  OR LOWER(COALESCE(fcli.product_usage_type, '')) LIKE '%ebs:volumethroughput%'
                THEN ${costExpression}
                ELSE 0
              END
            )::double precision AS throughput_cost
          FROM fact_cost_line_items fcli
          LEFT JOIN dim_date dd
            ON dd.id = fcli.usage_date_key
          LEFT JOIN dim_resource dr
            ON dr.id = fcli.resource_key
           AND dr.tenant_id = fcli.tenant_id
          WHERE fcli.tenant_id = :tenantId
            AND COALESCE(dd.full_date, DATE(COALESCE(fcli.usage_start_time, fcli.usage_end_time)))
                BETWEEN :startDate::date AND :endDate::date
            AND (
              LOWER(COALESCE(fcli.usage_type, '')) LIKE '%ebs:volumeusage%'
              OR LOWER(COALESCE(fcli.product_usage_type, '')) LIKE '%ebs:volumeusage%'
              OR LOWER(COALESCE(fcli.usage_type, '')) LIKE '%ebs:volumep-iops%'
              OR LOWER(COALESCE(fcli.product_usage_type, '')) LIKE '%ebs:volumep-iops%'
              OR LOWER(COALESCE(fcli.usage_type, '')) LIKE '%ebs:volumeiousage%'
              OR LOWER(COALESCE(fcli.product_usage_type, '')) LIKE '%ebs:volumeiousage%'
              OR LOWER(COALESCE(fcli.usage_type, '')) LIKE '%ebs:volumethroughput%'
              OR LOWER(COALESCE(fcli.product_usage_type, '')) LIKE '%ebs:volumethroughput%'
            )
            AND LOWER(COALESCE(fcli.usage_type, '')) NOT LIKE '%snapshot%'
            AND LOWER(COALESCE(fcli.product_usage_type, '')) NOT LIKE '%snapshot%'
            AND LOWER(COALESCE(fcli.usage_type, '')) NOT LIKE '%datatransfer%'
            AND LOWER(COALESCE(fcli.product_usage_type, '')) NOT LIKE '%datatransfer%'
            ${input.scope.scopeType === "global" && typeof input.scope.providerId === "number" ? "AND fcli.provider_id = :scopeProviderId" : ""}
            ${input.scope.scopeType === "global" && Array.isArray(input.scope.billingSourceIds) && input.scope.billingSourceIds.length > 0 ? "AND fcli.billing_source_id IN (:scopeBillingSourceIds)" : ""}
            ${input.scope.scopeType === "global" && typeof input.scope.subAccountKey === "number" ? "AND fcli.sub_account_key = :scopeSubAccountKey" : ""}
            ${input.scope.scopeType === "global" && typeof input.scope.regionKey === "number" ? "AND fcli.region_key = :scopeRegionKey" : ""}
            ${input.scope.scopeType === "upload" && Array.isArray(input.scope.rawBillingFileIds) && input.scope.rawBillingFileIds.length > 0 ? "AND fcli.billing_source_id IN (:scopeRawBillingFileIds)" : ""}
          GROUP BY
            COALESCE(dd.full_date, DATE(COALESCE(fcli.usage_start_time, fcli.usage_end_time)))::text,
            NULLIF(
              COALESCE(
                SUBSTRING(LOWER(COALESCE(dr.resource_id, '')) FROM '(vol-[a-z0-9-]+)'),
                SUBSTRING(LOWER(COALESCE(fcli.line_item_description, '')) FROM '(vol-[a-z0-9-]+)'),
                SUBSTRING(LOWER(COALESCE(fcli.usage_type, '')) FROM '(vol-[a-z0-9-]+)'),
                SUBSTRING(LOWER(COALESCE(fcli.product_usage_type, '')) FROM '(vol-[a-z0-9-]+)')
              ),
              ''
            ),
            fcli.sub_account_key,
            fcli.region_key
        ),
        latest_volume_meta AS (
          SELECT DISTINCT ON (v.tenant_id, v.volume_id)
            v.tenant_id,
            LOWER(v.volume_id) AS volume_id,
            v.tags_json,
            v.volume_type,
            v.state,
            COALESCE(v.size_gb, 0)::double precision AS size_gb,
            v.attached_instance_id
          FROM ec2_volume_inventory_snapshots v
          WHERE v.tenant_id = :tenantId
            AND v.deleted_at IS NULL
            AND v.discovered_at::date <= :endDate::date
          ORDER BY v.tenant_id, v.volume_id, v.is_current DESC, v.discovered_at DESC NULLS LAST, v.updated_at DESC NULLS LAST
        ),
        latest_fact_meta AS (
          SELECT DISTINCT ON (f.tenant_id, f.volume_id)
            f.tenant_id,
            LOWER(f.volume_id) AS volume_id,
            f.sub_account_key,
            f.region_key,
            f.availability_zone,
            f.volume_type,
            f.state,
            f.attached_instance_id,
            COALESCE(f.size_gb, 0)::double precision AS size_gb
          FROM fact_ebs_volume_daily f
          WHERE f.tenant_id = :tenantId
            AND f.usage_date <= :endDate::date
          ORDER BY f.tenant_id, f.volume_id, f.usage_date DESC, f.updated_at DESC NULLS LAST, f.id DESC
        )
        SELECT
          e.date AS date,
          COALESCE(e.volume_id, 'unknown')::text AS "volumeId",
          COALESCE(NULLIF(TRIM(lvm.tags_json ->> 'Name'), ''), COALESCE(e.volume_id, 'unknown'))::text AS "volumeName",
          COALESCE(NULLIF(TRIM(lvm.volume_type), ''), NULLIF(TRIM(lfm.volume_type), ''), 'unknown')::text AS "volumeType",
          COALESCE(dr.region_id, dr.region_name, lfm.availability_zone, 'Unknown')::text AS region,
          COALESCE(dsa.sub_account_name, CAST(COALESCE(lfm.sub_account_key, e.sub_account_key) AS text), 'Unknown')::text AS account,
          LOWER(COALESCE(NULLIF(TRIM(lvm.state), ''), NULLIF(TRIM(lfm.state), ''), 'unknown'))::text AS state,
          COALESCE(lvm.attached_instance_id, lfm.attached_instance_id)::text AS "attachedInstanceId",
          COALESCE(NULLIF(TRIM(li.tags_json ->> 'Name'), ''), COALESCE(lvm.attached_instance_id, lfm.attached_instance_id))::text AS "attachedInstanceName",
          CASE WHEN COALESCE(lvm.attached_instance_id, lfm.attached_instance_id) IS NULL THEN FALSE ELSE TRUE END AS "isAttached",
          COALESCE(lvm.size_gb, lfm.size_gb, 0)::double precision AS "sizeGb",
          COALESCE(e.storage_cost, 0)::double precision AS "storageCost",
          COALESCE(e.io_cost + e.piops_cost, 0)::double precision AS "ioCost",
          COALESCE(e.throughput_cost, 0)::double precision AS "throughputCost",
          COALESCE(e.storage_cost, 0) + COALESCE(e.piops_cost, 0) + COALESCE(e.io_cost, 0) + COALESCE(e.throughput_cost, 0) AS "totalCost",
          COALESCE(NULLIF(TRIM(lvm.tags_json ->> 'team'), ''), NULLIF(TRIM(lvm.tags_json ->> 'Team'), ''), 'Unassigned')::text AS team,
          COALESCE(NULLIF(TRIM(lvm.tags_json ->> 'product'), ''), NULLIF(TRIM(lvm.tags_json ->> 'Product'), ''), 'Unassigned')::text AS product,
          COALESCE(NULLIF(TRIM(lvm.tags_json ->> 'environment'), ''), NULLIF(TRIM(lvm.tags_json ->> 'Environment'), ''), 'Unassigned')::text AS environment,
          lvm.tags_json AS "tagsJson"
        FROM ebs_cost_by_volume_date e
        LEFT JOIN latest_volume_meta lvm
          ON lvm.tenant_id = :tenantId AND lvm.volume_id = e.volume_id
        LEFT JOIN latest_fact_meta lfm
          ON lfm.tenant_id = :tenantId AND lfm.volume_id = e.volume_id
        LEFT JOIN dim_sub_account dsa ON dsa.id = COALESCE(lfm.sub_account_key, e.sub_account_key)
        LEFT JOIN dim_region dr ON dr.id = COALESCE(lfm.region_key, e.region_key)
        LEFT JOIN latest_instance li
          ON li.tenant_id = :tenantId AND li.instance_id = COALESCE(lvm.attached_instance_id, lfm.attached_instance_id)
        ORDER BY e.date ASC, COALESCE(e.volume_id, 'unknown') ASC;
      `,
      { replacements: scoped.replacements, type: QueryTypes.SELECT },
    );
    return rows.map((row) => ({
      date: row.date,
      volumeId: (row.volumeId ?? "").trim(),
      volumeName: (row.volumeName ?? row.volumeId ?? "Unknown").trim(),
      volumeType: (row.volumeType ?? "unknown").trim(),
      region: (row.region ?? "Unknown").trim(),
      account: (row.account ?? "Unknown").trim(),
      state: (row.state ?? "unknown").trim(),
      attachedInstanceId: row.attachedInstanceId,
      attachedInstanceName: row.attachedInstanceName,
      isAttached: Boolean(row.isAttached),
      sizeGb: toNumber(row.sizeGb),
      storageCost: toNumber(row.storageCost),
      ioCost: toNumber(row.ioCost),
      throughputCost: toNumber(row.throughputCost),
      totalCost: toNumber(row.totalCost),
      team: (row.team ?? "Unassigned").trim(),
      product: (row.product ?? "Unassigned").trim(),
      environment: (row.environment ?? "Unassigned").trim(),
      tagsJson: row.tagsJson,
    })).filter((row) => row.volumeId.length > 0);
  }

  async getVolumeMetadataRows(input: Ec2ExplorerInput): Promise<Ec2ExplorerVolumeRow[]> {
    const scoped = toScopeWhereClauses(input);
    type RawRow = {
      date: string;
      volumeId: string | null;
      volumeName: string | null;
      volumeType: string | null;
      region: string | null;
      account: string | null;
      state: string | null;
      attachedInstanceId: string | null;
      attachedInstanceName: string | null;
      isAttached: boolean | null;
      sizeGb: number | string | null;
      team: string | null;
      product: string | null;
      environment: string | null;
      tagsJson: Record<string, unknown> | null;
    };
    const rows = await sequelize.query<RawRow>(
      `
        WITH latest_volume_tags AS (
          SELECT DISTINCT ON (v.tenant_id, v.volume_id)
            v.tenant_id,
            LOWER(v.volume_id) AS volume_id,
            v.tags_json
          FROM ec2_volume_inventory_snapshots v
          WHERE v.tenant_id = :tenantId
            AND v.deleted_at IS NULL
          ORDER BY v.tenant_id, v.volume_id, v.is_current DESC, v.discovered_at DESC NULLS LAST, v.updated_at DESC NULLS LAST
        ),
        latest_instance AS (
          SELECT DISTINCT ON (i.tenant_id, i.instance_id)
            i.tenant_id,
            i.instance_id,
            i.tags_json
          FROM ec2_instance_inventory_snapshots i
          WHERE i.tenant_id = :tenantId
            AND i.deleted_at IS NULL
          ORDER BY i.tenant_id, i.instance_id, i.is_current DESC, i.discovered_at DESC NULLS LAST, i.updated_at DESC NULLS LAST
        )
        SELECT
          f.usage_date::text AS date,
          LOWER(f.volume_id)::text AS "volumeId",
          COALESCE(NULLIF(TRIM(lvt.tags_json ->> 'Name'), ''), LOWER(f.volume_id))::text AS "volumeName",
          COALESCE(NULLIF(TRIM(f.volume_type), ''), 'unknown')::text AS "volumeType",
          COALESCE(dr.region_id, dr.region_name, f.availability_zone, 'Unknown')::text AS region,
          COALESCE(dsa.sub_account_name, CAST(f.sub_account_key AS text), 'Unknown')::text AS account,
          LOWER(COALESCE(NULLIF(TRIM(f.state), ''), 'unknown'))::text AS state,
          f.attached_instance_id::text AS "attachedInstanceId",
          COALESCE(NULLIF(TRIM(li.tags_json ->> 'Name'), ''), f.attached_instance_id)::text AS "attachedInstanceName",
          CASE WHEN f.attached_instance_id IS NULL THEN FALSE ELSE TRUE END AS "isAttached",
          COALESCE(f.size_gb, 0)::double precision AS "sizeGb",
          COALESCE(NULLIF(TRIM(lvt.tags_json ->> 'team'), ''), NULLIF(TRIM(lvt.tags_json ->> 'Team'), ''), 'Unassigned')::text AS team,
          COALESCE(NULLIF(TRIM(lvt.tags_json ->> 'product'), ''), NULLIF(TRIM(lvt.tags_json ->> 'Product'), ''), 'Unassigned')::text AS product,
          COALESCE(NULLIF(TRIM(lvt.tags_json ->> 'environment'), ''), NULLIF(TRIM(lvt.tags_json ->> 'Environment'), ''), 'Unassigned')::text AS environment,
          lvt.tags_json AS "tagsJson"
        FROM fact_ebs_volume_daily f
        LEFT JOIN dim_sub_account dsa ON dsa.id = f.sub_account_key
        LEFT JOIN dim_region dr ON dr.id = f.region_key
        LEFT JOIN latest_volume_tags lvt
          ON lvt.tenant_id = f.tenant_id
         AND lvt.volume_id = LOWER(f.volume_id)
        LEFT JOIN latest_instance li
          ON li.tenant_id = f.tenant_id
         AND li.instance_id = f.attached_instance_id
        WHERE ${scoped.whereSql.replaceAll("fed.", "f.")}
        ORDER BY f.usage_date ASC, LOWER(f.volume_id) ASC;
      `,
      { replacements: scoped.replacements, type: QueryTypes.SELECT },
    );

    return rows.map((row) => ({
      date: row.date,
      volumeId: (row.volumeId ?? "").trim(),
      volumeName: (row.volumeName ?? row.volumeId ?? "Unknown").trim(),
      volumeType: (row.volumeType ?? "unknown").trim(),
      region: (row.region ?? "Unknown").trim(),
      account: (row.account ?? "Unknown").trim(),
      state: (row.state ?? "unknown").trim(),
      attachedInstanceId: row.attachedInstanceId,
      attachedInstanceName: row.attachedInstanceName,
      isAttached: Boolean(row.isAttached),
      sizeGb: toNumber(row.sizeGb),
      storageCost: 0,
      ioCost: 0,
      throughputCost: 0,
      totalCost: 0,
      team: (row.team ?? "Unassigned").trim(),
      product: (row.product ?? "Unassigned").trim(),
      environment: (row.environment ?? "Unassigned").trim(),
      tagsJson: row.tagsJson,
    })).filter((row) => row.volumeId.length > 0);
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
      : input.costBasis === "amortized_cost"
        ? "COALESCE(fcli.amortized_cost, fcli.effective_cost, fcli.billed_cost, 0)"
        : input.costBasis === "net_amortized_cost"
          ? "COALESCE(fcli.net_amortized_cost, fcli.amortized_cost, fcli.effective_cost, fcli.billed_cost, 0)"
          : input.costBasis === "net_unblended_cost"
            ? "COALESCE(fcli.net_unblended_cost, fcli.effective_cost, fcli.billed_cost, 0)"
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
