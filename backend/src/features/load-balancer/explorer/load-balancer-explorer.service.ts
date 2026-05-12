import { LoadBalancerExplorerQuery } from "./load-balancer-explorer.query.js";
import type {
  LoadBalancerExplorerGraph,
  LoadBalancerExplorerGraphSeries,
  LoadBalancerExplorerInput,
  LoadBalancerExplorerSummary,
} from "./load-balancer-explorer.types.js";

const DATE_ONLY_REGEX = /^\d{4}-\d{2}-\d{2}$/;

const toFixedNumber = (value: number, digits = 2): number =>
  Number((Number.isFinite(value) ? value : 0).toFixed(digits));

const dateRangeDaysInclusive = (startDate: string, endDate: string): number => {
  const start = new Date(`${startDate}T00:00:00.000Z`);
  const end = new Date(`${endDate}T00:00:00.000Z`);
  return Math.max(1, Math.floor((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)) + 1);
};

const shiftDate = (dateIso: string, dayDelta: number): string => {
  const current = new Date(`${dateIso}T00:00:00.000Z`);
  current.setUTCDate(current.getUTCDate() + dayDelta);
  return current.toISOString().slice(0, 10);
};

const normalizeTrim = (value: string | null | undefined): string | null => {
  const trimmed = String(value ?? "").trim();
  return trimmed.length > 0 ? trimmed : null;
};

const normalizeList = (value: string[] | undefined): string[] =>
  [...new Set((value ?? []).map((item) => item.trim()).filter(Boolean))];

const metricLabel = (key: string): string => {
  if (key === "total") return "Total";
  if (key === "account") return "Account";
  if (key === "region") return "Region";
  if (key === "type") return "Type";
  if (key === "scheme") return "Scheme";
  if (key === "state") return "State";
  if (key === "team") return "Team";
  if (key === "product") return "Product";
  if (key === "environment") return "Environment";
  if (key === "load_balancer") return "Load Balancer";
  return key;
};

const normalizeInput = (input: LoadBalancerExplorerInput): LoadBalancerExplorerInput => {
  const startDate = String(input.startDate ?? "").trim();
  const endDate = String(input.endDate ?? "").trim();

  if (!DATE_ONLY_REGEX.test(startDate)) {
    throw new Error("startDate must be in YYYY-MM-DD format");
  }
  if (!DATE_ONLY_REGEX.test(endDate)) {
    throw new Error("endDate must be in YYYY-MM-DD format");
  }
  if (startDate > endDate) {
    throw new Error("startDate must be less than or equal to endDate");
  }

  const tagKey = normalizeTrim(input.tagKey);

  return {
    ...input,
    startDate,
    endDate,
    metric: input.metric === "load_balancers" || input.metric === "usage" ? input.metric : "cost",
    granularity: input.granularity,
    groupBy: input.groupBy,
    tagKey,
    groupValues: normalizeList(input.groupValues),
    filters: {
      cloudConnectionId: normalizeTrim(input.filters.cloudConnectionId),
      loadBalancerArn: normalizeTrim(input.filters.loadBalancerArn),
      accountId: normalizeTrim(input.filters.accountId),
      regions: normalizeList(input.filters.regions),
      types: normalizeList(input.filters.types),
      schemes: normalizeList(input.filters.schemes),
      states: normalizeList(input.filters.states),
      teams: normalizeList(input.filters.teams),
      products: normalizeList(input.filters.products),
      environments: normalizeList(input.filters.environments),
      tags: (input.filters.tags ?? [])
        .map((tag) => ({ key: String(tag.key ?? "").trim(), value: String(tag.value ?? "").trim() }))
        .filter((tag) => tag.key.length > 0 && tag.value.length > 0),
    },
  };
};

export class LoadBalancerExplorerService {
  private readonly query: LoadBalancerExplorerQuery;

  constructor(query = new LoadBalancerExplorerQuery()) {
    this.query = query;
  }

