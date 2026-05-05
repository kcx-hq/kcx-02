import { DatabaseAssetsRepository } from "./assets.repository.js";
import type { DatabaseAssetsQueryParams, DatabaseAssetsResponse } from "./assets.types.js";

export class DatabaseAssetsService {
  constructor(
    private readonly assetsRepository: DatabaseAssetsRepository = new DatabaseAssetsRepository(),
  ) {}

  async getAssetsData(params: DatabaseAssetsQueryParams): Promise<DatabaseAssetsResponse> {
    const [summary, filterOptions, paged] = await Promise.all([
      this.assetsRepository.getSummary(params),
      this.assetsRepository.getFilterOptions(params),
      this.assetsRepository.getAssetsPage(params),
    ]);

    return {
      summary,
      filterOptions,
      assets: paged.assets,
      pagination: {
        page: params.page,
        pageSize: params.pageSize,
        total: paged.total,
        totalPages: paged.total === 0 ? 0 : Math.ceil(paged.total / params.pageSize),
      },
    };
  }
}
