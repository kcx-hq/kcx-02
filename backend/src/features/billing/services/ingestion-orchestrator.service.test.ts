import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const thisDir = path.dirname(fileURLToPath(import.meta.url));
const orchestratorPath = path.resolve(thisDir, "ingestion-orchestrator.service.ts");
const source = readFileSync(orchestratorPath, "utf8");

function assertOrdered(snippets: string[]) {
  let previousIndex = -1;
  for (const snippet of snippets) {
    const index = source.indexOf(snippet);
    assert.ok(index >= 0, `Expected snippet not found: ${snippet}`);
    assert.ok(index > previousIndex, `Expected ordering violation around: ${snippet}`);
    previousIndex = index;
  }
}

test("fact replacement happens before aggregation and rebuild stages", () => {
  assertOrdered([
    "replacementSummary = await replaceFactRowsFromStagingInTransaction({",
    "await upsertCostAggregationsForRun({",
    "const ec2Result = await syncEc2CostHistoryForIngestionRun({",
    "const dbResult = await syncDbCostHistoryForIngestionRun({",
    "      scheduleLoadBalancerCostAggregationAfterIngestion({",
  ]);
});

test("post-sync EC2/DB/LB block is not duplicated", () => {
  assert.equal((source.match(/const ec2Result = await syncEc2CostHistoryForIngestionRun\(\{/g) ?? []).length, 1);
  assert.equal((source.match(/const dbResult = await syncDbCostHistoryForIngestionRun\(\{/g) ?? []).length, 1);
  assert.equal((source.match(/^\s{6}scheduleLoadBalancerCostAggregationAfterIngestion\(\{/gm) ?? []).length, 1);
});

test("anomaly detection trigger remains after recommendation sync on clean completion path", () => {
  assertOrdered([
    'stage: "recommendation_sync"',
    "await createAndStartAnomalyDetectionRunFromIngestion({",
    'stage: "ingestion_run_completed"',
  ]);
});

test("required ingestion stage log identifiers are present", () => {
  const requiredStages = [
    "ingestion_run_started",
    "schema_validation",
    "chunk_read",
    "row_normalization",
    "staging_insert",
    "staging_validation",
    "fact_replacement",
    "cost_aggregation",
    "ec2_rebuild",
    "db_rebuild",
    "load_balancer_rebuild",
    "storage_lens_sync",
    "recommendation_sync",
    "anomaly_detection_trigger",
    "ingestion_run_completed",
    "ingestion_run_failed",
  ];

  for (const stage of requiredStages) {
    assert.ok(source.includes(`stage: "${stage}"`), `Missing stage log for ${stage}`);
  }

  assert.ok(source.includes('status: "queued"'), "Expected queued stage logs for async jobs");
  assert.ok(
    source.includes("/_(started|completed|failed|skipped|queued)$/"),
    "Expected stage suffix normalization for structured stage names",
  );
});
