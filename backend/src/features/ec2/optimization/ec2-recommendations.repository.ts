import { QueryTypes } from "sequelize";

import { FactRecommendations, sequelize } from "../../../models/index.js";
import { classifyExplorerCostCategory } from "../classification/cost-category-classifier.js";
import type {
  Ec2RecommendationRecord,
  Ec2RecommendationStatus,
  Ec2RecommendationsQuery,
  Ec2RefreshRecommendationsInput,
} from "./ec2-recommendations.types.js";

const SOURCE_SYSTEMS = ["KCX_EC2_OPTIMIZATION_V1", "KCX_EC2_OPTIMIZATION"] as const;

type InstanceCandidateRow = {
  cloudConnectionId: string | null;
  billingSourceId: number | null;
  awsAccountId: string | null;
  awsRegionCode: string | null;
  regionKey: number | null;
  subAccountKey: number | null;
  instanceId: string;
  instanceName: string | null;
  state: string | null;
  avgCpu: number | null;
  avgDailyNetworkMb: number | null;
  runningHours: number | null;
  computeCost: number | null;
  totalCost: number | null;
  pricingType: string | null;
  coveredHours: number | null;
  tagsJson: Record<string, unknown> | null;
};

type VolumeCandidateRow = {
  cloudConnectionId: string | null;
  billingSourceId: number | null;
  awsAccountId: string | null;
  awsRegionCode: string | null;
  regionKey: number | null;
  subAccountKey: number | null;
  volumeId: string;
  volumeName: string | null;
  volumeState: string | null;
  attachedInstanceId: string | null;
  attachedInstanceState: string | null;
  sizeGb: number | null;
  discoveredAt: Date | null;
  createdAt: Date | null;
  firstSeenAt: Date | null;
  volumeCost: number | null;
  avgReadOps: number | null;
  avgWriteOps: number | null;
  avgReadBytes: number | null;
  avgWriteBytes: number | null;
  isUnattached: boolean | null;
  factState: string | null;
  tagsJson: Record<string, unknown> | null;
};

type SnapshotCandidateRow = {
  cloudConnectionId: string | null;
  billingSourceId: number | null;
  awsAccountId: string | null;
  awsRegionCode: string | null;
  regionKey: number | null;
  subAccountKey: number | null;
  snapshotId: string;
  snapshotState: string | null;
  sourceVolumeId: string | null;
  sourceVolumeState: string | null;
  sourceVolumeDeletedAt: Date | null;
  hasActiveSourceVolume: boolean | null;
  startTime: Date | null;
  snapshotCost: number | null;
  tagsJson: Record<string, unknown> | null;
};

type InstanceNetworkCostLineItemRow = {
  cloudConnectionId: string | null;
  billingSourceId: number | null;
  awsAccountId: string | null;
  awsRegionCode: string | null;
  regionKey: number | null;
  subAccountKey: number | null;
  instanceId: string;
  instanceName: string | null;
  usageType: string | null;
  productUsageType: string | null;
  productFamily: string | null;
  operation: string | null;
  lineItemDescription: string | null;
  fromLocation: string | null;
  toLocation: string | null;
  fromRegionCode: string | null;
  toRegionCode: string | null;
  cost: number | null;
  usageQuantity: number | null;
};

type InstanceUsageSummaryRow = {
  cloudConnectionId: string | null;
  billingSourceId: number | null;
  awsAccountId: string | null;
  awsRegionCode: string | null;
  regionKey: number | null;
  subAccountKey: number | null;
  instanceId: string;
  instanceName: string | null;
  state: string | null;
  avgCpu: number | null;
  totalNetworkUsageGb: number | null;
  totalEffectiveCost: number | null;
  runningDays: number | null;
};

type EipCandidateRow = {
  cloudConnectionId: string | null;
  billingSourceId: number | null;
  awsAccountId: string | null;
  awsRegionCode: string | null;
  regionKey: number | null;
  subAccountKey: number | null;
  allocationId: string;
  publicIp: string | null;
  associationStatus: string | null;
  isAttached: boolean | null;
  estimatedEipCost: number | null;
};

const toUpperStatus = (status: Ec2RecommendationStatus): string => status.toUpperCase();
const toLowerStatus = (status: string | null | undefined): Ec2RecommendationStatus => {
  const normalized = (status ?? "OPEN").trim().toLowerCase();
  if (normalized === "open" || normalized === "accepted" || normalized === "ignored" || normalized === "snoozed" || normalized === "completed") {
    return normalized;
  }
  return "open";
};

