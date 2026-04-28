import { QueryTypes } from "sequelize";

import { BadRequestError, NotFoundError } from "../../../../../errors/http-errors.js";
import { sequelize } from "../../../../../models/index.js";
import type {
  InventoryEc2InstanceDetailQuery,
  InventoryEc2InstanceDetailResponse,
  InventoryEc2InstancePerformanceQuery,
  InventoryEc2InstancePerformanceSeries,
  InventoryEc2InstancePerformanceResponse,
  InventoryEc2PerformanceInterval,
  InventoryEc2PerformanceMetric,
  InventoryEc2PerformanceTopic,
  InventoryEc2InstancesListItem,
  InventoryEc2InstancesListQuery,
  InventoryEc2InstancesListResponse,
} from "./instances-inventory.types.js";

type InventoryRow = {
  instanceId: string;
  instanceName: string;
  state: string | null;
  instanceType: string | null;
  subAccountKey: string | null;
  subAccountName: string | null;
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
  tagsJson: Record<string, unknown> | null;
};

type InventoryCountRow = {
  total: string;
};

type FactMetricsRow = {
  cloudConnectionKey: string;
  instanceId: string;
  cpuAvg: number | string | null;
  cpuMax: number | string | null;
  isIdleCandidate: boolean | null;
  isUnderutilizedCandidate: boolean | null;
  isOverutilizedCandidate: boolean | null;
  pricingType: string | null;
  totalHours: number | string | null;
  computeCost: number | string | null;
  monthToDateCost: number | string | null;
  dataTransferCost: number | string | null;
  networkUsageBytes: number | string | null;
  coveredHours: number | string | null;
  uncoveredHours: number | string | null;
  latestDailyCost: number;
};

type AttachedVolumeSummaryRow = {
  cloudConnectionKey: string;
  instanceId: string;
  attachedVolumeCount: number | string;
  attachedVolumeTotalSizeGb: number | string | null;
  attachedVolumeIds: string[];
};

type PerformanceDataRow = {
  timestamp: Date | string;
} & Partial<Record<InventoryEc2PerformanceMetric, number | string | null>>;

type RecommendationRow = {
  id: number | string;
  type: string | null;
  problem: string | null;
  evidence: string | null;
  action: string | null;
  saving: number | string | null;
  risk: string | null;
  status: string | null;
};

type DateRange = {
  startDate: string;
  endDate: string;
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
const toIsoDate = (value: Date): string => value.toISOString().slice(0, 10);

const resolveDateRange = (query: InventoryEc2InstancesListQuery): DateRange => {
  const today = new Date();
  const startOfMonth = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));

  const parsedStart = query.startDate ? new Date(`${query.startDate}T00:00:00Z`) : null;
  const parsedEnd = query.endDate ? new Date(`${query.endDate}T00:00:00Z`) : null;

  const startDate =
    parsedStart && !Number.isNaN(parsedStart.getTime())
      ? parsedStart
      : startOfMonth;
  const endDate =
    parsedEnd && !Number.isNaN(parsedEnd.getTime())
      ? parsedEnd
      : today;

  if (startDate.getTime() <= endDate.getTime()) {
    return {
      startDate: toIsoDate(startDate),
      endDate: toIsoDate(endDate),
    };
  }

  return {
    startDate: toIsoDate(endDate),
    endDate: toIsoDate(startDate),
  };
};

const toConnectionInstanceKey = (cloudConnectionId: string | null, instanceId: string): string =>
  `${cloudConnectionId ?? ""}::${instanceId}`;

const PERFORMANCE_TOPIC_METRICS: Record<InventoryEc2PerformanceTopic, InventoryEc2PerformanceMetric[]> = {
  cpu: ["cpu_avg", "cpu_max", "cpu_min"],
  network: ["network_in_bytes", "network_out_bytes"],
  disk_throughput: ["disk_read_bytes", "disk_write_bytes"],
  disk_operations: ["disk_read_ops", "disk_write_ops"],
  ebs: [
    "ebs_read_bytes",
    "ebs_write_bytes",
    "ebs_queue_length_max",
    "ebs_burst_balance_avg",
    "ebs_idle_time_avg",
  ],
  health: [
    "status_check_failed_max",
    "status_check_failed_instance_max",
    "status_check_failed_system_max",
  ],
};

const DEFAULT_TOPIC_METRIC: Record<InventoryEc2PerformanceTopic, InventoryEc2PerformanceMetric> = {
  cpu: "cpu_avg",
  network: "network_in_bytes",
  disk_throughput: "disk_read_bytes",
  disk_operations: "disk_read_ops",
  ebs: "ebs_read_bytes",
  health: "status_check_failed_max",
};

