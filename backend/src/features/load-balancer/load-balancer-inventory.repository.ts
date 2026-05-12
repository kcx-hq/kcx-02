import { QueryTypes } from "sequelize";

import { sequelize } from "../../models/index.js";
import type {
  LoadBalancerInventoryRow,
  LoadBalancerListenerInventoryRow,
  LoadBalancerTargetGroupInventoryRow,
} from "./load-balancer-inventory.types.js";

const chunk = <T>(items: T[], size: number): T[][] => {
  if (size <= 0) return [items];
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
};

export class LoadBalancerInventoryRepository {
  async upsertLoadBalancers(rows: LoadBalancerInventoryRow[], chunkSize = 200): Promise<number> {
    if (rows.length === 0) return 0;

    let affected = 0;
    for (const batch of chunk(rows, chunkSize)) {
      const { sql, bind } = buildLoadBalancerUpsertSql(batch);
      await sequelize.query(sql, { bind, type: QueryTypes.INSERT });
      affected += batch.length;
    }
    return affected;
  }

  async upsertTargetGroups(rows: LoadBalancerTargetGroupInventoryRow[], chunkSize = 200): Promise<number> {
    if (rows.length === 0) return 0;

    let affected = 0;
    for (const batch of chunk(rows, chunkSize)) {
      const { sql, bind } = buildTargetGroupUpsertSql(batch);
      await sequelize.query(sql, { bind, type: QueryTypes.INSERT });
      affected += batch.length;
    }
    return affected;
  }

  async upsertListeners(rows: LoadBalancerListenerInventoryRow[], chunkSize = 200): Promise<number> {
    if (rows.length === 0) return 0;

    let affected = 0;
    for (const batch of chunk(rows, chunkSize)) {
      const { sql, bind } = buildListenerUpsertSql(batch);
      await sequelize.query(sql, { bind, type: QueryTypes.INSERT });
      affected += batch.length;
    }
    return affected;
  }
}

const buildLoadBalancerUpsertSql = (rows: LoadBalancerInventoryRow[]): { sql: string; bind: unknown[] } => {
  const columns = [
    "cloud_connection_id",
    "account_id",
    "region",
    "arn",
    "name",
    "type",
    "scheme",
    "state",
    "vpc_id",
    "dns_name",
    "created_at_aws",
    "security_groups",
    "availability_zones",
    "tags",
    "listener_count",
    "target_group_count",
    "last_synced_at",
    "created_at",
    "updated_at",
  ] as const;

  const bind: unknown[] = [];
  const valuesSql: string[] = [];
  let p = 1;

  for (const row of rows) {
    const placeholders: string[] = [];
    const push = (value: unknown) => {
      bind.push(value);
      placeholders.push(`$${p}`);
      p += 1;
    };

    push(row.cloudConnectionId);
    push(row.accountId);
    push(row.region);
    push(row.arn);
    push(row.name);
    push(row.type);
    push(row.scheme);
    push(row.state);
    push(row.vpcId);
    push(row.dnsName);
    push(row.createdAtAws);
    push(row.securityGroups ? JSON.stringify(row.securityGroups) : null);
    push(row.availabilityZones ? JSON.stringify(row.availabilityZones) : null);
    push(row.tags ? JSON.stringify(row.tags) : null);
    push(row.listenerCount);
    push(row.targetGroupCount);
    push(row.lastSyncedAt);
    push(row.createdAt);
    push(row.updatedAt);

    valuesSql.push(`(${placeholders.join(", ")})`);
  }

  const sql = `
    INSERT INTO load_balancers (${columns.join(", ")})
    VALUES
      ${valuesSql.join(",\n      ")}
    ON CONFLICT (cloud_connection_id, account_id, region, arn)
    DO UPDATE SET
      name = EXCLUDED.name,
      type = EXCLUDED.type,
      scheme = EXCLUDED.scheme,
      state = EXCLUDED.state,
      vpc_id = EXCLUDED.vpc_id,
      dns_name = EXCLUDED.dns_name,
      created_at_aws = EXCLUDED.created_at_aws,
      security_groups = EXCLUDED.security_groups,
      availability_zones = EXCLUDED.availability_zones,
      tags = EXCLUDED.tags,
      listener_count = EXCLUDED.listener_count,
      target_group_count = EXCLUDED.target_group_count,
      last_synced_at = EXCLUDED.last_synced_at,
      updated_at = EXCLUDED.updated_at;
  `;

  return { sql, bind };
};

