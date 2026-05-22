import { QueryTypes } from "sequelize";

import { NotFoundError } from "../../../errors/http-errors.js";
import { sequelize } from "../../../models/index.js";
import { logger } from "../../../utils/logger.js";
import type {
  InventoryEc2VolumeDetailQuery,
  InventoryEc2VolumeDetailResponse,
  InventoryEc2VolumePerformanceInterval,
  InventoryEc2VolumePerformanceMetric,
  InventoryEc2VolumePerformanceQuery,
  InventoryEc2VolumePerformanceResponse,
  InventoryEc2VolumePerformanceSeries,
  InventoryEc2VolumesListItem,
  InventoryEc2VolumesListQuery,
  InventoryEc2VolumesListResponse,
} from "./volumes-inventory.types.js";

type DateRange = {
  startDate: string;
  endDate: string;
};

type BaseQueryParts = {
  sql: string;
  bind: unknown[];
  nextIndex: number;
};

type CountRow = {
  total: string;
};

type SummaryRow = {
  totalVolumes: number | string;
  totalStorageGb: number | string;
  totalCost: number | string;
  unattachedVolumes: number | string;
  attachedToStoppedInstance: number | string;
  idleVolumes: number | string;
  underutilizedVolumes: number | string;
};

type BaseDebugRow = {
  rawRowsCount: number | string;
  negativeCostRowsCount: number | string;
  unknownVolumeRowsCount: number | string;
  finalRowsCount: number | string;
};

type VolumeRow = {
  volumeId: string;
  volumeName: string;
  volumeType: string | null;
  sizeGb: number | string | null;
  iops: number | string | null;
  throughput: number | string | null;
  state: string | null;
  availabilityZone: string | null;
  isAttached: boolean | null;
  attachedInstanceId: string | null;
  attachedInstanceName: string | null;
  attachedInstanceState: string | null;
  attachedInstanceType: string | null;
  cloudConnectionId: string | null;
  subAccountKey: string | null;
  subAccountName: string | null;
  regionKey: string | null;
  regionId: string | null;
  regionName: string | null;
  resourceKey: string | null;
  discoveredAt: Date | string | null;
  usageDate: Date | string | null;
  currencyCode: string | null;
  dailyCost: number | string | null;
  mtdCost: number | string | null;
  snapshotCount: number | string | null;
  snapshotCost: number | string | null;
  storageCost: number | string | null;
  ioCost: number | string | null;
  pioPSCost: number | string | null;
  hours: number | string | null;
  ssdSavings: number | string | null;
  isUnattached: boolean | null;
  isAttachedToStoppedInstance: boolean | null;
  isIdleCandidate: boolean | null;
  isUnderutilizedCandidate: boolean | null;
  optimizationStatus: "idle" | "underutilized" | "optimal" | "warning" | null;
  status: "unattached" | "attached_stopped" | "idle" | "underutilized" | "healthy";
  statusLabel:
    | "Unattached"
    | "Attached to Stopped Instance"
    | "Idle"
    | "Underutilized"
    | "Healthy";
  tags: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
};

type PerformanceDataRow = {
  timestamp: Date | string;
} & Partial<Record<InventoryEc2VolumePerformanceMetric, number | string | null>>;

type VolumeIdentityRow = {
  volumeId: string;
  volumeName: string;
  state: string | null;
  volumeType: string | null;
  sizeGb: number | string | null;
  iops: number | string | null;
  throughput: number | string | null;
  availabilityZone: string | null;
  regionId: string | null;
  regionName: string | null;
  subAccountName: string | null;
  cloudConnectionId: string | null;
  discoveredAt: Date | string | null;
  attachedInstanceId: string | null;
  attachedInstanceName: string | null;
  attachedInstanceState: string | null;
  snapshotCount: number | string | null;
  snapshotCost: number | string | null;
  tagsJson: Record<string, unknown> | null;
  metadataJson: Record<string, unknown> | null;
};

const toIsoDate = (value: Date): string => value.toISOString().slice(0, 10);