export class Ec2RecommendationsRepository {
  async getInstanceCandidates(input: Ec2RefreshRecommendationsInput): Promise<InstanceCandidateRow[]> {
    return sequelize.query<InstanceCandidateRow>(
      `
      WITH grouped AS (
        SELECT
          d.cloud_connection_id AS "cloudConnectionId",
          d.billing_source_id AS "billingSourceId",
          d.instance_id AS "instanceId",
          SUM(COALESCE(d.total_hours, 0))::double precision AS "runningHours",
          AVG(d.cpu_avg::double precision) FILTER (WHERE d.cpu_avg IS NOT NULL) AS "avgCpu",
          AVG((COALESCE(d.network_in_bytes, 0) + COALESCE(d.network_out_bytes, 0))::double precision) / (1024 * 1024) AS "avgDailyNetworkMb",
          SUM(COALESCE(d.compute_cost, 0))::double precision AS "computeCost",
          SUM(COALESCE(d.total_effective_cost, d.total_billed_cost, 0))::double precision AS "totalCost",
          SUM(COALESCE(d.covered_hours, 0))::double precision AS "coveredHours",
          MAX(LOWER(COALESCE(NULLIF(TRIM(d.reservation_type), ''), NULLIF(TRIM(d.pricing_model), ''), CASE WHEN COALESCE(d.is_spot, FALSE) THEN 'spot' ELSE 'on_demand' END))) AS "pricingType"
        FROM fact_ec2_instance_daily d
        WHERE d.tenant_id = :tenantId
          AND d.usage_date >= :dateFrom::date
          AND d.usage_date < (:dateTo::date + INTERVAL '1 day')
          AND (:cloudConnectionId::uuid IS NULL OR d.cloud_connection_id = :cloudConnectionId::uuid)
          AND (:billingSourceId::bigint IS NULL OR d.billing_source_id = :billingSourceId::bigint)
        GROUP BY d.cloud_connection_id, d.billing_source_id, d.instance_id
      ),
      latest AS (
        SELECT DISTINCT ON (d.cloud_connection_id, d.billing_source_id, d.instance_id)
          d.cloud_connection_id,
          d.billing_source_id,
          d.instance_id,
          COALESCE(NULLIF(TRIM(d.instance_name), ''), d.instance_id) AS instance_name,
          d.state,
          d.region_key,
          d.sub_account_key
        FROM fact_ec2_instance_daily d
        WHERE d.tenant_id = :tenantId
          AND d.usage_date >= :dateFrom::date
          AND d.usage_date < (:dateTo::date + INTERVAL '1 day')
          AND (:cloudConnectionId::uuid IS NULL OR d.cloud_connection_id = :cloudConnectionId::uuid)
          AND (:billingSourceId::bigint IS NULL OR d.billing_source_id = :billingSourceId::bigint)
        ORDER BY d.cloud_connection_id, d.billing_source_id, d.instance_id, d.usage_date DESC
      )
      SELECT
        g."cloudConnectionId",
        g."billingSourceId",
        dsa.sub_account_id::text AS "awsAccountId",
        COALESCE(dr.region_id, dr.region_name)::text AS "awsRegionCode",
        l.region_key AS "regionKey",
        l.sub_account_key AS "subAccountKey",
        l.instance_id::text AS "instanceId",
        l.instance_name::text AS "instanceName",
        l.state::text AS state,
        g."avgCpu",
        g."avgDailyNetworkMb",
        g."runningHours",
        g."computeCost",
        g."totalCost",
        g."pricingType",
        g."coveredHours",
        eis.tags_json AS "tagsJson"
      FROM grouped g
      INNER JOIN latest l
        ON l.cloud_connection_id IS NOT DISTINCT FROM g."cloudConnectionId"
       AND l.billing_source_id IS NOT DISTINCT FROM g."billingSourceId"
       AND l.instance_id = g."instanceId"
      LEFT JOIN dim_sub_account dsa ON dsa.id = l.sub_account_key
      LEFT JOIN dim_region dr ON dr.id = l.region_key
      LEFT JOIN ec2_instance_inventory_snapshots eis
        ON eis.tenant_id = :tenantId::uuid
       AND eis.cloud_connection_id IS NOT DISTINCT FROM l.cloud_connection_id
       AND eis.instance_id = l.instance_id
       AND eis.is_current = TRUE;
      `,
      {
        replacements: input,
        type: QueryTypes.SELECT,
      },
    );
  }

