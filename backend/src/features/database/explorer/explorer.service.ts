import { DatabaseExplorerRepository } from "./explorer.repository.js";
import type { ExplorerQueryParams, ExplorerResponse } from "./explorer.types.js";

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
      filterOptions,
      cards,
      trend,
      trendGrouped,
      table,
    };
  }
}
