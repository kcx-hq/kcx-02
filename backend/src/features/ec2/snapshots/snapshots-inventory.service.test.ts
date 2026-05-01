import assert from "node:assert/strict";
import test from "node:test";

import { sequelize } from "../../../models/index.js";
import { SnapshotsInventoryService } from "./snapshots-inventory.service.js";

type QueryCall = {
  sql: string;
  normalizedSql: string;
  bind: unknown[] | undefined;
};

type QueryFn = (sql: string, options?: { bind?: unknown[] }) => Promise<unknown>;

const normalizeSql = (sql: string): string => sql.replace(/\s+/g, " ").trim().toLowerCase();

const installQueryMock = (
  impl: (normalizedSql: string, sql: string, bind: unknown[] | undefined) => Promise<unknown>,
) => {
  const owner = sequelize as unknown as { query: QueryFn };
  const original = owner.query;
  const calls: QueryCall[] = [];

  owner.query = async (sql: string, options?: { bind?: unknown[] }) => {
    const normalizedSql = normalizeSql(sql);
    calls.push({ sql, normalizedSql, bind: options?.bind });
    return impl(normalizedSql, sql, options?.bind);
  };

  return {
    calls,
    restore: () => {
      owner.query = original;
    },
  };
};

const makeDefaultQuery = () => ({
  cloudConnectionId: null,
  regionKey: null,
  state: null,
  storageTier: null,
  encrypted: null,
  search: null,
  page: 1,
  pageSize: 25,
});

test("listSnapshots prevents cross-connection enrichment fallback and keeps orphan classification strict", async () => {
  const service = new SnapshotsInventoryService();
  const mock = installQueryMock(async (normalizedSql) => {
    if (normalizedSql.includes("select count(*)::text as total from ec2_snapshot_inventory_snapshots inv")) {
      return [{ total: "1" }];
    }
    if (normalizedSql.includes('select inv.snapshot_id as "snapshotid"')) {
      return [
        {
          snapshotId: "snap-1",
          sourceVolumeId: "vol-1",
          sourceInstanceId: "i-1",
          state: "completed",
          storageTier: "standard",
          encrypted: true,
          kmsKeyId: "kms-1",
          progress: "100%",
          startTime: "2026-04-01T00:00:00.000Z",
          regionKey: "101",
          subAccountKey: "501",
          tags: { Name: "snapshot-1" },
          metadata: { awsRegion: "us-east-1" },
          cloudConnectionId: "conn-a",
        },
      ];
    }
    if (normalizedSql.includes('count(*)::text as "totalsnapshots"')) {
      return [
        {
          totalSnapshots: "1",
          oldSnapshots: "0",
          totalSnapshotCost: "0",
          potentialSavings: "0",
        },
      ];
    }
    if (normalizedSql.includes("from ec2_volume_inventory_snapshots inv")) {
      return [
        {
          cloudConnectionId: "conn-b",
          regionKey: "101",
          sourceVolumeId: "vol-1",
          sourceVolumeName: "wrong-volume",
        },
      ];
    }
    if (normalizedSql.includes('as "currencycode"')) {
      return [];
    }
    throw new Error(`Unexpected query: ${normalizedSql}`);
  });

  try {
    const response = await service.listSnapshots({
      tenantId: "tenant-1",
      query: makeDefaultQuery(),
    });

    assert.equal(response.rows.length, 1);
    assert.equal(response.rows[0]?.signal, "orphaned");
    assert.equal(response.rows[0]?.recommendation, null);
    assert.equal(response.rows[0]?.estimatedSavings, 0);
  } finally {
    mock.restore();
  }
});