const PERFORMANCE_METRIC_META: Record<
  InventoryEc2PerformanceMetric,
  { label: string; unit: InventoryEc2InstancePerformanceSeries["unit"] }
> = {
  cpu_avg: { label: "Avg CPU %", unit: "percent" },
  cpu_max: { label: "Max CPU %", unit: "percent" },
  cpu_min: { label: "Min CPU %", unit: "percent" },
  network_in_bytes: { label: "Network In", unit: "bytes" },
  network_out_bytes: { label: "Network Out", unit: "bytes" },
  disk_read_bytes: { label: "Disk Read Bytes", unit: "bytes" },
  disk_write_bytes: { label: "Disk Write Bytes", unit: "bytes" },
  disk_read_ops: { label: "Disk Read Ops", unit: "count" },
  disk_write_ops: { label: "Disk Write Ops", unit: "count" },
  ebs_read_bytes: { label: "EBS Read Bytes", unit: "bytes" },
  ebs_write_bytes: { label: "EBS Write Bytes", unit: "bytes" },
  ebs_queue_length_max: { label: "EBS Queue Length Max", unit: "count" },
  ebs_burst_balance_avg: { label: "EBS Burst Balance Avg", unit: "percent" },
  ebs_idle_time_avg: { label: "EBS Idle Time Avg", unit: "percent" },
  status_check_failed_max: { label: "Status Check Failed", unit: "count" },
  status_check_failed_instance_max: { label: "Instance Status Check Failed", unit: "count" },
  status_check_failed_system_max: { label: "System Status Check Failed", unit: "count" },
};

const resolvePerformanceDateRange = (query: InventoryEc2InstancePerformanceQuery): DateRange => {
  const today = new Date();
  const defaultStart = new Date(today);
  defaultStart.setUTCDate(defaultStart.getUTCDate() - 29);

  const parsedStart = query.startDate ? new Date(`${query.startDate}T00:00:00Z`) : null;
  const parsedEnd = query.endDate ? new Date(`${query.endDate}T00:00:00Z`) : null;

  const startDate = parsedStart && !Number.isNaN(parsedStart.getTime()) ? parsedStart : defaultStart;
  const endDate = parsedEnd && !Number.isNaN(parsedEnd.getTime()) ? parsedEnd : today;

  if (startDate.getTime() <= endDate.getTime()) {
    return {
      startDate: toIsoDate(startDate),
      endDate: toIsoDate(endDate),
    };
  }

  return {
    startDate: toIsoDate(endDate),
    endDate: toIsoDate(startDate),
  };
};

