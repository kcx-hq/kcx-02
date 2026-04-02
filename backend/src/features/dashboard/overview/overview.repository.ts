import { QueryTypes } from "sequelize";

import { sequelize } from "../../../models/index.js";
import type { DashboardScope } from "../dashboard.types.js";
import { buildDashboardFilter } from "../shared/filter-builder.js";
import type { QueryResult, TotalSpendRow } from "../shared/query-types.js";

export class OverviewRepository {
  async getTotalSpend(scope: DashboardScope): Promise<number> {
    const { whereClause, params } = buildDashboardFilter(scope);

    const rows = await sequelize.query<TotalSpendRow>(
      `
        SELECT COALESCE(SUM(fcli.billed_cost), 0)::double precision AS total_spend
        FROM fact_cost_line_items fcli
        JOIN dim_date dd ON dd.id = fcli.usage_date_key
        WHERE ${whereClause};
      `,
      {
        bind: params,
        type: QueryTypes.SELECT,
      },
    );

    const result: QueryResult<TotalSpendRow> = { rows };
    return Number(result.rows[0]?.total_spend ?? 0);
  }
}
