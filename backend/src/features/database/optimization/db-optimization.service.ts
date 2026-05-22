import { DbOptimizationRepository } from "./db-optimization.repository.js";
import type {
  DbOptimizationActionsQuery,
  DbOptimizationActionsResponse,
} from "./db-optimization.types.js";

export class DbOptimizationService {
  constructor(
    private readonly repository: DbOptimizationRepository = new DbOptimizationRepository(),
  ) {}

  async getActions(query: DbOptimizationActionsQuery): Promise<DbOptimizationActionsResponse> {
    const { items, total } = await this.repository.getActions(query);
    return {
      items,
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }
}

