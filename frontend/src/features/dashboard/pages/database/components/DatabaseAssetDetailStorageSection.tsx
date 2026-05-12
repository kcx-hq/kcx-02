import { useMemo } from "react";
import type { EChartsOption } from "echarts";

import type { DatabaseAssetDetail } from "../../../api/dashboardTypes";
import { BaseEChart } from "../../../common/charts/BaseEChart";
import { WidgetShell } from "../../../common/components";
import {
  DETAIL_EMPTY_NOTE,
  formatNumber,
  formatPercent,
} from "./database-asset-detail.formatters";

type DatabaseAssetDetailStorageSectionProps = {
  detail: DatabaseAssetDetail;
};

export function DatabaseAssetDetailStorageSection({ detail }: DatabaseAssetDetailStorageSectionProps) {
  const chartOption = useMemo<EChartsOption>(
    () => ({
      tooltip: { trigger: "axis", confine: true },
      legend: { bottom: 0, left: "center", textStyle: { fontSize: 11 } },
      grid: { left: 56, right: 18, top: 24, bottom: 48, containLabel: true },
      xAxis: { type: "category", boundaryGap: false, data: detail.trends.storage.map((point) => point.date) },
      yAxis: { type: "value", name: "GB", nameLocation: "end", nameGap: 20 },
      series: [
        { name: "Allocated", type: "line", smooth: 0.35, showSymbol: false, data: detail.trends.storage.map((point) => point.allocatedStorageGb) },
        { name: "Used", type: "line", smooth: 0.35, showSymbol: false, data: detail.trends.storage.map((point) => point.storageUsedGb) },
        { name: "Footprint", type: "line", smooth: 0.35, showSymbol: false, data: detail.trends.storage.map((point) => point.dataFootprintGb) },
      ],
    }),
    [detail.trends.storage],
  );

  return (
    <WidgetShell title="Storage Profile" subtitle="Allocated, used, and footprint storage signals">
      <div className="database-asset-detail__mini-kpis">
        <div className="database-asset-detail__mini-kpi">
          <span>Allocated Storage</span>
          <strong>{formatNumber(detail.storageSummary.allocatedStorageGb, " GB")}</strong>
        </div>
        <div className="database-asset-detail__mini-kpi">
          <span>Used Storage</span>
          <strong>{formatNumber(detail.storageSummary.storageUsedGb, " GB")}</strong>
        </div>
        <div className="database-asset-detail__mini-kpi">
          <span>Data Footprint</span>
          <strong>{formatNumber(detail.storageSummary.dataFootprintGb, " GB")}</strong>
        </div>
        <div className="database-asset-detail__mini-kpi">
          <span>Storage Utilization</span>
          <strong>{formatPercent(detail.storageSummary.storageUtilizationPct)}</strong>
        </div>
      </div>
      {detail.trends.storage.length > 0 ? (
        <BaseEChart option={chartOption} height={300} />
      ) : (
        <p className="dashboard-note">{DETAIL_EMPTY_NOTE}</p>
      )}
    </WidgetShell>
  );
}