  async getVolumeCandidates(input: Ec2RefreshRecommendationsInput): Promise<VolumeCandidateRow[]> {
    return sequelize.query<VolumeCandidateRow>(
      `
      WITH costs AS (
        SELECT
          d.cloud_connection_id,
          d.billing_source_id,
          d.volume_id,
          SUM(COALESCE(d.total_cost, 0))::double precision AS volume_cost,
          MIN(d.usage_date)::date AS first_seen_at,
          BOOL_OR(COALESCE(d.is_unattached, FALSE)) AS is_unattached,
          MAX(d.state)::text AS fact_state
        FROM fact_ebs_volume_daily d
        WHERE d.tenant_id = :tenantId
          AND d.usage_date >= :dateFrom::date
          AND d.usage_date < (:dateTo::date + INTERVAL '1 day')
          AND (:cloudConnectionId::uuid IS NULL OR d.cloud_connection_id = :cloudConnectionId::uuid)
          AND (:billingSourceId::bigint IS NULL OR d.billing_source_id = :billingSourceId::bigint)
        GROUP BY d.cloud_connection_id, d.billing_source_id, d.volume_id
      ),
      utilization AS (
        SELECT
          u.cloud_connection_id,
          u.volume_id,
          AVG(COALESCE(u.read_ops, 0))::double precision AS avg_read_ops,
          AVG(COALESCE(u.write_ops, 0))::double precision AS avg_write_ops,
          AVG(COALESCE(u.read_bytes, 0))::double precision AS avg_read_bytes,
          AVG(COALESCE(u.write_bytes, 0))::double precision AS avg_write_bytes
        FROM ebs_volume_utilization_daily u
        WHERE u.tenant_id = :tenantId
          AND u.usage_date >= :dateFrom::date
          AND u.usage_date < (:dateTo::date + INTERVAL '1 day')
          AND (:cloudConnectionId::uuid IS NULL OR u.cloud_connection_id = :cloudConnectionId::uuid)
        GROUP BY u.cloud_connection_id, u.volume_id
      )
      SELECT
        inv.cloud_connection_id AS "cloudConnectionId",
        COALESCE(c.billing_source_id, :billingSourceId::bigint) AS "billingSourceId",
        dsa.sub_account_id::text AS "awsAccountId",
        COALESCE(dr.region_id, dr.region_name)::text AS "awsRegionCode",
        inv.region_key AS "regionKey",
        inv.sub_account_key AS "subAccountKey",
        inv.volume_id::text AS "volumeId",
        COALESCE(NULLIF(TRIM(COALESCE(inv.metadata_json ->> 'volumeName', '')), ''), inv.volume_id)::text AS "volumeName",
        inv.state::text AS "volumeState",
        inv.attached_instance_id::text AS "attachedInstanceId",
        inst.state::text AS "attachedInstanceState",
        inv.size_gb AS "sizeGb",
        inv.discovered_at AS "discoveredAt",
        inv.created_at AS "createdAt",
        c.first_seen_at AS "firstSeenAt",
        COALESCE(c.volume_cost, 0)::double precision AS "volumeCost",
        u.avg_read_ops AS "avgReadOps",
        u.avg_write_ops AS "avgWriteOps",
        u.avg_read_bytes AS "avgReadBytes",
        u.avg_write_bytes AS "avgWriteBytes",
        c.is_unattached AS "isUnattached",
        c.fact_state::text AS "factState",
        inv.tags_json AS "tagsJson"
      FROM ec2_volume_inventory_snapshots inv
      LEFT JOIN costs c
        ON c.volume_id = inv.volume_id
      LEFT JOIN utilization u
        ON u.volume_id = inv.volume_id
       AND u.cloud_connection_id IS NOT DISTINCT FROM inv.cloud_connection_id
      LEFT JOIN ec2_instance_inventory_snapshots inst
        ON inst.tenant_id = inv.tenant_id
       AND inst.instance_id = inv.attached_instance_id
       AND inst.cloud_connection_id IS NOT DISTINCT FROM inv.cloud_connection_id
       AND inst.is_current = TRUE
      LEFT JOIN dim_sub_account dsa ON dsa.id = inv.sub_account_key
      LEFT JOIN dim_region dr ON dr.id = inv.region_key
      WHERE inv.tenant_id = :tenantId::uuid
        AND inv.is_current = TRUE
        AND (:cloudConnectionId::uuid IS NULL OR inv.cloud_connection_id = :cloudConnectionId::uuid);
      `,
      {
        replacements: input,
        type: QueryTypes.SELECT,
      },
    );
  }

