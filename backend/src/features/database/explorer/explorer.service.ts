import { DatabaseExplorerRepository } from "./explorer.repository.js";
import {
  EXPLORER_ALLOWED_GROUP_BY_BY_METRIC,
  type ExplorerQueryParams,
  type ExplorerResponse,
} from "./explorer.types.js";

export class DatabaseExplorerService {
  constructor(
    private readonly explorerRepository: DatabaseExplorerRepository = new DatabaseExplorerRepository(),
  ) {}

  async getExplorerData(params: ExplorerQueryParams): Promise<ExplorerResponse> {
    const [filterOptions, cards, trend, trendGrouped, table] = await Promise.all([
      this.explorerRepository.getFilterOptions(params),
      this.explorerRepository.getCards(params),
      this.explorerRepository.getTrend(params),
      this.explorerRepository.getTrendGrouped(params),
      this.explorerRepository.getTable(params),
    ]);

    return {
      filters: params,
      allowedGroupBy: [...EXPLORER_ALLOWED_GROUP_BY_BY_METRIC[params.metric]],
      allowedGroupByByMetric: {
        cost: [...EXPLORER_ALLOWED_GROUP_BY_BY_METRIC.cost],
        usage: [...EXPLORER_ALLOWED_GROUP_BY_BY_METRIC.usage],
      },
      filterOptions,
      cards,
      trend,
      trendGrouped,
      table,
    };
  }
}
