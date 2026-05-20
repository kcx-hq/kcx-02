import type { DashboardScope } from "../../dashboard.types.js";

import { S3AnomaliesRepository } from "./s3-anomalies.repository.js";
import type { S3AnomaliesFilters, S3AnomaliesResponse } from "./s3-anomalies.types.js";

export class S3AnomaliesService {
  constructor(
    private readonly repository: S3AnomaliesRepository = new S3AnomaliesRepository(),
  ) {}

  async getAnomalies(scope: DashboardScope, filters: S3AnomaliesFilters): Promise<S3AnomaliesResponse> {
    return this.repository.getS3Anomalies(scope, filters);
  }
}

