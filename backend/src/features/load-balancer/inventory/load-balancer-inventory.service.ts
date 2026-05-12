import { QueryTypes } from "sequelize";

import { sequelize } from "../../../models/index.js";
import type {
  InventoryLoadBalancerDetailItem,
  InventoryLoadBalancerDetailListener,
  InventoryLoadBalancerDetailTargetGroup,
  InventoryLoadBalancersListItem,
  InventoryLoadBalancersListQuery,
  InventoryLoadBalancersListResponse,
} from "./load-balancer-inventory.types.js";

type DateRange = { startDate: string; endDate: string };

type InventoryListRow = {
  id: string;
  arn: string | null;
  name: string | null;
  type: string | null;
  scheme: string | null;
  state: string | null;
  region: string | null;
  vpcId: string | null;
  dnsName: string | null;
  createdAtAws: Date | string | null;
  accountId: string | null;
  tags: Record<string, unknown> | null;
  totalCost: number | string | null;
  fixedCost: number | string | null;
  lcuCost: number | string | null;
  dataProcessingCost: number | string | null;
};

type InventoryCountRow = { total: number | string | null };
type InventoryDetailRow = {
  id: string;
  cloudConnectionId: string | null;
  arn: string | null;
  name: string | null;
  type: string | null;
  scheme: string | null;
  state: string | null;
  region: string | null;
  vpcId: string | null;
  dnsName: string | null;
  createdAtAws: Date | string | null;
  accountId: string | null;
  tags: Record<string, unknown> | null;
};

type InventoryDetailTargetGroupRow = {
  arn: string | null;
  name: string | null;
  protocol: string | null;
  port: number | string | null;
  targetType: string | null;
  healthyTargetCount: number | string | null;
  unhealthyTargetCount: number | string | null;
};

type InventoryDetailListenerRow = {
  arn: string | null;
  protocol: string | null;
  port: number | string | null;
  sslPolicy: string | null;
  defaultActions: unknown[] | Record<string, unknown> | null;
};

const toIsoDate = (value: Date): string => value.toISOString().slice(0, 10);
const toNumber = (value: number | string | null | undefined): number => {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
};

const resolveDateRange = (query: InventoryLoadBalancersListQuery): DateRange => {
  const today = new Date();
  const startOfMonth = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
  const parsedStart = query.startDate ? new Date(`${query.startDate}T00:00:00Z`) : null;
  const parsedEnd = query.endDate ? new Date(`${query.endDate}T00:00:00Z`) : null;

  const startDate = parsedStart && !Number.isNaN(parsedStart.getTime()) ? parsedStart : startOfMonth;
  const endDate = parsedEnd && !Number.isNaN(parsedEnd.getTime()) ? parsedEnd : today;

  if (startDate.getTime() <= endDate.getTime()) {
    return { startDate: toIsoDate(startDate), endDate: toIsoDate(endDate) };
  }
  return { startDate: toIsoDate(endDate), endDate: toIsoDate(startDate) };
};

const SORT_COLUMN_SQL: Record<InventoryLoadBalancersListQuery["sortBy"], string> = {
  name: "COALESCE(NULLIF(TRIM(flb.name), ''), flb.arn)",
  type: "COALESCE(flb.type, '')",
  scheme: "COALESCE(flb.scheme, '')",
  region: "COALESCE(flb.region, '')",
  totalCost: "COALESCE(cost.total_cost, 0)",
  fixedCost: "COALESCE(cost.fixed_cost, 0)",
  lcuCost: "COALESCE(cost.lcu_cost, 0)",
  dataProcessingCost: "COALESCE(cost.data_processing_cost, 0)",
};

