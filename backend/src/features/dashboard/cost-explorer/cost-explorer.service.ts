import type { DashboardScope } from "../dashboard.types.js";
import { CostExplorerRepository, computeEffectiveGranularity } from "./cost-explorer.repository.js";
import type { CostExplorerFilters, CostExplorerResponse } from "./cost-explorer.types.js";

export class CostExplorerService {
  private readonly repository: CostExplorerRepository;
  private static readonly BREAKDOWN_MAX_ROWS = 5000;

  constructor(repository: CostExplorerRepository = new CostExplorerRepository()) {
    this.repository = repository;
  }

  async getCostExplorer(scope: DashboardScope, filters: CostExplorerFilters): Promise<CostExplorerResponse> {
    const effectiveGranularity = computeEffectiveGranularity(filters.granularity, scope.from, scope.to);
    const effectiveFilters = {
      ...filters,
      effectiveGranularity,
      from: scope.from,
      to: scope.to,
    };

    const [chartData, topServices, topServiceCategories, topResources, topAccounts, topRegions] = await Promise.all([
      this.repository.getChartData(scope, effectiveFilters),
      this.repository.getBreakdownByDimension(scope, effectiveFilters, "service", CostExplorerService.BREAKDOWN_MAX_ROWS),
      this.repository.getBreakdownByDimension(
        scope,
        effectiveFilters,
        "service-category",
        CostExplorerService.BREAKDOWN_MAX_ROWS,
      ),
      this.repository.getBreakdownByDimension(scope, effectiveFilters, "resource", CostExplorerService.BREAKDOWN_MAX_ROWS),
      this.repository.getBreakdownByDimension(scope, effectiveFilters, "account", CostExplorerService.BREAKDOWN_MAX_ROWS),
      this.repository.getBreakdownByDimension(scope, effectiveFilters, "region", CostExplorerService.BREAKDOWN_MAX_ROWS),
    ]);

    const trendPct =
      chartData.previousPeriodSpend > 0
        ? ((chartData.periodSpend - chartData.previousPeriodSpend) / chartData.previousPeriodSpend) * 100
        : 0;

    return {
      section: "cost-explorer",
      title: "Cost Explorer",
      message: "Cost explorer data loaded",
      filtersApplied: {
        from: scope.from,
        to: scope.to,
        granularity: filters.granularity,
        effectiveGranularity,
        groupBy: filters.groupBy,
        metric: filters.metric,
        compareKey: filters.compareKey,
        scopeType: scope.scopeType,
      },
      kpis: {
        periodSpend: chartData.periodSpend,
        previousPeriodSpend: chartData.previousPeriodSpend,
        trendPct,
        topService: topServices[0]?.name ?? "Unspecified",
      },
      chart: {
        labels: chartData.labels,
        series: chartData.series,
      },
      breakdowns: {
        service: topServices,
        serviceCategory: topServiceCategories,
        resource: topResources,
        account: topAccounts,
        region: topRegions,
      },
    };
  }
}
