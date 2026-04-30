import type { DashboardScope } from "../dashboard.types.js";
import { S3OptimizationRepository } from "./s3-optimization.repository.js";
import type { S3BucketLifecycleInsightResponse, S3OptimizationResponse } from "./s3-optimization.types.js";

export class S3OptimizationService {
  constructor(private readonly repository: S3OptimizationRepository = new S3OptimizationRepository()) {}

  async getOptimization(scope: DashboardScope): Promise<S3OptimizationResponse> {
    const buckets = await this.repository.getLatestBucketLifecycleRows(scope);

    return {
      section: "s3-optimization",
      title: "S3 Optimization",
      message: "S3 optimization lifecycle data loaded",
      buckets,
    };
  }

  async getBucketLifecycleInsight(
    scope: DashboardScope,
    bucketName: string,
  ): Promise<S3BucketLifecycleInsightResponse> {
    const insight = await this.repository.getBucketLifecycleInsight(scope, bucketName);

    return {
      section: "s3-lifecycle-insight",
      title: "S3 Bucket Lifecycle Insight",
      message: "S3 lifecycle insight loaded",
      insight,
    };
  }
}
