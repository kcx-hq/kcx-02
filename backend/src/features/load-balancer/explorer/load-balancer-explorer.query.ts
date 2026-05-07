import { QueryTypes } from "sequelize";

import { sequelize } from "../../../models/index.js";
import type { LoadBalancerExplorerInput, LoadBalancerExplorerTagFilter } from "./load-balancer-explorer.types.js";

const toTagValueFilterSql = (input: { keyParam: string; valueParam: string }): string =>
  `LOWER(COALESCE(NULLIF(TRIM(lb.tags ->> :${input.keyParam}), ''), '')) = LOWER(:${input.valueParam})`;

const normalizeList = (items: string[] | undefined): string[] =>
  [...new Set((items ?? []).map((item) => item.trim()).filter(Boolean))];

const toInventoryScopeWhereClauses = (input: LoadBalancerExplorerInput): {
  whereSql: string;
  replacements: Record<string, unknown>;
} => {
  const whereClauses: string[] = [
    "lb.cloud_connection_id IN (SELECT cc.id FROM cloud_connections cc WHERE cc.tenant_id = CAST(:tenantId AS uuid))",
  ];
  const replacements: Record<string, unknown> = {
    tenantId: input.scope.tenantId,
    startDate: input.startDate,
    endDate: input.endDate,
  };

  if (typeof input.filters.cloudConnectionId === "string" && input.filters.cloudConnectionId.trim().length > 0) {
    whereClauses.push("lb.cloud_connection_id = CAST(:cloudConnectionId AS uuid)");
    replacements.cloudConnectionId = input.filters.cloudConnectionId.trim();
  }

  if (typeof input.filters.accountId === "string" && input.filters.accountId.trim().length > 0) {
    whereClauses.push("lb.account_id = :accountId");
    replacements.accountId = input.filters.accountId.trim();
  }

  const regions = normalizeList(input.filters.regions);
  if (regions.length > 0) {
    whereClauses.push("LOWER(COALESCE(lb.region, '')) IN (:regionsLower)");
    replacements.regionsLower = regions.map((item) => item.toLowerCase());
  }

  const types = normalizeList(input.filters.types);
  if (types.length > 0) {
    whereClauses.push("LOWER(COALESCE(lb.type, 'unknown')) IN (:typesLower)");
    replacements.typesLower = types.map((item) => item.toLowerCase());
  }

  const schemes = normalizeList(input.filters.schemes);
  if (schemes.length > 0) {
    whereClauses.push("LOWER(COALESCE(lb.scheme, 'unknown')) IN (:schemesLower)");
    replacements.schemesLower = schemes.map((item) => item.toLowerCase());
  }

  const states = normalizeList(input.filters.states);
  if (states.length > 0) {
    whereClauses.push("LOWER(COALESCE(lb.state, 'unknown')) IN (:statesLower)");
    replacements.statesLower = states.map((item) => item.toLowerCase());
  }

  const teams = normalizeList(input.filters.teams);
  if (teams.length > 0) {
    whereClauses.push(
      "LOWER(COALESCE(NULLIF(TRIM(lb.tags ->> 'team'), ''), NULLIF(TRIM(lb.tags ->> 'Team'), ''), 'Unassigned')) IN (:teamsLower)",
    );
    replacements.teamsLower = teams.map((item) => item.toLowerCase());
  }

  const products = normalizeList(input.filters.products);
  if (products.length > 0) {
    whereClauses.push(
      "LOWER(COALESCE(NULLIF(TRIM(lb.tags ->> 'product'), ''), NULLIF(TRIM(lb.tags ->> 'Product'), ''), 'Unassigned')) IN (:productsLower)",
    );
    replacements.productsLower = products.map((item) => item.toLowerCase());
  }

  const environments = normalizeList(input.filters.environments);
  if (environments.length > 0) {
    whereClauses.push(
      "LOWER(COALESCE(NULLIF(TRIM(lb.tags ->> 'environment'), ''), NULLIF(TRIM(lb.tags ->> 'Environment'), ''), 'Unassigned')) IN (:environmentsLower)",
    );
    replacements.environmentsLower = environments.map((item) => item.toLowerCase());
  }

  input.filters.tags.forEach((tagFilter: LoadBalancerExplorerTagFilter, index: number) => {
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

type RawCostSummaryRow = {
  totalCost: number | string | null;
  fixedCost: number | string | null;
  lcuCost: number | string | null;
  dataProcessingCost: number | string | null;
  loadBalancerCount: number | string | null;
};

type RawCostTrendRow = {
  usageDate: string;
  totalCost: number | string | null;
  fixedCost: number | string | null;
  lcuCost: number | string | null;
  dataProcessingCost: number | string | null;
};

type RawCostGroupByRow = {
  group: string | null;
  totalCost: number | string | null;
  fixedCost: number | string | null;
  lcuCost: number | string | null;
  dataProcessingCost: number | string | null;
  loadBalancerCount: number | string | null;
};

type RawCostTrendGroupRow = {
  usageDate: string;
  group: string | null;
  totalCost: number | string | null;
  fixedCost: number | string | null;
  lcuCost: number | string | null;
  dataProcessingCost: number | string | null;
};

type RawLoadBalancerSummaryRow = {
  totalLoadBalancers: number | string | null;
  albCount: number | string | null;
  nlbCount: number | string | null;
  internetFacingCount: number | string | null;
  internalCount: number | string | null;
};

type RawLoadBalancerGroupByRow = {
  group: string | null;
  loadBalancerCount: number | string | null;
  totalCost: number | string | null;
  avgCost: number | string | null;
  fixedCost: number | string | null;
  lcuCost: number | string | null;
  dataProcessingCost: number | string | null;
};

const toNumber = (value: number | string | null | undefined): number => {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
};

const toGroupBySql = (input: LoadBalancerExplorerInput): string => {
  if (input.groupBy === "account") return "base.account_id";
  if (input.groupBy === "region") return "base.region";
  if (input.groupBy === "type") return "base.type";
  if (input.groupBy === "scheme") return "base.scheme";
  if (input.groupBy === "state") return "base.state";
  if (input.groupBy === "team") return "base.team";
  if (input.groupBy === "product") return "base.product";
  if (input.groupBy === "environment") return "base.environment";
  if (input.groupBy === "load_balancer") return "base.load_balancer";
  if (input.groupBy === "tag") {
    if (!input.tagKey || input.tagKey.trim().length === 0) return "'Unspecified'";
    return "COALESCE(NULLIF(TRIM(base.tags_json ->> :groupTagKey), ''), 'Unspecified')";
  }
  return "'total'";
};

export class LoadBalancerExplorerQuery {
  async getCostSummary(input: LoadBalancerExplorerInput): Promise<{
    totalCost: number;
    fixedCost: number;
    lcuCost: number;
    dataProcessingCost: number;
    loadBalancerCount: number;
  }> {
    const scoped = toInventoryScopeWhereClauses(input);

    const rows = await sequelize.query<RawCostSummaryRow>(
      `
        WITH filtered_lb AS (
          SELECT
            lb.cloud_connection_id,
            lb.account_id,
            lb.region,
            lb.arn
          FROM load_balancers lb
          WHERE ${scoped.whereSql}
        ),
        cost_by_lb AS (
          SELECT
            lcd.cloud_connection_id,
            lcd.account_id,
            lcd.region,
            lcd.load_balancer_arn,
            SUM(COALESCE(lcd.total_cost, 0))::double precision AS total_cost,
            SUM(COALESCE(lcd.fixed_cost, 0))::double precision AS fixed_cost,
            SUM(COALESCE(lcd.lcu_cost, 0))::double precision AS lcu_cost,
            SUM(COALESCE(lcd.data_processing_cost, 0))::double precision AS data_processing_cost
          FROM load_balancer_cost_daily lcd
          WHERE lcd.usage_date BETWEEN :startDate::date AND :endDate::date
          GROUP BY
            lcd.cloud_connection_id,
            lcd.account_id,
            lcd.region,
            lcd.load_balancer_arn
        )
        SELECT
          COALESCE(SUM(COALESCE(cb.total_cost, 0)), 0)::double precision AS "totalCost",
          COALESCE(SUM(COALESCE(cb.fixed_cost, 0)), 0)::double precision AS "fixedCost",
          COALESCE(SUM(COALESCE(cb.lcu_cost, 0)), 0)::double precision AS "lcuCost",
          COALESCE(SUM(COALESCE(cb.data_processing_cost, 0)), 0)::double precision AS "dataProcessingCost",
          COUNT(*)::int AS "loadBalancerCount"
        FROM filtered_lb flb
        LEFT JOIN cost_by_lb cb
          ON cb.cloud_connection_id IS NOT DISTINCT FROM flb.cloud_connection_id
         AND cb.account_id = flb.account_id
         AND cb.region = flb.region
         AND cb.load_balancer_arn = flb.arn;
      `,
      { replacements: scoped.replacements, type: QueryTypes.SELECT },
    );

    const row = rows[0];
    return {
      totalCost: toNumber(row?.totalCost),
      fixedCost: toNumber(row?.fixedCost),
      lcuCost: toNumber(row?.lcuCost),
      dataProcessingCost: toNumber(row?.dataProcessingCost),
      loadBalancerCount: Math.trunc(toNumber(row?.loadBalancerCount)),
    };
  }

  async getCostTrend(input: LoadBalancerExplorerInput): Promise<Array<{
    usageDate: string;
    totalCost: number;
    fixedCost: number;
    lcuCost: number;
    dataProcessingCost: number;
  }>> {
    const scoped = toInventoryScopeWhereClauses(input);

    const rows = await sequelize.query<RawCostTrendRow>(
      `
        WITH filtered_lb AS (
          SELECT
            lb.cloud_connection_id,
            lb.account_id,
            lb.region,
            lb.arn
          FROM load_balancers lb
          WHERE ${scoped.whereSql}
        ),
        daily_cost AS (
          SELECT
            lcd.usage_date::text AS usage_date,
            SUM(COALESCE(lcd.total_cost, 0))::double precision AS total_cost,
            SUM(COALESCE(lcd.fixed_cost, 0))::double precision AS fixed_cost,
            SUM(COALESCE(lcd.lcu_cost, 0))::double precision AS lcu_cost,
            SUM(COALESCE(lcd.data_processing_cost, 0))::double precision AS data_processing_cost
          FROM load_balancer_cost_daily lcd
          INNER JOIN filtered_lb flb
            ON lcd.cloud_connection_id IS NOT DISTINCT FROM flb.cloud_connection_id
           AND lcd.account_id = flb.account_id
           AND lcd.region = flb.region
           AND lcd.load_balancer_arn = flb.arn
          WHERE lcd.usage_date BETWEEN :startDate::date AND :endDate::date
          GROUP BY lcd.usage_date::text
        ),
        date_series AS (
          SELECT generate_series(:startDate::date, :endDate::date, interval '1 day')::date::text AS usage_date
        )
        SELECT
          ds.usage_date AS "usageDate",
          COALESCE(dc.total_cost, 0)::double precision AS "totalCost",
          COALESCE(dc.fixed_cost, 0)::double precision AS "fixedCost",
          COALESCE(dc.lcu_cost, 0)::double precision AS "lcuCost",
          COALESCE(dc.data_processing_cost, 0)::double precision AS "dataProcessingCost"
        FROM date_series ds
        LEFT JOIN daily_cost dc
          ON dc.usage_date = ds.usage_date
        ORDER BY ds.usage_date ASC;
      `,
      { replacements: scoped.replacements, type: QueryTypes.SELECT },
    );

    return rows.map((row) => ({
      usageDate: row.usageDate,
      totalCost: toNumber(row.totalCost),
      fixedCost: toNumber(row.fixedCost),
      lcuCost: toNumber(row.lcuCost),
      dataProcessingCost: toNumber(row.dataProcessingCost),
    }));
  }

  async getCostGroupBy(input: LoadBalancerExplorerInput): Promise<Array<{
    group: string;
    totalCost: number;
    fixedCost: number;
    lcuCost: number;
    dataProcessingCost: number;
    loadBalancerCount: number;
  }>> {
    const scoped = toInventoryScopeWhereClauses(input);
    const groupExpr = toGroupBySql(input);
    const replacements: Record<string, unknown> = {
      ...scoped.replacements,
      ...(input.groupBy === "tag" ? { groupTagKey: input.tagKey } : {}),
    };

    const rows = await sequelize.query<RawCostGroupByRow>(
      `
        WITH filtered_lb AS (
          SELECT
            lb.cloud_connection_id,
            lb.account_id,
            lb.region,
            lb.arn,
            COALESCE(NULLIF(TRIM(lb.name), ''), lb.arn)::text AS load_balancer,
            COALESCE(NULLIF(TRIM(lb.type), ''), 'unknown')::text AS type,
            COALESCE(NULLIF(TRIM(lb.scheme), ''), 'unknown')::text AS scheme,
            COALESCE(NULLIF(TRIM(lb.state), ''), 'unknown')::text AS state,
            COALESCE(NULLIF(TRIM(lb.tags ->> 'team'), ''), NULLIF(TRIM(lb.tags ->> 'Team'), ''), 'Unassigned')::text AS team,
            COALESCE(NULLIF(TRIM(lb.tags ->> 'product'), ''), NULLIF(TRIM(lb.tags ->> 'Product'), ''), 'Unassigned')::text AS product,
            COALESCE(NULLIF(TRIM(lb.tags ->> 'environment'), ''), NULLIF(TRIM(lb.tags ->> 'Environment'), ''), 'Unassigned')::text AS environment,
            lb.tags AS tags_json
          FROM load_balancers lb
          WHERE ${scoped.whereSql}
        ),
        cost_by_lb AS (
          SELECT
            lcd.cloud_connection_id,
            lcd.account_id,
            lcd.region,
            lcd.load_balancer_arn,
            SUM(COALESCE(lcd.total_cost, 0))::double precision AS total_cost,
            SUM(COALESCE(lcd.fixed_cost, 0))::double precision AS fixed_cost,
            SUM(COALESCE(lcd.lcu_cost, 0))::double precision AS lcu_cost,
            SUM(COALESCE(lcd.data_processing_cost, 0))::double precision AS data_processing_cost
          FROM load_balancer_cost_daily lcd
          WHERE lcd.usage_date BETWEEN :startDate::date AND :endDate::date
          GROUP BY
            lcd.cloud_connection_id,
            lcd.account_id,
            lcd.region,
            lcd.load_balancer_arn
        ),
        base AS (
          SELECT
            flb.*, 
            COALESCE(cb.total_cost, 0)::double precision AS total_cost,
            COALESCE(cb.fixed_cost, 0)::double precision AS fixed_cost,
            COALESCE(cb.lcu_cost, 0)::double precision AS lcu_cost,
            COALESCE(cb.data_processing_cost, 0)::double precision AS data_processing_cost
          FROM filtered_lb flb
          LEFT JOIN cost_by_lb cb
            ON cb.cloud_connection_id IS NOT DISTINCT FROM flb.cloud_connection_id
           AND cb.account_id = flb.account_id
           AND cb.region = flb.region
           AND cb.load_balancer_arn = flb.arn
        )
        SELECT
          ${groupExpr}::text AS "group",
          SUM(base.total_cost)::double precision AS "totalCost",
          SUM(base.fixed_cost)::double precision AS "fixedCost",
          SUM(base.lcu_cost)::double precision AS "lcuCost",
          SUM(base.data_processing_cost)::double precision AS "dataProcessingCost",
          COUNT(*)::int AS "loadBalancerCount"
        FROM base
        GROUP BY ${groupExpr}
        ORDER BY "totalCost" DESC, "group" ASC;
      `,
      { replacements, type: QueryTypes.SELECT },
    );

    return rows.map((row) => ({
      group: (row.group ?? "Unknown").trim() || "Unknown",
      totalCost: toNumber(row.totalCost),
      fixedCost: toNumber(row.fixedCost),
      lcuCost: toNumber(row.lcuCost),
      dataProcessingCost: toNumber(row.dataProcessingCost),
      loadBalancerCount: Math.trunc(toNumber(row.loadBalancerCount)),
    }));
  }

  async getCostTrendGrouped(input: LoadBalancerExplorerInput): Promise<Array<{
    usageDate: string;
    group: string;
    totalCost: number;
    fixedCost: number;
    lcuCost: number;
    dataProcessingCost: number;
  }>> {
    const scoped = toInventoryScopeWhereClauses(input);
    const groupExpr = toGroupBySql(input).replaceAll("base.", "flb.");
    const replacements: Record<string, unknown> = {
      ...scoped.replacements,
      ...(input.groupBy === "tag" ? { groupTagKey: input.tagKey } : {}),
    };

    const rows = await sequelize.query<RawCostTrendGroupRow>(
      `
        WITH filtered_lb AS (
          SELECT
            lb.cloud_connection_id,
            lb.account_id,
            lb.region,
            lb.arn,
            COALESCE(NULLIF(TRIM(lb.name), ''), lb.arn)::text AS load_balancer,
            COALESCE(NULLIF(TRIM(lb.type), ''), 'unknown')::text AS type,
            COALESCE(NULLIF(TRIM(lb.scheme), ''), 'unknown')::text AS scheme,
            COALESCE(NULLIF(TRIM(lb.state), ''), 'unknown')::text AS state,
            COALESCE(NULLIF(TRIM(lb.tags ->> 'team'), ''), NULLIF(TRIM(lb.tags ->> 'Team'), ''), 'Unassigned')::text AS team,
            COALESCE(NULLIF(TRIM(lb.tags ->> 'product'), ''), NULLIF(TRIM(lb.tags ->> 'Product'), ''), 'Unassigned')::text AS product,
            COALESCE(NULLIF(TRIM(lb.tags ->> 'environment'), ''), NULLIF(TRIM(lb.tags ->> 'Environment'), ''), 'Unassigned')::text AS environment,
            lb.tags AS tags_json
          FROM load_balancers lb
          WHERE ${scoped.whereSql}
        ),
        base AS (
          SELECT
            lcd.usage_date::text AS usage_date,
            ${groupExpr}::text AS group_value,
            COALESCE(lcd.total_cost, 0)::double precision AS total_cost,
            COALESCE(lcd.fixed_cost, 0)::double precision AS fixed_cost,
            COALESCE(lcd.lcu_cost, 0)::double precision AS lcu_cost,
            COALESCE(lcd.data_processing_cost, 0)::double precision AS data_processing_cost
          FROM load_balancer_cost_daily lcd
          INNER JOIN filtered_lb flb
            ON lcd.cloud_connection_id IS NOT DISTINCT FROM flb.cloud_connection_id
           AND lcd.account_id = flb.account_id
           AND lcd.region = flb.region
           AND lcd.load_balancer_arn = flb.arn
          WHERE lcd.usage_date BETWEEN :startDate::date AND :endDate::date
        )
        SELECT
          base.usage_date AS "usageDate",
          base.group_value AS "group",
          SUM(base.total_cost)::double precision AS "totalCost",
          SUM(base.fixed_cost)::double precision AS "fixedCost",
          SUM(base.lcu_cost)::double precision AS "lcuCost",
          SUM(base.data_processing_cost)::double precision AS "dataProcessingCost"
        FROM base
        GROUP BY base.usage_date, base.group_value
        ORDER BY base.usage_date ASC, "totalCost" DESC, base.group_value ASC;
      `,
      { replacements, type: QueryTypes.SELECT },
    );

    return rows.map((row) => ({
      usageDate: row.usageDate,
      group: (row.group ?? "Unknown").trim() || "Unknown",
      totalCost: toNumber(row.totalCost),
      fixedCost: toNumber(row.fixedCost),
      lcuCost: toNumber(row.lcuCost),
      dataProcessingCost: toNumber(row.dataProcessingCost),
    }));
  }

  async getLoadBalancersSummary(input: LoadBalancerExplorerInput): Promise<{
    totalLoadBalancers: number;
    albCount: number;
    nlbCount: number;
    internetFacingCount: number;
    internalCount: number;
  }> {
    const scoped = toInventoryScopeWhereClauses(input);

    const rows = await sequelize.query<RawLoadBalancerSummaryRow>(
      `
        SELECT
          COUNT(*)::int AS "totalLoadBalancers",
          COUNT(*) FILTER (WHERE LOWER(COALESCE(lb.type, '')) = 'application')::int AS "albCount",
          COUNT(*) FILTER (WHERE LOWER(COALESCE(lb.type, '')) = 'network')::int AS "nlbCount",
          COUNT(*) FILTER (WHERE LOWER(COALESCE(lb.scheme, '')) = 'internet-facing')::int AS "internetFacingCount",
          COUNT(*) FILTER (WHERE LOWER(COALESCE(lb.scheme, '')) = 'internal')::int AS "internalCount"
        FROM load_balancers lb
        WHERE ${scoped.whereSql};
      `,
      { replacements: scoped.replacements, type: QueryTypes.SELECT },
    );

    const row = rows[0];
    return {
      totalLoadBalancers: Math.trunc(toNumber(row?.totalLoadBalancers)),
      albCount: Math.trunc(toNumber(row?.albCount)),
      nlbCount: Math.trunc(toNumber(row?.nlbCount)),
      internetFacingCount: Math.trunc(toNumber(row?.internetFacingCount)),
      internalCount: Math.trunc(toNumber(row?.internalCount)),
    };
  }

  async getLoadBalancersGroupBy(input: LoadBalancerExplorerInput): Promise<Array<{
    group: string;
    loadBalancerCount: number;
    totalCost: number;
    avgCost: number;
    fixedCost: number;
    lcuCost: number;
    dataProcessingCost: number;
  }>> {
    const scoped = toInventoryScopeWhereClauses(input);
    const groupExpr = toGroupBySql(input);
    const replacements: Record<string, unknown> = {
      ...scoped.replacements,
      ...(input.groupBy === "tag" ? { groupTagKey: input.tagKey } : {}),
    };

    const rows = await sequelize.query<RawLoadBalancerGroupByRow>(
      `
        WITH filtered_lb AS (
          SELECT
            lb.cloud_connection_id,
            lb.account_id,
            lb.region,
            lb.arn,
            COALESCE(NULLIF(TRIM(lb.name), ''), lb.arn)::text AS load_balancer,
            COALESCE(NULLIF(TRIM(lb.type), ''), 'unknown')::text AS type,
            COALESCE(NULLIF(TRIM(lb.scheme), ''), 'unknown')::text AS scheme,
            COALESCE(NULLIF(TRIM(lb.state), ''), 'unknown')::text AS state,
            COALESCE(NULLIF(TRIM(lb.tags ->> 'team'), ''), NULLIF(TRIM(lb.tags ->> 'Team'), ''), 'Unassigned')::text AS team,
            COALESCE(NULLIF(TRIM(lb.tags ->> 'product'), ''), NULLIF(TRIM(lb.tags ->> 'Product'), ''), 'Unassigned')::text AS product,
            COALESCE(NULLIF(TRIM(lb.tags ->> 'environment'), ''), NULLIF(TRIM(lb.tags ->> 'Environment'), ''), 'Unassigned')::text AS environment,
            lb.tags AS tags_json
          FROM load_balancers lb
          WHERE ${scoped.whereSql}
        ),
        cost_by_lb AS (
          SELECT
            lcd.cloud_connection_id,
            lcd.account_id,
            lcd.region,
            lcd.load_balancer_arn,
            SUM(COALESCE(lcd.total_cost, 0))::double precision AS total_cost,
            SUM(COALESCE(lcd.fixed_cost, 0))::double precision AS fixed_cost,
            SUM(COALESCE(lcd.lcu_cost, 0))::double precision AS lcu_cost,
            SUM(COALESCE(lcd.data_processing_cost, 0))::double precision AS data_processing_cost
          FROM load_balancer_cost_daily lcd
          WHERE lcd.usage_date BETWEEN :startDate::date AND :endDate::date
          GROUP BY
            lcd.cloud_connection_id,
            lcd.account_id,
            lcd.region,
            lcd.load_balancer_arn
        ),
        base AS (
          SELECT
            flb.*, 
            COALESCE(cb.total_cost, 0)::double precision AS total_cost,
            COALESCE(cb.fixed_cost, 0)::double precision AS fixed_cost,
            COALESCE(cb.lcu_cost, 0)::double precision AS lcu_cost,
            COALESCE(cb.data_processing_cost, 0)::double precision AS data_processing_cost
          FROM filtered_lb flb
          LEFT JOIN cost_by_lb cb
            ON cb.cloud_connection_id IS NOT DISTINCT FROM flb.cloud_connection_id
           AND cb.account_id = flb.account_id
           AND cb.region = flb.region
           AND cb.load_balancer_arn = flb.arn
        )
        SELECT
          ${groupExpr}::text AS "group",
          COUNT(*)::int AS "loadBalancerCount",
          SUM(base.total_cost)::double precision AS "totalCost",
          AVG(base.total_cost)::double precision AS "avgCost",
          SUM(base.fixed_cost)::double precision AS "fixedCost",
          SUM(base.lcu_cost)::double precision AS "lcuCost",
          SUM(base.data_processing_cost)::double precision AS "dataProcessingCost"
        FROM base
        GROUP BY ${groupExpr}
        ORDER BY "loadBalancerCount" DESC, "group" ASC;
      `,
      { replacements, type: QueryTypes.SELECT },
    );

    return rows.map((row) => ({
      group: (row.group ?? "Unknown").trim() || "Unknown",
      loadBalancerCount: Math.trunc(toNumber(row.loadBalancerCount)),
      totalCost: toNumber(row.totalCost),
      avgCost: toNumber(row.avgCost),
      fixedCost: toNumber(row.fixedCost),
      lcuCost: toNumber(row.lcuCost),
      dataProcessingCost: toNumber(row.dataProcessingCost),
    }));
  }
}
