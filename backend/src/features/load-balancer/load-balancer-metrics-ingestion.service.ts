import { logger } from "../../utils/logger.js";
import { LoadBalancer } from "../../models/index.js";
import {
  fetchLoadBalancerDailyCloudWatchMetrics,
  type FetchLoadBalancerDailyMetricsInput,
  type LoadBalancerDailyMetricRow,
} from "./load-balancer-metrics-fetcher.service.js";
import { LoadBalancerMetricsDailyRepository } from "./load-balancer-metrics-daily.repository.js";

export type LoadBalancerMetricsIngestionInput = FetchLoadBalancerDailyMetricsInput & {
  tenantId: string;
};

type LoadBalancerMetricsFetcher = (
  input: FetchLoadBalancerDailyMetricsInput,
) => Promise<LoadBalancerDailyMetricRow[]>;

export class LoadBalancerMetricsIngestionService {
  constructor(
    private readonly fetcher: LoadBalancerMetricsFetcher = fetchLoadBalancerDailyCloudWatchMetrics,
    private readonly repository: LoadBalancerMetricsDailyRepository = new LoadBalancerMetricsDailyRepository(),
  ) {}

  async syncMetrics(input: LoadBalancerMetricsIngestionInput): Promise<LoadBalancerDailyMetricRow[]> {
    const startedAt = Date.now();
    logger.info("Load balancer metrics sync job started", {
      tenantId: input.tenantId,
      cloudConnectionId: input.cloudConnectionId,
      startDate: input.startDate,
      endDate: input.endDate,
      accountId: input.accountId ?? null,
      region: input.region ?? null,
    });

    const lbInventory = await this.loadInventory(input);
    logger.info("Load balancer inventory loaded", {
      tenantId: input.tenantId,
      cloudConnectionId: input.cloudConnectionId,
      loadBalancersProcessed: lbInventory.length,
    });

    const scopeGroups = groupInventoryByAccountRegion(lbInventory);
    let failureCount = 0;
    let rowsWritten = 0;
    const allAggregatedRows: LoadBalancerDailyMetricRow[] = [];

    for (const scope of scopeGroups) {
      logger.info("Load balancer metrics scope started", {
        tenantId: input.tenantId,
        cloudConnectionId: input.cloudConnectionId,
        accountId: scope.accountId,
        region: scope.region,
        loadBalancersInScope: scope.inventory.length,
      });

      const fetched = await this.fetcher({
        cloudConnectionId: input.cloudConnectionId,
        tenantId: input.tenantId,
        startDate: input.startDate,
        endDate: input.endDate,
        accountId: scope.accountId,
        region: scope.region,
      });

      logger.info("Load balancer metrics fetched", {
        tenantId: input.tenantId,
        cloudConnectionId: input.cloudConnectionId,
        accountId: scope.accountId,
        region: scope.region,
        metricsFetched: fetched.length,
      });

      const aggregated = await this.aggregateDailyMetrics({
        tenantId: input.tenantId,
        cloudConnectionId: input.cloudConnectionId,
        startDate: input.startDate,
        endDate: input.endDate,
        inventory: scope.inventory,
        rows: fetched,
      });

      allAggregatedRows.push(...aggregated);

      const upsertableRows = aggregated.filter((row) => row.accountId && row.region && row.loadBalancerArn && row.metricDate);
      if (upsertableRows.length === 0) continue;

      try {
        const written = await this.repository.upsertDailyRows({
          tenantId: input.tenantId,
          cloudConnectionId: input.cloudConnectionId,
          rows: upsertableRows,
        });
        rowsWritten += written;

        logger.info("Load balancer metrics rows written", {
          tenantId: input.tenantId,
          cloudConnectionId: input.cloudConnectionId,
          accountId: scope.accountId,
          region: scope.region,
          rowsWritten: written,
        });
      } catch (error) {
        failureCount += upsertableRows.length;
        logger.warn("Load balancer metrics scope upsert failed", {
          tenantId: input.tenantId,
          cloudConnectionId: input.cloudConnectionId,
          accountId: scope.accountId,
          region: scope.region,
          rowsAttempted: upsertableRows.length,
          reason: error instanceof Error ? error.message : String(error),
        });
      }
    }

    logger.info("Load balancer metrics sync completed", {
      tenantId: input.tenantId,
      cloudConnectionId: input.cloudConnectionId,
      loadBalancersProcessed: lbInventory.length,
      aggregatedRows: allAggregatedRows.length,
      rowsWritten,
      failures: failureCount,
      durationMs: Date.now() - startedAt,
    });

    return allAggregatedRows;
  }

