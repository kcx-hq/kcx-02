import { QueryTypes } from "sequelize";

import { sequelize } from "../../../../../models/index.js";
import type {
  InventoryEc2InstancesListItem,
  InventoryEc2InstancesListQuery,
  InventoryEc2InstancesListResponse,
} from "./instances-inventory.types.js";

type InventoryRow = {
  instanceId: string;
  instanceName: string;
  state: string | null;
  instanceType: string | null;
  regionKey: string | null;
  regionId: string | null;
  regionName: string | null;
  availabilityZone: string | null;
  platform: string | null;
  launchTime: Date | string | null;
  privateIpAddress: string | null;
  publicIpAddress: string | null;
  imageId: string | null;
  tenancy: string | null;
  architecture: string | null;
  instanceLifecycle: string | null;
  resourceKey: string | null;
  cloudConnectionId: string | null;
  subAccountKey: string | null;
};

type InventoryCountRow = {
  total: string;
};

type UtilizationRow = {
  cloudConnectionKey: string;
  instanceId: string;
  cpuAvg: string | null;
  cpuMax: string | null;
  isIdleCandidate: boolean | null;
  isUnderutilizedCandidate: boolean | null;
  isOverutilizedCandidate: boolean | null;
};

type CostSummary = {
  monthToDateCost: number;
  latestDailyCost: number;
};

type CostLookup = {
  byConnectionInstance: Map<string, CostSummary>;
  byDimensionInstance: Map<string, CostSummary>;
  byInstance: Map<string, CostSummary>;
};

type Ec2CostHistoryColumnRow = {
  column_name: string;
};

type Ec2CostHistoryCostRow = {
  cloudConnectionKey: string;
  instanceId: string;
  monthToDateCost: number | string | null;
  latestDailyCost: number | string | null;
};

type FactCostFallbackRow = {
  instanceId: string;
  subAccountKey: string | null;
  regionKey: string | null;
  monthToDateCost: number | string | null;
  latestDailyCost: number | string | null;
};

type InventoryWhereClause = {
  clause: string;
  bind: unknown[];
  nextIndex: number;
};

const normalizeLower = (value: string | null | undefined): string | null => {
  if (!value) return null;
  const trimmed = value.trim().toLowerCase();
  return trimmed.length > 0 ? trimmed : null;
};

