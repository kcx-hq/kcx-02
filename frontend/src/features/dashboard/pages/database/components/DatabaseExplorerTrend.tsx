import { useMemo } from "react";
import type { EChartsOption } from "echarts";

import { BaseEChart } from "../../../common/charts/BaseEChart";
import { EmptyStateBlock, WidgetShell } from "../../../common/components";
import type {
  DatabaseExplorerCostTrendItem,
  DatabaseExplorerMetric,
  DatabaseExplorerResponse,
  DatabaseExplorerUsageTrendItem,
} from "../../../api/dashboardTypes";
import { asFiniteOrZero, formatCompactCurrency, formatCurrency, formatNumber } from "./databaseExplorer.formatters";

type DatabaseExplorerTrendProps = {
  metric: DatabaseExplorerMetric;
  trend: DatabaseExplorerResponse["trend"];
  isLoading?: boolean;
};

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "2-digit",
  timeZone: "UTC",
});

const toDateLabel = (value: string): string => {
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? value : dateFormatter.format(parsed);
};

const isCostTrendItem = (item: DatabaseExplorerResponse["trend"][number]): item is DatabaseExplorerCostTrendItem =>
  "compute" in item;

const isUsageTrendItem = (item: DatabaseExplorerResponse["trend"][number]): item is DatabaseExplorerUsageTrendItem =>
  "load" in item;

export function DatabaseExplorerTrend({ metric, trend, isLoading = false }: DatabaseExplorerTrendProps) {
  const activeTrend = useMemo(
    () => (metric === "usage" ? trend.filter(isUsageTrendItem) : trend.filter(isCostTrendItem)),
    [metric, trend],
  );
  const labels = useMemo(() => activeTrend.map((item) => toDateLabel(item.date)), [activeTrend]);

  const option = useMemo<EChartsOption>(() => {
    if (metric === "usage") {
      const usageTrend = activeTrend.filter(isUsageTrendItem);
      return {
        color: ["#2f8f88", "#3f68c6"],
        tooltip: {
          trigger: "axis",
          valueFormatter: (value: unknown) => formatNumber(value),
        },
        legend: {
          top: 0,
          icon: "roundRect",
          itemHeight: 6,
          itemWidth: 18,
          textStyle: { color: "#58706d", fontSize: 11 },
        },
        grid: { left: 10, right: 10, top: 36, bottom: 14, containLabel: true },
        xAxis: {
          type: "category",
          boundaryGap: false,
          data: labels,
          axisLine: { lineStyle: { color: "#d7e4df" } },
          axisLabel: { color: "#5c7370", fontSize: 11, hideOverlap: true, rotate: labels.length > 24 ? 28 : 0 },
        },
        yAxis: {
          type: "value",
          axisLine: { show: false },
          splitLine: { lineStyle: { color: "#e1eae7", type: "dashed" } },
          axisLabel: { color: "#6d837e", fontSize: 11 },
        },
        dataZoom: labels.length > 45 ? [{ type: "inside", start: 0, end: 100 }] : undefined,
        series: [
          {
            name: "Load",
            type: "line",
            smooth: true,
            showSymbol: labels.length <= 35,
            symbolSize: 5,
            lineStyle: { width: 2.2 },
            areaStyle: { opacity: 0.08 },
            data: usageTrend.map((item) => item.load ?? null),
          },
          {
            name: "Connections",
            type: "line",
            smooth: true,
            showSymbol: labels.length <= 35,
            symbolSize: 5,
            lineStyle: { width: 2.2 },
            data: usageTrend.map((item) => item.connections ?? null),
          },
        ],
      };
    }

    const costTrend = activeTrend.filter(isCostTrendItem);
    return {
      color: ["#3f68c6", "#2f8f88", "#b45309", "#7e22ce"],
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "shadow" },
        formatter: (raw: unknown) => {
          const points = (Array.isArray(raw) ? raw : []) as Array<{
            axisValueLabel?: string;
            seriesName: string;
            value: number;
            marker: string;
            dataIndex: number;
          }>;

          if (!points.length) return "";
          const row = costTrend[points[0]?.dataIndex ?? 0];
          const total = row ? asFiniteOrZero(row.total) : points.reduce((sum, point) => sum + asFiniteOrZero(point.value), 0);
          const rows = points
            .map(
              (point) =>
                `<div style="display:flex;justify-content:space-between;gap:10px;margin-top:4px;">${point.marker}<span>${point.seriesName}</span><strong>${formatCurrency(point.value)}</strong></div>`,
            )
            .join("");

          return `<div style="min-width:190px;"><div style="font-weight:600;margin-bottom:4px;">${points[0]?.axisValueLabel ?? ""}</div>${rows}<div style="margin-top:6px;padding-top:6px;border-top:1px solid rgba(148,163,184,0.3);display:flex;justify-content:space-between;gap:10px;"><span>Total</span><strong>${formatCurrency(total)}</strong></div></div>`;
        },
      },
      legend: {
        top: 0,
        icon: "roundRect",
        itemHeight: 6,
        itemWidth: 18,
        textStyle: { color: "#58706d", fontSize: 11 },
      },
      grid: { left: 10, right: 10, top: 36, bottom: 14, containLabel: true },
      xAxis: {
        type: "category",
        data: labels,
        axisLine: { lineStyle: { color: "#d7e4df" } },
        axisLabel: { color: "#5c7370", fontSize: 11, hideOverlap: true, rotate: labels.length > 24 ? 28 : 0 },
      },
      yAxis: {
        type: "value",
        axisLine: { show: false },
        splitLine: { lineStyle: { color: "#e1eae7", type: "dashed" } },
        axisLabel: {
          color: "#6d837e",
          fontSize: 11,
          formatter: (value: number) => formatCompactCurrency(value),
        },
      },
      dataZoom: labels.length > 45 ? [{ type: "inside", start: 0, end: 100 }] : undefined,
      series: [
        { name: "Compute", key: "compute" },
        { name: "Storage", key: "storage" },
        { name: "IO", key: "io" },
        { name: "Backup", key: "backup" },
      ].map((series) => ({
        name: series.name,
        type: "bar",
        stack: "database-cost",
        barMaxWidth: 28,
        itemStyle: { borderRadius: 0 },
        data: costTrend.map(
          (item) =>
            item[
              series.key as keyof Pick<DatabaseExplorerCostTrendItem, "compute" | "storage" | "io" | "backup">
            ],
        ),
      })),
    };
  }, [activeTrend, labels, metric]);

  const title = metric === "usage" ? "Database Usage Trend" : "Database Cost Trend";
  const subtitle = metric === "usage" ? "Daily load and connections" : "Daily cost by compute, storage, IO, and backup";
  const chartReady = activeTrend.length > 0;

  return (
    <WidgetShell title={title} subtitle={subtitle}>
      {isLoading ? (
        <div className="cost-explorer-chart-skeleton" style={{ minHeight: 420 }} aria-hidden="true" />
      ) : chartReady ? (
        <BaseEChart option={option} height={420} />
      ) : (
        <EmptyStateBlock title="No data available" message="No database trend rows are available for the selected filters." />
      )}
    </WidgetShell>
  );
}