  async getExplorerSummary(rawInput: LoadBalancerExplorerInput): Promise<LoadBalancerExplorerSummary> {
    const input = normalizeInput(rawInput);
    const durationDays = dateRangeDaysInclusive(input.startDate, input.endDate);
    if (input.metric === "usage") {
      const [usageSummary, lbSummary] = await Promise.all([
        this.query.getUsageSummary(input),
        this.query.getLoadBalancersSummary(input),
      ]);

      return {
        totalCost: 0,
        previousCost: 0,
        trendPercent: 0,
        loadBalancerCount: lbSummary.totalLoadBalancers,
        totalLoadBalancers: lbSummary.totalLoadBalancers,
        albCount: lbSummary.albCount,
        nlbCount: lbSummary.nlbCount,
        activeLoadBalancerCount: lbSummary.totalLoadBalancers,
        internetFacingCount: lbSummary.internetFacingCount,
        internalCount: lbSummary.internalCount,
        totalProcessedBytesGb: toFixedNumber(usageSummary.processedGB, 6),
        avgDailyCost: 0,
        requestCount: Math.trunc(usageSummary.requestCount),
        processedGB: toFixedNumber(usageSummary.processedGB, 6),
        activeConnections: Math.trunc(usageSummary.activeConnections),
        newConnections: Math.trunc(usageSummary.newConnections),
        healthyHosts: toFixedNumber(usageSummary.healthyHosts, 4),
        unhealthyHosts: toFixedNumber(usageSummary.unhealthyHosts, 4),
        errorCount: Math.trunc(usageSummary.errorCount),
      };
    }

    const previousInput: LoadBalancerExplorerInput = {
      ...input,
      startDate: shiftDate(input.startDate, -durationDays),
      endDate: shiftDate(input.endDate, -durationDays),
    };

    const [currentCost, previousCost, lbSummary] = await Promise.all([
      this.query.getCostSummary(input),
      this.query.getCostSummary(previousInput),
      this.query.getLoadBalancersSummary(input),
    ]);

    const totalCost = currentCost.totalCost;
    const previousCostValue = previousCost.totalCost;
    const trendPercent = previousCostValue > 0
      ? ((totalCost - previousCostValue) / previousCostValue) * 100
      : 0;

    const avgDailyCost = durationDays > 0 ? totalCost / durationDays : 0;

    return {
      totalCost: toFixedNumber(totalCost),
      fixedCost: toFixedNumber(currentCost.fixedCost),
      lcuCost: toFixedNumber(currentCost.lcuCost),
      dataProcessingCost: toFixedNumber(currentCost.dataProcessingCost),
      previousCost: toFixedNumber(previousCostValue),
      trendPercent: toFixedNumber(trendPercent),
      loadBalancerCount: input.metric === "cost"
        ? currentCost.loadBalancerCount
        : lbSummary.totalLoadBalancers,
      totalLoadBalancers: lbSummary.totalLoadBalancers,
      albCount: lbSummary.albCount,
      nlbCount: lbSummary.nlbCount,
      activeLoadBalancerCount: lbSummary.totalLoadBalancers,
      internetFacingCount: lbSummary.internetFacingCount,
      internalCount: lbSummary.internalCount,
      totalProcessedBytesGb: 0,
      avgDailyCost: toFixedNumber(avgDailyCost),
    };
  }

