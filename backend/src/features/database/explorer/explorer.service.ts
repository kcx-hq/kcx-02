import { DatabaseExplorerRepository } from "./explorer.repository.js";
import type { ExplorerQueryParams, ExplorerResponse } from "./explorer.types.js";

export class DatabaseExplorerService {
  constructor(
    private readonly explorerRepository: DatabaseExplorerRepository = new DatabaseExplorerRepository(),
  ) {}

  async getExplorerData(params: ExplorerQueryParams): Promise<ExplorerResponse> {
    const [cards, trend, table] = await Promise.all([
      this.explorerRepository.getCards(params),
      this.explorerRepository.getTrend(params),
      this.explorerRepository.getTable(params),
    ]);

    return {
      filters: params,
      cards,
      trend,
      table,
    };
  }
}
