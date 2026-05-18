import assert from "node:assert/strict";
import test from "node:test";

import type { ScheduledJob } from "../../../../models/ec2/scheduled_jobs.js";
import { CloudInventorySyncPipelineService } from "./cloud-inventory-sync-pipeline.service.js";

const makeJob = (): ScheduledJob =>
  ({
    id: "job-1",
    jobType: "cloud_inventory_sync_pipeline",
    tenantId: "tenant-1",
    cloudConnectionId: "conn-1",
    billingSourceId: "101",
    configJson: null,
  }) as unknown as ScheduledJob;

test("pipeline calls ec2, load balancer, rds aurora, and s3 inventory steps", async () => {
  const calls: string[] = [];
  const service = new CloudInventorySyncPipelineService({
    syncEc2Inventory: async () => {
      calls.push("ec2");
    },
    syncLoadBalancerInventory: async () => {
      calls.push("lb");
    },
    syncRdsAuroraInventory: async () => {
      calls.push("rds");
      return { fetchedInstances: 1, fetchedClusters: 1, persisted: null };
    },
    collectS3BucketConfigSnapshots: async () => {
      calls.push("s3");
      return { bucketsScanned: 1, snapshotsCreated: 1 };
    },
    findBillingSourceIdForConnection: async () => "101",
  });

  const result = await service.run(makeJob());
  assert.equal(result.status, "completed");
  assert.deepEqual(calls, ["ec2", "lb", "rds", "s3"]);
});

test("one failed step does not stop remaining steps", async () => {
  const calls: string[] = [];
  const service = new CloudInventorySyncPipelineService({
    syncEc2Inventory: async () => {
      calls.push("ec2");
      throw new Error("ec2 failed");
    },
    syncLoadBalancerInventory: async () => {
      calls.push("lb");
    },
    syncRdsAuroraInventory: async () => {
      calls.push("rds");
      return { fetchedInstances: 2, fetchedClusters: 2, persisted: null };
    },
    collectS3BucketConfigSnapshots: async () => {
      calls.push("s3");
      return { bucketsScanned: 3, snapshotsCreated: 4 };
    },
    findBillingSourceIdForConnection: async () => "101",
  });

  const result = await service.run(makeJob());
  assert.equal(result.status, "completed_with_warnings");
  assert.deepEqual(calls, ["ec2", "lb", "rds", "s3"]);
  assert.equal(result.steps.filter((step) => step.status === "failed").length, 1);
});

test("all failed steps mark pipeline failed", async () => {
  const service = new CloudInventorySyncPipelineService({
    syncEc2Inventory: async () => {
      throw new Error("ec2 failed");
    },
    syncLoadBalancerInventory: async () => {
      throw new Error("lb failed");
    },
    syncRdsAuroraInventory: async () => {
      throw new Error("rds failed");
    },
    collectS3BucketConfigSnapshots: async () => {
      throw new Error("s3 failed");
    },
    findBillingSourceIdForConnection: async () => "101",
  });

  await assert.rejects(() => service.run(makeJob()), /all steps failed/i);
});

test("partial failure records warnings", async () => {
  const service = new CloudInventorySyncPipelineService({
    syncEc2Inventory: async () => undefined,
    syncLoadBalancerInventory: async () => {
      throw new Error("lb failed");
    },
    syncRdsAuroraInventory: async () => ({ fetchedInstances: 0, fetchedClusters: 0, persisted: null }),
    collectS3BucketConfigSnapshots: async () => ({ bucketsScanned: 0, snapshotsCreated: 0 }),
    findBillingSourceIdForConnection: async () => "101",
  });

  const result = await service.run(makeJob());
  assert.equal(result.status, "completed_with_warnings");
  assert.equal(result.steps.filter((step) => step.status === "failed").length, 1);
  assert.equal(result.steps.find((step) => step.service === "load_balancer")?.errorMessage, "lb failed");
});