  async getExplorerTrend(rawInput: LoadBalancerExplorerInput): Promise<LoadBalancerExplorerGraph> {
    const input = normalizeInput(rawInput);
    if (input.metric === "usage") {
      const groupedRows = await this.query.getUsageTrendGrouped(input);
      const selected = new Set(input.groupValues.map((item) => item.toLowerCase()));
      const filteredRows = selected.size > 0
        ? groupedRows.filter((row) => selected.has(row.group.trim().toLowerCase()))
        : groupedRows;

      const byGroup = new Map<string, Array<{
        date: string;
        value: number;
        group: string;
        requestCount: number;
        processedGB: number;
        activeConnections: number;
        newConnections: number;
        healthyHosts: number;
        unhealthyHosts: number;
        errorCount: number;
      }>>();

      for (const row of filteredRows) {
        const key = row.group;
        const points = byGroup.get(key) ?? [];
        points.push({
          date: row.usageDate,
          value: Math.trunc(row.requestCount),
          group: key,
          requestCount: Math.trunc(row.requestCount),
          processedGB: toFixedNumber(row.processedGB, 6),
          activeConnections: Math.trunc(row.activeConnections),
          newConnections: Math.trunc(row.newConnections),
          healthyHosts: toFixedNumber(row.healthyHosts, 4),
          unhealthyHosts: toFixedNumber(row.unhealthyHosts, 4),
          errorCount: Math.trunc(row.errorCount),
        });
        byGroup.set(key, points);
      }

      const series: LoadBalancerExplorerGraphSeries[] = [...byGroup.entries()].map(([key, data]) => ({
        key,
        label: key,
        data,
      }));

      return {
        type: "line",
        xKey: "date",
        series,
      };
    }

    if (input.metric !== "cost") {
      const groupedRows = await this.query.getLoadBalancersTrendGrouped(input);
      const selected = new Set(input.groupValues.map((item) => item.toLowerCase()));
      const filteredRows = selected.size > 0
        ? groupedRows.filter((row) => selected.has(row.group.trim().toLowerCase()))
        : groupedRows;

      const byGroup = new Map<string, Array<{ date: string; value: number; group: string; loadBalancerCount: number }>>();
      for (const row of filteredRows) {
        const key = input.groupBy === "cost_type" || input.groupBy === "none" ? "Total" : row.group;
        const points = byGroup.get(key) ?? [];
        const loadBalancerCount = Math.trunc(row.loadBalancerCount);
        points.push({
          date: row.usageDate,
          value: loadBalancerCount,
          group: key,
          loadBalancerCount,
        });
        byGroup.set(key, points);
      }

      const series: LoadBalancerExplorerGraphSeries[] = [...byGroup.entries()].map(([key, data]) => ({
        key,
        label: key,
        data,
      }));

      return {
        type: input.groupBy === "cost_type" || input.groupBy === "none" ? "bar" : "stacked_bar",
        xKey: "date",
        series,
      };
    }

    if (input.groupBy === "cost_type" || input.groupBy === "none") {
      const trendRows = await this.query.getCostTrend(input);
      const series: LoadBalancerExplorerGraphSeries[] = [
        {
          key: "fixed_cost",
          label: "Fixed Cost",
          data: trendRows.map((row) => ({ date: row.usageDate, value: toFixedNumber(row.fixedCost) })),
        },
        {
          key: "lcu_cost",
          label: "LCU Cost",
          data: trendRows.map((row) => ({ date: row.usageDate, value: toFixedNumber(row.lcuCost) })),
        },
        {
          key: "data_processing_cost",
          label: "Data Processing Cost",
          data: trendRows.map((row) => ({ date: row.usageDate, value: toFixedNumber(row.dataProcessingCost) })),
        },
      ];

      return {
        type: "line",
        xKey: "date",
        series,
      };
    }

    const groupedRows = await this.query.getCostTrendGrouped(input);
    const selected = new Set(input.groupValues.map((item) => item.toLowerCase()));
    const filteredRows = selected.size > 0
      ? groupedRows.filter((row) => selected.has(row.group.trim().toLowerCase()))
      : groupedRows;

    const byGroup = new Map<string, Array<{ date: string; value: number }>>();
    for (const row of filteredRows) {
      const key = row.group;
      const points = byGroup.get(key) ?? [];
      points.push({ date: row.usageDate, value: toFixedNumber(row.totalCost) });
      byGroup.set(key, points);
    }

    const series: LoadBalancerExplorerGraphSeries[] = [...byGroup.entries()].map(([key, data]) => ({
      key,
      label: key,
      data,
    }));

    return {
      type: "line",
      xKey: "date",
      series,
    };
  }