export class InstancesInventoryService {
  async getInstanceDetails(input: {
    tenantId: string;
    query: InventoryEc2InstanceDetailQuery;
  }): Promise<InventoryEc2InstanceDetailResponse> {
    const dateRange = resolveDateRange({
      ...input.query,
      page: 1,
      pageSize: 1,
      state: null,
      instanceType: null,
      pricingType: null,
      region: null,
      search: null,
      subAccountKey: null,
      cloudConnectionId: input.query.cloudConnectionId,
    });
    const instance = await this.loadInstanceIdentity(input);
    if (!instance) {
      throw new NotFoundError("Instance not found");
    }

    const costUsageRows = await sequelize.query<{
      usageDate: string;
      totalCost: number | string | null;
      computeCost: number | string | null;
      ebsCost: number | string | null;
      networkCost: number | string | null;
      cpuAvg: number | string | null;
      cpuMax: number | string | null;
      networkInBytes: number | string | null;
      networkOutBytes: number | string | null;
      totalHours: number | string | null;
      coveredHours: number | string | null;
      uncoveredHours: number | string | null;
      pricingType: string | null;
    }>(
      `
      SELECT
        fed.usage_date::text AS "usageDate",
        COALESCE(fed.total_effective_cost, fed.total_billed_cost, 0)::double precision AS "totalCost",
        COALESCE(fed.compute_cost, 0)::double precision AS "computeCost",
        COALESCE(fed.ebs_cost, 0)::double precision AS "ebsCost",
        COALESCE(fed.data_transfer_cost, 0)::double precision AS "networkCost",
        fed.cpu_avg::double precision AS "cpuAvg",
        fed.cpu_max::double precision AS "cpuMax",
        COALESCE(fed.network_in_bytes, 0)::double precision AS "networkInBytes",
        COALESCE(fed.network_out_bytes, 0)::double precision AS "networkOutBytes",
        COALESCE(fed.total_hours, 0)::double precision AS "totalHours",
        COALESCE(fed.covered_hours, 0)::double precision AS "coveredHours",
        COALESCE(fed.uncovered_hours, 0)::double precision AS "uncoveredHours",
        LOWER(
          COALESCE(
            NULLIF(TRIM(fed.reservation_type), ''),
            NULLIF(TRIM(fed.pricing_model), ''),
            CASE WHEN COALESCE(fed.is_spot, FALSE) THEN 'spot' ELSE 'on_demand' END
          )
        ) AS "pricingType"
      FROM fact_ec2_instance_daily fed
      WHERE fed.tenant_id = $1::uuid
        AND fed.instance_id = $2
        AND ($3::uuid IS NULL OR fed.cloud_connection_id = $3::uuid)
        AND fed.usage_date >= $4::date
        AND fed.usage_date <= $5::date
      ORDER BY fed.usage_date ASC;
      `,
      { bind: [input.tenantId, input.query.instanceId, input.query.cloudConnectionId, dateRange.startDate, dateRange.endDate], type: QueryTypes.SELECT },
    );

    const volumeRows = await sequelize.query<{
      volumeId: string;
      sizeGb: number | string | null;
      volumeType: string | null;
      cost: number | string | null;
      state: string | null;
      iops: number | string | null;
      throughput: number | string | null;
      attachedSince: Date | string | null;
      deleteOnTermination: boolean | null;
    }>(
      `
      SELECT
        inv.volume_id AS "volumeId",
        inv.size_gb::double precision AS "sizeGb",
        inv.volume_type AS "volumeType",
        COALESCE(SUM(fvd.total_cost), 0)::double precision AS cost,
        inv.state AS state,
        inv.iops::double precision AS iops,
        inv.throughput::double precision AS throughput,
        inv.discovered_at AS "attachedSince",
        NULL::boolean AS "deleteOnTermination"
      FROM ec2_volume_inventory_snapshots inv
      LEFT JOIN fact_ebs_volume_daily fvd
        ON fvd.tenant_id = inv.tenant_id
        AND fvd.volume_id = inv.volume_id
        AND ($3::uuid IS NULL OR fvd.cloud_connection_id = $3::uuid)
        AND fvd.usage_date >= $4::date
        AND fvd.usage_date <= $5::date
      WHERE inv.tenant_id = $1::uuid
        AND inv.attached_instance_id = $2
        AND inv.is_current = true
        AND inv.deleted_at IS NULL
        AND inv.is_attached = true
        AND ($3::uuid IS NULL OR inv.cloud_connection_id = $3::uuid)
      GROUP BY inv.volume_id, inv.size_gb, inv.volume_type, inv.state, inv.iops, inv.throughput, inv.discovered_at
      ORDER BY inv.volume_id ASC;
      `,
      { bind: [input.tenantId, input.query.instanceId, input.query.cloudConnectionId, dateRange.startDate, dateRange.endDate], type: QueryTypes.SELECT },
    );

    const recRows = await sequelize.query<RecommendationRow>(
      `
      SELECT
        fr.id::bigint AS id,
        fr.recommendation_type::text AS type,
        COALESCE(fr.recommendation_title, '')::text AS problem,
        COALESCE(fr.recommendation_text, '')::text AS evidence,
        COALESCE(fr.idle_observation_value, '')::text AS action,
        COALESCE(fr.estimated_monthly_savings, 0)::double precision AS saving,
        LOWER(COALESCE(fr.risk_level, 'medium'))::text AS risk,
        LOWER(COALESCE(fr.status, 'open'))::text AS status
      FROM fact_recommendations fr
      WHERE fr.tenant_id = $1::uuid
        AND fr.source_system = 'KCX_EC2_OPTIMIZATION_V1'
        AND fr.resource_type = 'ec2_instance'
        AND fr.resource_id = $2
        AND ($3::uuid IS NULL OR fr.cloud_connection_id = $3::uuid)
      ORDER BY fr.estimated_monthly_savings DESC NULLS LAST, fr.updated_at DESC;
      `,
      { bind: [input.tenantId, input.query.instanceId, input.query.cloudConnectionId], type: QueryTypes.SELECT },
    );

    const totalCost = costUsageRows.reduce((sum, row) => sum + toNumberOrZero(row.totalCost), 0);
    const computeCost = costUsageRows.reduce((sum, row) => sum + toNumberOrZero(row.computeCost), 0);
    const ebsCostFromFact = costUsageRows.reduce((sum, row) => sum + toNumberOrZero(row.ebsCost), 0);
    const ebsCost = ebsCostFromFact > 0 ? ebsCostFromFact : volumeRows.reduce((sum, row) => sum + toNumberOrZero(row.cost), 0);
    const networkCost = costUsageRows.reduce((sum, row) => sum + toNumberOrZero(row.networkCost), 0);
    const otherCost = Math.max(0, totalCost - computeCost - ebsCost - networkCost);

    const avgCpuValues = costUsageRows.map((row) => toNullableNumber(row.cpuAvg)).filter((v): v is number => v !== null);
    const maxCpuValues = costUsageRows.map((row) => toNullableNumber(row.cpuMax)).filter((v): v is number => v !== null);
    const networkInBytes = costUsageRows.reduce((sum, row) => sum + toNumberOrZero(row.networkInBytes), 0);
    const networkOutBytes = costUsageRows.reduce((sum, row) => sum + toNumberOrZero(row.networkOutBytes), 0);
    const coveredHours = costUsageRows.reduce((sum, row) => sum + toNumberOrZero(row.coveredHours), 0);
    const uncoveredHours = costUsageRows.reduce((sum, row) => sum + toNumberOrZero(row.uncoveredHours), 0);
    const totalHours = costUsageRows.reduce((sum, row) => sum + toNumberOrZero(row.totalHours), 0);
    const coveragePercent = totalHours > 0 ? (coveredHours / totalHours) * 100 : 0;
    const latestPricingType =
      [...costUsageRows].reverse().map((row) => row.pricingType).find((value) => value && value.length > 0) ?? null;

    const costTrend = costUsageRows.map((row) => {
      const rowTotal = toNumberOrZero(row.totalCost);
      const rowCompute = toNumberOrZero(row.computeCost);
      const rowEbs = toNumberOrZero(row.ebsCost);
      const rowNetwork = toNumberOrZero(row.networkCost);
      return {
        date: row.usageDate,
        totalCost: rowTotal,
        computeCost: rowCompute,
        ebsCost: rowEbs,
        networkCost: rowNetwork,
        otherCost: Math.max(0, rowTotal - rowCompute - rowEbs - rowNetwork),
      };
    });
    const cpuTrend = costUsageRows
      .map((row) => {
        const avg = toNullableNumber(row.cpuAvg);
        if (avg === null) return null;
        return { date: row.usageDate, avgCpu: avg, maxCpu: toNullableNumber(row.cpuMax) };
      })
      .filter((row): row is { date: string; avgCpu: number; maxCpu: number | null } => row !== null);
    const networkTrend = costUsageRows.map((row) => ({
      date: row.usageDate,
      totalGb: (toNumberOrZero(row.networkInBytes) + toNumberOrZero(row.networkOutBytes)) / (1024 * 1024 * 1024),
      inGb: toNumberOrZero(row.networkInBytes) / (1024 * 1024 * 1024),
      outGb: toNumberOrZero(row.networkOutBytes) / (1024 * 1024 * 1024),
    }));

    return {
      identity: {
        instanceId: instance.instanceId,
        name: instance.instanceName,
        state: instance.state,
        type: instance.instanceType,
        region: instance.regionId ?? instance.regionName ?? null,
        account: instance.subAccountName,
        launchTime: toIsoOrNull(instance.launchTime),
        availabilityZone: instance.availabilityZone,
        cloudConnectionId: instance.cloudConnectionId,
      },
      tags: instance.tagsJson ?? {},
      costSummary: { totalCost, computeCost, ebsCost, networkCost, otherCost },
      usageSummary: {
        avgCpu: avgCpuValues.length > 0 ? avgCpuValues.reduce((sum, value) => sum + value, 0) / avgCpuValues.length : null,
        maxCpu: maxCpuValues.length > 0 ? Math.max(...maxCpuValues) : null,
        networkInBytes,
        networkOutBytes,
        networkUsageBytes: networkInBytes + networkOutBytes,
        networkCost,
      },
      pricingSummary: {
        pricingType:
          latestPricingType === "on_demand" ||
          latestPricingType === "reserved" ||
          latestPricingType === "savings_plan" ||
          latestPricingType === "spot" ||
          latestPricingType === "other"
            ? latestPricingType
            : null,
        coveredHours,
        uncoveredHours,
        coveragePercent,
        computeCost,
        potentialSavings: recRows.length > 0 ? Math.max(...recRows.map((row) => toNumberOrZero(row.saving))) : null,
      },
      attachedVolumes: volumeRows.map((row) => ({
        volumeId: row.volumeId,
        sizeGb: toNullableNumber(row.sizeGb),
        volumeType: row.volumeType,
        cost: toNumberOrZero(row.cost),
        state: row.state,
        iops: toNullableNumber(row.iops),
        throughput: toNullableNumber(row.throughput),
        attachedSince: toIsoOrNull(row.attachedSince),
        deleteOnTermination: row.deleteOnTermination,
      })),
      recommendations: recRows.map((row) => ({
        id: Math.trunc(toNumberOrZero(row.id)),
        type: row.type ?? "unknown",
        problem: row.problem ?? "",
        evidence: row.evidence ?? "",
        action: row.action ?? "",
        saving: toNumberOrZero(row.saving),
        risk: row.risk ?? "medium",
        status: row.status ?? "open",
      })),
      trends: { costTrend, cpuTrend, networkTrend },
    };
  }

