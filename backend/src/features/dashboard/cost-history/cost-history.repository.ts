import type { DashboardScope } from "../dashboard.types.js";
import { CostExplorerService } from "../cost-explorer/cost-explorer.service.js";
import type { CostExplorerFilters, CostExplorerGroupOptionsResponse } from "../cost-explorer/cost-explorer.types.js";
import type {
  CostHistoryCeFilters,
  CostHistoryRepositoryPayload,
} from "./cost-history.types.js";

export class CostHistoryRepository {
  private readonly costExplorerService: CostExplorerService;

  constructor(costExplorerService: CostExplorerService = new CostExplorerService()) {
    this.costExplorerService = costExplorerService;
  }

  async getData(scope: DashboardScope, filters: CostHistoryCeFilters): Promise<CostHistoryRepositoryPayload> {
    const ceFilters: CostExplorerFilters = {
      granularity: filters.granularity,
      groupBy: filters.groupBy,
      metric: filters.metric,
      compareKey: filters.compareKey,
      tagKey: filters.tagKey,
      tagValue: filters.tagValue,
      groupValues: filters.groupValues,
    };

    const chartSource = await this.costExplorerService.getCostExplorer(scope, ceFilters);
    return { chartSource };
  }

  async getGroupOptions(scope: DashboardScope): Promise<CostExplorerGroupOptionsResponse> {
    return this.costExplorerService.getGroupOptions(scope, "service", null);
  }
}
