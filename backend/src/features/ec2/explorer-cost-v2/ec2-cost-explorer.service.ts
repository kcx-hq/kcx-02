import { logger } from "../../../utils/logger.js";
import type { Ec2CostExplorerInput, Ec2CostExplorerRawRow, Ec2CostExplorerResponse } from "./ec2-cost-explorer.types.js";
import { Ec2CostExplorerQuery } from "./ec2-cost-explorer.query.js";
import { buildChartSeries } from "./helpers/chart-formatting.js";
import { includeInExplorerModel, toCostTypeKey } from "./helpers/cost-classification.js";
import { buildTableRows } from "./helpers/grouping.js";
import { buildKpis } from "./helpers/kpi-aggregation.js";
import { normalizeReservationType } from "./helpers/normalization.js";

export class Ec2CostExplorerService {
  private query = new Ec2CostExplorerQuery();

  async getCostExplorer(input: Ec2CostExplorerInput): Promise<Ec2CostExplorerResponse> {
    logger.info("[EC2 Cost Explorer v2] request", {
      tenantId: input.scope.tenantId,
      startDate: input.startDate,
      endDate: input.endDate,
      groupBy: input.groupBy,
      costBasis: input.costBasis,
      granularity: input.granularity,
      compare: input.compare,
    });

    const rows = await this.query.getRows(input);
    logger.info("[EC2 Cost Explorer v2][KPI Filter Conditions]", {
      tenantId: input.scope.tenantId,
      where: {
        dateRange: { startDate: input.startDate, endDate: input.endDate },
        includeInExplorerModel: "exclude nat_gateway only",
        accountIds: input.filters.accountIds,
        regions: input.filters.regions,
        instanceTypes: input.filters.instanceTypes,
        reservationTypes: input.filters.reservationTypes,
        costTypes: input.filters.costTypes,
        tags: input.filters.tags,
        groupBy: input.groupBy,
        billedCostFilterForKpi: "none (includes positive, negative, credit, refund rows)",
        billedCostFilterForChartTable: "grossCost > 0 only",
        chargeCategoryFilterForKpi: "none",
        chargeCategoryFilterForChartTable: "credit/refund excluded by workload-only gross projection",
      },
    });
    const scopedRows = rows
      .filter(includeInExplorerModel)
      .filter((row) => {
        if (input.filters.accountIds.length > 0 && !input.filters.accountIds.map((v) => v.toLowerCase()).includes(String(row.account ?? "").toLowerCase())) return false;
        if (input.filters.regions.length > 0 && !input.filters.regions.map((v) => v.toLowerCase()).includes(String(row.region ?? "").toLowerCase())) return false;
        if (input.filters.instanceTypes.length > 0 && !input.filters.instanceTypes.map((v) => v.toLowerCase()).includes(String(row.instanceType ?? "").toLowerCase())) return false;
        if (input.filters.reservationTypes.length > 0) {
          const normalized = normalizeReservationType(row.reservationType).groupKey;
          if (!input.filters.reservationTypes.map((v) => v.toLowerCase()).includes(normalized)) return false;
        }
        if (input.filters.costTypes.length > 0) {
          const costType = toCostTypeKey(row.category);
          const requested = input.filters.costTypes.map((v) => {
            const normalized = String(v).trim().toLowerCase();
            if (normalized === "ebs") return "volume";
            if (normalized === "eip") return "elastic_ip";
            return normalized;
          });
          if (!requested.includes(costType)) return false;
        }
        return true;
      });

    const kpiRows = rows.filter(includeInExplorerModel);
    const workloadRows = scopedRows.filter((row) => Number(row.grossCost ?? 0) > 0);

    const negativeKpiRows = kpiRows
      .filter((row) => Number(row.rawBilledCost ?? 0) < 0)
      .map((row) => ({
        usage_date: row.date,
        charge_category: row.chargeCategory,
        line_item_type: row.lineItemType,
        billed_cost: Number(row.billedCostSum ?? 0),
        rawBilledCost: Number(row.rawBilledCost ?? 0),
        positiveBilledCost: Number(row.positiveBilledCost ?? 0),
        region: row.region,
        pricing_model: row.pricingModel,
      }));

    const tableRows = buildTableRows(workloadRows, input.groupBy, input.tagKey, input.costBasis, input.compare);
    const chartSeries = buildChartSeries(workloadRows, input.granularity, input.groupBy, input.tagKey, input.costBasis, input.compare);
    const kpis = buildKpis(kpiRows);
    const positiveBilledCostSum = kpiRows.reduce((sum, row) => sum + Number(row.positiveBilledCost ?? 0), 0);
    const rawBilledCostSum = kpiRows.reduce((sum, row) => sum + Number(row.rawBilledCost ?? 0), 0);
    const negativeBilledSum = kpiRows.reduce((sum, row) => sum + (Number(row.rawBilledCost ?? 0) < 0 ? Number(row.rawBilledCost ?? 0) : 0), 0);
    const creditCategorySum = kpiRows.reduce(
      (sum, row) => sum + (String(row.chargeCategory ?? "").trim().toLowerCase() === "credit" ? Number(row.rawBilledCost ?? 0) : 0),
      0,
    );
    const refundCategorySum = kpiRows.reduce(
      (sum, row) => sum + (String(row.chargeCategory ?? "").trim().toLowerCase() === "refund" ? Number(row.rawBilledCost ?? 0) : 0),
      0,
    );
    const positiveRowsCount = kpiRows.filter((row) => Number(row.rawBilledCost ?? 0) > 0).length;
    const negativeRowsCount = kpiRows.filter((row) => Number(row.rawBilledCost ?? 0) < 0).length;
    const creditCategoryRowsCount = kpiRows.filter((row) => String(row.chargeCategory ?? "").trim().toLowerCase() === "credit").length;
    const creditRowCount = kpiRows.reduce((sum, row) => sum + Number(row.creditRowCount ?? 0), 0);
    const creditBilledSum = kpiRows.reduce((sum, row) => sum + Number(row.creditBilledSum ?? 0), 0);
    const chartRowCount = chartSeries.reduce((sum, series) => sum + series.points.length, 0);
    const chartBucketCount = new Set(chartSeries.flatMap((series) => series.points.map((point) => point.date))).size;

    logger.info("[EC2 Cost Explorer KPI Credit Rows]", {
      tenantId: input.scope.tenantId,
      rows: negativeKpiRows,
    });
    logger.info("[EC2 Cost Explorer v2][KPI Source Counts]", {
      tenantId: input.scope.tenantId,
      totalKpiSourceRows: kpiRows.length,
      positiveBilledRowsCount: positiveRowsCount,
      negativeBilledRowsCount: negativeRowsCount,
      chargeCategoryCreditRowsCount: creditCategoryRowsCount,
    });
    logger.info("[EC2 Cost Explorer v2][KPI Source Sums Before Formula]", {
      tenantId: input.scope.tenantId,
      positiveBilledSum: positiveBilledCostSum,
      negativeBilledSum,
      creditCategorySum,
      refundCategorySum,
      rawBilledCostSum,
    });
    logger.info("[EC2 Cost Explorer v2][KPI Formula Result]", {
      tenantId: input.scope.tenantId,
      grossCost: kpis.grossCost,
      credits: kpis.credits,
      netCost: kpis.netCost,
    });

    logger.info("[EC2 Cost Explorer v2] aggregation summary", {
      tenantId: input.scope.tenantId,
      rawRows: rows.length,
      scopedRows: scopedRows.length,
      kpiRows: kpiRows.length,
      workloadRows: workloadRows.length,
      normalizedGroups: [...new Set(tableRows.map((row) => row.groupKey))],
      tableRowCount: tableRows.length,
      chartSeriesCount: chartSeries.length,
      chartRowCount,
      generatedChartBucketCount: chartBucketCount,
      grossCost: kpis.grossCost,
      credits: kpis.credits,
      netCost: kpis.netCost,
      positiveBilledCostSum,
      rawBilledCostSum,
      creditRowCount,
      creditBilledSum,
      totalRowsForKpiQuery: kpiRows.length,
      netCalculated: kpis.netCost,
      billedCostSum: rawBilledCostSum,
      listCostSum: kpiRows.reduce((sum, row) => sum + Number(row.listCostSum ?? 0), 0),
      kpis,
    });

    // TODO(frontend-integration): Wire this response to the new EC2 Cost Explorer UI route.
    return {
      kpis,
      chart: {
        granularity: input.granularity,
        xAxis: "date",
        yAxis: input.costBasis,
        series: chartSeries,
      },
      table: {
        rows: tableRows,
      },
      meta: {
        costBasis: input.costBasis,
        groupBy: input.groupBy,
        granularity: input.granularity,
        currency: "USD",
        normalized: true,
        debug: {
          positiveBilledSum: positiveBilledCostSum,
          negativeBilledSum,
          creditRowsCount: creditCategoryRowsCount,
          rawBilledSum: rawBilledCostSum,
        },
      },
    };
  }
}
