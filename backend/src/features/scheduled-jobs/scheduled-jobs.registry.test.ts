import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { REGISTERED_SCHEDULED_JOBS } from "./scheduled-jobs.registry.js";

const thisDir = path.dirname(fileURLToPath(import.meta.url));

test("cloud_inventory_sync_pipeline is registered", () => {
  const job = REGISTERED_SCHEDULED_JOBS.find((item) => item.type === "cloud_inventory_sync_pipeline");
  assert.ok(job);
  assert.equal(job?.key, "cloud-inventory-sync-pipeline");
  assert.equal(job?.category, "inventory_sync");
});

test("cloud inventory pipeline does not call metrics/cost/recommendation sync paths", () => {
  const sourcePath = path.resolve(
    thisDir,
    "handlers/inventory/cloud-inventory-sync-pipeline.service.ts",
  );
  const source = readFileSync(sourcePath, "utf8");

  assert.equal(source.includes("syncEc2InstanceMetrics"), false);
  assert.equal(source.includes("syncEbsVolumeMetrics"), false);
  assert.equal(source.includes("syncLoadBalancerCostDaily"), false);
  assert.equal(source.includes("syncAwsRightsizingRecommendations"), false);
  assert.equal(source.includes("syncAwsIdleRecommendations"), false);
  assert.equal(source.includes("createAndStartAnomalyDetectionRunFromIngestion"), false);
});