  async getSnapshotCandidates(input: Ec2RefreshRecommendationsInput): Promise<SnapshotCandidateRow[]> {
    return sequelize.query<SnapshotCandidateRow>(
      `
      WITH snapshot_cost AS (
        SELECT
          dr.resource_id AS snapshot_id,
          SUM(COALESCE(f.billed_cost, f.effective_cost, 0))::double precision AS snapshot_cost
        FROM fact_cost_line_items f
        INNER JOIN dim_resource dr ON dr.id = f.resource_key
        WHERE f.tenant_id = :tenantId::uuid
          AND f.usage_start_time >= :dateFrom::date
          AND f.usage_start_time < (:dateTo::date + INTERVAL '1 day')
          AND LOWER(COALESCE(dr.resource_type, '')) = 'ec2_snapshot'
          AND (:billingSourceId::bigint IS NULL OR f.billing_source_id = :billingSourceId::bigint)
        GROUP BY dr.resource_id
      )
      SELECT
        inv.cloud_connection_id AS "cloudConnectionId",
        :billingSourceId::bigint AS "billingSourceId",
        dsa.sub_account_id::text AS "awsAccountId",
        COALESCE(dr.region_id, dr.region_name)::text AS "awsRegionCode",
        inv.region_key AS "regionKey",
        inv.sub_account_key AS "subAccountKey",
        inv.snapshot_id::text AS "snapshotId",
        inv.state::text AS "snapshotState",
        inv.source_volume_id::text AS "sourceVolumeId",
        vol.state::text AS "sourceVolumeState",
        vol.deleted_at AS "sourceVolumeDeletedAt",
        CASE
          WHEN inv.source_volume_id IS NULL THEN FALSE
          WHEN vol.volume_id IS NULL THEN FALSE
          WHEN vol.deleted_at IS NOT NULL THEN FALSE
          WHEN LOWER(COALESCE(vol.state, '')) IN ('deleted', 'deleting', 'unavailable', 'error', 'failed') THEN FALSE
          ELSE TRUE
        END AS "hasActiveSourceVolume",
        inv.start_time AS "startTime",
        COALESCE(sc.snapshot_cost, 0)::double precision AS "snapshotCost",
        inv.tags_json AS "tagsJson"
      FROM ec2_snapshot_inventory_snapshots inv
      LEFT JOIN snapshot_cost sc ON sc.snapshot_id = inv.snapshot_id
      LEFT JOIN ec2_volume_inventory_snapshots vol
        ON vol.tenant_id = inv.tenant_id
       AND vol.cloud_connection_id IS NOT DISTINCT FROM inv.cloud_connection_id
       AND vol.region_key IS NOT DISTINCT FROM inv.region_key
       AND vol.volume_id = inv.source_volume_id
       AND vol.is_current = TRUE
      LEFT JOIN dim_sub_account dsa ON dsa.id = inv.sub_account_key
      LEFT JOIN dim_region dr ON dr.id = inv.region_key
      WHERE inv.tenant_id = :tenantId::uuid
        AND inv.is_current = TRUE
        AND (:cloudConnectionId::uuid IS NULL OR inv.cloud_connection_id = :cloudConnectionId::uuid);
      `,
      {
        replacements: input,
        type: QueryTypes.SELECT,
      },
    );
  }

