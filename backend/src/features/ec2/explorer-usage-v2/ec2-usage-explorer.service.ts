import { logger } from "../../../utils/logger.js";
import type { Ec2UsageExplorerInput, Ec2UsageExplorerResponse } from "./ec2-usage-explorer.types.js";
import { Ec2UsageExplorerQuery } from "./ec2-usage-explorer.query.js";
import { buildChartSeries } from "./helpers/chart-formatting.js";
import { buildTableRows } from "./helpers/grouping.js";
import { buildKpis } from "./helpers/kpi-aggregation.js";

export class Ec2UsageExplorerService {
  private query = new Ec2UsageExplorerQuery();

  async getUsageExplorer(input: Ec2UsageExplorerInput): Promise<Ec2UsageExplorerResponse> {
    logger.info("[EC2 Usage Explorer v2] request", {
      tenantId: input.scope.tenantId,
      startDate: input.startDate,
      endDate: input.endDate,
      granularity: input.granularity,
      usageMetric: input.usageMetric,
      aggregation: input.aggregation,
      groupBy: input.groupBy,
      compare: input.compare,
    });

    const rows = await this.query.getRows(input);
    const totalRows = rows.length;
    const rowsWithCpu = rows.filter((row) => Number(row.avgCpu ?? 0) > 0 || Number(row.maxCpu ?? 0) > 0).length;
    const rowsWithNetwork = rows.filter((row) => Number(row.networkInGb ?? 0) > 0 || Number(row.networkOutGb ?? 0) > 0).length;
    const filtered = rows.filter((row) => {
      if (input.filters.accountIds.length > 0 && !input.filters.accountIds.map((v) => v.toLowerCase()).includes(String(row.account ?? "").toLowerCase())) return false;
      if (input.filters.regions.length > 0 && !input.filters.regions.map((v) => v.toLowerCase()).includes(String(row.region ?? "").toLowerCase())) return false;
      if (input.filters.instanceTypes.length > 0 && !input.filters.instanceTypes.map((v) => v.toLowerCase()).includes(String(row.instanceType ?? "").toLowerCase())) return false;
      return true;
    });

    const chartSeries = buildChartSeries(filtered, input.granularity, input.groupBy, input.tagKey, input.usageMetric, input.aggregation);
    const tableRows = buildTableRows(filtered, input.groupBy, input.tagKey);
    const kpis = buildKpis(filtered);
    const chartPointsCount = chartSeries.reduce((sum, series) => sum + series.points.length, 0);

    logger.info("[EC2 Usage Explorer v2] aggregation summary", {
      tenantId: input.scope.tenantId,
      rowCount: totalRows,
      rowsWithCpu,
      rowsWithNetwork,
      filteredRowCount: filtered.length,
      chartSeriesCount: chartSeries.length,
      chartPointsCount,
      tableRowCount: tableRows.length,
      kpis,
    });

    // TODO(frontend-drilldown): add deep-link/drilldown support for Usage Explorer groups.
    return {
      kpis,
      chart: {
        granularity: input.granularity,
        xAxis: "date",
        yAxis: input.usageMetric,
        series: chartSeries,
      },
      table: {
        rows: tableRows,
      },
      meta: {
        usageMetric: input.usageMetric,
        aggregation: input.aggregation,
        groupBy: input.groupBy,
        granularity: input.granularity,
        normalized: true,
      },
    };
  }
}