  async processLoadBalancer(input: {
    tenantId: string;
    cloudConnectionId: string;
    loadBalancerArn: string;
    metricDate: string;
    loadBalancerType: "application" | "network";
    rows: LoadBalancerDailyMetricRow[];
  }): Promise<LoadBalancerDailyMetricRow> {
    const matched = input.rows.filter(
      (row) =>
        row.cloudConnectionId === input.cloudConnectionId &&
        row.loadBalancerArn === input.loadBalancerArn &&
        row.metricDate === input.metricDate,
    );

    const accountId = matched[0]?.accountId ?? "";
    const region = matched[0]?.region ?? "";
    const base: LoadBalancerDailyMetricRow = {
      cloudConnectionId: input.cloudConnectionId,
      accountId,
      region,
      loadBalancerArn: input.loadBalancerArn,
      metricDate: input.metricDate,
      requestCount: null,
      processedBytes: null,
      processedGb: null,
      activeConnectionCount: null,
      newConnectionCount: null,
      activeFlowCount: null,
      newFlowCount: null,
      healthyHostCount: null,
      unhealthyHostCount: null,
      targetResponseTimeAvg: null,
      elb5xxCount: null,
      target5xxCount: null,
      tcpTargetResetCount: null,
      lastSyncedAt: new Date(),
    };

    const merged = matched.reduce<LoadBalancerDailyMetricRow>((acc, row) => {
      if (!acc.accountId && row.accountId) acc.accountId = row.accountId;
      if (!acc.region && row.region) acc.region = row.region;

      acc.requestCount = row.requestCount ?? acc.requestCount;
      acc.processedBytes = row.processedBytes ?? acc.processedBytes;
      acc.processedGb = row.processedGb ?? acc.processedGb;
      acc.activeConnectionCount = row.activeConnectionCount ?? acc.activeConnectionCount;
      acc.newConnectionCount = row.newConnectionCount ?? acc.newConnectionCount;
      acc.activeFlowCount = row.activeFlowCount ?? acc.activeFlowCount;
      acc.newFlowCount = row.newFlowCount ?? acc.newFlowCount;
      acc.healthyHostCount = row.healthyHostCount ?? acc.healthyHostCount;
      acc.unhealthyHostCount = row.unhealthyHostCount ?? acc.unhealthyHostCount;
      acc.targetResponseTimeAvg = row.targetResponseTimeAvg ?? acc.targetResponseTimeAvg;
      acc.elb5xxCount = row.elb5xxCount ?? acc.elb5xxCount;
      acc.target5xxCount = row.target5xxCount ?? acc.target5xxCount;
      acc.tcpTargetResetCount = row.tcpTargetResetCount ?? acc.tcpTargetResetCount;
      acc.lastSyncedAt = row.lastSyncedAt ?? acc.lastSyncedAt;
      return acc;
    }, base);

    if (input.loadBalancerType === "application") {
      merged.activeFlowCount = null;
      merged.newFlowCount = null;
      merged.tcpTargetResetCount = null;
    } else {
      merged.requestCount = null;
      merged.activeConnectionCount = null;
      merged.newConnectionCount = null;
      merged.targetResponseTimeAvg = null;
      merged.elb5xxCount = null;
      merged.target5xxCount = null;
    }

    return merged;
  }