  async getInstanceNetworkCostLineItems(input: Ec2RefreshRecommendationsInput): Promise<InstanceNetworkCostLineItemRow[]> {
    const rows = await sequelize.query<InstanceNetworkCostLineItemRow>(
      `
      SELECT
        eis.cloud_connection_id AS "cloudConnectionId",
        f.billing_source_id AS "billingSourceId",
        dsa.sub_account_id::text AS "awsAccountId",
        COALESCE(dr.region_id, dr.region_name)::text AS "awsRegionCode",
        f.region_key AS "regionKey",
        f.sub_account_key AS "subAccountKey",
        dres.resource_id::text AS "instanceId",
        COALESCE(NULLIF(TRIM(dres.resource_name), ''), dres.resource_id)::text AS "instanceName",
        f.usage_type AS "usageType",
        f.product_usage_type AS "productUsageType",
        f.product_family AS "productFamily",
        f.operation AS operation,
        f.line_item_description AS "lineItemDescription",
        f.from_location AS "fromLocation",
        f.to_location AS "toLocation",
        f.from_region_code AS "fromRegionCode",
        f.to_region_code AS "toRegionCode",
        SUM(COALESCE(f.effective_cost, f.billed_cost, 0))::double precision AS cost,
        SUM(COALESCE(f.consumed_quantity, f.pricing_quantity, 0))::double precision AS "usageQuantity"
      FROM fact_cost_line_items f
      INNER JOIN dim_resource dres
        ON dres.id = f.resource_key
       AND dres.tenant_id = f.tenant_id
      LEFT JOIN ec2_instance_inventory_snapshots eis
        ON eis.tenant_id = f.tenant_id
       AND eis.instance_id = dres.resource_id
       AND eis.is_current = TRUE
      LEFT JOIN dim_sub_account dsa ON dsa.id = f.sub_account_key
      LEFT JOIN dim_region dr ON dr.id = f.region_key
      WHERE f.tenant_id = :tenantId::uuid
        AND f.usage_start_time >= :dateFrom::date
        AND f.usage_start_time < (:dateTo::date + INTERVAL '1 day')
        AND (:cloudConnectionId::uuid IS NULL OR eis.cloud_connection_id = :cloudConnectionId::uuid)
        AND (:billingSourceId::bigint IS NULL OR f.billing_source_id = :billingSourceId::bigint)
        AND (
          LOWER(COALESCE(dres.resource_type, '')) IN ('ec2_instance', 'aws_ec2_instance', 'instance')
          OR dres.resource_id ILIKE 'i-%'
        )
      GROUP BY
        eis.cloud_connection_id,
        f.billing_source_id,
        dsa.sub_account_id,
        dr.region_id,
        dr.region_name,
        f.region_key,
        f.sub_account_key,
        dres.resource_id,
        dres.resource_name,
        f.usage_type,
        f.product_usage_type,
        f.product_family,
        f.operation,
        f.line_item_description,
        f.from_location,
        f.to_location,
        f.from_region_code,
        f.to_region_code;
      `,
      { replacements: input, type: QueryTypes.SELECT },
    );
    return rows
      .map((row) => ({
        ...row,
        cost: row.cost ?? 0,
        usageQuantity: row.usageQuantity ?? 0,
      }))
      .filter((row) => {
        const networkType = classifyExplorerCostCategory({
          usageType: row.usageType,
          productUsageType: row.productUsageType,
          productFamily: row.productFamily,
          operation: row.operation,
          lineItemDescription: row.lineItemDescription,
          fromLocation: row.fromLocation,
          toLocation: row.toLocation,
          fromRegionCode: row.fromRegionCode,
          toRegionCode: row.toRegionCode,
        });
        return networkType !== "other";
      });
  }

  async getInstanceUsageSummaries(input: Ec2RefreshRecommendationsInput): Promise<InstanceUsageSummaryRow[]> {
    return sequelize.query<InstanceUsageSummaryRow>(
      `
      WITH grouped AS (
        SELECT
          d.cloud_connection_id AS "cloudConnectionId",
          d.billing_source_id AS "billingSourceId",
          d.instance_id AS "instanceId",
          AVG(d.cpu_avg::double precision) FILTER (WHERE d.cpu_avg IS NOT NULL) AS "avgCpu",
          SUM((COALESCE(d.network_in_bytes, 0) + COALESCE(d.network_out_bytes, 0))::double precision) / (1024 * 1024 * 1024) AS "totalNetworkUsageGb",
          SUM(COALESCE(d.total_effective_cost, d.total_billed_cost, 0))::double precision AS "totalEffectiveCost",
          SUM(CASE WHEN LOWER(COALESCE(d.state, '')) = 'running' THEN 1 ELSE 0 END)::double precision AS "runningDays"
        FROM fact_ec2_instance_daily d
        WHERE d.tenant_id = :tenantId
          AND d.usage_date >= :dateFrom::date
          AND d.usage_date < (:dateTo::date + INTERVAL '1 day')
          AND (:cloudConnectionId::uuid IS NULL OR d.cloud_connection_id = :cloudConnectionId::uuid)
          AND (:billingSourceId::bigint IS NULL OR d.billing_source_id = :billingSourceId::bigint)
        GROUP BY d.cloud_connection_id, d.billing_source_id, d.instance_id
      ),
      latest AS (
        SELECT DISTINCT ON (d.cloud_connection_id, d.billing_source_id, d.instance_id)
          d.cloud_connection_id,
          d.billing_source_id,
          d.instance_id,
          COALESCE(NULLIF(TRIM(d.instance_name), ''), d.instance_id) AS instance_name,
          d.state,
          d.region_key,
          d.sub_account_key
        FROM fact_ec2_instance_daily d
        WHERE d.tenant_id = :tenantId
          AND d.usage_date >= :dateFrom::date
          AND d.usage_date < (:dateTo::date + INTERVAL '1 day')
          AND (:cloudConnectionId::uuid IS NULL OR d.cloud_connection_id = :cloudConnectionId::uuid)
          AND (:billingSourceId::bigint IS NULL OR d.billing_source_id = :billingSourceId::bigint)
        ORDER BY d.cloud_connection_id, d.billing_source_id, d.instance_id, d.usage_date DESC
      )
      SELECT
        g."cloudConnectionId",
        g."billingSourceId",
        dsa.sub_account_id::text AS "awsAccountId",
        COALESCE(dr.region_id, dr.region_name)::text AS "awsRegionCode",
        l.region_key AS "regionKey",
        l.sub_account_key AS "subAccountKey",
        l.instance_id::text AS "instanceId",
        l.instance_name::text AS "instanceName",
        l.state::text AS state,
        g."avgCpu",
        g."totalNetworkUsageGb",
        g."totalEffectiveCost",
        g."runningDays"
      FROM grouped g
      INNER JOIN latest l
        ON l.cloud_connection_id IS NOT DISTINCT FROM g."cloudConnectionId"
       AND l.billing_source_id IS NOT DISTINCT FROM g."billingSourceId"
       AND l.instance_id = g."instanceId"
      LEFT JOIN dim_sub_account dsa ON dsa.id = l.sub_account_key
      LEFT JOIN dim_region dr ON dr.id = l.region_key;
      `,
      { replacements: input, type: QueryTypes.SELECT },
    );
  }

