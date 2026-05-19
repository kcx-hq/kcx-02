import { QueryTypes } from "sequelize";

import { sequelize } from "../../../../../models/index.js";
import { logger } from "../../../../../utils/logger.js";
import { DbAwsValidationError } from "../../errors/db-aws.errors.js";

export type MergeDbUtilizationIntoFactsParams = {
  tenantId: string;
  cloudConnectionId: string;
  usageDates?: string[] | null;
  resourceIds?: string[] | null;
};

export type MergeDbUtilizationIntoFactsResult = {
  updatedRows: number;
};

type MergeCountRow = {
  updated_count: string | number;
};

const toRequired = (value: unknown, field: string): string => {
  const normalized = typeof value === "string" ? value.trim() : "";
  if (!normalized) {
    throw new DbAwsValidationError(`${field} is required`, { field });
  }
  return normalized;
};

const toUniqueNonEmptyStrings = (values: unknown): string[] => {
  if (!Array.isArray(values)) return [];
  const normalized = values
    .map((value) => (typeof value === "string" ? value.trim() : ""))
    .filter((value) => value.length > 0);
  return Array.from(new Set(normalized));
};

export const mergeDbUtilizationIntoFacts = async (
  params: MergeDbUtilizationIntoFactsParams,
): Promise<MergeDbUtilizationIntoFactsResult> => {
  const tenantId = toRequired(params.tenantId, "tenantId");
  const cloudConnectionId = toRequired(params.cloudConnectionId, "cloudConnectionId");
  const usageDates = toUniqueNonEmptyStrings(params.usageDates);
  const resourceIds = toUniqueNonEmptyStrings(params.resourceIds);
  const hasUsageDateFilter = usageDates.length > 0;
  const hasResourceIdFilter = resourceIds.length > 0;

  const rows = await sequelize.query<MergeCountRow>(
    `
WITH source_rows AS (
  SELECT
    u.tenant_id,
    u.cloud_connection_id,
    u.usage_date,
    u.resource_id,
    u.cpu_avg,
    u.cpu_max,
    u.load_avg,
    u.connections_avg,
    u.connections_max,
    u.request_count,
    u.read_iops,
    u.write_iops,
    u.read_throughput_bytes,
    u.write_throughput_bytes,
    u.storage_used_gb
  FROM db_utilization_daily u
  WHERE u.tenant_id = CAST(:tenantId AS UUID)
    AND u.cloud_connection_id = CAST(:cloudConnectionId AS UUID)
    AND (
      :hasUsageDateFilter = FALSE
      OR u.usage_date IN (:usageDates)
    )
    AND (
      :hasResourceIdFilter = FALSE
      OR u.resource_id IN (:resourceIds)
    )
),
direct_updated AS (
  UPDATE fact_db_resource_daily f
  SET
    cpu_avg = s.cpu_avg,
    cpu_max = s.cpu_max,
    load_avg = s.load_avg,
    connections_avg = s.connections_avg,
    connections_max = s.connections_max,
    request_count = s.request_count,
    read_iops = s.read_iops,
    write_iops = s.write_iops,
    read_throughput_bytes = s.read_throughput_bytes,
    write_throughput_bytes = s.write_throughput_bytes,
    storage_used_gb = s.storage_used_gb,
    updated_at = NOW()
  FROM source_rows s
  WHERE f.tenant_id = s.tenant_id
    AND f.cloud_connection_id = s.cloud_connection_id
    AND f.usage_date = s.usage_date
    AND f.resource_id = s.resource_id
  RETURNING f.tenant_id, f.cloud_connection_id, f.usage_date, f.resource_id
),
unmatched_source_rows AS (
  SELECT s.*
  FROM source_rows s
  LEFT JOIN direct_updated d
    ON d.tenant_id = s.tenant_id
   AND d.cloud_connection_id = s.cloud_connection_id
   AND d.usage_date = s.usage_date
   AND d.resource_id = s.resource_id
  WHERE d.resource_id IS NULL
),
inventory_clusters AS (
  SELECT
    inv.tenant_id,
    inv.cloud_connection_id,
    inv.resource_id,
    inv.resource_arn,
    inv.resource_name,
    inv.cluster_id,
    inv.metadata_json,
    CASE
      WHEN inv.resource_arn LIKE 'arn:%:cluster:%'
        AND COALESCE(NULLIF(inv.metadata_json->>'dbClusterResourceId', ''), '') <> ''
      THEN regexp_replace(
        inv.resource_arn,
        ':cluster:[^:]+$',
        ':cluster:' || (inv.metadata_json->>'dbClusterResourceId')
      )
      ELSE NULL
    END AS legacy_cluster_arn
  FROM db_resource_inventory_snapshots inv
  WHERE inv.tenant_id = CAST(:tenantId AS UUID)
    AND inv.cloud_connection_id = CAST(:cloudConnectionId AS UUID)
    AND inv.is_current = TRUE
    AND (
      COALESCE(inv.resource_type, '') = 'db_cluster'
      OR COALESCE(inv.db_service, '') = 'aurora'
    )
),
cluster_aliases AS (
  SELECT tenant_id, cloud_connection_id, resource_id AS canonical_resource_id, resource_id AS alias_key
  FROM inventory_clusters
  WHERE NULLIF(resource_id, '') IS NOT NULL
  UNION ALL
  SELECT tenant_id, cloud_connection_id, resource_id AS canonical_resource_id, resource_arn AS alias_key
  FROM inventory_clusters
  WHERE NULLIF(resource_arn, '') IS NOT NULL
  UNION ALL
  SELECT tenant_id, cloud_connection_id, resource_id AS canonical_resource_id, resource_name AS alias_key
  FROM inventory_clusters
  WHERE NULLIF(resource_name, '') IS NOT NULL
  UNION ALL
  SELECT tenant_id, cloud_connection_id, resource_id AS canonical_resource_id, cluster_id AS alias_key
  FROM inventory_clusters
  WHERE NULLIF(cluster_id, '') IS NOT NULL
  UNION ALL
  SELECT tenant_id, cloud_connection_id, resource_id AS canonical_resource_id, metadata_json->>'dbClusterArn' AS alias_key
  FROM inventory_clusters
  WHERE NULLIF(metadata_json->>'dbClusterArn', '') IS NOT NULL
  UNION ALL
  SELECT tenant_id, cloud_connection_id, resource_id AS canonical_resource_id, metadata_json->>'dbClusterIdentifier' AS alias_key
  FROM inventory_clusters
  WHERE NULLIF(metadata_json->>'dbClusterIdentifier', '') IS NOT NULL
  UNION ALL
  SELECT tenant_id, cloud_connection_id, resource_id AS canonical_resource_id, metadata_json->>'dbClusterResourceId' AS alias_key
  FROM inventory_clusters
  WHERE NULLIF(metadata_json->>'dbClusterResourceId', '') IS NOT NULL
  UNION ALL
  SELECT tenant_id, cloud_connection_id, resource_id AS canonical_resource_id, legacy_cluster_arn AS alias_key
  FROM inventory_clusters
  WHERE NULLIF(legacy_cluster_arn, '') IS NOT NULL
),
fallback_matches AS (
  SELECT
    s.tenant_id,
    s.cloud_connection_id,
    s.usage_date,
    s.resource_id AS utilization_resource_id,
    s.cpu_avg,
    s.cpu_max,
    s.load_avg,
    s.connections_avg,
    s.connections_max,
    s.request_count,
    s.read_iops,
    s.write_iops,
    s.read_throughput_bytes,
    s.write_throughput_bytes,
    s.storage_used_gb,
    ca.canonical_resource_id AS matched_resource_id,
    ic.legacy_cluster_arn AS matched_legacy_cluster_arn,
    ic.resource_name AS matched_cluster_identifier
  FROM unmatched_source_rows s
  JOIN cluster_aliases ca
    ON ca.tenant_id = s.tenant_id
   AND ca.cloud_connection_id = s.cloud_connection_id
   AND ca.alias_key = s.resource_id
  JOIN inventory_clusters ic
    ON ic.tenant_id = ca.tenant_id
   AND ic.cloud_connection_id = ca.cloud_connection_id
   AND ic.resource_id = ca.canonical_resource_id
),
fallback_updated AS (
  UPDATE fact_db_resource_daily f
  SET
    cpu_avg = m.cpu_avg,
    cpu_max = m.cpu_max,
    load_avg = m.load_avg,
    connections_avg = m.connections_avg,
    connections_max = m.connections_max,
    request_count = m.request_count,
    read_iops = m.read_iops,
    write_iops = m.write_iops,
    read_throughput_bytes = m.read_throughput_bytes,
    write_throughput_bytes = m.write_throughput_bytes,
    storage_used_gb = m.storage_used_gb,
    updated_at = NOW()
  FROM fallback_matches m
  WHERE f.tenant_id = m.tenant_id
    AND f.cloud_connection_id = m.cloud_connection_id
    AND f.usage_date = m.usage_date
    AND (
      f.resource_id = m.matched_resource_id
      OR (
        COALESCE(f.resource_type, '') = 'cluster'
        AND (
          f.resource_id = m.matched_legacy_cluster_arn
          OR f.resource_arn = m.matched_legacy_cluster_arn
          OR f.resource_name = m.matched_legacy_cluster_arn
          OR f.cluster_id = m.matched_cluster_identifier
          OR f.resource_name = m.matched_cluster_identifier
        )
      )
    )
  RETURNING 1
),
heuristic_matches AS (
  SELECT
    s.tenant_id,
    s.cloud_connection_id,
    s.usage_date,
    s.resource_id AS utilization_resource_id,
    s.cpu_avg,
    s.cpu_max,
    s.load_avg,
    s.connections_avg,
    s.connections_max,
    s.request_count,
    s.read_iops,
    s.write_iops,
    s.read_throughput_bytes,
    s.write_throughput_bytes,
    s.storage_used_gb,
    f.resource_id AS matched_fact_resource_id,
    COUNT(*) OVER (
      PARTITION BY s.tenant_id, s.cloud_connection_id, s.usage_date, s.resource_id
    ) AS candidate_count
  FROM unmatched_source_rows s
  JOIN fact_db_resource_daily f
    ON f.tenant_id = s.tenant_id
   AND f.cloud_connection_id = s.cloud_connection_id
   AND f.usage_date = s.usage_date
   AND COALESCE(f.resource_type, '') = 'cluster'
   AND f.resource_id LIKE 'arn:aws:rds:%:cluster:%'
   AND LOWER(COALESCE(f.db_engine, '')) LIKE '%aurora%'
   AND split_part(f.resource_id, ':', 4) = split_part(s.resource_id, ':', 4)
   AND split_part(f.resource_id, ':', 5) = split_part(s.resource_id, ':', 5)
  WHERE s.resource_id LIKE 'arn:aws:rds:%:cluster:%'
),
heuristic_updated AS (
  UPDATE fact_db_resource_daily f
  SET
    cpu_avg = m.cpu_avg,
    cpu_max = m.cpu_max,
    load_avg = m.load_avg,
    connections_avg = m.connections_avg,
    connections_max = m.connections_max,
    request_count = m.request_count,
    read_iops = m.read_iops,
    write_iops = m.write_iops,
    read_throughput_bytes = m.read_throughput_bytes,
    write_throughput_bytes = m.write_throughput_bytes,
    storage_used_gb = m.storage_used_gb,
    updated_at = NOW()
  FROM heuristic_matches m
  WHERE m.candidate_count = 1
    AND f.tenant_id = m.tenant_id
    AND f.cloud_connection_id = m.cloud_connection_id
    AND f.usage_date = m.usage_date
    AND f.resource_id = m.matched_fact_resource_id
  RETURNING 1
),
counts AS (
  SELECT (SELECT COUNT(*) FROM direct_updated)::bigint AS direct_count,
         (SELECT COUNT(*) FROM fallback_updated)::bigint AS fallback_count,
         (SELECT COUNT(*) FROM heuristic_updated)::bigint AS heuristic_count
)
SELECT (direct_count + fallback_count + heuristic_count)::text AS updated_count
FROM counts;
`,
    {
      type: QueryTypes.SELECT,
      replacements: {
        tenantId,
        cloudConnectionId,
        hasUsageDateFilter,
        hasResourceIdFilter,
        usageDates,
        resourceIds,
      },
    },
  );

  const updatedRows = Number(rows[0]?.updated_count ?? 0);

  logger.info("DB utilization merge into facts completed", {
    tenantId,
    cloudConnectionId,
    usageDateCount: usageDates.length,
    resourceIdCount: resourceIds.length,
    updatedRows,
  });

  return { updatedRows };
};
