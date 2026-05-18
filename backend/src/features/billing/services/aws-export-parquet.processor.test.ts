import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const thisDir = path.dirname(fileURLToPath(import.meta.url));
const processorPath = path.resolve(thisDir, "aws-export-parquet.processor.ts");
const source = readFileSync(processorPath, "utf8");

function assertOrdered(snippets: string[]) {
  let previousIndex = -1;
  for (const snippet of snippets) {
    const index = source.indexOf(snippet);
    assert.ok(index >= 0, `Expected snippet not found: ${snippet}`);
    assert.ok(index > previousIndex, `Expected ordering violation around: ${snippet}`);
    previousIndex = index;
  }
}

test("DB processor starts after fact replacement commit", () => {
  assertOrdered([
    "replacementSummary = await replaceFactRowsFromStagingInTransaction({",
    'stage: "aws_parquet_fact_replacement_committed"',
    'stage: "s3_cost_daily_sync_started"',
    "await syncS3CostDaily({",
    'stage: "s3_cost_daily_sync_completed"',
    'stage: "db_processor_started"',
    "await syncDbCostHistoryForIngestionRun({",
    'stage: "db_processor_completed"',
  ]);
});

test("LB processor uses defined dateFrom/dateTo derived after fact replacement", () => {
  assertOrdered([
    "const affectedUsageDates = Array.isArray(replacementSummary.affectedUsageDates)",
    "const dateFrom = affectedUsageDates.length > 0 ? affectedUsageDates[0] : null;",
    "const dateTo = affectedUsageDates.length > 0 ? affectedUsageDates[affectedUsageDates.length - 1] : null;",
    'stage: "lb_processor_started"',
    "dateFrom,",
    "dateTo,",
    "await loadBalancerRecommendationsService.refreshRecommendations({",
  ]);
});

test("no post-fact processor starts before commit", () => {
  assertOrdered([
    'stage: "aws_parquet_fact_replacement_committed"',
    'stage: "post_fact_processors_started"',
    'stage: "s3_cost_daily_sync_started"',
    'stage: "db_processor_started"',
    'stage: "lb_processor_started"',
    'stage: "ec2_recommendation_refresh_started"',
    'stage: "cost_aggregation_started"',
  ]);
});

test("aggregations run after fact replacement", () => {
  assertOrdered([
    "replacementSummary = await replaceFactRowsFromStagingInTransaction({",
    "await upsertCostAggregationsForRun({",
  ]);
});

test("required aws parquet stage logs are present", () => {
  const requiredStages = [
    "aws_parquet_staging_started",
    "aws_parquet_staging_completed",
    "aws_parquet_fact_replacement_started",
    "aws_parquet_fact_replacement_committed",
    "post_fact_processors_started",
    "s3_cost_daily_sync_started",
    "s3_cost_daily_sync_completed",
    "s3_cost_daily_sync_failed",
    "s3_cost_daily_sync_skipped_no_date_range",
    "db_processor_started",
    "db_processor_completed",
    "lb_processor_started",
    "lb_processor_completed",
    "ec2_recommendation_refresh_started",
    "ec2_recommendation_refresh_completed",
    "cost_aggregation_started",
    "cost_aggregation_completed",
  ];

  for (const stage of requiredStages) {
    assert.ok(source.includes(`stage: "${stage}"`), `Missing stage log for ${stage}`);
  }
});

test("s3 cost sync receives affected date range and is sourced from fact-backed window", () => {
  assert.ok(source.includes("startDate: s3StartDate"), "syncS3CostDaily startDate not wired");
  assert.ok(source.includes("endDate: s3EndDate"), "syncS3CostDaily endDate not wired");
  assert.ok(source.includes("billingSourceId: String(source.id)"), "syncS3CostDaily billingSourceId missing");
  assert.ok(source.includes("cloudConnectionId: source.cloudConnectionId"), "syncS3CostDaily cloudConnectionId missing");
  assert.ok(source.includes("rebuildRange: true"), "syncS3CostDaily should run with rebuildRange=true");
});

test("s3 sync failure does not fail fact replacement flow", () => {
  assert.ok(source.includes("catch (s3SyncError)"), "Expected s3 sync failure handler");
  assert.equal(source.includes("throw s3SyncError"), false, "s3 sync failures should be non-fatal");
  assert.ok(
    source.includes('status: "completed_with_warnings"'),
    "s3 sync failure should mark run completed_with_warnings",
  );
});

test("s3 sync does not depend on storage lens data", () => {
  const s3SyncCallIndex = source.indexOf("await syncS3CostDaily({");
  const storageLensCallIndex = source.indexOf("scheduleStorageLensSyncAfterIngestion({");
  assert.ok(s3SyncCallIndex >= 0, "syncS3CostDaily call not found");
  assert.ok(storageLensCallIndex >= 0, "scheduleStorageLensSyncAfterIngestion call not found");
  assert.ok(
    s3SyncCallIndex < storageLensCallIndex,
    "s3 cost sync should run independently before storage lens scheduling",
  );
});