  async getUnattachedEipCandidates(input: Ec2RefreshRecommendationsInput): Promise<EipCandidateRow[]> {
    return sequelize.query<EipCandidateRow>(
      `
      WITH eip_cost AS (
        SELECT
          dres.resource_id::text AS resource_id,
          SUM(COALESCE(f.effective_cost, f.billed_cost, 0))::double precision AS eip_cost
        FROM fact_cost_line_items f
        INNER JOIN dim_resource dres
          ON dres.id = f.resource_key
         AND dres.tenant_id = f.tenant_id
        WHERE f.tenant_id = :tenantId::uuid
          AND f.usage_start_time >= :dateFrom::date
          AND f.usage_start_time < (:dateTo::date + INTERVAL '1 day')
          AND (:billingSourceId::bigint IS NULL OR f.billing_source_id = :billingSourceId::bigint)
        GROUP BY dres.resource_id
      )
      SELECT
        inv.cloud_connection_id AS "cloudConnectionId",
        :billingSourceId::bigint AS "billingSourceId",
        dsa.sub_account_id::text AS "awsAccountId",
        COALESCE(dr.region_id, dr.region_name)::text AS "awsRegionCode",
        inv.region_key AS "regionKey",
        inv.sub_account_key AS "subAccountKey",
        inv.allocation_id::text AS "allocationId",
        inv.public_ip::text AS "publicIp",
        inv.association_status::text AS "associationStatus",
        inv.is_attached AS "isAttached",
        COALESCE(ec1.eip_cost, ec2.eip_cost, 0)::double precision AS "estimatedEipCost"
      FROM ec2_eip_inventory_snapshots inv
      LEFT JOIN dim_sub_account dsa ON dsa.id = inv.sub_account_key
      LEFT JOIN dim_region dr ON dr.id = inv.region_key
      LEFT JOIN eip_cost ec1
        ON ec1.resource_id = inv.allocation_id
      LEFT JOIN eip_cost ec2
        ON ec2.resource_id = inv.public_ip
      WHERE inv.tenant_id = :tenantId::uuid
        AND inv.is_current = TRUE
        AND (:cloudConnectionId::uuid IS NULL OR inv.cloud_connection_id = :cloudConnectionId::uuid)
        AND (
          COALESCE(inv.is_attached, FALSE) = FALSE
          OR LOWER(COALESCE(inv.association_status, '')) IN ('unattached', 'unassociated', 'disassociated', 'available')
        );
      `,
      { replacements: input, type: QueryTypes.SELECT },
    );
  }

