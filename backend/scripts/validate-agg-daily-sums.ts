import { QueryTypes } from "sequelize";

import { sequelize } from "../src/models/index.js";

type MismatchRow = {
  usage_date: string;
  billed_cost_diff: string;
  usage_quantity_diff: string;
};

async function main(): Promise<void> {
  const mismatches = (await sequelize.query(
    `
      WITH fact_daily AS (
        SELECT
          DATE(usage_start_time) AS usage_date,
          COALESCE(SUM(billed_cost), 0)::numeric(38,18) AS billed_cost_sum,
          COALESCE(SUM(consumed_quantity), 0)::numeric(38,18) AS usage_quantity_sum
        FROM fact_cost_line_items
        WHERE usage_start_time IS NOT NULL
        GROUP BY 1
      ),
      agg_daily AS (
        SELECT
          usage_date,
          COALESCE(SUM(billed_cost), 0)::numeric(38,18) AS billed_cost_sum,
          COALESCE(SUM(usage_quantity), 0)::numeric(38,18) AS usage_quantity_sum
        FROM agg_cost_daily
        GROUP BY 1
      )
      SELECT
        COALESCE(f.usage_date, a.usage_date) AS usage_date,
        (COALESCE(f.billed_cost_sum, 0) - COALESCE(a.billed_cost_sum, 0))::text AS billed_cost_diff,
        (COALESCE(f.usage_quantity_sum, 0) - COALESCE(a.usage_quantity_sum, 0))::text AS usage_quantity_diff
      FROM fact_daily f
      FULL OUTER JOIN agg_daily a
        ON a.usage_date = f.usage_date
      WHERE COALESCE(f.billed_cost_sum, 0) <> COALESCE(a.billed_cost_sum, 0)
         OR COALESCE(f.usage_quantity_sum, 0) <> COALESCE(a.usage_quantity_sum, 0)
      ORDER BY 1;
    `,
    { type: QueryTypes.SELECT },
  )) as MismatchRow[];

  if (mismatches.length === 0) {
    console.info("Aggregation validation passed: fact daily sums match agg_cost_daily sums.");
    return;
  }

  console.error("Aggregation validation failed: mismatched daily sums.", {
    mismatchCount: mismatches.length,
    sample: mismatches.slice(0, 25),
  });
  process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error("Aggregation validation crashed:", error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  })
  .finally(async () => {
    await sequelize.close();
  });

