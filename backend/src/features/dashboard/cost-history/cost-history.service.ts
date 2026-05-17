import type { DashboardScope } from "../dashboard.types.js";
import type { CostExplorerBreakdownRow, CostExplorerGroupBy, CostExplorerMetric } from "../cost-explorer/cost-explorer.types.js";
import { CostHistoryRepository } from "./cost-history.repository.js";
import type {
  CostHistoryCeFilters,
  CostHistoryFilterOptionsResponse,
  CostHistoryFilters,
  CostHistoryGroupBy,
  CostHistoryResponse,
  CostHistoryXAxis,
  CostHistoryYAxisMetric,
} from "./cost-history.types.js";

const GROUP_BY_TO_TAG_KEY: Partial<Record<CostHistoryGroupBy, string>> = {
  team: "team",
  app: "app",
};

const mapYAxisToCostExplorerMetric = (value: CostHistoryYAxisMetric): CostExplorerMetric => {
  if (value === "effective_cost") return "effective";
  if (value === "amortized_cost") return "list";
  return "billed";
};

const mapGranularity = (value: CostHistoryFilters["granularity"]): "daily" | "monthly" =>
  value === "day" ? "daily" : "monthly";

const toTitle = (value: string): string => value.replace(/[_-]/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());

export class CostHistoryService {
  private readonly repository: CostHistoryRepository;

  constructor(repository: CostHistoryRepository = new CostHistoryRepository()) {
    this.repository = repository;
  }

  async getFilterOptions(scope: DashboardScope): Promise<CostHistoryFilterOptionsResponse> {
    const groupOptions = await this.repository.getGroupOptions(scope);

    return {
      granularity: [
        { key: "day", label: "Day" },
        { key: "month", label: "Month" },
      ],
      xAxis: [
        { key: "date", label: "Date" },
        { key: "account", label: "Account" },
        { key: "region", label: "Region" },
      ],
      yAxis: [
        { key: "billed_cost", label: "Billed Cost (Actual Cost)" },
        { key: "effective_cost", label: "Effective Cost" },
        { key: "amortized_cost", label: "Amortized Cost" },
      ],
      groupBy: [
        { key: "service", label: "Service" },
        { key: "region", label: "Region" },
        { key: "team", label: "Team" },
        { key: "app", label: "App" },
        { key: "account", label: "Account" },
        { key: "resource", label: "Resource" },
        { key: "service-category", label: "Service Category" },
      ],
      availableTagGroupBy: groupOptions.tagKeyOptions,
    };
  }

  async getCostHistory(scope: DashboardScope, filters: CostHistoryFilters): Promise<CostHistoryResponse> {
    const ceMetric = mapYAxisToCostExplorerMetric(filters.yAxisMetric);
    const ceGranularity = mapGranularity(filters.granularity);
    const isTagGroupBy = filters.groupBy === "team" || filters.groupBy === "app";
    const groupOptions = isTagGroupBy ? await this.repository.getGroupOptions(scope) : null;
    const resolvedTagOption = isTagGroupBy
      ? groupOptions?.tagKeyOptions.find((option) => option.normalizedKey === filters.groupBy)
      : null;
    const resolvedTagKey = isTagGroupBy ? resolvedTagOption?.key ?? GROUP_BY_TO_TAG_KEY[filters.groupBy] ?? filters.groupBy : null;
    const ceGroupBy: CostExplorerGroupBy = isTagGroupBy
      ? (`tag:${resolvedTagKey}` as CostExplorerGroupBy)
      : (filters.groupBy as Exclude<CostHistoryGroupBy, "team" | "app">);

    const ceFilters: CostHistoryCeFilters = {
      granularity: ceGranularity,
      groupBy: ceGroupBy,
      metric: ceMetric,
      compareKey: null,
      tagKey: resolvedTagKey,
      tagValue: null,
      groupValues: [],
    };

    const { chartSource } = await this.repository.getData(scope, ceFilters);

    if (filters.xAxis === "date") {
      return {
        section: "cost-history",
        title: "Cost History",
        message: "Cost history data loaded",
        filtersApplied: {
          scopeType: scope.scopeType,
          from: scope.from,
          to: scope.to,
          granularity: filters.granularity,
          xAxis: filters.xAxis,
          yAxisMetric: filters.yAxisMetric,
          groupBy: filters.groupBy,
        },
        chart: {
          labels: chartSource.chart.labels,
          series: chartSource.chart.series,
        },
        source: {
          costExplorerGroupBy: ceGroupBy,
          costExplorerMetric: ceMetric,
          costExplorerGranularity: chartSource.filtersApplied.effectiveGranularity,
        },
      };
    }

    const breakdownRows: CostExplorerBreakdownRow[] =
      filters.xAxis === "account" ? chartSource.breakdowns.account : chartSource.breakdowns.region;
    const axisSeriesName = filters.groupBy === "service" ? "Service Cost" : `${toTitle(filters.groupBy)} Cost`;

    return {
      section: "cost-history",
      title: "Cost History",
      message: "Cost history data loaded",
      filtersApplied: {
        scopeType: scope.scopeType,
        from: scope.from,
        to: scope.to,
        granularity: filters.granularity,
        xAxis: filters.xAxis as CostHistoryXAxis,
        yAxisMetric: filters.yAxisMetric,
        groupBy: filters.groupBy,
      },
      chart: {
        labels: breakdownRows.map((row) => ({
          bucketStart: String(row.key ?? row.name),
          short: row.name,
          long: row.name,
        })),
        series: [
          {
            name: axisSeriesName,
            kind: "group",
            values: breakdownRows.map((row) => Number(row.cost ?? 0)),
          },
        ],
      },
      source: {
        costExplorerGroupBy: ceGroupBy,
        costExplorerMetric: ceMetric,
        costExplorerGranularity: chartSource.filtersApplied.effectiveGranularity,
      },
    };
  }
}