  async getPersistedRecommendations(input: Ec2RecommendationsQuery): Promise<Ec2RecommendationRecord[]> {
    const rows = await sequelize.query<
      Omit<Ec2RecommendationRecord, "status"> & { status: string | null }
    >(
      `
      SELECT
        fr.id::bigint AS id,
        CASE
          WHEN LOWER(COALESCE(fr.category, '')) IN ('compute', 'storage', 'pricing', 'network')
            THEN LOWER(fr.category)
          WHEN LOWER(COALESCE(fr.recommendation_type, '')) IN ('idle_instance', 'underutilized_instance', 'overutilized_instance')
            THEN 'compute'
          WHEN LOWER(COALESCE(fr.recommendation_type, '')) IN ('unattached_volume', 'old_snapshot', 'orphaned_snapshot', 'unattached_ebs_volume', 'ebs_attached_to_stopped_instance')
            THEN 'storage'
          WHEN LOWER(COALESCE(fr.recommendation_type, '')) IN ('uncovered_on_demand')
            THEN 'pricing'
          WHEN LOWER(COALESCE(fr.recommendation_type, '')) IN ('high_internet_data_transfer', 'high_inter_region_data_transfer', 'high_inter_az_data_transfer', 'low_cpu_high_network', 'high_nat_gateway_cost', 'unattached_elastic_ip')
            THEN 'network'
          ELSE LOWER(COALESCE(fr.category, ''))
        END::text AS category,
        CASE
          WHEN LOWER(COALESCE(fr.recommendation_type, '')) = 'unattached_ebs_volume' THEN 'unattached_volume'
          WHEN LOWER(COALESCE(fr.recommendation_type, '')) = 'ebs_attached_to_stopped_instance' THEN 'unattached_volume'
          ELSE LOWER(COALESCE(fr.recommendation_type, ''))
        END::text AS type,
        CASE
          WHEN fr.resource_type = 'ec2_instance' THEN 'instance'
          WHEN fr.resource_type = 'ebs_volume' THEN 'volume'
          WHEN fr.resource_type = 'elastic_ip' THEN 'elastic_ip'
          ELSE 'snapshot'
        END::text AS "resourceType",
        fr.resource_id::text AS "resourceId",
        COALESCE(fr.resource_name, fr.resource_id)::text AS "resourceName",
        fr.aws_account_id::text AS "accountId",
        COALESCE(fr.aws_region_code, dr.region_id, dr.region_name)::text AS region,
        COALESCE(fr.recommendation_title, '')::text AS problem,
        COALESCE(fr.recommendation_text, '')::text AS evidence,
        COALESCE(fr.idle_observation_value, '')::text AS action,
        fr.estimated_monthly_savings::double precision AS "estimatedMonthlySaving",
        LOWER(COALESCE(fr.risk_level, 'medium'))::text AS risk,
        LOWER(COALESCE(fr.effort_level, 'low'))::text AS effort,
        fr.status::text AS status,
        CASE WHEN fr.detected_at IS NULL THEN NULL ELSE fr.detected_at::text END AS "detectedAt",
        CASE WHEN fr.last_seen_at IS NULL THEN NULL ELSE fr.last_seen_at::text END AS "lastSeenAt",
        fr.metadata_json AS metadata
      FROM fact_recommendations fr
      LEFT JOIN dim_region dr ON dr.id = fr.region_key
      WHERE fr.tenant_id = :tenantId::uuid
        AND fr.source_system IN (:sourceSystems)
        AND (:cloudConnectionId::uuid IS NULL OR fr.cloud_connection_id = :cloudConnectionId::uuid)
        AND (:billingSourceId::bigint IS NULL OR fr.billing_source_id = :billingSourceId::bigint)
        AND (:category::text IS NULL OR LOWER(fr.category) = :category::text)
        AND (:type::text IS NULL OR fr.recommendation_type = :type::text)
        AND (:status::text IS NULL OR LOWER(fr.status) = :status::text)
        AND (:account::text IS NULL OR LOWER(COALESCE(fr.aws_account_id, '')) = LOWER(:account::text))
        AND (:region::text IS NULL OR LOWER(COALESCE(fr.aws_region_code, dr.region_id, dr.region_name, '')) LIKE ('%' || LOWER(:region::text) || '%'))
        AND (
          :dateFrom::date IS NULL
          OR :dateTo::date IS NULL
          OR fr.last_seen_at IS NULL
          OR (fr.last_seen_at::date >= :dateFrom::date AND fr.last_seen_at::date <= :dateTo::date)
        )
        AND (:team::text IS NULL OR LOWER(COALESCE(fr.metadata_json -> 'tags' ->> 'team', '')) = LOWER(:team::text))
        AND (:product::text IS NULL OR LOWER(COALESCE(fr.metadata_json -> 'tags' ->> 'product', '')) = LOWER(:product::text))
        AND (
          :environment::text IS NULL
          OR LOWER(COALESCE(fr.metadata_json -> 'tags' ->> 'environment', fr.metadata_json -> 'tags' ->> 'env', '')) = LOWER(:environment::text)
        )
      ORDER BY fr.estimated_monthly_savings DESC NULLS LAST, fr.last_seen_at DESC NULLS LAST;
      `,
      {
        replacements: {
          ...input,
          sourceSystems: SOURCE_SYSTEMS,
        },
        type: QueryTypes.SELECT,
      },
    );
    return rows.map((row) => ({ ...row, status: toLowerStatus(row.status) }));
  }

