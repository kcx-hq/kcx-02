import { Router } from "express";

import { asyncHandler } from "../../../utils/async-handler.js";
import { handleGetS3BucketDetail } from "./bucket-detail/s3-bucket-detail.controller.js";
import { handleGetS3CostInsights } from "./cost-insights/s3-cost-insights.controller.js";
import { handleGetS3Anomalies } from "./anomalies/s3-anomalies.controller.js";
import {
  handleApplyS3BucketLifecyclePolicy,
  handleApplyS3ReplicationSetup,
  handleAutoCreateS3ReplicationRole,
  handleDeleteS3BucketLifecyclePolicy,
  handleGetS3BucketLifecycleInsight,
  handleGetS3Optimization,
  handleGetS3Replication,
  handleGetS3ReplicationDestinationBuckets,
  handlePreviewS3ReplicationSetup,
} from "./optimization/s3-optimization.controller.js";
import { handleGetS3UsageInsights } from "./usage-insights/s3-usage-insights.controller.js";

const s3Router = Router();

s3Router.get("/cost-insights", asyncHandler(handleGetS3CostInsights));
s3Router.get("/anomalies", asyncHandler(handleGetS3Anomalies));
s3Router.get("/usage-insights", asyncHandler(handleGetS3UsageInsights));
s3Router.get("/buckets/:bucketName/detail", asyncHandler(handleGetS3BucketDetail));
s3Router.get("/optimization", asyncHandler(handleGetS3Optimization));
s3Router.get("/replication", asyncHandler(handleGetS3Replication));
s3Router.get("/replication/destination-buckets", asyncHandler(handleGetS3ReplicationDestinationBuckets));
s3Router.post("/replication/role/auto-create", asyncHandler(handleAutoCreateS3ReplicationRole));
s3Router.post("/replication/setup/preview", asyncHandler(handlePreviewS3ReplicationSetup));
s3Router.post("/replication/setup/apply", asyncHandler(handleApplyS3ReplicationSetup));
s3Router.get("/lifecycle-insight", asyncHandler(handleGetS3BucketLifecycleInsight));
s3Router.get("/usage/bucket-lifecycle-insight", asyncHandler(handleGetS3BucketLifecycleInsight));
s3Router.post("/lifecycle-policy", asyncHandler(handleApplyS3BucketLifecyclePolicy));
s3Router.post("/lifecycle-policy/delete", asyncHandler(handleDeleteS3BucketLifecyclePolicy));

export default s3Router;