const toNullableNumber = (value: number | string | null | undefined): number | null => {
  if (value === null || typeof value === "undefined") return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const toNumberOrZero = (value: number | string | null | undefined): number => {
  const parsed = toNullableNumber(value);
  return parsed ?? 0;
};

const toIsoOrNull = (value: Date | string | null): string | null => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

const toConnectionInstanceKey = (cloudConnectionId: string | null, instanceId: string): string =>
  `${cloudConnectionId ?? ""}::${instanceId}`;

const toDimensionInstanceKey = (
  subAccountKey: string | null,
  regionKey: string | null,
  instanceId: string,
): string => `${subAccountKey ?? ""}::${regionKey ?? ""}::${instanceId}`;

const isSafeIdentifier = (value: string): boolean => /^[a-z_][a-z0-9_]*$/.test(value);
const quoteIdentifier = (value: string): string => {
  if (!isSafeIdentifier(value)) {
    throw new Error(`Unsafe SQL identifier: ${value}`);
  }
  return `"${value}"`;
};

const pickColumn = (columns: Set<string>, candidates: string[]): string | null => {
  for (const candidate of candidates) {
    if (columns.has(candidate)) return candidate;
  }
  return null;
};

type CostTableConfig = {
  instanceColumn: string;
  dateColumn: string;
  costColumn: string;
  tenantColumn: string | null;
  cloudConnectionColumn: string | null;
};

const resolveEc2CostHistoryConfig = (columns: string[]): CostTableConfig | null => {
  const set = new Set(columns.map((column) => column.toLowerCase()));

  const instanceColumn = pickColumn(set, ["instance_id", "resource_id"]);
  const dateColumn = pickColumn(set, ["usage_date", "cost_date", "date", "day"]);
  const costColumn = pickColumn(set, [
    "billed_cost",
    "effective_cost",
    "list_cost",
    "cost",
    "amount",
    "daily_cost",
    "unblended_cost",
    "blended_cost",
    "net_cost",
  ]);

  if (!instanceColumn || !dateColumn || !costColumn) {
    return null;
  }

  return {
    instanceColumn,
    dateColumn,
    costColumn,
    tenantColumn: set.has("tenant_id") ? "tenant_id" : null,
    cloudConnectionColumn: set.has("cloud_connection_id") ? "cloud_connection_id" : null,
  };
};

export class InstancesInventoryService {
  async listInstances(input: {
    tenantId: string;
    query: InventoryEc2InstancesListQuery;
  }): Promise<InventoryEc2InstancesListResponse> {
    const page = input.query.page;
    const pageSize = input.query.pageSize;

    const { total, rows } = await this.loadInventoryPage({
      tenantId: input.tenantId,
      query: input.query,
    });

    if (rows.length === 0) {
      return {
        items: [],
        pagination: {
          page,
          pageSize,
          total,
          totalPages: total === 0 ? 0 : Math.ceil(total / pageSize),
        },
      };
    }

    const uniqueInstanceIds = Array.from(new Set(rows.map((row) => row.instanceId)));
    const [utilizationLookup, costLookup] = await Promise.all([
      this.loadLatestUtilizationByInstance({
        tenantId: input.tenantId,
        instanceIds: uniqueInstanceIds,
      }),
      this.loadCostLookup({
        tenantId: input.tenantId,
        rows,
      }),
    ]);

    const items: InventoryEc2InstancesListItem[] = rows.map((row) => {
      const utilization =
        utilizationLookup.byConnectionInstance.get(
          toConnectionInstanceKey(row.cloudConnectionId, row.instanceId),
        ) ?? utilizationLookup.byInstance.get(row.instanceId);

      const cost =
        costLookup.byConnectionInstance.get(
          toConnectionInstanceKey(row.cloudConnectionId, row.instanceId),
        ) ??
        costLookup.byDimensionInstance.get(
          toDimensionInstanceKey(row.subAccountKey, row.regionKey, row.instanceId),
        ) ??
        costLookup.byInstance.get(row.instanceId) ?? {
          monthToDateCost: 0,
          latestDailyCost: 0,
        };

      return {
        instanceId: row.instanceId,
        instanceName: row.instanceName,
        state: row.state,
        instanceType: row.instanceType,
        regionKey: row.regionKey,
        regionId: row.regionId,
        regionName: row.regionName,
        availabilityZone: row.availabilityZone,
        platform: row.platform,
        launchTime: toIsoOrNull(row.launchTime),
        privateIpAddress: row.privateIpAddress,
        publicIpAddress: row.publicIpAddress,
        cpuAvg: toNullableNumber(utilization?.cpuAvg),
        cpuMax: toNullableNumber(utilization?.cpuMax),
        isIdleCandidate: utilization?.isIdleCandidate ?? null,
        isUnderutilizedCandidate: utilization?.isUnderutilizedCandidate ?? null,
        isOverutilizedCandidate: utilization?.isOverutilizedCandidate ?? null,
        monthToDateCost: cost.monthToDateCost,
        latestDailyCost: cost.latestDailyCost,
        imageId: row.imageId,
        tenancy: row.tenancy,
        architecture: row.architecture,
        instanceLifecycle: row.instanceLifecycle,
        resourceKey: row.resourceKey,
        cloudConnectionId: row.cloudConnectionId,
      };
    });

    return {
      items,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: total === 0 ? 0 : Math.ceil(total / pageSize),
      },
    };
  }

  private buildInventoryWhereClause(input: {
    tenantId: string;
    query: InventoryEc2InstancesListQuery;
  }): InventoryWhereClause {
    const whereParts: string[] = [
      "inv.tenant_id = $1",
      "inv.is_current = true",
      "inv.deleted_at IS NULL",
    ];
    const bind: unknown[] = [input.tenantId];
    let nextIndex = 2;

    if (input.query.cloudConnectionId) {
      whereParts.push(`inv.cloud_connection_id = $${nextIndex}`);
      bind.push(input.query.cloudConnectionId);
      nextIndex += 1;
    }

    const normalizedState = normalizeLower(input.query.state);
    if (normalizedState) {
      whereParts.push(`LOWER(COALESCE(inv.state, '')) = $${nextIndex}`);
      bind.push(normalizedState);
      nextIndex += 1;
    }

    const normalizedInstanceType = normalizeLower(input.query.instanceType);
    if (normalizedInstanceType) {
      whereParts.push(`LOWER(COALESCE(inv.instance_type, '')) = $${nextIndex}`);
      bind.push(normalizedInstanceType);
      nextIndex += 1;
    }

    const normalizedRegion = normalizeLower(input.query.region);
    if (normalizedRegion) {
      const regionExactIdx = nextIndex;
      const regionLikeIdx = nextIndex + 1;
      whereParts.push(`
        (
          LOWER(COALESCE(dr.region_id, '')) = $${regionExactIdx}
          OR LOWER(COALESCE(dr.region_name, '')) = $${regionExactIdx}
          OR LOWER(COALESCE(inv.availability_zone, '')) = $${regionExactIdx}
          OR LOWER(COALESCE(inv.availability_zone, '')) LIKE $${regionLikeIdx}
        )
      `);
      bind.push(normalizedRegion);
      bind.push(`${normalizedRegion}%`);
      nextIndex += 2;
    }

    const normalizedSearch = normalizeLower(input.query.search);
    if (normalizedSearch) {
      whereParts.push(`
        (
          LOWER(inv.instance_id) LIKE $${nextIndex}
          OR LOWER(COALESCE(inv.tags_json ->> 'Name', '')) LIKE $${nextIndex}
        )
      `);
      bind.push(`%${normalizedSearch}%`);
      nextIndex += 1;
    }

    return {
      clause: `WHERE ${whereParts.join(" AND ")}`,
      bind,
      nextIndex,
    };
  }

  private async loadInventoryPage(input: {
    tenantId: string;
    query: InventoryEc2InstancesListQuery;
  }): Promise<{ total: number; rows: InventoryRow[] }> {
    const where = this.buildInventoryWhereClause(input);
    const offset = (input.query.page - 1) * input.query.pageSize;

    const countRows = await sequelize.query<InventoryCountRow>(
      `
        SELECT COUNT(*)::text AS total
        FROM ec2_instance_inventory_snapshots inv
        LEFT JOIN dim_region dr
          ON dr.id = inv.region_key
        ${where.clause};
      `,
      {
        bind: where.bind,
        type: QueryTypes.SELECT,
      },
    );
    const total = Number(countRows[0]?.total ?? 0) || 0;

    const limitIndex = where.nextIndex;
    const offsetIndex = where.nextIndex + 1;
    const rows = await sequelize.query<InventoryRow>(
      `
        SELECT
          inv.instance_id AS "instanceId",
          COALESCE(NULLIF(TRIM(COALESCE(inv.tags_json ->> 'Name', '')), ''), inv.instance_id) AS "instanceName",
          inv.state AS "state",
          inv.instance_type AS "instanceType",
          inv.region_key::text AS "regionKey",
          dr.region_id AS "regionId",
          dr.region_name AS "regionName",
          inv.availability_zone AS "availabilityZone",
          inv.platform AS "platform",
          inv.launch_time AS "launchTime",
          inv.private_ip_address AS "privateIpAddress",
          inv.public_ip_address AS "publicIpAddress",
          inv.image_id AS "imageId",
          inv.tenancy AS "tenancy",
          inv.architecture AS "architecture",
          inv.instance_lifecycle AS "instanceLifecycle",
          inv.resource_key::text AS "resourceKey",
          inv.cloud_connection_id::text AS "cloudConnectionId",
          inv.sub_account_key::text AS "subAccountKey"
        FROM ec2_instance_inventory_snapshots inv
        LEFT JOIN dim_region dr
          ON dr.id = inv.region_key
        ${where.clause}
        ORDER BY inv.updated_at DESC NULLS LAST, inv.instance_id ASC
        LIMIT $${limitIndex} OFFSET $${offsetIndex};
      `,
      {
        bind: [...where.bind, input.query.pageSize, offset],
        type: QueryTypes.SELECT,
      },
    );

    return { total, rows };
  }

  private async loadLatestUtilizationByInstance(input: {
    tenantId: string;
    instanceIds: string[];
  }): Promise<{
    byConnectionInstance: Map<string, UtilizationRow>;
    byInstance: Map<string, UtilizationRow>;
  }> {
    const rows = await sequelize.query<UtilizationRow>(
      `
        SELECT DISTINCT ON (u.cloud_connection_id, u.instance_id)
          COALESCE(u.cloud_connection_id::text, '') AS "cloudConnectionKey",
          u.instance_id AS "instanceId",
          u.cpu_avg AS "cpuAvg",
          u.cpu_max AS "cpuMax",
          u.is_idle_candidate AS "isIdleCandidate",
          u.is_underutilized_candidate AS "isUnderutilizedCandidate",
          u.is_overutilized_candidate AS "isOverutilizedCandidate"
        FROM ec2_instance_utilization_daily u
        WHERE u.tenant_id = $1
          AND u.instance_id = ANY($2::text[])
        ORDER BY
          u.cloud_connection_id NULLS FIRST,
          u.instance_id,
          u.usage_date DESC,
          u.updated_at DESC;
      `,
      {
        bind: [input.tenantId, input.instanceIds],
        type: QueryTypes.SELECT,
      },
    );

    const byConnectionInstance = new Map<string, UtilizationRow>();
    const byInstance = new Map<string, UtilizationRow>();

    for (const row of rows) {
      byConnectionInstance.set(
        toConnectionInstanceKey(row.cloudConnectionKey || null, row.instanceId),
        row,
      );
      if (!byInstance.has(row.instanceId)) {
        byInstance.set(row.instanceId, row);
      }
    }

    return { byConnectionInstance, byInstance };
  }

  private async loadCostLookup(input: {
    tenantId: string;
    rows: InventoryRow[];
  }): Promise<CostLookup> {
    const fromEc2CostHistory = await this.loadCostLookupFromEc2CostHistoryDaily(input);
    if (fromEc2CostHistory) {
      return fromEc2CostHistory;
    }

    return this.loadCostLookupFromFactCostLineItems(input);
  }

  private async loadCostLookupFromEc2CostHistoryDaily(input: {
    tenantId: string;
    rows: InventoryRow[];
  }): Promise<CostLookup | null> {
    try {
      const columns = await sequelize.query<Ec2CostHistoryColumnRow>(
        `
          SELECT column_name
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'ec2_cost_history_daily';
        `,
        {
          type: QueryTypes.SELECT,
        },
      );

      if (columns.length === 0) {
        return null;
      }

      const config = resolveEc2CostHistoryConfig(columns.map((column) => column.column_name));
      if (!config) {
        return null;
      }

      const instanceIds = Array.from(new Set(input.rows.map((row) => row.instanceId)));
      if (instanceIds.length === 0) {
        return {
          byConnectionInstance: new Map(),
          byDimensionInstance: new Map(),
          byInstance: new Map(),
        };
      }

      const tableAlias = "ecd";
      const instanceExpr = `${tableAlias}.${quoteIdentifier(config.instanceColumn)}`;
      const dateExpr = `${tableAlias}.${quoteIdentifier(config.dateColumn)}`;
      const costExpr = `${tableAlias}.${quoteIdentifier(config.costColumn)}`;
      const cloudConnectionExpr = config.cloudConnectionColumn
        ? `COALESCE(${tableAlias}.${quoteIdentifier(config.cloudConnectionColumn)}::text, '')`
        : "''::text";

      const whereParts = [`${instanceExpr} = ANY($1::text[])`];
      const bind: unknown[] = [instanceIds];
      let nextIndex = 2;

      if (config.tenantColumn) {
        whereParts.push(`${tableAlias}.${quoteIdentifier(config.tenantColumn)} = $${nextIndex}`);
        bind.push(input.tenantId);
        nextIndex += 1;
      }

      const connectionIds = Array.from(
        new Set(
          input.rows
            .map((row) => row.cloudConnectionId)
            .filter((value): value is string => Boolean(value)),
        ),
      );
      if (config.cloudConnectionColumn && connectionIds.length > 0) {
        whereParts.push(`
          (
            ${cloudConnectionExpr} = ANY($${nextIndex}::text[])
            OR ${cloudConnectionExpr} = ''
          )
        `);
        bind.push(connectionIds);
        nextIndex += 1;
      }

      const rows = await sequelize.query<Ec2CostHistoryCostRow>(
        `
          WITH scoped AS (
            SELECT
              ${cloudConnectionExpr} AS cloud_connection_key,
              ${instanceExpr}::text AS instance_id,
              ${dateExpr}::date AS usage_date,
              COALESCE(${costExpr}::numeric, 0) AS daily_cost
            FROM ec2_cost_history_daily ${tableAlias}
            WHERE ${whereParts.join(" AND ")}
          ),
          latest_usage AS (
            SELECT
              scoped.cloud_connection_key,
              scoped.instance_id,
              MAX(scoped.usage_date) AS latest_usage_date
            FROM scoped
            GROUP BY scoped.cloud_connection_key, scoped.instance_id
          )
          SELECT
            scoped.cloud_connection_key AS "cloudConnectionKey",
            scoped.instance_id AS "instanceId",
            COALESCE(
              SUM(
                CASE
                  WHEN scoped.usage_date >= DATE_TRUNC('month', CURRENT_DATE)::date THEN scoped.daily_cost
                  ELSE 0
                END
              ),
              0
            )::double precision AS "monthToDateCost",
            COALESCE(
              SUM(
                CASE
                  WHEN scoped.usage_date = latest_usage.latest_usage_date THEN scoped.daily_cost
                  ELSE 0
                END
              ),
              0
            )::double precision AS "latestDailyCost"
          FROM scoped
          INNER JOIN latest_usage
            ON latest_usage.cloud_connection_key = scoped.cloud_connection_key
            AND latest_usage.instance_id = scoped.instance_id
          GROUP BY scoped.cloud_connection_key, scoped.instance_id;
        `,
        {
          bind,
          type: QueryTypes.SELECT,
        },
      );

      const byConnectionInstance = new Map<string, CostSummary>();
      const byInstance = new Map<string, CostSummary>();
      for (const row of rows) {
        const summary = {
          monthToDateCost: toNumberOrZero(row.monthToDateCost),
          latestDailyCost: toNumberOrZero(row.latestDailyCost),
        };
        byConnectionInstance.set(
          toConnectionInstanceKey(row.cloudConnectionKey || null, row.instanceId),
          summary,
        );
        if (!byInstance.has(row.instanceId)) {
          byInstance.set(row.instanceId, summary);
        }
      }

      return {
        byConnectionInstance,
        byDimensionInstance: new Map(),
        byInstance,
      };
    } catch {
      return null;
    }
  }

  private async loadCostLookupFromFactCostLineItems(input: {
    tenantId: string;
    rows: InventoryRow[];
  }): Promise<CostLookup> {
    const instanceIds = Array.from(new Set(input.rows.map((row) => row.instanceId)));
    if (instanceIds.length === 0) {
      return {
        byConnectionInstance: new Map(),
        byDimensionInstance: new Map(),
        byInstance: new Map(),
      };
    }

    const rows = await sequelize.query<FactCostFallbackRow>(
      `
        WITH daily AS (
          SELECT
            dr.resource_id AS instance_id,
            fcli.sub_account_key::text AS sub_account_key,
            fcli.region_key::text AS region_key,
            dd.full_date AS usage_date,
            SUM(COALESCE(fcli.billed_cost, fcli.effective_cost, fcli.list_cost, 0))::numeric AS daily_cost
          FROM fact_cost_line_items fcli
          INNER JOIN dim_resource dr
            ON dr.id = fcli.resource_key
          INNER JOIN dim_date dd
            ON dd.id = fcli.usage_date_key
          WHERE fcli.tenant_id = $1
            AND dr.tenant_id = $1
            AND dr.resource_id = ANY($2::text[])
          GROUP BY dr.resource_id, fcli.sub_account_key, fcli.region_key, dd.full_date
        ),
        latest_usage AS (
          SELECT
            daily.instance_id,
            daily.sub_account_key,
            daily.region_key,
            MAX(daily.usage_date) AS latest_usage_date
          FROM daily
          GROUP BY daily.instance_id, daily.sub_account_key, daily.region_key
        )
        SELECT
          daily.instance_id AS "instanceId",
          daily.sub_account_key AS "subAccountKey",
          daily.region_key AS "regionKey",
          COALESCE(
            SUM(
              CASE
                WHEN daily.usage_date >= DATE_TRUNC('month', CURRENT_DATE)::date THEN daily.daily_cost
                ELSE 0
              END
            ),
            0
          )::double precision AS "monthToDateCost",
          COALESCE(
            SUM(
              CASE
                WHEN daily.usage_date = latest_usage.latest_usage_date THEN daily.daily_cost
                ELSE 0
              END
            ),
            0
          )::double precision AS "latestDailyCost"
        FROM daily
        INNER JOIN latest_usage
          ON latest_usage.instance_id = daily.instance_id
          AND COALESCE(latest_usage.sub_account_key, '') = COALESCE(daily.sub_account_key, '')
          AND COALESCE(latest_usage.region_key, '') = COALESCE(daily.region_key, '')
        GROUP BY daily.instance_id, daily.sub_account_key, daily.region_key;
      `,
      {
        bind: [input.tenantId, instanceIds],
        type: QueryTypes.SELECT,
      },
    );

    const byDimensionInstance = new Map<string, CostSummary>();
    const byInstance = new Map<string, CostSummary>();

    for (const row of rows) {
      const summary = {
        monthToDateCost: toNumberOrZero(row.monthToDateCost),
        latestDailyCost: toNumberOrZero(row.latestDailyCost),
      };
      byDimensionInstance.set(
        toDimensionInstanceKey(row.subAccountKey, row.regionKey, row.instanceId),
        summary,
      );
      if (!byInstance.has(row.instanceId)) {
        byInstance.set(row.instanceId, summary);
      }
    }

    return {
      byConnectionInstance: new Map(),
      byDimensionInstance,
      byInstance,
    };
  }
}

