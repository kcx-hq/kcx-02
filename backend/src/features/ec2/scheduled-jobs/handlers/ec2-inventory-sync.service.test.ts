import assert from "node:assert/strict";
import test from "node:test";

import { sequelize } from "../../../../models/index.js";
import { markStaleSnapshotInventoryRowsNotCurrentForRegionScope } from "./ec2-inventory-sync.service.js";

type QueryCall = {
  sql: string;
  bind: unknown[] | undefined;
};

type QueryFn = (sql: string, options?: { bind?: unknown[] }) => Promise<unknown>;

const installQueryMock = (impl: (sql: string, bind: unknown[] | undefined) => Promise<unknown>) => {
  const owner = sequelize as unknown as { query: QueryFn };
  const original = owner.query;
  const calls: QueryCall[] = [];

  owner.query = async (sql: string, options?: { bind?: unknown[] }) => {
    calls.push({ sql, bind: options?.bind });
    return impl(sql, options?.bind);
  };

  return {
    calls,
    restore: () => {
      owner.query = original;
    },
  };
};

test("markStaleSnapshotInventoryRowsNotCurrentForRegionScope applies scoped stale reconciliation filters", async () => {
  const mock = installQueryMock(async () => []);
  try {
    await markStaleSnapshotInventoryRowsNotCurrentForRegionScope({
      tenantId: "tenant-1",
      cloudConnectionId: "conn-1",
      providerId: "42",
      region: "  us-east-1  ",
      latestSnapshotIds: ["snap-1", " snap-1 ", "", "snap-2"],
    });

    assert.equal(mock.calls.length, 1);

    const [call] = mock.calls;
    const sqlLower = call.sql.toLowerCase();
    assert.match(sqlLower, /update ec2_snapshot_inventory_snapshots s/);
    assert.match(sqlLower, /s\.snapshot_id <> all/);
    assert.match(sqlLower, /cardinality\(\$\d+::text\[\]\) = 0/);
    assert.match(sqlLower, /s\.cloud_connection_id = \$1/);
    assert.match(sqlLower, /s\.tenant_id = \$2/);

    assert.deepEqual(call.bind, ["conn-1", "tenant-1", "us-east-1", 42, ["snap-1", "snap-2"]]);
  } finally {
    mock.restore();
  }
});

test("markStaleSnapshotInventoryRowsNotCurrentForRegionScope no-ops for empty region input", async () => {
  const mock = installQueryMock(async () => []);
  try {
    await markStaleSnapshotInventoryRowsNotCurrentForRegionScope({
      tenantId: "tenant-1",
      cloudConnectionId: "conn-1",
      providerId: "42",
      region: "   ",
      latestSnapshotIds: ["snap-1"],
    });

    assert.equal(mock.calls.length, 0);
  } finally {
    mock.restore();
  }
});