  async aggregateDailyMetrics(input: {
    tenantId: string;
    cloudConnectionId: string;
    startDate: string;
    endDate: string;
    inventory: Array<{
      accountId: string;
      region: string;
      loadBalancerArn: string;
      loadBalancerType: "application" | "network";
    }>;
    rows: LoadBalancerDailyMetricRow[];
  }): Promise<LoadBalancerDailyMetricRow[]> {
    const metricDates = buildDateRange(input.startDate, input.endDate);
    if (metricDates.length === 0 || input.inventory.length === 0) return [];

    const out: LoadBalancerDailyMetricRow[] = [];
    for (const lb of input.inventory) {
      try {
        for (const metricDate of metricDates) {
          const row = await this.processLoadBalancer({
            tenantId: input.tenantId,
            cloudConnectionId: input.cloudConnectionId,
            loadBalancerArn: lb.loadBalancerArn,
            metricDate,
            loadBalancerType: lb.loadBalancerType,
            rows: input.rows.filter(
              (candidate) =>
                candidate.accountId === lb.accountId &&
                candidate.region === lb.region &&
                candidate.loadBalancerArn === lb.loadBalancerArn &&
                candidate.metricDate === metricDate,
            ),
          });

          row.accountId = lb.accountId;
          row.region = lb.region;
          out.push(row);
        }
      } catch (error) {
        logger.warn("Load balancer metric aggregation failed for load balancer", {
          tenantId: input.tenantId,
          cloudConnectionId: input.cloudConnectionId,
          accountId: lb.accountId,
          region: lb.region,
          loadBalancerArn: lb.loadBalancerArn,
          reason: error instanceof Error ? error.message : String(error),
        });
      }
    }

    out.sort((left, right) =>
      left.metricDate.localeCompare(right.metricDate) ||
      left.accountId.localeCompare(right.accountId) ||
      left.region.localeCompare(right.region) ||
      left.loadBalancerArn.localeCompare(right.loadBalancerArn));

    return out;
  }

  private async loadInventory(input: LoadBalancerMetricsIngestionInput): Promise<
    Array<{
      accountId: string;
      region: string;
      loadBalancerArn: string;
      loadBalancerType: "application" | "network";
    }>
  > {
    const rows = await LoadBalancer.findAll({
      where: {
        cloudConnectionId: input.cloudConnectionId,
        ...(input.accountId ? { accountId: input.accountId } : {}),
        ...(input.region ? { region: input.region } : {}),
      },
      attributes: ["accountId", "region", "arn", "type"],
    });

    const deduped = new Map<string, { accountId: string; region: string; loadBalancerArn: string; loadBalancerType: "application" | "network" }>();
    for (const row of rows) {
      const accountId = String(row.accountId ?? "").trim();
      const region = String(row.region ?? "").trim();
      const loadBalancerArn = String(row.arn ?? "").trim();
      const typeRaw = String(row.type ?? "").trim().toLowerCase();
      const loadBalancerType = typeRaw === "network" ? "network" : typeRaw === "application" ? "application" : null;
      if (!accountId || !region || !loadBalancerArn || !loadBalancerType) continue;
      const key = `${accountId}|${region}|${loadBalancerArn}`;
      if (!deduped.has(key)) {
        deduped.set(key, { accountId, region, loadBalancerArn, loadBalancerType });
      }
    }

    return Array.from(deduped.values());
  }
}

function buildDateRange(startDate: string, endDate: string): string[] {
  const start = new Date(`${startDate}T00:00:00.000Z`);
  const end = new Date(`${endDate}T00:00:00.000Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return [];

  const [from, to] = start.getTime() <= end.getTime() ? [start, end] : [end, start];
  const out: string[] = [];
  for (let d = new Date(from); d.getTime() <= to.getTime(); d = new Date(d.getTime() + 24 * 60 * 60 * 1000)) {
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

function groupInventoryByAccountRegion(
  inventory: Array<{
    accountId: string;
    region: string;
    loadBalancerArn: string;
    loadBalancerType: "application" | "network";
  }>,
): Array<{
  accountId: string;
  region: string;
  inventory: Array<{
    accountId: string;
    region: string;
    loadBalancerArn: string;
    loadBalancerType: "application" | "network";
  }>;
}> {
  const groups = new Map<
    string,
    {
      accountId: string;
      region: string;
      inventory: Array<{
        accountId: string;
        region: string;
        loadBalancerArn: string;
        loadBalancerType: "application" | "network";
      }>;
    }
  >();

  for (const row of inventory) {
    const key = `${row.accountId}|${row.region}`;
    if (!groups.has(key)) {
      groups.set(key, {
        accountId: row.accountId,
        region: row.region,
        inventory: [],
      });
    }
    groups.get(key)?.inventory.push(row);
  }

  return Array.from(groups.values()).sort(
    (left, right) => left.accountId.localeCompare(right.accountId) || left.region.localeCompare(right.region),
  );
}
