import { useMemo } from "react";
import type { EChartsOption } from "echarts";

import { BaseEChart } from "../../../common/charts/BaseEChart";
import { EmptyStateBlock, WidgetShell } from "../../../common/components";
import type {
  DatabaseExplorerGroupBy,
  DatabaseExplorerCostTrendItem,
  DatabaseExplorerMetric,
  DatabaseExplorerResponse,
  DatabaseExplorerTrendGrouped,
  DatabaseExplorerUsageTrendItem,
} from "../../../api/dashboardTypes";
import { asFiniteOrZero, formatCompactCurrency, formatCurrency, formatNumber } from "./databaseExplorer.formatters";

type DatabaseExplorerTrendProps = {
  metric: DatabaseExplorerMetric;
  groupBy: DatabaseExplorerGroupBy;
  trend: DatabaseExplorerResponse["trend"];
  trendGrouped?: DatabaseExplorerTrendGrouped;
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

const toGroupByLabel = (groupBy: DatabaseExplorerGroupBy): string => {
  if (groupBy === "db_service") return "DB Service";
  if (groupBy === "db_engine") return "DB Engine";
  if (groupBy === "resource_type") return "Resource Type";
  if (groupBy === "instance_class") return "Instance Class";
  if (groupBy === "cluster") return "Cluster";
  if (groupBy === "cost_category") return "Cost Category";
  return "Region";
};

export function DatabaseExplorerTrend({ metric, groupBy, trend, trendGrouped, isLoading = false }: DatabaseExplorerTrendProps) {
  const activeTrend = useMemo(
    () => (metric === "usage" ? trend.filter(isUsageTrendItem) : trend.filter(isCostTrendItem)),
    [metric, trend],
  );
  const activeGrouped = useMemo(() => {
    if (!trendGrouped) return null;
    if (trendGrouped.metric !== metric) return null;
    if (!Array.isArray(trendGrouped.series) || trendGrouped.series.length === 0) return null;
    return trendGrouped;
  }, [metric, trendGrouped]);
  const labels = useMemo(() => activeTrend.map((item) => item.date), [activeTrend]);
  const groupedLabels = useMemo(() => {
    if (!activeGrouped) return [];
    const set = new Set<string>();
    for (const series of activeGrouped.series) {
      for (const point of series.data ?? []) {
        if (typeof point?.date === "string" && point.date.trim().length > 0) set.add(point.date);
      }
    }
    return [...set].sort((left, right) => left.localeCompare(right));
  }, [activeGrouped]);

  const option = useMemo<EChartsOption>(() => {
    if (activeGrouped) {
      const numberFormatter = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });
      const currencyFormatter = new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 2,
      });
      return {
        tooltip: {
          trigger: "axis",
          valueFormatter: (value: unknown) => {
            const numeric = asFiniteOrZero(value);
            if (metric === "cost") return currencyFormatter.format(numeric);
            return numberFormatter.format(numeric);
          },
        },
        legend: {
          top: 0,
          icon: "roundRect",
          itemHeight: 6,
          itemWidth: 18,
          textStyle: { color: "#58706d", fontSize: 11 },
          type: "scroll",
        },
        grid: { left: 10, right: 18, top: 36, bottom: 14, containLabel: true },
        xAxis: {
          type: "category",
          data: groupedLabels,
          boundaryGap: metric === "cost",
          axisLine: { lineStyle: { color: "#d7e4df" } },
          axisLabel: {
            color: "#5c7370",
            fontSize: 11,
            hideOverlap: true,
            rotate: groupedLabels.length > 24 ? 28 : 0,
            formatter: (value: string) => toDateLabel(value),
            showMinLabel: true,
            showMaxLabel: true,
          },
        },
        yAxis: {
          type: "value",
          axisLine: { show: false },
          splitLine: { lineStyle: { color: "#e1eae7", type: "dashed" } },
          axisLabel: {
            color: "#6d837e",
            fontSize: 11,
            formatter: metric === "cost" ? (value: number) => formatCompactCurrency(value) : undefined,
          },
        },
        dataZoom: groupedLabels.length > 45 ? [{ type: "inside", start: 0, end: 100 }] : undefined,
        series: activeGrouped.series.map((series) => {
          const valueByDate = new Map(
            (Array.isArray(series.data) ? series.data : []).map((point) => [point.date, asFiniteOrZero(point.value)]),
          );
          return {
            name: series.label || series.key,
            type: metric === "cost" ? "bar" : "line",
            smooth: metric === "usage",
            stack: metric === "cost" ? "database-grouped-cost" : undefined,
            showSymbol: metric === "usage" ? groupedLabels.length <= 35 : false,
            symbolSize: metric === "usage" ? 5 : undefined,
            barMaxWidth: metric === "cost" ? 28 : undefined,
            data: groupedLabels.map((date) => valueByDate.get(date) ?? 0),
          };
        }),
      };
    }

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
        grid: { left: 10, right: 18, top: 36, bottom: 14, containLabel: true },
        xAxis: {
          type: "category",
          boundaryGap: false,
          data: labels,
          axisLine: { lineStyle: { color: "#d7e4df" } },
          axisLabel: {
            color: "#5c7370",
            fontSize: 11,
            hideOverlap: true,
            rotate: labels.length > 24 ? 28 : 0,
            formatter: (value: string) => toDateLabel(value),
            showMinLabel: true,
            showMaxLabel: true,
          },
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

          const axisLabel = points[0]?.axisValueLabel ? toDateLabel(points[0].axisValueLabel) : "";
          return `<div style="min-width:190px;"><div style="font-weight:600;margin-bottom:4px;">${axisLabel}</div>${rows}<div style="margin-top:6px;padding-top:6px;border-top:1px solid rgba(148,163,184,0.3);display:flex;justify-content:space-between;gap:10px;"><span>Total</span><strong>${formatCurrency(total)}</strong></div></div>`;
        },
      },
      legend: {
        top: 0,
        icon: "roundRect",
        itemHeight: 6,
        itemWidth: 18,
        textStyle: { color: "#58706d", fontSize: 11 },
      },
      grid: { left: 10, right: 18, top: 36, bottom: 14, containLabel: true },
      xAxis: {
        type: "category",
        data: labels,
        axisLine: { lineStyle: { color: "#d7e4df" } },
        axisLabel: {
          color: "#5c7370",
          fontSize: 11,
          hideOverlap: true,
          rotate: labels.length > 24 ? 28 : 0,
          formatter: (value: string) => toDateLabel(value),
          showMinLabel: true,
          showMaxLabel: true,
        },
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
  }, [activeGrouped, activeTrend, groupedLabels, labels, metric]);

  const title = metric === "usage" ? "Database Usage Trend" : "Database Cost Trend";
  const subtitle = `Daily ${metric === "usage" ? "load" : "cost"} segmented by ${toGroupByLabel(groupBy)}`;
  const chartReady = activeGrouped ? groupedLabels.length > 0 && activeGrouped.series.length > 0 : activeTrend.length > 0;

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