  async listInstances(input: {
    tenantId: string;
    query: InventoryEc2InstancesListQuery;
  }): Promise<InventoryEc2InstancesListResponse> {
    const page = input.query.page;
    const pageSize = input.query.pageSize;
    const dateRange = resolveDateRange(input.query);

    const { total, rows } = await this.loadInventoryPage({
      tenantId: input.tenantId,
      query: input.query,
      dateRange,
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

    const metricsLookup = await this.loadFactMetricsLookup({
      tenantId: input.tenantId,
      rows,
      dateRange,
    });
    const attachedVolumesLookup = await this.loadAttachedVolumeLookup({
      tenantId: input.tenantId,
      rows,
    });

    const items: InventoryEc2InstancesListItem[] = rows.map((row) => {
      const metrics =
        metricsLookup.byConnectionInstance.get(
          toConnectionInstanceKey(row.cloudConnectionId, row.instanceId),
        ) ?? metricsLookup.byInstance.get(row.instanceId);
      const attachedVolumes =
        attachedVolumesLookup.byConnectionInstance.get(
          toConnectionInstanceKey(row.cloudConnectionId, row.instanceId),
        ) ?? attachedVolumesLookup.byInstance.get(row.instanceId);

      return {
        instanceId: row.instanceId,
        instanceName: row.instanceName,
        state: row.state,
        instanceType: row.instanceType,
        subAccountKey: row.subAccountKey,
        subAccountName: row.subAccountName,
        regionKey: row.regionKey,
        regionId: row.regionId,
        regionName: row.regionName,
        availabilityZone: row.availabilityZone,
        platform: row.platform,
        launchTime: toIsoOrNull(row.launchTime),
        privateIpAddress: row.privateIpAddress,
        publicIpAddress: row.publicIpAddress,
        cpuAvg: toNullableNumber(metrics?.cpuAvg),
        cpuMax: toNullableNumber(metrics?.cpuMax),
        isIdleCandidate: metrics?.isIdleCandidate ?? null,
        isUnderutilizedCandidate: metrics?.isUnderutilizedCandidate ?? null,
        isOverutilizedCandidate: metrics?.isOverutilizedCandidate ?? null,
        pricingType:
          metrics?.pricingType === "on_demand" ||
          metrics?.pricingType === "reserved" ||
          metrics?.pricingType === "savings_plan" ||
          metrics?.pricingType === "spot" ||
          metrics?.pricingType === "other"
            ? metrics.pricingType
            : null,
        totalHours: toNumberOrZero(metrics?.totalHours),
        computeCost: toNumberOrZero(metrics?.computeCost),
        monthToDateCost: toNumberOrZero(metrics?.monthToDateCost),
        dataTransferCost: toNumberOrZero(metrics?.dataTransferCost),
        networkUsageBytes: toNumberOrZero(metrics?.networkUsageBytes),
        coveredHours: toNumberOrZero(metrics?.coveredHours),
        uncoveredHours: toNumberOrZero(metrics?.uncoveredHours),
        otherUnallocatedCost: Math.max(
          0,
          toNumberOrZero(metrics?.monthToDateCost) -
            toNumberOrZero(metrics?.computeCost) -
            toNumberOrZero(metrics?.dataTransferCost),
        ),
        latestDailyCost: toNumberOrZero(metrics?.latestDailyCost),
        imageId: row.imageId,
        tenancy: row.tenancy,
        architecture: row.architecture,
        instanceLifecycle: row.instanceLifecycle,
        resourceKey: row.resourceKey,
        cloudConnectionId: row.cloudConnectionId,
        attachedVolumeCount: toNumberOrZero(attachedVolumes?.attachedVolumeCount),
        attachedVolumeTotalSizeGb: toNullableNumber(attachedVolumes?.attachedVolumeTotalSizeGb),
        attachedVolumeIds: Array.isArray(attachedVolumes?.attachedVolumeIds)
          ? attachedVolumes.attachedVolumeIds.filter(
              (volumeId): volumeId is string =>
                typeof volumeId === "string" && volumeId.trim().length > 0,
            )
          : [],
        tags: row.tagsJson,
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

  async getInstancePerformance(input: {
    tenantId: string;
    query: InventoryEc2InstancePerformanceQuery;
  }): Promise<InventoryEc2InstancePerformanceResponse> {
    const dateRange = resolvePerformanceDateRange(input.query);
    const selectedMetrics = this.resolveValidatedPerformanceMetrics(
      input.query.topic,
      input.query.metrics,
    );

    const rows = await this.loadPerformanceRows({
      tenantId: input.tenantId,
      instanceId: input.query.instanceId,
      cloudConnectionId: input.query.cloudConnectionId,
      interval: input.query.interval,
      metrics: selectedMetrics,
      dateRange,
    });

    const series: InventoryEc2InstancePerformanceSeries[] = selectedMetrics.map((metric) => {
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
      instanceId: input.query.instanceId,
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
    topic: InventoryEc2PerformanceTopic,
    requestedMetrics: InventoryEc2PerformanceMetric[],
  ): InventoryEc2PerformanceMetric[] {
    const allowed = new Set(PERFORMANCE_TOPIC_METRICS[topic]);
    const filtered = requestedMetrics.filter((metric) => allowed.has(metric));
    if (filtered.length === 0) {
      return [DEFAULT_TOPIC_METRIC[topic]];
    }
    return Array.from(new Set(filtered));
  }

  private async loadInstanceIdentity(input: {
    tenantId: string;
    query: InventoryEc2InstanceDetailQuery;
  }): Promise<InventoryRow | null> {
    const rows = await sequelize.query<InventoryRow>(
      `
      SELECT
        inv.instance_id AS "instanceId",
        COALESCE(NULLIF(TRIM(COALESCE(inv.tags_json ->> 'Name', '')), ''), inv.instance_id) AS "instanceName",
        inv.state AS "state",
        inv.instance_type AS "instanceType",
        inv.sub_account_key::text AS "subAccountKey",
        dsa.sub_account_name AS "subAccountName",
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
        inv.tags_json AS "tagsJson"
      FROM ec2_instance_inventory_snapshots inv
      LEFT JOIN dim_region dr ON dr.id = inv.region_key
      LEFT JOIN dim_sub_account dsa ON dsa.id = inv.sub_account_key
      WHERE inv.tenant_id = $1::uuid
        AND inv.instance_id = $2
        AND inv.is_current = true
        AND inv.deleted_at IS NULL
        AND ($3::uuid IS NULL OR inv.cloud_connection_id = $3::uuid)
      ORDER BY inv.updated_at DESC NULLS LAST
      LIMIT 1;
      `,
      { bind: [input.tenantId, input.query.instanceId, input.query.cloudConnectionId], type: QueryTypes.SELECT },
    );

    return rows[0] ?? null;
  }

  private async loadPerformanceRows(input: {
    tenantId: string;
    instanceId: string;
    cloudConnectionId: string | null;
    interval: InventoryEc2PerformanceInterval;
    metrics: InventoryEc2PerformanceMetric[];
    dateRange: DateRange;
  }): Promise<PerformanceDataRow[]> {
    if (input.metrics.length === 0) {
      throw new BadRequestError("At least one metric is required");
    }

    const tableName =
      input.interval === "hourly"
        ? "ec2_instance_utilization_hourly"
        : "ec2_instance_utilization_daily";
    const timestampSelect =
      input.interval === "hourly" ? "u.hour_start AS timestamp" : "u.usage_date::timestamp AS timestamp";
    const rangeClause =
      input.interval === "hourly"
        ? "u.hour_start >= $4::timestamptz AND u.hour_start < (($5::date + INTERVAL '1 day')::timestamptz)"
        : "u.usage_date >= $4::date AND u.usage_date <= $5::date";
    const metricSelect = input.metrics.map((metric) => `u.${metric} AS ${metric}`).join(",\n          ");

    const cloudConnectionClause = "AND ($3::uuid IS NULL OR u.cloud_connection_id = $3::uuid)";

    const rows = await sequelize.query<PerformanceDataRow>(
      `
        SELECT
          ${timestampSelect},
          ${metricSelect}
        FROM ${tableName} u
        WHERE u.tenant_id = $1::uuid
          AND u.instance_id = $2
          ${cloudConnectionClause}
          AND ${rangeClause}
        ORDER BY timestamp ASC;
      `,
      {
        bind: [
          input.tenantId,
          input.instanceId,
          input.cloudConnectionId,
          input.dateRange.startDate,
          input.dateRange.endDate,
        ],
        type: QueryTypes.SELECT,
      },
    );

    return rows;
  }

  private buildInventoryWhereClause(input: {
    tenantId: string;
    query: InventoryEc2InstancesListQuery;
    dateRange: DateRange;
  }): InventoryWhereClause {
    const whereParts: string[] = [
      "inv.tenant_id = $1",
      "inv.is_current = true",
      "inv.deleted_at IS NULL",
    ];
    const bind: unknown[] = [input.tenantId];
    let nextIndex = 2;
    const dateStartIndex = nextIndex;
    const dateEndIndex = nextIndex + 1;
    bind.push(input.dateRange.startDate, input.dateRange.endDate);
    nextIndex += 2;

    if (input.query.cloudConnectionId) {
      whereParts.push(`inv.cloud_connection_id = $${nextIndex}`);
      bind.push(input.query.cloudConnectionId);
      nextIndex += 1;
    }

    if (input.query.subAccountKey) {
      whereParts.push(`inv.sub_account_key::text = $${nextIndex}`);
      bind.push(input.query.subAccountKey);
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

    whereParts.push(`
      EXISTS (
        SELECT 1
        FROM fact_ec2_instance_daily fed
        WHERE fed.tenant_id = inv.tenant_id
          AND fed.instance_id = inv.instance_id
          AND (
            inv.cloud_connection_id IS NULL
            OR fed.cloud_connection_id IS NULL
            OR fed.cloud_connection_id = inv.cloud_connection_id
          )
          AND fed.usage_date >= $${dateStartIndex}::date
          AND fed.usage_date <= $${dateEndIndex}::date
      )
    `);

    const normalizedPricingType = normalizeLower(input.query.pricingType);
    if (normalizedPricingType) {
      whereParts.push(`
        EXISTS (
          SELECT 1
          FROM fact_ec2_instance_daily fedp
          WHERE fedp.tenant_id = inv.tenant_id
            AND fedp.instance_id = inv.instance_id
            AND (
              inv.cloud_connection_id IS NULL
              OR fedp.cloud_connection_id IS NULL
              OR fedp.cloud_connection_id = inv.cloud_connection_id
            )
            AND fedp.usage_date >= $${dateStartIndex}::date
            AND fedp.usage_date <= $${dateEndIndex}::date
            AND LOWER(
              COALESCE(
                NULLIF(TRIM(fedp.reservation_type), ''),
                NULLIF(TRIM(fedp.pricing_model), ''),
                CASE WHEN COALESCE(fedp.is_spot, FALSE) THEN 'spot' ELSE 'on_demand' END
              )
            ) = $${nextIndex}
        )
      `);
      bind.push(normalizedPricingType);
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
    dateRange: DateRange;
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
          inv.sub_account_key::text AS "subAccountKey",
          dsa.sub_account_name AS "subAccountName",
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
          inv.cloud_connection_id::text AS "cloudConnectionId"
          ,inv.tags_json AS "tagsJson"
        FROM ec2_instance_inventory_snapshots inv
        LEFT JOIN dim_region dr
          ON dr.id = inv.region_key
        LEFT JOIN dim_sub_account dsa
          ON dsa.id = inv.sub_account_key
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

  private async loadFactMetricsLookup(input: {
    tenantId: string;
    rows: InventoryRow[];
    dateRange: DateRange;
  }): Promise<{
    byConnectionInstance: Map<string, FactMetricsRow>;
    byInstance: Map<string, FactMetricsRow>;
  }> {
    const instanceIds = Array.from(new Set(input.rows.map((row) => row.instanceId)));
    if (instanceIds.length === 0) {
      return {
        byConnectionInstance: new Map(),
        byInstance: new Map(),
      };
    }

    const rows = await sequelize.query<FactMetricsRow>(
      `
        WITH scoped AS (
          SELECT
            COALESCE(fed.cloud_connection_id::text, '') AS cloud_connection_key,
            fed.instance_id AS instance_id,
            fed.usage_date AS usage_date,
            COALESCE(fed.total_hours, 0)::double precision AS total_hours,
            COALESCE(fed.compute_cost, 0)::double precision AS compute_cost,
            COALESCE(fed.total_effective_cost, fed.total_billed_cost, 0)::double precision AS total_cost,
            COALESCE(fed.data_transfer_cost, 0)::double precision AS data_transfer_cost,
            (COALESCE(fed.network_in_bytes, 0) + COALESCE(fed.network_out_bytes, 0))::double precision AS network_usage_bytes,
            COALESCE(fed.covered_hours, 0)::double precision AS covered_hours,
            COALESCE(fed.uncovered_hours, 0)::double precision AS uncovered_hours,
            fed.cpu_avg::double precision AS cpu_avg,
            fed.cpu_max::double precision AS cpu_max,
            fed.is_idle_candidate AS is_idle_candidate,
            fed.is_underutilized_candidate AS is_underutilized_candidate,
            fed.is_overutilized_candidate AS is_overutilized_candidate,
            fed.is_spot AS is_spot,
            fed.reservation_type AS reservation_type,
            fed.pricing_model AS pricing_model
          FROM fact_ec2_instance_daily fed
          WHERE fed.tenant_id = $1
            AND fed.instance_id = ANY($2::text[])
            AND fed.usage_date >= $3::date
            AND fed.usage_date <= $4::date
        ),
        latest_daily AS (
          SELECT
            scoped.cloud_connection_key,
            scoped.instance_id,
            MAX(scoped.usage_date) AS latest_usage_date
          FROM scoped
          GROUP BY scoped.cloud_connection_key, scoped.instance_id
        ),
        latest_attrs AS (
          SELECT DISTINCT ON (scoped.cloud_connection_key, scoped.instance_id)
            scoped.cloud_connection_key,
            scoped.instance_id,
            scoped.reservation_type,
            scoped.pricing_model,
            scoped.is_spot
          FROM scoped
          ORDER BY scoped.cloud_connection_key, scoped.instance_id, scoped.usage_date DESC
        )
        SELECT
          scoped.cloud_connection_key AS "cloudConnectionKey",
          scoped.instance_id AS "instanceId",
          AVG(scoped.cpu_avg)::double precision AS "cpuAvg",
          MAX(scoped.cpu_max)::double precision AS "cpuMax",
          BOOL_OR(COALESCE(scoped.is_idle_candidate, FALSE)) AS "isIdleCandidate",
          BOOL_OR(COALESCE(scoped.is_underutilized_candidate, FALSE)) AS "isUnderutilizedCandidate",
          BOOL_OR(COALESCE(scoped.is_overutilized_candidate, FALSE)) AS "isOverutilizedCandidate",
          LOWER(
            COALESCE(
              NULLIF(TRIM(latest_attrs.reservation_type), ''),
              NULLIF(TRIM(latest_attrs.pricing_model), ''),
              CASE WHEN COALESCE(latest_attrs.is_spot, FALSE) THEN 'spot' ELSE 'on_demand' END
            )
          ) AS "pricingType",
          SUM(scoped.total_hours)::double precision AS "totalHours",
          SUM(scoped.compute_cost)::double precision AS "computeCost",
          SUM(scoped.total_cost)::double precision AS "monthToDateCost",
          SUM(scoped.data_transfer_cost)::double precision AS "dataTransferCost",
          SUM(scoped.network_usage_bytes)::double precision AS "networkUsageBytes",
          SUM(scoped.covered_hours)::double precision AS "coveredHours",
          SUM(scoped.uncovered_hours)::double precision AS "uncoveredHours",
          COALESCE(
            SUM(
              CASE
                WHEN scoped.usage_date = latest_daily.latest_usage_date THEN scoped.compute_cost
                ELSE 0
              END
            ),
            0
          )::double precision AS "latestDailyCost"
        FROM scoped
        INNER JOIN latest_daily
          ON latest_daily.cloud_connection_key = scoped.cloud_connection_key
          AND latest_daily.instance_id = scoped.instance_id
        LEFT JOIN latest_attrs
          ON latest_attrs.cloud_connection_key = scoped.cloud_connection_key
          AND latest_attrs.instance_id = scoped.instance_id
        GROUP BY
          scoped.cloud_connection_key,
          scoped.instance_id,
          latest_attrs.reservation_type,
          latest_attrs.pricing_model,
          latest_attrs.is_spot,
          latest_daily.latest_usage_date;
      `,
      {
        bind: [input.tenantId, instanceIds, input.dateRange.startDate, input.dateRange.endDate],
        type: QueryTypes.SELECT,
      },
    );

    const byConnectionInstance = new Map<string, FactMetricsRow>();
    const byInstance = new Map<string, FactMetricsRow>();

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

  private async loadAttachedVolumeLookup(input: {
    tenantId: string;
    rows: InventoryRow[];
  }): Promise<{
    byConnectionInstance: Map<string, AttachedVolumeSummaryRow>;
    byInstance: Map<string, AttachedVolumeSummaryRow>;
  }> {
    const instanceIds = Array.from(new Set(input.rows.map((row) => row.instanceId)));
    if (instanceIds.length === 0) {
      return {
        byConnectionInstance: new Map(),
        byInstance: new Map(),
      };
    }

    const rows = await sequelize.query<AttachedVolumeSummaryRow>(
      `
        SELECT
          COALESCE(inv.cloud_connection_id::text, '') AS "cloudConnectionKey",
          inv.attached_instance_id AS "instanceId",
          COUNT(*)::int AS "attachedVolumeCount",
          SUM(COALESCE(inv.size_gb, 0))::double precision AS "attachedVolumeTotalSizeGb",
          ARRAY_AGG(DISTINCT inv.volume_id ORDER BY inv.volume_id) AS "attachedVolumeIds"
        FROM ec2_volume_inventory_snapshots inv
        WHERE inv.tenant_id = $1
          AND inv.is_current = true
          AND inv.deleted_at IS NULL
          AND inv.is_attached = true
          AND inv.attached_instance_id = ANY($2::text[])
        GROUP BY
          COALESCE(inv.cloud_connection_id::text, ''),
          inv.attached_instance_id;
      `,
      {
        bind: [input.tenantId, instanceIds],
        type: QueryTypes.SELECT,
      },
    );

    const byConnectionInstance = new Map<string, AttachedVolumeSummaryRow>();
    const byInstance = new Map<string, AttachedVolumeSummaryRow>();

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
}