const toIsoOrNull = (value: Date | string | null): string | null => {
  if (!value) return null;
  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
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

const normalizeLower = (value: string | null | undefined): string | null => {
  if (!value) return null;
  const trimmed = value.trim().toLowerCase();
  return trimmed.length > 0 ? trimmed : null;
};

const resolveDateRange = (query: InventoryEc2VolumesListQuery): DateRange => {
  const today = new Date();
  const startOfMonth = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
  const parsedStart = query.startDate ? new Date(`${query.startDate}T00:00:00Z`) : null;
  const parsedEnd = query.endDate ? new Date(`${query.endDate}T00:00:00Z`) : null;
  const start = parsedStart && !Number.isNaN(parsedStart.getTime()) ? parsedStart : startOfMonth;
  const end = parsedEnd && !Number.isNaN(parsedEnd.getTime()) ? parsedEnd : today;

  if (start.getTime() <= end.getTime()) {
    return { startDate: toIsoDate(start), endDate: toIsoDate(end) };
  }

  return { startDate: toIsoDate(end), endDate: toIsoDate(start) };
};

const PERFORMANCE_TOPIC_METRICS: Record<"ebs", InventoryEc2VolumePerformanceMetric[]> = {
  ebs: [
    "volume_read_bytes",
    "volume_write_bytes",
    "volume_read_ops",
    "volume_write_ops",
    "queue_length",
    "burst_balance",
    "volume_idle_time",
  ],
};

const DEFAULT_TOPIC_METRIC: Record<"ebs", InventoryEc2VolumePerformanceMetric> = {
  ebs: "volume_read_bytes",
};

const PERFORMANCE_METRIC_META: Record<
  InventoryEc2VolumePerformanceMetric,
  { label: string; unit: InventoryEc2VolumePerformanceSeries["unit"]; column: string }
> = {
  volume_read_bytes: { label: "Volume Read Bytes", unit: "bytes", column: "read_bytes" },
  volume_write_bytes: { label: "Volume Write Bytes", unit: "bytes", column: "write_bytes" },
  volume_read_ops: { label: "Volume Read Ops", unit: "count", column: "read_ops" },
  volume_write_ops: { label: "Volume Write Ops", unit: "count", column: "write_ops" },
  queue_length: { label: "Queue Length", unit: "count", column: "queue_length_max" },
  burst_balance: { label: "Burst Balance", unit: "percent", column: "burst_balance_avg" },
  volume_idle_time: { label: "Volume Idle Time", unit: "count", column: "idle_time_avg" },
};

const resolvePerformanceDateRange = (query: InventoryEc2VolumePerformanceQuery): DateRange => {
  const today = new Date();
  const defaultStart = new Date(today);
  defaultStart.setUTCDate(defaultStart.getUTCDate() - 29);

  const parsedStart = query.startDate ? new Date(`${query.startDate}T00:00:00Z`) : null;
  const parsedEnd = query.endDate ? new Date(`${query.endDate}T00:00:00Z`) : null;

  const start = parsedStart && !Number.isNaN(parsedStart.getTime()) ? parsedStart : defaultStart;
  const end = parsedEnd && !Number.isNaN(parsedEnd.getTime()) ? parsedEnd : today;

  if (start.getTime() <= end.getTime()) {
    return { startDate: toIsoDate(start), endDate: toIsoDate(end) };
  }

  return { startDate: toIsoDate(end), endDate: toIsoDate(start) };
};

const ORDER_BY_SQL: Record<InventoryEc2VolumesListQuery["sortBy"], string> = {
  signal: `base.signal_rank ASC, base.mtd_cost DESC, LOWER(base.volume_id) ASC`,
  volumeId: `LOWER(base.volume_id)`,
  sizeGb: `base.size_gb`,
  dailyCost: `base.daily_cost`,
  mtdCost: `base.mtd_cost`,
  volumeType: `LOWER(COALESCE(base.volume_type, ''))`,
  availabilityZone: `LOWER(COALESCE(base.availability_zone, ''))`,
  attachedInstanceState: `LOWER(COALESCE(base.attached_instance_state, ''))`,
};

export class VolumesInventoryService {
  async getVolumeDetails(input: {
    tenantId: string;
    query: InventoryEc2VolumeDetailQuery;
  }): Promise<InventoryEc2VolumeDetailResponse> {
    const dateRange = resolveDateRange({
      ...input.query,
      page: 1,
      pageSize: 1,
      subAccountKey: null,
      attachedInstanceId: null,
      state: null,
      volumeType: null,
      isAttached: null,
      attachmentState: null,
      optimizationStatus: null,
      signal: null,
      region: null,
      search: null,
      sortBy: "signal",
      sortDirection: "desc",
    });

    const identityRows = await sequelize.query<VolumeIdentityRow>(
      `
      SELECT
        inv.volume_id AS "volumeId",
        COALESCE(NULLIF(TRIM(COALESCE(inv.tags_json ->> 'Name', '')), ''), inv.volume_id) AS "volumeName",
        inv.state AS "state",
        inv.volume_type AS "volumeType",
        inv.size_gb::double precision AS "sizeGb",
        inv.iops::double precision AS "iops",
        inv.throughput::double precision AS "throughput",
        inv.availability_zone AS "availabilityZone",
        dr.region_id AS "regionId",
        dr.region_name AS "regionName",
        dsa.sub_account_name AS "subAccountName",
        inv.cloud_connection_id::text AS "cloudConnectionId",
        inv.discovered_at AS "discoveredAt",
        inv.attached_instance_id AS "attachedInstanceId",
        inst.attached_instance_name AS "attachedInstanceName",
        inst.attached_instance_state AS "attachedInstanceState",
        COALESCE(snapshot_stats.snapshot_count, 0)::double precision AS "snapshotCount",
        COALESCE(snapshot_stats.snapshot_cost, 0)::double precision AS "snapshotCost",
        inv.tags_json AS "tagsJson",
        inv.metadata_json AS "metadataJson"
      FROM ec2_volume_inventory_snapshots inv
      LEFT JOIN dim_region dr ON dr.id = inv.region_key
      LEFT JOIN dim_sub_account dsa ON dsa.id = inv.sub_account_key
      LEFT JOIN LATERAL (
        WITH snapshots_for_volume AS (
          SELECT s.snapshot_id
          FROM ec2_snapshot_inventory_snapshots s
          WHERE s.tenant_id = inv.tenant_id
            AND s.source_volume_id = inv.volume_id
            AND s.is_current = true
            AND s.deleted_at IS NULL
            AND (
              inv.cloud_connection_id IS NULL
              OR s.cloud_connection_id IS NULL
              OR s.cloud_connection_id = inv.cloud_connection_id
            )
        ),
        snapshot_cost_scoped AS (
          SELECT
            SUM(COALESCE(f.billed_cost, f.effective_cost, f.list_cost, 0))::double precision AS total_cost
          FROM snapshots_for_volume sfv
          INNER JOIN dim_resource dr
            ON dr.tenant_id = inv.tenant_id
           AND dr.resource_id = sfv.snapshot_id
           AND LOWER(COALESCE(dr.resource_type, '')) = 'ec2_snapshot'
          INNER JOIN fact_cost_line_items f
            ON f.tenant_id = inv.tenant_id
           AND f.resource_key = dr.id
          INNER JOIN dim_date dd
            ON dd.id = f.usage_date_key
          WHERE dd.full_date >= $4::date
            AND dd.full_date <= $5::date
        )
        SELECT
          (SELECT COUNT(*)::double precision FROM snapshots_for_volume) AS snapshot_count,
          COALESCE((SELECT total_cost FROM snapshot_cost_scoped), 0)::double precision AS snapshot_cost
      ) snapshot_stats ON TRUE
      LEFT JOIN LATERAL (
        SELECT
          COALESCE(NULLIF(TRIM(COALESCE(e.tags_json ->> 'Name', '')), ''), e.instance_id) AS attached_instance_name,
          e.state AS attached_instance_state
        FROM ec2_instance_inventory_snapshots e
        WHERE e.tenant_id = inv.tenant_id
          AND e.instance_id = inv.attached_instance_id
          AND e.is_current = true
          AND e.deleted_at IS NULL
        ORDER BY e.updated_at DESC NULLS LAST
        LIMIT 1
      ) inst ON TRUE
      WHERE inv.tenant_id = $1::uuid
        AND inv.volume_id = $2
        AND inv.is_current = true
        AND inv.deleted_at IS NULL
        AND ($3::uuid IS NULL OR inv.cloud_connection_id = $3::uuid)
      ORDER BY inv.updated_at DESC NULLS LAST
      LIMIT 1;
      `,
      {
        bind: [input.tenantId, input.query.volumeId, input.query.cloudConnectionId],
        type: QueryTypes.SELECT,
      },
    );

    const identity = identityRows[0];
    if (!identity) {
      throw new NotFoundError("Volume not found");
    }

    const costTrendRows = await sequelize.query<{
      usageDate: string;
      totalCost: number | string | null;
      storageCost: number | string | null;
      ioCost: number | string | null;
      throughputCost: number | string | null;
      sizeGb: number | string | null;
    }>(
      `
      SELECT
        f.usage_date::text AS "usageDate",
        COALESCE(f.total_cost, 0)::double precision AS "totalCost",
        COALESCE(f.storage_cost, 0)::double precision AS "storageCost",
        COALESCE(f.io_cost, 0)::double precision AS "ioCost",
        COALESCE(f.throughput_cost, 0)::double precision AS "throughputCost",
        f.size_gb::double precision AS "sizeGb"
      FROM fact_ebs_volume_daily f
      WHERE f.tenant_id = $1::uuid
        AND f.volume_id = $2
        AND ($3::uuid IS NULL OR f.cloud_connection_id = $3::uuid)
        AND f.usage_date >= $4::date
        AND f.usage_date <= $5::date
      ORDER BY f.usage_date ASC;
      `,
      {
        bind: [
          input.tenantId,
          input.query.volumeId,
          input.query.cloudConnectionId,
          dateRange.startDate,
          dateRange.endDate,
        ],
        type: QueryTypes.SELECT,
      },
    );

    const totalVolumeCost = costTrendRows.reduce((sum, row) => sum + toNumberOrZero(row.totalCost), 0);
    const storageCostTotalRaw = costTrendRows.reduce((sum, row) => sum + toNumberOrZero(row.storageCost), 0);
    const ioCostTotalRaw = costTrendRows.reduce((sum, row) => sum + toNumberOrZero(row.ioCost), 0);
    const throughputCostTotalRaw = costTrendRows.reduce((sum, row) => sum + toNumberOrZero(row.throughputCost), 0);

    const hasSeparateCosts = storageCostTotalRaw > 0 || ioCostTotalRaw > 0 || throughputCostTotalRaw > 0;
    const storageCost = hasSeparateCosts ? storageCostTotalRaw : totalVolumeCost;
    const iopsCost = hasSeparateCosts ? ioCostTotalRaw : 0;
    const throughputCost = hasSeparateCosts ? throughputCostTotalRaw : 0;
    const snapshotCost = Math.max(totalVolumeCost - storageCost - iopsCost - throughputCost, 0);

    const costTrend = costTrendRows.map((row) => ({
      date: row.usageDate,
      totalCost: toNumberOrZero(row.totalCost),
    }));

    const sizeTrend = costTrendRows
      .map((row) => ({
        date: row.usageDate,
        sizeGb: toNullableNumber(row.sizeGb),
      }))
      .filter((row): row is { date: string; sizeGb: number } => row.sizeGb !== null);

    return {
      identity: {
        volumeId: identity.volumeId,
        name: identity.volumeName,
        state: identity.state,
        volumeType: identity.volumeType,
        sizeGb: toNullableNumber(identity.sizeGb),
        iops: toNullableNumber(identity.iops),
        throughput: toNullableNumber(identity.throughput),
        availabilityZone: identity.availabilityZone,
        region: identity.regionId ?? identity.regionName ?? null,
        subAccount: identity.subAccountName,
        cloudConnectionId: identity.cloudConnectionId,
        discoveredAt: toIsoOrNull(identity.discoveredAt),
      },
      attachment: {
        instanceId: identity.attachedInstanceId,
        instanceName: identity.attachedInstanceName,
        instanceState: identity.attachedInstanceState,
      },
      metadata: {
        tags: identity.tagsJson ?? {},
        metadata: identity.metadataJson ?? {},
      },
      costBreakdown: {
        totalVolumeCost,
        storageCost,
        iopsCost,
        throughputCost,
        snapshotCost,
      },
      snapshot: {
        snapshotCount: toNumberOrZero(identity.snapshotCount),
        snapshotCost: toNumberOrZero(identity.snapshotCost),
      },
      trends: {
        costTrend,
        sizeTrend,
      },
    };
  }

  async listVolumes(input: {
    tenantId: string;
    query: InventoryEc2VolumesListQuery;
  }): Promise<InventoryEc2VolumesListResponse> {
    const page = input.query.page;
    const pageSize = input.query.pageSize;
    const dateRange = resolveDateRange(input.query);
    const base = this.buildBaseQuery({ tenantId: input.tenantId, query: input.query, dateRange });
    const debugRows = await sequelize.query<BaseDebugRow>(
      `
      ${base.sql}
      SELECT
        (SELECT COUNT(*)::double precision FROM pre_base) AS "rawRowsCount",
        (
          SELECT COUNT(*)::double precision
          FROM pre_base
          WHERE COALESCE(pre_base.raw_mtd_cost, 0) < 0
             OR COALESCE(pre_base.raw_storage_cost, 0) < 0
        ) AS "negativeCostRowsCount",
        (
          SELECT COUNT(*)::double precision
          FROM pre_base
          WHERE pre_base.volume_id IS NULL
             OR LENGTH(TRIM(pre_base.volume_id)) = 0
             OR LOWER(TRIM(pre_base.volume_id)) = 'unknown'
        ) AS "unknownVolumeRowsCount",
        (SELECT COUNT(*)::double precision FROM base) AS "finalRowsCount";
      `,
      {
        bind: base.bind,
        type: QueryTypes.SELECT,
      },
    );
    const debugRow = debugRows[0];
    logger.info("[EC2 Volumes] Inventory row sanitization stats", {
      tenantId: input.tenantId,
      cloudConnectionId: input.query.cloudConnectionId ?? null,
      startDate: dateRange.startDate,
      endDate: dateRange.endDate,
      rawRowsCount: toNumberOrZero(debugRow?.rawRowsCount),
      negativeCostRowsCount: toNumberOrZero(debugRow?.negativeCostRowsCount),
      unknownVolumeRowsCount: toNumberOrZero(debugRow?.unknownVolumeRowsCount),
      finalRowsCount: toNumberOrZero(debugRow?.finalRowsCount),
    });

    const countRows = await sequelize.query<CountRow>(
      `
      ${base.sql}
      SELECT COUNT(*)::text AS total
      FROM base;
      `,
      {
        bind: base.bind,
        type: QueryTypes.SELECT,
      },
    );
    const total = Number(countRows[0]?.total ?? 0) || 0;

    const summaryRows = await sequelize.query<SummaryRow>(
      `
      ${base.sql}
      SELECT
        COUNT(*)::double precision AS "totalVolumes",
        COALESCE(SUM(COALESCE(base.size_gb, 0)), 0)::double precision AS "totalStorageGb",
        COALESCE(SUM(COALESCE(base.mtd_cost, 0)), 0)::double precision AS "totalCost",
        COALESCE(SUM(CASE WHEN COALESCE(base.is_unattached, FALSE) THEN 1 ELSE 0 END), 0)::double precision AS "unattachedVolumes",
        COALESCE(SUM(CASE WHEN COALESCE(base.is_attached_to_stopped_instance, FALSE) THEN 1 ELSE 0 END), 0)::double precision AS "attachedToStoppedInstance",
        COALESCE(SUM(CASE WHEN COALESCE(base.is_idle_candidate, FALSE) THEN 1 ELSE 0 END), 0)::double precision AS "idleVolumes",
        COALESCE(SUM(CASE WHEN COALESCE(base.is_underutilized_candidate, FALSE) THEN 1 ELSE 0 END), 0)::double precision AS "underutilizedVolumes"
      FROM base;
      `,
      {
        bind: base.bind,
        type: QueryTypes.SELECT,
      },
    );

    const offset = (page - 1) * pageSize;
    const limitIndex = base.nextIndex;
    const offsetIndex = base.nextIndex + 1;
    const sortOrder = this.resolveSortOrder(input.query.sortBy, input.query.sortDirection);
    const rows = await sequelize.query<VolumeRow>(
      `
      ${base.sql}
      SELECT
        base.volume_id AS "volumeId",
        base.volume_name AS "volumeName",
        base.volume_type AS "volumeType",
        base.size_gb AS "sizeGb",
        base.iops AS "iops",
        base.throughput AS "throughput",
        base.state AS "state",
        base.availability_zone AS "availabilityZone",
        base.is_attached AS "isAttached",
        base.attached_instance_id AS "attachedInstanceId",
        base.attached_instance_name AS "attachedInstanceName",
        base.attached_instance_state AS "attachedInstanceState",
        base.attached_instance_type AS "attachedInstanceType",
        base.cloud_connection_id AS "cloudConnectionId",
        base.sub_account_key AS "subAccountKey",
        base.sub_account_name AS "subAccountName",
        base.region_key AS "regionKey",
        base.region_id AS "regionId",
        base.region_name AS "regionName",
        base.resource_key AS "resourceKey",
        base.discovered_at AS "discoveredAt",
        base.usage_date AS "usageDate",
        base.currency_code AS "currencyCode",
        base.daily_cost AS "dailyCost",
        base.mtd_cost AS "mtdCost",
        base.snapshot_count AS "snapshotCount",
        base.snapshot_cost AS "snapshotCost",
        base.storage_cost AS "storageCost",
        base.io_cost AS "ioCost",
        base.piops_cost AS "pioPSCost",
        base.hours AS "hours",
        base.ssd_savings AS "ssdSavings",
        base.is_unattached AS "isUnattached",
        base.is_attached_to_stopped_instance AS "isAttachedToStoppedInstance",
        base.is_idle_candidate AS "isIdleCandidate",
        base.is_underutilized_candidate AS "isUnderutilizedCandidate",
        base.optimization_status AS "optimizationStatus",
        base.status AS "status",
        base.status_label AS "statusLabel",
        base.tags AS "tags",
        base.metadata AS "metadata"
      FROM base
      ORDER BY ${sortOrder}
      LIMIT $${limitIndex} OFFSET $${offsetIndex};
      `,
      {
        bind: [...base.bind, pageSize, offset],
        type: QueryTypes.SELECT,
      },
    );

    const items: InventoryEc2VolumesListItem[] = rows.map((row) => ({
      volumeId: row.volumeId,
      volumeName: row.volumeName,
      volumeType: row.volumeType,
      sizeGb: toNullableNumber(row.sizeGb),
      iops: toNullableNumber(row.iops),
      throughput: toNullableNumber(row.throughput),
      state: row.state,
      availabilityZone: row.availabilityZone,
      isAttached: row.isAttached,
      attachedInstanceId: row.attachedInstanceId,
      attachedInstanceName: row.attachedInstanceName,
      attachedInstanceState: row.attachedInstanceState,
      attachedInstanceType: row.attachedInstanceType,
      cloudConnectionId: row.cloudConnectionId,
      subAccountKey: row.subAccountKey,
      subAccountName: row.subAccountName,
      regionKey: row.regionKey,
      regionId: row.regionId,
      regionName: row.regionName,
      resourceKey: row.resourceKey,
      discoveredAt: toIsoOrNull(row.discoveredAt),
      usageDate: toIsoOrNull(row.usageDate),
      currencyCode: row.currencyCode,
      dailyCost: toNumberOrZero(row.dailyCost),
      mtdCost: toNumberOrZero(row.mtdCost),
      snapshotCount: toNumberOrZero(row.snapshotCount),
      snapshotCost: toNumberOrZero(row.snapshotCost),
      storageCost: toNumberOrZero(row.storageCost),
      ioCost: toNumberOrZero(row.ioCost),
      pioPSCost: toNumberOrZero(row.pioPSCost),
      hours: toNumberOrZero(row.hours),
      ssdSavings: toNumberOrZero(row.ssdSavings),
      isUnattached: row.isUnattached,
      isAttachedToStoppedInstance: row.isAttachedToStoppedInstance,
      isIdleCandidate: row.isIdleCandidate,
      isUnderutilizedCandidate: row.isUnderutilizedCandidate,
      optimizationStatus: row.optimizationStatus,
      status: row.status,
      statusLabel: row.statusLabel,
      tags: row.tags,
      metadata: row.metadata,
    }));

    const summaryRow = summaryRows[0];

    return {
      items,
      summary: {
        totalVolumes: toNumberOrZero(summaryRow?.totalVolumes),
        totalStorageGb: toNumberOrZero(summaryRow?.totalStorageGb),
        totalCost: toNumberOrZero(summaryRow?.totalCost),
        unattachedVolumes: toNumberOrZero(summaryRow?.unattachedVolumes),
        attachedToStoppedInstance: toNumberOrZero(summaryRow?.attachedToStoppedInstance),
        idleVolumes: toNumberOrZero(summaryRow?.idleVolumes),
        underutilizedVolumes: toNumberOrZero(summaryRow?.underutilizedVolumes),
      },
      dateRange,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: total === 0 ? 0 : Math.ceil(total / pageSize),
      },
    };
  }

  private resolveSortOrder(
    sortBy: InventoryEc2VolumesListQuery["sortBy"],
    sortDirection: InventoryEc2VolumesListQuery["sortDirection"],
  ): string {
    const baseOrder = ORDER_BY_SQL[sortBy] ?? ORDER_BY_SQL.signal;
    if (sortBy === "signal") return baseOrder;
    const direction = sortDirection === "asc" ? "ASC" : "DESC";
    return `${baseOrder} ${direction} NULLS LAST, LOWER(base.volume_id) ASC`;
  }

  async getVolumePerformance(input: {
    tenantId: string;
    query: InventoryEc2VolumePerformanceQuery;
  }): Promise<InventoryEc2VolumePerformanceResponse> {
    const dateRange = resolvePerformanceDateRange(input.query);
    const selectedMetrics = this.resolveValidatedPerformanceMetrics(
      input.query.topic,
      input.query.metrics,
    );

    const rows = await this.loadPerformanceRows({
      tenantId: input.tenantId,
      volumeId: input.query.volumeId,
      cloudConnectionId: input.query.cloudConnectionId,
      interval: input.query.interval,
      metrics: selectedMetrics,
      dateRange,
    });

    const series: InventoryEc2VolumePerformanceSeries[] = selectedMetrics.map((metric) => {
      const metadata = PERFORMANCE_METRIC_META[metric];
      return {
        metric,
        label: metadata.label,
        unit: metadata.unit,
        points: rows
          .map((row) => {
            const value = toNullableNumber(row[metric]);
            const timestamp = toIsoOrNull(row.timestamp);
            if (value === null || timestamp === null) return null;
            return { timestamp, value };
          })
          .filter((point): point is { timestamp: string; value: number } => point !== null),
      };
    });

    return {
      volumeId: input.query.volumeId,
      cloudConnectionId: input.query.cloudConnectionId,
      interval: input.query.interval,
      topic: input.query.topic,
      metrics: selectedMetrics,
      startDate: dateRange.startDate,
      endDate: dateRange.endDate,
      series,
    };
  }

  private resolveValidatedPerformanceMetrics(
    topic: "ebs",
    requestedMetrics: InventoryEc2VolumePerformanceMetric[],
  ): InventoryEc2VolumePerformanceMetric[] {
    const allowed = new Set(PERFORMANCE_TOPIC_METRICS[topic]);
    const filtered = requestedMetrics.filter((metric) => allowed.has(metric));
    if (filtered.length === 0) {
      return [DEFAULT_TOPIC_METRIC[topic]];
    }
    return Array.from(new Set(filtered));
  }

  private async loadPerformanceRows(input: {
    tenantId: string;
    volumeId: string;
    cloudConnectionId: string | null;
    interval: InventoryEc2VolumePerformanceInterval;
    metrics: InventoryEc2VolumePerformanceMetric[];
    dateRange: DateRange;
  }): Promise<PerformanceDataRow[]> {
    const tableName =
      input.interval === "hourly"
        ? "ebs_volume_utilization_hourly"
        : "ebs_volume_utilization_daily";
    const timestampSelect =
      input.interval === "hourly" ? "u.hour_start AS timestamp" : "u.usage_date::timestamp AS timestamp";
    const rangeClause =
      input.interval === "hourly"
        ? "u.hour_start >= $4::timestamptz AND u.hour_start < (($5::date + INTERVAL '1 day')::timestamptz)"
        : "u.usage_date >= $4::date AND u.usage_date <= $5::date";
    const metricSelect = input.metrics
      .map((metric) => `u.${PERFORMANCE_METRIC_META[metric].column} AS ${metric}`)
      .join(",\n          ");

    const rows = await sequelize.query<PerformanceDataRow>(
      `
        SELECT
          ${timestampSelect},
          ${metricSelect}
        FROM ${tableName} u
        WHERE u.tenant_id = $1::uuid
          AND u.volume_id = $2
          AND (
            $3::uuid IS NULL
            OR u.cloud_connection_id = $3::uuid
            OR u.cloud_connection_id IS NULL
          )
          AND ${rangeClause}
        ORDER BY timestamp ASC;
      `,
      {
        bind: [
          input.tenantId,
          input.volumeId,
          input.cloudConnectionId,
          input.dateRange.startDate,
          input.dateRange.endDate,
        ],
        type: QueryTypes.SELECT,
      },
    );

    return rows;
  }

  private buildBaseQuery(input: {
    tenantId: string;
    query: InventoryEc2VolumesListQuery;
    dateRange: DateRange;
  }): BaseQueryParts {
    const whereParts: string[] = [
      "inv.tenant_id = $1::uuid",
      "inv.is_current = TRUE",
      "inv.deleted_at IS NULL",
    ];
    const bind: unknown[] = [input.tenantId, input.dateRange.startDate, input.dateRange.endDate];
    let nextIndex = 4;

    if (input.query.cloudConnectionId) {
      whereParts.push(`inv.cloud_connection_id = $${nextIndex}::uuid`);
      bind.push(input.query.cloudConnectionId);
      nextIndex += 1;
    }

    if (input.query.subAccountKey) {
      whereParts.push(`inv.sub_account_key::text = $${nextIndex}`);
      bind.push(input.query.subAccountKey);
      nextIndex += 1;
    }

    const baseWhereParts: string[] = [];

    const normalizedVolumeType = normalizeLower(input.query.volumeType);
    if (normalizedVolumeType) {
      baseWhereParts.push(`LOWER(COALESCE(current.volume_type, '')) = $${nextIndex}`);
      bind.push(normalizedVolumeType);
      nextIndex += 1;
    }

    const normalizedState = normalizeLower(input.query.state);
    if (normalizedState) {
      baseWhereParts.push(`LOWER(COALESCE(current.state, '')) = $${nextIndex}`);
      bind.push(normalizedState);
      nextIndex += 1;
    }

    const normalizedAttachedInstanceId = normalizeLower(input.query.attachedInstanceId);
    if (normalizedAttachedInstanceId) {
      baseWhereParts.push(`LOWER(COALESCE(current.attached_instance_id, '')) = $${nextIndex}`);
      bind.push(normalizedAttachedInstanceId);
      nextIndex += 1;
    }

    const normalizedRegion = normalizeLower(input.query.region);
    if (normalizedRegion) {
      const exactIndex = nextIndex;
      const likeIndex = nextIndex + 1;
      baseWhereParts.push(`
        (
          LOWER(COALESCE(dr.region_id, '')) = $${exactIndex}
          OR LOWER(COALESCE(dr.region_name, '')) = $${exactIndex}
          OR LOWER(COALESCE(current.availability_zone, '')) = $${exactIndex}
          OR LOWER(COALESCE(current.availability_zone, '')) LIKE $${likeIndex}
        )
      `);
      bind.push(normalizedRegion, `${normalizedRegion}%`);
      nextIndex += 2;
    }

    const latestWhereParts: string[] = [];
    if (typeof input.query.isAttached === "boolean") {
      latestWhereParts.push(`current.is_attached = $${nextIndex}`);
      bind.push(input.query.isAttached);
      nextIndex += 1;
    }

    if (input.query.attachmentState === "attached") {
      latestWhereParts.push(`COALESCE(current.is_attached, FALSE) = TRUE`);
    } else if (input.query.attachmentState === "unattached") {
      latestWhereParts.push(`COALESCE(NOT COALESCE(current.is_attached, FALSE), FALSE) = TRUE`);
    } else if (input.query.attachmentState === "attached_stopped") {
      latestWhereParts.push(`COALESCE(current.is_attached, FALSE) = TRUE AND LOWER(COALESCE(inst.attached_instance_state, '')) = 'stopped'`);
    }

    if (input.query.optimizationStatus) {
      latestWhereParts.push(`
        LOWER(
          CASE
            WHEN COALESCE(utilization.is_idle_candidate, FALSE) THEN 'idle'
            WHEN COALESCE(utilization.is_underutilized_candidate, FALSE) THEN 'underutilized'
            ELSE 'optimal'
          END
        ) = $${nextIndex}
      `);
      bind.push(input.query.optimizationStatus);
      nextIndex += 1;
    }

    if (input.query.signal === "unattached") {
      latestWhereParts.push(`COALESCE(NOT COALESCE(current.is_attached, FALSE), FALSE) = TRUE`);
    } else if (input.query.signal === "attached_stopped") {
      latestWhereParts.push(`COALESCE(current.is_attached, FALSE) = TRUE AND LOWER(COALESCE(inst.attached_instance_state, '')) = 'stopped'`);
    } else if (input.query.signal === "idle") {
      latestWhereParts.push(`COALESCE(utilization.is_idle_candidate, FALSE) = TRUE`);
    } else if (input.query.signal === "underutilized") {
      latestWhereParts.push(`COALESCE(utilization.is_underutilized_candidate, FALSE) = TRUE`);
    }

    const normalizedSearch = normalizeLower(input.query.search);
    if (normalizedSearch) {
      latestWhereParts.push(`
        (
          LOWER(current.volume_id) LIKE $${nextIndex}
          OR LOWER(COALESCE(NULLIF(TRIM(COALESCE(current.tags_json ->> 'Name', '')), ''), current.volume_id)) LIKE $${nextIndex}
          OR LOWER(COALESCE(current.attached_instance_id, '')) LIKE $${nextIndex}
          OR LOWER(COALESCE(inst.attached_instance_name, '')) LIKE $${nextIndex}
        )
      `);
      bind.push(`%${normalizedSearch}%`);
      nextIndex += 1;
    }

    const allBaseWhereParts = [...baseWhereParts, ...latestWhereParts];
    const latestWhereClause =
      allBaseWhereParts.length > 0 ? `WHERE ${allBaseWhereParts.join(" AND ")}` : "";

    const sql = `
      WITH current_inventory AS (
        SELECT
          inv.volume_id,
          inv.cloud_connection_id::text AS cloud_connection_id,
          inv.sub_account_key::text AS sub_account_key,
          inv.region_key::text AS region_key,
          inv.resource_key::text AS resource_key,
          inv.volume_type,
          inv.size_gb,
          inv.iops,
          inv.throughput,
          inv.availability_zone,
          inv.state,
          inv.attached_instance_id,
          inv.is_attached,
          inv.discovered_at,
          inv.tags_json,
          inv.metadata_json,
          ROW_NUMBER() OVER (
            PARTITION BY inv.cloud_connection_id, inv.volume_id
            ORDER BY inv.discovered_at DESC, inv.updated_at DESC NULLS LAST, inv.id DESC
          ) AS row_rank
        FROM ec2_volume_inventory_snapshots inv
        WHERE ${whereParts.join(" AND ")}
      ),
      current AS (
        SELECT
          current_inventory.volume_id,
          current_inventory.cloud_connection_id,
          current_inventory.sub_account_key,
          current_inventory.region_key,
          current_inventory.resource_key,
          current_inventory.volume_type,
          current_inventory.size_gb,
          current_inventory.iops,
          current_inventory.throughput,
          current_inventory.availability_zone,
          current_inventory.state,
          current_inventory.attached_instance_id,
          current_inventory.is_attached,
          current_inventory.discovered_at,
          current_inventory.tags_json,
          current_inventory.metadata_json
        FROM current_inventory
        WHERE current_inventory.row_rank = 1
      ),
      cost_scoped AS (
        SELECT
          f.volume_id,
          f.cloud_connection_id::text AS cloud_connection_id,
          f.usage_date,
          f.total_cost::double precision AS total_cost,
          COALESCE(f.storage_cost, 0)::double precision AS storage_cost,
          COALESCE(f.io_cost, 0)::double precision AS io_cost,
          COALESCE(f.throughput_cost, 0)::double precision AS throughput_cost,
          f.currency_code,
          ROW_NUMBER() OVER (
            PARTITION BY f.volume_id, f.cloud_connection_id
            ORDER BY f.usage_date DESC, f.updated_at DESC NULLS LAST, f.id DESC
          ) AS row_rank,
          MAX(f.usage_date) OVER (PARTITION BY f.volume_id, f.cloud_connection_id) AS latest_usage_date
        FROM fact_ebs_volume_daily f
        WHERE f.tenant_id = $1::uuid
          AND f.usage_date >= $2::date
          AND f.usage_date <= $3::date
      ),
      cost_agg AS (
        SELECT
          cost_scoped.volume_id,
          cost_scoped.cloud_connection_id,
          COALESCE(SUM(cost_scoped.total_cost), 0)::double precision AS raw_mtd_cost,
          COALESCE(SUM(cost_scoped.storage_cost), 0)::double precision AS raw_storage_cost,
          COALESCE(SUM(GREATEST(cost_scoped.total_cost, 0)), 0)::double precision AS mtd_cost,
          COALESCE(SUM(GREATEST(cost_scoped.storage_cost, 0)), 0)::double precision AS storage_cost,
          COALESCE(SUM(GREATEST(cost_scoped.io_cost, 0)), 0)::double precision AS io_cost,
          COALESCE(SUM(GREATEST(cost_scoped.throughput_cost, 0)), 0)::double precision AS piops_cost,
          (($3::date - $2::date + 1) * 24)::double precision AS hours,
          COALESCE(
            SUM(
              CASE
                WHEN cost_scoped.usage_date = cost_scoped.latest_usage_date
                  THEN GREATEST(cost_scoped.total_cost, 0)
                ELSE 0
              END
            ),
            0
          )::double precision AS daily_cost
        FROM cost_scoped
        GROUP BY cost_scoped.volume_id, cost_scoped.cloud_connection_id
      ),
      cost_latest AS (
        SELECT
          cost_scoped.volume_id,
          cost_scoped.cloud_connection_id,
          cost_scoped.usage_date,
          cost_scoped.currency_code
        FROM cost_scoped
        WHERE cost_scoped.row_rank = 1
      ),
      utilization_agg AS (
        SELECT
          u.volume_id,
          u.cloud_connection_id::text AS cloud_connection_id,
          BOOL_OR(COALESCE(u.is_idle_candidate, FALSE)) AS is_idle_candidate,
          BOOL_OR(COALESCE(u.is_underutilized_candidate, FALSE)) AS is_underutilized_candidate
        FROM ebs_volume_utilization_daily u
        WHERE u.tenant_id = $1::uuid
          AND u.usage_date >= $2::date
          AND u.usage_date <= $3::date
        GROUP BY u.volume_id, u.cloud_connection_id
      ),
      snapshot_scoped AS (
        SELECT
          s.source_volume_id AS volume_id,
          s.cloud_connection_id::text AS cloud_connection_id,
          s.snapshot_id
        FROM ec2_snapshot_inventory_snapshots s
        WHERE s.tenant_id = $1::uuid
          AND s.is_current = TRUE
          AND s.deleted_at IS NULL
      ),
      snapshot_cost_scoped AS (
        SELECT
          ss.volume_id,
          ss.cloud_connection_id,
          SUM(COALESCE(fcli.billed_cost, fcli.effective_cost, fcli.list_cost, 0))::double precision AS snapshot_cost
        FROM snapshot_scoped ss
        INNER JOIN dim_resource dr
          ON dr.tenant_id = $1::uuid
         AND dr.resource_id = ss.snapshot_id
         AND LOWER(COALESCE(dr.resource_type, '')) = 'ec2_snapshot'
        INNER JOIN fact_cost_line_items fcli
          ON fcli.tenant_id = $1::uuid
         AND fcli.resource_key = dr.id
        INNER JOIN dim_date dd
          ON dd.id = fcli.usage_date_key
        WHERE dd.full_date >= $2::date
          AND dd.full_date <= $3::date
        GROUP BY ss.volume_id, ss.cloud_connection_id
      ),
      snapshot_agg AS (
        SELECT
          ss.volume_id,
          ss.cloud_connection_id,
          COUNT(*)::double precision AS snapshot_count,
          COALESCE(MAX(scs.snapshot_cost), 0)::double precision AS snapshot_cost
        FROM snapshot_scoped ss
        LEFT JOIN snapshot_cost_scoped scs
          ON scs.volume_id = ss.volume_id
         AND scs.cloud_connection_id IS NOT DISTINCT FROM ss.cloud_connection_id
        GROUP BY ss.volume_id, ss.cloud_connection_id
      ),
      pre_base AS (
        SELECT
          current.volume_id,
          COALESCE(NULLIF(TRIM(COALESCE(current.tags_json ->> 'Name', '')), ''), current.volume_id) AS volume_name,
          current.volume_type,
          current.size_gb,
          current.iops,
          current.throughput,
          current.state,
          current.availability_zone,
          current.is_attached,
          current.attached_instance_id,
          inst.attached_instance_name,
          inst.attached_instance_state,
          inst.attached_instance_type,
          current.cloud_connection_id,
          current.sub_account_key,
          dsa.sub_account_name,
          current.region_key,
          dr.region_id,
          dr.region_name,
          current.resource_key,
          cost_latest.usage_date,
          cost_latest.currency_code,
          COALESCE(cost_agg.daily_cost, 0)::double precision AS daily_cost,
          COALESCE(cost_agg.mtd_cost, 0)::double precision AS mtd_cost,
          COALESCE(cost_agg.storage_cost, 0)::double precision AS storage_cost,
          COALESCE(cost_agg.io_cost, 0)::double precision AS io_cost,
          COALESCE(cost_agg.piops_cost, 0)::double precision AS piops_cost,
          COALESCE(cost_agg.raw_mtd_cost, 0)::double precision AS raw_mtd_cost,
          COALESCE(cost_agg.raw_storage_cost, 0)::double precision AS raw_storage_cost,
          COALESCE(cost_agg.hours, 0)::double precision AS hours,
          0::double precision AS ssd_savings,
          COALESCE(snapshot.snapshot_count, 0)::double precision AS snapshot_count,
          COALESCE(snapshot.snapshot_cost, 0)::double precision AS snapshot_cost,
          COALESCE(NOT COALESCE(current.is_attached, FALSE), FALSE) AS is_unattached,
          (
            COALESCE(current.is_attached, FALSE)
            AND LOWER(COALESCE(inst.attached_instance_state, '')) = 'stopped'
          ) AS is_attached_to_stopped_instance,
          COALESCE(utilization.is_idle_candidate, FALSE) AS is_idle_candidate,
          COALESCE(utilization.is_underutilized_candidate, FALSE) AS is_underutilized_candidate,
          CASE
            WHEN COALESCE(utilization.is_idle_candidate, FALSE) THEN 'idle'
            WHEN COALESCE(utilization.is_underutilized_candidate, FALSE) THEN 'underutilized'
            ELSE 'optimal'
          END AS optimization_status,
          CASE
            WHEN COALESCE(NOT COALESCE(current.is_attached, FALSE), FALSE) THEN 'unattached'
            WHEN (
              COALESCE(current.is_attached, FALSE)
              AND LOWER(COALESCE(inst.attached_instance_state, '')) = 'stopped'
            ) THEN 'attached_stopped'
            WHEN COALESCE(utilization.is_idle_candidate, FALSE) THEN 'idle'
            WHEN COALESCE(utilization.is_underutilized_candidate, FALSE) THEN 'underutilized'
            ELSE 'healthy'
          END AS status,
          CASE
            WHEN COALESCE(NOT COALESCE(current.is_attached, FALSE), FALSE) THEN 'Unattached'
            WHEN (
              COALESCE(current.is_attached, FALSE)
              AND LOWER(COALESCE(inst.attached_instance_state, '')) = 'stopped'
            ) THEN 'Attached to Stopped Instance'
            WHEN COALESCE(utilization.is_idle_candidate, FALSE) THEN 'Idle'
            WHEN COALESCE(utilization.is_underutilized_candidate, FALSE) THEN 'Underutilized'
            ELSE 'Healthy'
          END AS status_label,
          current.discovered_at,
          current.tags_json AS tags,
          current.metadata_json AS metadata,
          CASE
            WHEN COALESCE(NOT COALESCE(current.is_attached, FALSE), FALSE) THEN 1
            WHEN (
              COALESCE(current.is_attached, FALSE)
              AND LOWER(COALESCE(inst.attached_instance_state, '')) = 'stopped'
            ) THEN 2
            WHEN COALESCE(utilization.is_idle_candidate, FALSE) THEN 3
            WHEN COALESCE(utilization.is_underutilized_candidate, FALSE) THEN 4
            ELSE 9
          END AS signal_rank
        FROM current
        LEFT JOIN dim_region dr
          ON dr.id::text = current.region_key
        LEFT JOIN dim_sub_account dsa
          ON dsa.id::text = current.sub_account_key
        LEFT JOIN LATERAL (
          SELECT
            agg.daily_cost,
            agg.mtd_cost,
            agg.storage_cost,
            agg.io_cost,
            agg.piops_cost,
            agg.raw_mtd_cost,
            agg.raw_storage_cost,
            agg.hours
          FROM cost_agg agg
          WHERE agg.volume_id = current.volume_id
            AND (
              current.cloud_connection_id IS NULL
              OR agg.cloud_connection_id IS NULL
              OR agg.cloud_connection_id = current.cloud_connection_id
            )
          ORDER BY
            CASE WHEN agg.cloud_connection_id = current.cloud_connection_id THEN 0 ELSE 1 END
          LIMIT 1
        ) cost_agg ON TRUE
        LEFT JOIN LATERAL (
          SELECT
            cl.usage_date,
            cl.currency_code
          FROM cost_latest cl
          WHERE cl.volume_id = current.volume_id
            AND (
              current.cloud_connection_id IS NULL
              OR cl.cloud_connection_id IS NULL
              OR cl.cloud_connection_id = current.cloud_connection_id
            )
          ORDER BY
            CASE WHEN cl.cloud_connection_id = current.cloud_connection_id THEN 0 ELSE 1 END,
            cl.usage_date DESC NULLS LAST
          LIMIT 1
        ) cost_latest ON TRUE
        LEFT JOIN LATERAL (
          SELECT
            ua.is_idle_candidate,
            ua.is_underutilized_candidate
          FROM utilization_agg ua
          WHERE ua.volume_id = current.volume_id
            AND (
              current.cloud_connection_id IS NULL
              OR ua.cloud_connection_id IS NULL
              OR ua.cloud_connection_id = current.cloud_connection_id
            )
          ORDER BY
            CASE WHEN ua.cloud_connection_id = current.cloud_connection_id THEN 0 ELSE 1 END
          LIMIT 1
        ) utilization ON TRUE
        LEFT JOIN LATERAL (
          SELECT
            sa.snapshot_count,
            sa.snapshot_cost
          FROM snapshot_agg sa
          WHERE sa.volume_id = current.volume_id
            AND (
              current.cloud_connection_id IS NULL
              OR sa.cloud_connection_id IS NULL
              OR sa.cloud_connection_id = current.cloud_connection_id
            )
          ORDER BY
            CASE WHEN sa.cloud_connection_id = current.cloud_connection_id THEN 0 ELSE 1 END
          LIMIT 1
        ) snapshot ON TRUE
        LEFT JOIN LATERAL (
          SELECT
            COALESCE(NULLIF(TRIM(COALESCE(inv.tags_json ->> 'Name', '')), ''), inv.instance_id) AS attached_instance_name,
            inv.state AS attached_instance_state,
            inv.instance_type AS attached_instance_type
          FROM ec2_instance_inventory_snapshots inv
          WHERE inv.tenant_id = $1::uuid
            AND inv.is_current = true
            AND inv.deleted_at IS NULL
            AND inv.instance_id = current.attached_instance_id
            AND (
              current.cloud_connection_id IS NULL
              OR inv.cloud_connection_id IS NULL
              OR inv.cloud_connection_id::text = current.cloud_connection_id
            )
          ORDER BY
            CASE WHEN inv.cloud_connection_id::text = current.cloud_connection_id THEN 0 ELSE 1 END,
            inv.discovered_at DESC NULLS LAST,
            inv.updated_at DESC NULLS LAST
          LIMIT 1
        ) inst ON TRUE
        ${latestWhereClause}
      ),
      base AS (
        SELECT
          *
        FROM pre_base
        WHERE
          pre_base.volume_id IS NOT NULL
          AND LENGTH(TRIM(pre_base.volume_id)) > 0
          AND LOWER(TRIM(pre_base.volume_id)) <> 'unknown'
          AND COALESCE(pre_base.raw_mtd_cost, 0) >= 0
          AND COALESCE(pre_base.raw_storage_cost, 0) >= 0
      )
    `;

    return { sql, bind, nextIndex };
  }
}