test("listSnapshots uses scoped enrichment, preserves fixed ordering, and returns drawer-ready fields", async () => {
  const service = new SnapshotsInventoryService();
  const mock = installQueryMock(async (normalizedSql) => {
    if (normalizedSql.includes("select count(*)::text as total from ec2_snapshot_inventory_snapshots inv")) {
      return [{ total: "1" }];
    }
    if (normalizedSql.includes('select inv.snapshot_id as "snapshotid"')) {
      return [
        {
          snapshotId: "snap-1",
          sourceVolumeId: "vol-1",
          sourceInstanceId: "i-1",
          state: "completed",
          storageTier: "standard",
          encrypted: false,
          kmsKeyId: null,
          progress: "100%",
          startTime: "2026-01-01T00:00:00.000Z",
          regionKey: "101",
          subAccountKey: "501",
          tags: { Name: "snapshot-1" },
          metadata: { awsRegion: "us-east-1" },
          cloudConnectionId: "conn-a",
        },
      ];
    }
    if (normalizedSql.includes('count(*)::text as "totalsnapshots"')) {
      return [
        {
          totalSnapshots: "1",
          oldSnapshots: "1",
          totalSnapshotCost: "7.25",
          potentialSavings: "7.25",
        },
      ];
    }
    if (normalizedSql.includes("from ec2_volume_inventory_snapshots inv")) {
      return [
        {
          cloudConnectionId: "conn-a",
          regionKey: "202",
          sourceVolumeId: "vol-1",
          sourceVolumeName: "wrong-region-volume",
        },
        {
          cloudConnectionId: "conn-a",
          regionKey: "101",
          sourceVolumeId: "vol-1",
          sourceVolumeName: "source-volume",
        },
      ];
    }
    if (normalizedSql.includes('as "currencycode"')) {
      return [{ snapshotId: "snap-1", cost: "7.25", currencyCode: "USD" }];
    }
    throw new Error(`Unexpected query: ${normalizedSql}`);
  });

  try {
    const response = await service.listSnapshots({
      tenantId: "tenant-1",
      query: makeDefaultQuery(),
    });

    assert.equal(response.rows.length, 1);
    assert.equal(response.rows[0]?.signal, "old");
    assert.equal(response.rows[0]?.cost, 7.25);
    assert.equal(response.rows[0]?.recommendation, "Delete or review old snapshot");
    assert.equal(response.rows[0]?.estimatedSavings, 7.25);
    assert.equal(response.summary.totalSnapshotCost, 7.25);
    assert.equal(response.summary.potentialSavings, 7.25);

    const inventoryQuery = mock.calls.find((call) =>
      call.normalizedSql.includes('select inv.snapshot_id as "snapshotid"'),
    );
    assert.ok(inventoryQuery);
    assert.match(
      inventoryQuery.sql.toLowerCase(),
      /order by inv\.updated_at desc nulls last, inv\.snapshot_id asc/,
    );
  } finally {
    mock.restore();
  }
});

test("listSnapshots returns numeric totalSnapshotCost when summary has reliable value", async () => {
  const service = new SnapshotsInventoryService();
  const mock = installQueryMock(async (normalizedSql) => {
    if (normalizedSql.includes("select count(*)::text as total from ec2_snapshot_inventory_snapshots inv")) {
      return [{ total: "0" }];
    }
    if (normalizedSql.includes('select inv.snapshot_id as "snapshotid"')) {
      return [];
    }
    if (normalizedSql.includes('count(*)::text as "totalsnapshots"')) {
      return [
        {
          totalSnapshots: "0",
          oldSnapshots: "0",
          totalSnapshotCost: "12.5",
          potentialSavings: "0",
        },
      ];
    }
    throw new Error(`Unexpected query: ${normalizedSql}`);
  });

  try {
    const response = await service.listSnapshots({
      tenantId: "tenant-1",
      query: makeDefaultQuery(),
    });

    assert.equal(response.rows.length, 0);
    assert.equal(response.summary.totalSnapshotCost, 12.5);
  } finally {
    mock.restore();
  }
});

test("listSnapshots keeps totalSnapshotCost nullable and summary query enforces strict currency guardrails", async () => {
  const service = new SnapshotsInventoryService();
  const mock = installQueryMock(async (normalizedSql) => {
    if (normalizedSql.includes("select count(*)::text as total from ec2_snapshot_inventory_snapshots inv")) {
      return [{ total: "0" }];
    }
    if (normalizedSql.includes('select inv.snapshot_id as "snapshotid"')) {
      return [];
    }
    if (normalizedSql.includes('count(*)::text as "totalsnapshots"')) {
      return [
        {
          totalSnapshots: "0",
          oldSnapshots: "0",
          totalSnapshotCost: null,
          potentialSavings: null,
        },
      ];
    }
    throw new Error(`Unexpected query: ${normalizedSql}`);
  });

  try {
    const response = await service.listSnapshots({
      tenantId: "tenant-1",
      query: makeDefaultQuery(),
    });

    assert.equal(response.summary.totalSnapshotCost, 0);

    const summaryQuery = mock.calls.find((call) =>
      call.normalizedSql.includes('count(*)::text as "totalsnapshots"'),
    );
    assert.ok(summaryQuery);
    assert.match(
      summaryQuery.sql.toLowerCase(),
      /coalesce\(array_length\(cc_invalid\.currencies, 1\), 0\) <> 1/,
    );
    assert.match(
      summaryQuery.sql.toLowerCase(),
      /count\(distinct cc_currency\.currencies\[1\]\)/,
    );
  } finally {
    mock.restore();
  }
});