  async upsertGeneratedRecommendations(records: Array<Record<string, unknown>>): Promise<{ created: number; updated: number; resolved: number }> {
    const now = new Date();
    let created = 0;
    let updated = 0;
    let resolved = 0;
    const identity = (r: { tenantId: string; cloudConnectionId: string | null; billingSourceId: number | null; category: string; type: string; resourceType: string; resourceId: string }) =>
      `${r.tenantId}|${r.cloudConnectionId ?? ""}|${r.billingSourceId ?? ""}|${r.category}|${r.type}|${r.resourceType}|${r.resourceId}`;

    return sequelize.transaction(async (transaction) => {
      const tenantId = String(records[0]?.tenantId ?? "");
      const existing = await FactRecommendations.findAll({
        where: {
          tenantId,
          sourceSystem: SOURCE_SYSTEMS[0],
        },
        transaction,
      });

      const existingByKey = new Map<string, (typeof existing)[number]>();
      for (const row of existing) {
        const key = identity({
          tenantId: row.tenantId,
          cloudConnectionId: row.cloudConnectionId,
          billingSourceId: row.billingSourceId ? Number(row.billingSourceId) : null,
          category: String(row.category).toLowerCase(),
          type: String(row.recommendationType),
          resourceType: String(row.resourceType),
          resourceId: String(row.resourceId ?? ""),
        });
        existingByKey.set(key, row);
      }

      const seenKeys = new Set<string>();
      for (const record of records) {
        const rec = record as Record<string, unknown>;
        const key = identity({
          tenantId: String(rec.tenantId),
          cloudConnectionId: (rec.cloudConnectionId as string | null) ?? null,
          billingSourceId: (rec.billingSourceId as number | null) ?? null,
          category: String(rec.category).toLowerCase(),
          type: String(rec.type),
          resourceType: String(rec.resourceType),
          resourceId: String(rec.resourceId),
        });
        seenKeys.add(key);
        const existingRow = existingByKey.get(key);
        const existingStatus = toLowerStatus(existingRow?.status);
        const preserveStatus = existingStatus === "accepted" || existingStatus === "ignored" || existingStatus === "snoozed";

        const payload: Record<string, unknown> = {
          tenantId: rec.tenantId,
          cloudConnectionId: rec.cloudConnectionId,
          billingSourceId: rec.billingSourceId,
          awsAccountId: rec.accountId,
          awsRegionCode: rec.region,
          category: String(rec.category).toUpperCase(),
          recommendationType: rec.type,
          resourceType: rec.resourceType,
          resourceId: rec.resourceId,
          resourceName: rec.resourceName,
          recommendationTitle: rec.problem,
          recommendationText: rec.evidence,
          idleObservationValue: rec.action,
          currentMonthlyCost: rec.currentMonthlyCost,
          estimatedMonthlySavings: rec.estimatedMonthlySaving,
          projectedMonthlyCost: rec.projectedMonthlyCost,
          riskLevel: String(rec.risk).toUpperCase(),
          effortLevel: rec.effort ? String(rec.effort).toUpperCase() : null,
          status: preserveStatus ? toUpperStatus(existingStatus) : "OPEN",
          sourceSystem: SOURCE_SYSTEMS[0],
          metadataJson: rec.metadata,
          detectedAt: existingRow?.detectedAt ?? now,
          lastSeenAt: now,
          observationStart: rec.observationStart,
          observationEnd: rec.observationEnd,
          updatedAt: now,
        };

        if (existingRow) {
          await existingRow.update(payload as never, { transaction });
          updated += 1;
        } else {
          await FactRecommendations.create(
            {
              ...payload,
              createdAt: now,
            } as never,
            { transaction },
          );
          created += 1;
        }
      }

      for (const row of existing) {
        const key = identity({
          tenantId: row.tenantId,
          cloudConnectionId: row.cloudConnectionId,
          billingSourceId: row.billingSourceId ? Number(row.billingSourceId) : null,
          category: String(row.category).toLowerCase(),
          type: String(row.recommendationType),
          resourceType: String(row.resourceType),
          resourceId: String(row.resourceId ?? ""),
        });
        if (seenKeys.has(key)) continue;
        if (toLowerStatus(row.status) === "completed") continue;
        await row.update({ status: "COMPLETED", updatedAt: now }, { transaction });
        resolved += 1;
      }

      return { created, updated, resolved };
    });
  }

  async updateRecommendationStatus(input: { tenantId: string; id: number; status: Ec2RecommendationStatus }): Promise<boolean> {
    const [affected] = await FactRecommendations.update(
      { status: toUpperStatus(input.status), updatedAt: new Date() },
      {
        where: {
          id: input.id,
          tenantId: input.tenantId,
          sourceSystem: SOURCE_SYSTEMS[0],
        },
      },
    );
    return affected > 0;
  }
}
