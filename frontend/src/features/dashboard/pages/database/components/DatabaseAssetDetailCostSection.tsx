import { useMemo } from "react";
import type { EChartsOption } from "echarts";

import type { DatabaseAssetDetail } from "../../../api/dashboardTypes";
import { BaseEChart } from "../../../common/charts/BaseEChart";
import { WidgetShell } from "../../../common/components";
import { BaseDataTable } from "../../../common/tables/BaseDataTable";
import { DETAIL_SECTION_EMPTY_NOTE, formatCurrency } from "./database-asset-detail.formatters";

type DatabaseAssetDetailCostSectionProps = {
  detail: DatabaseAssetDetail;
};

export function DatabaseAssetDetailCostSection({ detail }: DatabaseAssetDetailCostSectionProps) {
  const rows = [
    { category: "Compute", amount: detail.costBreakdown.compute },
    { category: "Storage", amount: detail.costBreakdown.storage },
    { category: "I/O", amount: detail.costBreakdown.io },
    { category: "Backup", amount: detail.costBreakdown.backup },
    { category: "Data Transfer", amount: detail.costBreakdown.dataTransfer },
    { category: "Other", amount: detail.costBreakdown.other },
    { category: "Tax", amount: detail.costBreakdown.tax },
    { category: "Credit", amount: detail.costBreakdown.credit },
    { category: "Refund", amount: detail.costBreakdown.refund },
  ];

  const chartOption = useMemo<EChartsOption>(
    () => ({
      tooltip: { trigger: "axis", confine: true },
      legend: { bottom: 0, left: "center", textStyle: { fontSize: 11 } },
      grid: { left: 56, right: 18, top: 24, bottom: 48, containLabel: true },
      xAxis: {
        type: "category",
        boundaryGap: false,
        data: detail.trends.cost.map((point) => point.date),
        axisLabel: { hideOverlap: true, fontSize: 11 },
      },
      yAxis: {
        type: "value",
        name: "USD",
        nameLocation: "end",
        nameGap: 20,
        nameTextStyle: { fontSize: 11 },
        axisLabel: { fontSize: 11 },
      },
      series: [
        { name: "Compute", type: "line", smooth: 0.35, showSymbol: false, data: detail.trends.cost.map((point) => point.compute) },
        { name: "Storage", type: "line", smooth: 0.35, showSymbol: false, data: detail.trends.cost.map((point) => point.storage) },
        { name: "I/O", type: "line", smooth: 0.35, showSymbol: false, data: detail.trends.cost.map((point) => point.io) },
        { name: "Backup", type: "line", smooth: 0.35, showSymbol: false, data: detail.trends.cost.map((point) => point.backup) },
        { name: "Data Transfer", type: "line", smooth: 0.35, showSymbol: false, data: detail.trends.cost.map((point) => point.dataTransfer) },
      ],
    }),
    [detail.trends.cost],
  );

  return (
    <div className="database-asset-detail__stack">
      <WidgetShell title="Cost Trend" subtitle="Operational database cost over the selected range">
        {detail.trends.cost.length > 0 ? (
          <BaseEChart option={chartOption} height={300} />
        ) : (
          <p className="dashboard-note">{DETAIL_SECTION_EMPTY_NOTE}</p>
        )}
      </WidgetShell>
      <WidgetShell title="Cost Breakdown" subtitle="Category drivers behind the selected resource cost">
        <BaseDataTable
          columnDefs={[
            { headerName: "Category", field: "category", minWidth: 180 },
            { headerName: "Amount", field: "amount", minWidth: 140, valueFormatter: (params) => formatCurrency(params.value as number | null | undefined) },
          ]}
          rowData={rows}
          autoHeight
        />
      </WidgetShell>
    </div>
  );
}