export class LoadBalancerInventoryListService {
  async listLoadBalancers(input: {
    tenantId: string;
    query: InventoryLoadBalancersListQuery;
  }): Promise<InventoryLoadBalancersListResponse> {
    const { tenantId, query } = input;
    const dateRange = resolveDateRange(query);
    const page = Math.max(1, query.page);
    const pageSize = Math.max(1, query.pageSize);
    const offset = (page - 1) * pageSize;
    const sortColumn = SORT_COLUMN_SQL[query.sortBy] ?? SORT_COLUMN_SQL.name;
    const sortDirection = query.sortDirection === "desc" ? "DESC" : "ASC";

    const whereClauses: string[] = [
      "cc.tenant_id = CAST(:tenantId AS uuid)",
      "lb.cloud_connection_id = cc.id",
    ];
    const replacements: Record<string, unknown> = {
      tenantId,
      startDate: dateRange.startDate,
      endDate: dateRange.endDate,
      limit: pageSize,
      offset,
    };

    if (query.search) {
      whereClauses.push("(LOWER(COALESCE(lb.name, '')) LIKE :search OR LOWER(lb.arn) LIKE :search)");
      replacements.search = `%${query.search.toLowerCase()}%`;
    }
    if (query.account) {
      whereClauses.push("LOWER(COALESCE(lb.account_id, '')) LIKE :account");
      replacements.account = `%${query.account.toLowerCase()}%`;
    }
    if (query.region) {
      whereClauses.push("LOWER(COALESCE(lb.region, '')) LIKE :region");
      replacements.region = `%${query.region.toLowerCase()}%`;
    }
    if (query.type) {
      whereClauses.push("LOWER(COALESCE(lb.type, '')) LIKE :type");
      replacements.type = `%${query.type.toLowerCase()}%`;
    }
    if (query.scheme) {
      whereClauses.push("LOWER(COALESCE(lb.scheme, '')) LIKE :scheme");
      replacements.scheme = `%${query.scheme.toLowerCase()}%`;
    }
    if (query.state) {
      whereClauses.push("LOWER(COALESCE(lb.state, '')) LIKE :state");
      replacements.state = `%${query.state.toLowerCase()}%`;
    }
    if (query.team) {
      whereClauses.push("LOWER(COALESCE(NULLIF(TRIM(lb.tags ->> 'team'), ''), NULLIF(TRIM(lb.tags ->> 'Team'), ''))) LIKE :team");
      replacements.team = `%${query.team.toLowerCase()}%`;
    }
    if (query.product) {
      whereClauses.push("LOWER(COALESCE(NULLIF(TRIM(lb.tags ->> 'product'), ''), NULLIF(TRIM(lb.tags ->> 'Product'), ''))) LIKE :product");
      replacements.product = `%${query.product.toLowerCase()}%`;
    }
    if (query.environment) {
      whereClauses.push("LOWER(COALESCE(NULLIF(TRIM(lb.tags ->> 'environment'), ''), NULLIF(TRIM(lb.tags ->> 'Environment'), ''))) LIKE :environment");
      replacements.environment = `%${query.environment.toLowerCase()}%`;
    }
    query.tags.forEach((tag, index) => {
      const keyParam = `tagKey${index}`;
      const valParam = `tagVal${index}`;
      whereClauses.push(`LOWER(COALESCE(NULLIF(TRIM(lb.tags ->> :${keyParam}), ''), '')) = LOWER(:${valParam})`);
      replacements[keyParam] = tag.key;
      replacements[valParam] = tag.value;
    });

    const whereSql = whereClauses.join("\n          AND ");

    const rows = await sequelize.query<InventoryListRow>(
      `
      WITH filtered_lb AS (
        SELECT DISTINCT ON (lb.arn)
          lb.id,
          lb.cloud_connection_id,
          lb.arn,
          lb.name,
          lb.type,
          lb.scheme,
          lb.state,
          lb.region,
          lb.vpc_id,
          lb.dns_name,
          lb.created_at_aws,
          lb.account_id,
          lb.tags,
          lb.updated_at
        FROM load_balancers lb
        JOIN cloud_connections cc
          ON lb.cloud_connection_id = cc.id
        WHERE ${whereSql}
        ORDER BY lb.arn ASC, lb.updated_at DESC, lb.id DESC
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
        JOIN filtered_lb flb2
          ON flb2.cloud_connection_id IS NOT DISTINCT FROM lcd.cloud_connection_id
         AND flb2.account_id = lcd.account_id
         AND flb2.region = lcd.region
         AND flb2.arn = lcd.load_balancer_arn
        WHERE lcd.usage_date BETWEEN :startDate::date AND :endDate::date
        GROUP BY lcd.cloud_connection_id, lcd.account_id, lcd.region, lcd.load_balancer_arn
      )
      SELECT
        flb.id::text AS id,
        flb.arn,
        flb.name,
        flb.type,
        flb.scheme,
        flb.state,
        flb.region,
        flb.vpc_id AS "vpcId",
        flb.dns_name AS "dnsName",
        flb.created_at_aws AS "createdAtAws",
        flb.account_id AS "accountId",
        flb.tags,
        COALESCE(cost.total_cost, 0)::double precision AS "totalCost",
        COALESCE(cost.fixed_cost, 0)::double precision AS "fixedCost",
        COALESCE(cost.lcu_cost, 0)::double precision AS "lcuCost",
        COALESCE(cost.data_processing_cost, 0)::double precision AS "dataProcessingCost"
      FROM filtered_lb flb
      LEFT JOIN cost_by_lb cost
        ON cost.cloud_connection_id IS NOT DISTINCT FROM flb.cloud_connection_id
       AND cost.account_id = flb.account_id
       AND cost.region = flb.region
       AND cost.load_balancer_arn = flb.arn
      ORDER BY ${sortColumn} ${sortDirection}, flb.id ASC
      LIMIT :limit OFFSET :offset;
      `,
      { replacements, type: QueryTypes.SELECT },
    );

    const countRows = await sequelize.query<InventoryCountRow>(
      `
      SELECT COUNT(*)::bigint AS total
      FROM (
        SELECT DISTINCT lb.arn
        FROM load_balancers lb
        JOIN cloud_connections cc
          ON lb.cloud_connection_id = cc.id
        WHERE ${whereSql}
      ) deduped;
      `,
      { replacements, type: QueryTypes.SELECT },
    );

    const total = Math.max(0, Math.trunc(toNumber(countRows[0]?.total)));
    const items: InventoryLoadBalancersListItem[] = rows.map((row) => ({
      id: row.id,
      arn: row.arn,
      name: (row.name && row.name.trim().length > 0 ? row.name : row.arn) ?? "Unknown Load Balancer",
      type: row.type,
      scheme: row.scheme,
      state: row.state,
      region: row.region,
      vpcId: row.vpcId,
      dnsName: row.dnsName,
      createdAtAws:
        row.createdAtAws instanceof Date
          ? row.createdAtAws.toISOString()
          : typeof row.createdAtAws === "string"
            ? row.createdAtAws
            : null,
      accountId: row.accountId,
      team: (row.tags?.team as string | undefined) ?? (row.tags?.Team as string | undefined) ?? null,
      product: (row.tags?.product as string | undefined) ?? (row.tags?.Product as string | undefined) ?? null,
      environment: (row.tags?.environment as string | undefined) ?? (row.tags?.Environment as string | undefined) ?? null,
      totalCost: toNumber(row.totalCost),
      fixedCost: toNumber(row.fixedCost),
      lcuCost: toNumber(row.lcuCost),
      dataProcessingCost: toNumber(row.dataProcessingCost),
      tags: row.tags,
    }));

    return {
      items,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: total > 0 ? Math.ceil(total / pageSize) : 0,
      },
    };
  }

  async getLoadBalancerDetail(input: {
    tenantId: string;
    loadBalancerId: string;
  }): Promise<InventoryLoadBalancerDetailItem | null> {
    const loadBalancerId = input.loadBalancerId.trim();
    if (!loadBalancerId) return null;

    const rows = await sequelize.query<InventoryDetailRow>(
      `
      SELECT
        lb.id::text AS id,
        lb.cloud_connection_id::text AS "cloudConnectionId",
        lb.arn,
        lb.name,
        lb.type,
        lb.scheme,
        lb.state,
        lb.region,
        lb.vpc_id AS "vpcId",
        lb.dns_name AS "dnsName",
        lb.created_at_aws AS "createdAtAws",
        lb.account_id AS "accountId",
        lb.tags
      FROM load_balancers lb
      JOIN cloud_connections cc
        ON lb.cloud_connection_id = cc.id
      WHERE cc.tenant_id = CAST(:tenantId AS uuid)
        AND (
          lb.id::text = :loadBalancerId
          OR lb.arn = :loadBalancerId
          OR lb.name = :loadBalancerId
        )
      ORDER BY lb.updated_at DESC, lb.id DESC
      LIMIT 1;
      `,
      {
        replacements: {
          tenantId: input.tenantId,
          loadBalancerId,
        },
        type: QueryTypes.SELECT,
      },
    );

    const row = rows[0];
    if (!row) return null;

    const targetGroupsRows = await sequelize.query<InventoryDetailTargetGroupRow>(
      `
      SELECT
        tg.arn,
        tg.name,
        tg.protocol,
        tg.port,
        tg.target_type AS "targetType",
        tg.healthy_target_count AS "healthyTargetCount",
        tg.unhealthy_target_count AS "unhealthyTargetCount"
      FROM load_balancer_target_groups tg
      WHERE tg.cloud_connection_id::text IS NOT DISTINCT FROM :cloudConnectionId
        AND tg.account_id IS NOT DISTINCT FROM :accountId
        AND tg.region IS NOT DISTINCT FROM :region
        AND tg.load_balancer_arn IS NOT DISTINCT FROM :loadBalancerArn
      ORDER BY COALESCE(NULLIF(TRIM(tg.name), ''), tg.arn) ASC;
      `,
      {
        replacements: {
          cloudConnectionId: row.cloudConnectionId,
          accountId: row.accountId,
          region: row.region,
          loadBalancerArn: row.arn,
        },
        type: QueryTypes.SELECT,
      },
    );

    const listenerRows = await sequelize.query<InventoryDetailListenerRow>(
      `
      SELECT
        li.arn,
        li.protocol,
        li.port,
        li.ssl_policy AS "sslPolicy",
        li.default_actions AS "defaultActions"
      FROM load_balancer_listeners li
      WHERE li.cloud_connection_id::text IS NOT DISTINCT FROM :cloudConnectionId
        AND li.account_id IS NOT DISTINCT FROM :accountId
        AND li.region IS NOT DISTINCT FROM :region
        AND li.load_balancer_arn IS NOT DISTINCT FROM :loadBalancerArn
      ORDER BY li.port ASC NULLS LAST, li.arn ASC;
      `,
      {
        replacements: {
          cloudConnectionId: row.cloudConnectionId,
          accountId: row.accountId,
          region: row.region,
          loadBalancerArn: row.arn,
        },
        type: QueryTypes.SELECT,
      },
    );

    const targetGroups: InventoryLoadBalancerDetailTargetGroup[] = targetGroupsRows
      .filter((item) => Boolean(item.arn))
      .map((item) => ({
        arn: item.arn as string,
        name: item.name,
        protocol: item.protocol,
        port: item.port === null ? null : Math.trunc(toNumber(item.port)),
        targetType: item.targetType,
        healthyTargetCount: Math.trunc(toNumber(item.healthyTargetCount)),
        unhealthyTargetCount: Math.trunc(toNumber(item.unhealthyTargetCount)),
      }));

    const listeners: InventoryLoadBalancerDetailListener[] = listenerRows
      .filter((item) => Boolean(item.arn))
      .map((item) => ({
        arn: item.arn as string,
        protocol: item.protocol,
        port: item.port === null ? null : Math.trunc(toNumber(item.port)),
        sslPolicy: item.sslPolicy,
        defaultActions: item.defaultActions,
      }));

    return {
      id: row.id,
      arn: row.arn,
      name: (row.name && row.name.trim().length > 0 ? row.name : row.arn) ?? "Unknown Load Balancer",
      type: row.type,
      scheme: row.scheme,
      state: row.state,
      region: row.region,
      vpcId: row.vpcId,
      dnsName: row.dnsName,
      createdAtAws:
        row.createdAtAws instanceof Date
          ? row.createdAtAws.toISOString()
          : typeof row.createdAtAws === "string"
            ? row.createdAtAws
            : null,
      accountId: row.accountId,
      cloudConnectionId: row.cloudConnectionId,
      tags: row.tags,
      targetGroups,
      listeners,
    };
  }
}