const buildTargetGroupUpsertSql = (rows: LoadBalancerTargetGroupInventoryRow[]): { sql: string; bind: unknown[] } => {
  const columns = [
    "cloud_connection_id",
    "account_id",
    "region",
    "arn",
    "name",
    "load_balancer_arn",
    "protocol",
    "port",
    "target_type",
    "vpc_id",
    "health_check_protocol",
    "health_check_path",
    "healthy_target_count",
    "unhealthy_target_count",
    "tags",
    "last_synced_at",
    "created_at",
    "updated_at",
  ] as const;

  const bind: unknown[] = [];
  const valuesSql: string[] = [];
  let p = 1;

  for (const row of rows) {
    const placeholders: string[] = [];
    const push = (value: unknown) => {
      bind.push(value);
      placeholders.push(`$${p}`);
      p += 1;
    };

    push(row.cloudConnectionId);
    push(row.accountId);
    push(row.region);
    push(row.arn);
    push(row.name);
    push(row.loadBalancerArn);
    push(row.protocol);
    push(row.port);
    push(row.targetType);
    push(row.vpcId);
    push(row.healthCheckProtocol);
    push(row.healthCheckPath);
    push(row.healthyTargetCount);
    push(row.unhealthyTargetCount);
    push(row.tags ? JSON.stringify(row.tags) : null);
    push(row.lastSyncedAt);
    push(row.createdAt);
    push(row.updatedAt);

    valuesSql.push(`(${placeholders.join(", ")})`);
  }

  const sql = `
    INSERT INTO load_balancer_target_groups (${columns.join(", ")})
    VALUES
      ${valuesSql.join(",\n      ")}
    ON CONFLICT (cloud_connection_id, account_id, region, arn)
    DO UPDATE SET
      name = EXCLUDED.name,
      load_balancer_arn = EXCLUDED.load_balancer_arn,
      protocol = EXCLUDED.protocol,
      port = EXCLUDED.port,
      target_type = EXCLUDED.target_type,
      vpc_id = EXCLUDED.vpc_id,
      health_check_protocol = EXCLUDED.health_check_protocol,
      health_check_path = EXCLUDED.health_check_path,
      healthy_target_count = EXCLUDED.healthy_target_count,
      unhealthy_target_count = EXCLUDED.unhealthy_target_count,
      tags = EXCLUDED.tags,
      last_synced_at = EXCLUDED.last_synced_at,
      updated_at = EXCLUDED.updated_at;
  `;

  return { sql, bind };
};

const buildListenerUpsertSql = (rows: LoadBalancerListenerInventoryRow[]): { sql: string; bind: unknown[] } => {
  const columns = [
    "cloud_connection_id",
    "account_id",
    "region",
    "arn",
    "load_balancer_arn",
    "protocol",
    "port",
    "ssl_policy",
    "certificates",
    "default_actions",
    "last_synced_at",
    "created_at",
    "updated_at",
  ] as const;

  const bind: unknown[] = [];
  const valuesSql: string[] = [];
  let p = 1;

  for (const row of rows) {
    const placeholders: string[] = [];
    const push = (value: unknown) => {
      bind.push(value);
      placeholders.push(`$${p}`);
      p += 1;
    };

    push(row.cloudConnectionId);
    push(row.accountId);
    push(row.region);
    push(row.arn);
    push(row.loadBalancerArn);
    push(row.protocol);
    push(row.port);
    push(row.sslPolicy);
    push(row.certificates ? JSON.stringify(row.certificates) : null);
    push(row.defaultActions ? JSON.stringify(row.defaultActions) : null);
    push(row.lastSyncedAt);
    push(row.createdAt);
    push(row.updatedAt);

    valuesSql.push(`(${placeholders.join(", ")})`);
  }

  const sql = `
    INSERT INTO load_balancer_listeners (${columns.join(", ")})
    VALUES
      ${valuesSql.join(",\n      ")}
    ON CONFLICT (cloud_connection_id, account_id, region, arn)
    DO UPDATE SET
      load_balancer_arn = EXCLUDED.load_balancer_arn,
      protocol = EXCLUDED.protocol,
      port = EXCLUDED.port,
      ssl_policy = EXCLUDED.ssl_policy,
      certificates = EXCLUDED.certificates,
      default_actions = EXCLUDED.default_actions,
      last_synced_at = EXCLUDED.last_synced_at,
      updated_at = EXCLUDED.updated_at;
  `;

  return { sql, bind };
};
