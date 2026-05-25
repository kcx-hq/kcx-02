import { useMemo } from "react";
import type { EChartsOption } from "echarts";

import type { DatabaseAssetDetail } from "../../../api/dashboardTypes";
import { BaseEChart } from "../../../common/charts/BaseEChart";
import { WidgetShell } from "../../../common/components";
import {
  DETAIL_SECTION_EMPTY_NOTE,
  formatBytes,
  formatNumber,
  formatPercent,
  hasMetricValue,
  isRdsAuroraService,
} from "./database-asset-detail.formatters";

type DatabaseAssetDetailPerformanceSectionProps = {
  detail: DatabaseAssetDetail;
};

export function DatabaseAssetDetailPerformanceSection({ detail }: DatabaseAssetDetailPerformanceSectionProps) {
  const isRelationalDepth = isRdsAuroraService(detail.identity.dbService, detail.identity.dbEngine);
  const hasPerformanceSummary = hasMetricValue(
    detail.usageSummary.avgCpu,
    detail.usageSummary.maxCpu,
    detail.performanceSummary.avgIops,
    detail.performanceSummary.maxIops,
    detail.performanceSummary.avgThroughputBytes,
    detail.performanceSummary.maxThroughputBytes,
  );
  const hasPerformanceTrend = detail.trends.performance.some((point) =>
    hasMetricValue(
      point.readIops,
      point.writeIops,
      point.totalIops,
      point.readThroughputBytes,
      point.writeThroughputBytes,
      point.totalThroughputBytes,
    ),
  );
  const showPerformanceData = hasPerformanceSummary || hasPerformanceTrend;

  const chartOption = useMemo<EChartsOption>(
    () => ({
      tooltip: { trigger: "axis", confine: true },
      legend: { bottom: 0, left: "center", textStyle: { fontSize: 11 } },
      grid: { left: 56, right: 18, top: 24, bottom: 48, containLabel: true },
      xAxis: { type: "category", boundaryGap: false, data: detail.trends.performance.map((point) => point.date) },
      yAxis: [
        { type: "value", name: "IOPS", nameLocation: "end", nameGap: 20 },
        { type: "value", name: "Bytes/s", nameLocation: "end", nameGap: 20 },
      ],
      series: [
        { name: "Total IOPS", type: "line", smooth: 0.35, showSymbol: false, data: detail.trends.performance.map((point) => point.totalIops) },
        { name: "Read Throughput", type: "line", smooth: 0.35, showSymbol: false, yAxisIndex: 1, data: detail.trends.performance.map((point) => point.readThroughputBytes) },
        { name: "Write Throughput", type: "line", smooth: 0.35, showSymbol: false, yAxisIndex: 1, data: detail.trends.performance.map((point) => point.writeThroughputBytes) },
      ],
    }),
    [detail.trends.performance],
  );

  return (
    <WidgetShell title="Performance Signals" subtitle="CPU, IOPS, throughput, load, and connection posture">
      {!showPerformanceData ? (
        <p className="dashboard-note">
          {isRelationalDepth
            ? "No performance telemetry available for this resource in the selected range."
            : "Performance telemetry is limited for this service/resource in the selected range."}
        </p>
      ) : null}
      {showPerformanceData ? (
        <>
      <div className="database-asset-detail__mini-kpis">
        <div className="database-asset-detail__mini-kpi">
          <span>Avg CPU</span>
          <strong>{formatPercent(detail.usageSummary.avgCpu)}</strong>
        </div>
        <div className="database-asset-detail__mini-kpi">
          <span>Max CPU</span>
          <strong>{formatPercent(detail.usageSummary.maxCpu)}</strong>
        </div>
        <div className="database-asset-detail__mini-kpi">
          <span>Avg IOPS</span>
          <strong>{formatNumber(detail.performanceSummary.avgIops)}</strong>
        </div>
        <div className="database-asset-detail__mini-kpi">
          <span>Max IOPS</span>
          <strong>{formatNumber(detail.performanceSummary.maxIops)}</strong>
        </div>
        <div className="database-asset-detail__mini-kpi">
          <span>Avg Throughput</span>
          <strong>{formatBytes(detail.performanceSummary.avgThroughputBytes)}</strong>
        </div>
        <div className="database-asset-detail__mini-kpi">
          <span>Max Throughput</span>
          <strong>{formatBytes(detail.performanceSummary.maxThroughputBytes)}</strong>
        </div>
      </div>
      {hasPerformanceTrend ? (
        <BaseEChart option={chartOption} height={300} />
      ) : (
        <p className="dashboard-note">{DETAIL_SECTION_EMPTY_NOTE}</p>
      )}
        </>
      ) : null}
    </WidgetShell>
  );
}
