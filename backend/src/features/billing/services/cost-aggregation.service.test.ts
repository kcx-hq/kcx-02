import assert from "node:assert/strict";
import test from "node:test";

import { sequelize } from "../../../models/index.js";
import { upsertCostAggregationsForRun } from "./cost-aggregation.service.js";

test("upsertCostAggregationsForRun rebuilds aggregates from fact rows for affected usage dates", async () => {
  const originalQuery = sequelize.query.bind(sequelize);
  const calls: string[] = [];

  (sequelize.query as unknown as (sql: string, options?: unknown) => Promise<unknown>) = async (sql: string) => {
    calls.push(sql);
    if (sql.includes("SELECT COUNT(*)::bigint AS row_count") && sql.includes("FROM fact_cost_line_items")) {
      return [{ row_count: "5" }];
    }
    if (sql.includes("SELECT COUNT(*)::bigint AS deleted_count")) {
      return [{ deleted_count: "2" }];
    }
    if (sql.includes("INSERT INTO agg_cost_hourly")) return [[], 3];
    if (sql.includes("INSERT INTO agg_cost_daily")) return [[], 4];
    if (sql.includes("INSERT INTO agg_cost_monthly")) return [[], 1];
    return [[], 0];
  };

  try {
    await upsertCostAggregationsForRun({
      ingestionRunId: "77",
      tenantId: "00000000-0000-0000-0000-000000000001",
      providerId: "1",
      billingSourceId: "11",
      uploadedBy: null,
      affectedUsageDates: ["2026-05-13", "2026-05-14"],
    });
  } finally {
    (sequelize.query as unknown as (sql: string, options?: unknown) => Promise<unknown>) = originalQuery as unknown as (
      sql: string,
      options?: unknown,
    ) => Promise<unknown>;
  }

  assert.ok(calls.some((sql) => sql.includes("FROM fact_cost_line_items")));
  assert.ok(!calls.some((sql) => sql.includes("FROM staging_cost_line_items")));
  assert.ok(calls.some((sql) => sql.includes("DELETE FROM agg_cost_hourly")));
  assert.ok(calls.some((sql) => sql.includes("DELETE FROM agg_cost_daily")));
  assert.ok(calls.some((sql) => sql.includes("DELETE FROM agg_cost_monthly")));
  assert.ok(calls.some((sql) => sql.includes("INSERT INTO agg_cost_hourly")));
  assert.ok(calls.some((sql) => sql.includes("INSERT INTO agg_cost_daily")));
  assert.ok(calls.some((sql) => sql.includes("INSERT INTO agg_cost_monthly")));
});
