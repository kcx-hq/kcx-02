import { useMemo } from "react";
import type { EChartsOption } from "echarts";

import type { DatabaseAssetDetail } from "../../../api/dashboardTypes";
import { BaseEChart } from "../../../common/charts/BaseEChart";
import { WidgetShell } from "../../../common/components";
import {
  DETAIL_SECTION_EMPTY_NOTE,
  formatInteger,
  formatNumber,
  getWorkloadLabel,
  hasMetricValue,
  isRdsAuroraService,
} from "./database-asset-detail.formatters";

type DatabaseAssetDetailUsageSectionProps = {
  detail: DatabaseAssetDetail;
};

export function DatabaseAssetDetailUsageSection({ detail }: DatabaseAssetDetailUsageSectionProps) {
  const isRelationalDepth = isRdsAuroraService(detail.identity.dbService, detail.identity.dbEngine);
  const hasUsageSummary = hasMetricValue(
    detail.usageSummary.avgLoad,
    detail.usageSummary.maxLoad,
    detail.usageSummary.avgConnections,
    detail.usageSummary.maxConnections,
    detail.usageSummary.requestCount,
  );
  const hasUsageTrend = detail.trends.usage.some((point) =>
    hasMetricValue(point.avgLoad, point.maxLoad, point.avgConnections, point.maxConnections, point.requestCount, point.avgCpu),
  );
  const showUsageData = hasUsageSummary || hasUsageTrend;

  const chartOption = useMemo<EChartsOption>(
    () => ({
      tooltip: { trigger: "axis", confine: true },
      legend: { bottom: 0, left: "center", textStyle: { fontSize: 11 } },
      grid: { left: 56, right: 18, top: 24, bottom: 48, containLabel: true },
      xAxis: { type: "category", boundaryGap: false, data: detail.trends.usage.map((point) => point.date) },
      yAxis: [
        { type: "value", name: "Load", nameLocation: "end", nameGap: 20 },
        { type: "value", name: "Connections", nameLocation: "end", nameGap: 20 },
      ],
      series: [
        { name: "Avg Load", type: "line", smooth: 0.35, showSymbol: false, data: detail.trends.usage.map((point) => point.avgLoad) },
        { name: "Avg Connections", type: "line", smooth: 0.35, showSymbol: false, yAxisIndex: 1, data: detail.trends.usage.map((point) => point.avgConnections) },
        { name: "Max Connections", type: "line", smooth: 0.35, showSymbol: false, yAxisIndex: 1, data: detail.trends.usage.map((point) => point.maxConnections) },
      ],
    }),
    [detail.trends.usage],
  );

  return (
    <div className="database-asset-detail__stack">
      <WidgetShell title="Usage & Workload Behavior" subtitle="Load, concurrency, and request signals">
        {!showUsageData ? (
          <p className="dashboard-note">
            {isRelationalDepth
              ? "No usage telemetry available for this resource in the selected range."
              : "Usage telemetry is limited for this service/resource in the selected range."}
          </p>
        ) : null}
        {showUsageData ? (
          <>
        <div className="database-asset-detail__mini-kpis">
          <div className="database-asset-detail__mini-kpi">
            <span>Avg Load</span>
            <strong>{formatNumber(detail.usageSummary.avgLoad)}</strong>
          </div>
          <div className="database-asset-detail__mini-kpi">
            <span>Max Load</span>
            <strong>{formatNumber(detail.usageSummary.maxLoad)}</strong>
          </div>
          <div className="database-asset-detail__mini-kpi">
            <span>Avg Connections</span>
            <strong>{formatNumber(detail.usageSummary.avgConnections)}</strong>
          </div>
          <div className="database-asset-detail__mini-kpi">
            <span>Max Connections</span>
            <strong>{formatNumber(detail.usageSummary.maxConnections)}</strong>
          </div>
          <div className="database-asset-detail__mini-kpi">
            <span>Request Count</span>
            <strong>{formatInteger(detail.usageSummary.requestCount)}</strong>
          </div>
          <div className="database-asset-detail__mini-kpi">
            <span>Workload Label</span>
            <strong>
              {getWorkloadLabel({
                avgLoad: detail.usageSummary.avgLoad,
                avgConnections: detail.usageSummary.avgConnections,
                requestCount: detail.usageSummary.requestCount,
              })}
            </strong>
          </div>
        </div>
        {hasUsageTrend ? (
          <BaseEChart option={chartOption} height={300} />
        ) : (
          <p className="dashboard-note">{DETAIL_SECTION_EMPTY_NOTE}</p>
        )}
          </>
        ) : null}
      </WidgetShell>
    </div>
  );
}
