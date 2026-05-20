import type { DashboardScope } from "../dashboard.types.js";
import { S3UsageInsightsRepository } from "./s3-usage-insights.repository.js";
import type { S3UsageInsightsFilters, S3UsageInsightsResponse } from "./s3-usage-insights.types.js";

export class S3UsageInsightsService {
  constructor(
    private readonly repository: S3UsageInsightsRepository = new S3UsageInsightsRepository(),
  ) {}

  async getInsights(scope: DashboardScope, filters: S3UsageInsightsFilters): Promise<S3UsageInsightsResponse> {
    return this.repository.getUsageInsights({ scope, filters });
  }
}