  async getExplorerGroupBy(rawInput: LoadBalancerExplorerInput): Promise<Array<{
    group: string;
    label: string;
    totalCost: number;
    fixedCost: number;
    lcuCost: number;
    dataProcessingCost: number;
    loadBalancerCount: number;
    avgCost: number;
    requestCount?: number;
    processedGB?: number;
    activeConnections?: number;
    newConnections?: number;
    healthyHosts?: number;
    unhealthyHosts?: number;
    errorCount?: number;
  }>> {
    const input = normalizeInput(rawInput);
    if (input.metric === "usage") {
      const rows = await this.query.getUsageGroupBy(input);
      const selected = new Set(input.groupValues.map((item) => item.toLowerCase()));
      const filtered = selected.size > 0
        ? rows.filter((row) => selected.has(row.group.trim().toLowerCase()))
        : rows;

      return filtered.map((row) => ({
        group: row.group,
        label: metricLabel(row.group),
        totalCost: 0,
        fixedCost: 0,
        lcuCost: 0,
        dataProcessingCost: 0,
        loadBalancerCount: 0,
        avgCost: 0,
        requestCount: Math.trunc(row.requestCount),
        processedGB: toFixedNumber(row.processedGB, 6),
        activeConnections: Math.trunc(row.activeConnections),
        newConnections: Math.trunc(row.newConnections),
        healthyHosts: toFixedNumber(row.healthyHosts, 4),
        unhealthyHosts: toFixedNumber(row.unhealthyHosts, 4),
        errorCount: Math.trunc(row.errorCount),
      }));
    }

    if (input.metric === "cost") {
      if (input.groupBy === "cost_type" || input.groupBy === "none") {
        const summary = await this.query.getCostSummary(input);
        return [
          {
            group: "Fixed Cost",
            label: "Fixed Cost",
            totalCost: toFixedNumber(summary.fixedCost),
            fixedCost: toFixedNumber(summary.fixedCost),
            lcuCost: 0,
            dataProcessingCost: 0,
            loadBalancerCount: summary.loadBalancerCount,
            avgCost: toFixedNumber(summary.loadBalancerCount > 0 ? summary.fixedCost / summary.loadBalancerCount : 0),
          },
          {
            group: "LCU Cost",
            label: "LCU Cost",
            totalCost: toFixedNumber(summary.lcuCost),
            fixedCost: 0,
            lcuCost: toFixedNumber(summary.lcuCost),
            dataProcessingCost: 0,
            loadBalancerCount: summary.loadBalancerCount,
            avgCost: toFixedNumber(summary.loadBalancerCount > 0 ? summary.lcuCost / summary.loadBalancerCount : 0),
          },
          {
            group: "Data Processing Cost",
            label: "Data Processing Cost",
            totalCost: toFixedNumber(summary.dataProcessingCost),
            fixedCost: 0,
            lcuCost: 0,
            dataProcessingCost: toFixedNumber(summary.dataProcessingCost),
            loadBalancerCount: summary.loadBalancerCount,
            avgCost: toFixedNumber(
              summary.loadBalancerCount > 0 ? summary.dataProcessingCost / summary.loadBalancerCount : 0,
            ),
          },
        ];
      }

      const rows = await this.query.getCostGroupBy(input);
      const selected = new Set(input.groupValues.map((item) => item.toLowerCase()));
      const filtered = selected.size > 0
        ? rows.filter((row) => selected.has(row.group.trim().toLowerCase()))
        : rows;
      return filtered.map((row) => ({
        group: row.group,
        label: metricLabel(row.group),
        totalCost: toFixedNumber(row.totalCost),
        fixedCost: toFixedNumber(row.fixedCost),
        lcuCost: toFixedNumber(row.lcuCost),
        dataProcessingCost: toFixedNumber(row.dataProcessingCost),
        loadBalancerCount: row.loadBalancerCount,
        avgCost: toFixedNumber(row.loadBalancerCount > 0 ? row.totalCost / row.loadBalancerCount : 0),
      }));
    }

    const rows = await this.query.getLoadBalancersGroupBy(input);
    const selected = new Set(input.groupValues.map((item) => item.toLowerCase()));
    const filtered = selected.size > 0
      ? rows.filter((row) => selected.has(row.group.trim().toLowerCase()))
      : rows;

    return filtered.map((row) => ({
      group: row.group,
      label: metricLabel(row.group),
      totalCost: toFixedNumber(row.totalCost),
      fixedCost: toFixedNumber(row.fixedCost),
      lcuCost: toFixedNumber(row.lcuCost),
      dataProcessingCost: toFixedNumber(row.dataProcessingCost),
      loadBalancerCount: row.loadBalancerCount,
      avgCost: toFixedNumber(row.avgCost),
    }));
  }
}
