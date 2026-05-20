import { useMemo } from "react";
import type { EChartsOption } from "echarts";
import type { CallbackDataParams } from "echarts/types/dist/shared";

import { BaseEChart } from "../../../common/charts/BaseEChart";
import type { S3BucketDetailResponse } from "../../../api/dashboardApi";

type Props = {
  filtersApplied?: S3BucketDetailResponse["filtersApplied"] | undefined;
  charts: S3BucketDetailResponse["charts"] | undefined;
  isLoading?: boolean;
  isError?: boolean;
  errorMessage?: string;
};

const numberFormatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const tinyMoneyFormatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 7,
});
const countFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 0,
});

const xAxisFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "2-digit",
  timeZone: "UTC",
});

const tooltipDateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "2-digit",
  year: "numeric",
  timeZone: "UTC",
});

const SERIES_COLORS = {
  storage: "#2f8f78",
  request: "#5f8fdc",
  transfer: "#8a6fd0",
  other: "#d6a546",
} as const;

type TrendRow = {
  date: string;
  storageCost: number;
  requestCost: number;
  transferCost: number;
  otherCost: number;
  totalCost: number;
};

const DAY_MS = 24 * 60 * 60 * 1000;

const parseUtcDate = (value: string | undefined | null): Date | null => {
  if (!value) return null;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
};

const toIsoDate = (value: Date): string => value.toISOString().slice(0, 10);

const toMoney = (value: number): string => {
  const numericValue = Number(value ?? 0);
  if (numericValue === 0) return "$0.00";
  const absoluteValue = Math.abs(numericValue);
  if (absoluteValue >= 0.01) return `$${numberFormatter.format(numericValue)}`;
  return `$${tinyMoneyFormatter.format(numericValue)}`;
};

const computeYAxis = (maxTotal: number) => {
  if (maxTotal <= 0) {
    return { max: 0.1, interval: 0.02, decimals: 2 };
  }
  if (maxTotal < 0.1) {
    return { max: 0.1, interval: 0.02, decimals: 2 };
  }
  if (maxTotal < 1) {
    return { max: Math.ceil(maxTotal * 20) / 20, interval: 0.05, decimals: 2 };
  }
  if (maxTotal < 10) {
    return { max: Math.ceil(maxTotal * 2) / 2, interval: 0.5, decimals: 2 };
  }
  const rough = maxTotal / 5;
  const power = 10 ** Math.floor(Math.log10(rough));
  const normalized = rough / power;
  const step = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  const interval = step * power;
  const max = Math.ceil(maxTotal / interval) * interval;
  return { max, interval, decimals: 0 };
};

export function S3BucketUsageTrendPanel({ filtersApplied, charts, isLoading = false, isError = false, errorMessage }: Props) {
  const trendRows = useMemo<TrendRow[]>(() => {
    const source = charts?.costTrend ?? [];
    if (source.length === 0) return [];

    const byDate = new Map<string, TrendRow>();
    for (const row of source) {
      const key = String(row.date ?? "");
      if (!key) continue;
      const existing = byDate.get(key) ?? {
        date: key,
        storageCost: 0,
        requestCost: 0,
        transferCost: 0,
        otherCost: 0,
        totalCost: 0,
      };
      existing.storageCost += Number(row.storageCost ?? 0);
      existing.requestCost += Number(row.requestCost ?? 0);
      existing.transferCost += Number(row.transferCost ?? 0);
      existing.otherCost += Number(row.otherCost ?? 0);
      byDate.set(key, existing);
    }

    const scopeFrom = parseUtcDate(filtersApplied?.from);
    const scopeTo = parseUtcDate(filtersApplied?.to);
    const sortedKnownDates = [...byDate.keys()].sort();
    const fallbackFrom = parseUtcDate(sortedKnownDates[0]);
    const fallbackTo = parseUtcDate(sortedKnownDates[sortedKnownDates.length - 1]);
    const fromDate = scopeFrom ?? fallbackFrom;
    const toDate = scopeTo ?? fallbackTo;
    if (!fromDate || !toDate || fromDate.getTime() > toDate.getTime()) return [];

    const rows: TrendRow[] = [];
    for (let time = fromDate.getTime(); time <= toDate.getTime(); time += DAY_MS) {
      const iso = toIsoDate(new Date(time));
      const row = byDate.get(iso) ?? {
        date: iso,
        storageCost: 0,
        requestCost: 0,
        transferCost: 0,
        otherCost: 0,
        totalCost: 0,
      };
      row.totalCost = row.storageCost + row.requestCost + row.transferCost + row.otherCost;
      rows.push(row);
    }
    return rows;
  }, [charts?.costTrend, filtersApplied?.from, filtersApplied?.to]);

  const labels = useMemo(() => trendRows.map((item) => xAxisFormatter.format(new Date(`${item.date}T00:00:00.000Z`))), [trendRows]);

  const series = useMemo(() => {
    return {
      storage: trendRows.map((row) => row.storageCost),
      request: trendRows.map((row) => row.requestCost),
      transfer: trendRows.map((row) => row.transferCost),
      other: trendRows.map((row) => row.otherCost),
    };
  }, [trendRows]);

  const maxTotalCost = useMemo(() => trendRows.reduce((max, row) => Math.max(max, row.totalCost), 0), [trendRows]);
  const yAxisScale = useMemo(() => computeYAxis(maxTotalCost), [maxTotalCost]);
  const hasAnyNonZeroCost = useMemo(() => trendRows.some((row) => row.totalCost > 0), [trendRows]);

  const option = useMemo<EChartsOption>(() => ({
    tooltip: {
      trigger: "axis",
      axisPointer: { type: "shadow" },
      formatter: (rawParams: unknown) => {
        const params = (Array.isArray(rawParams) ? rawParams : []) as CallbackDataParams[];
        const dataIndex = Number(params[0]?.dataIndex ?? -1);
        const day = trendRows[dataIndex];
        if (!day) return "";
        const dateLabel = tooltipDateFormatter.format(new Date(`${day.date}T00:00:00.000Z`));
        return [
          `<div style="font-size:12px;font-weight:600;color:#1f3140;margin-bottom:6px;">${dateLabel}</div>`,
          `<div style="display:flex;justify-content:space-between;gap:16px;"><span style="color:${SERIES_COLORS.storage};">● Storage Cost</span><strong>${toMoney(day.storageCost)}</strong></div>`,
          `<div style="display:flex;justify-content:space-between;gap:16px;"><span style="color:${SERIES_COLORS.request};">● Request Cost</span><strong>${toMoney(day.requestCost)}</strong></div>`,
          `<div style="display:flex;justify-content:space-between;gap:16px;"><span style="color:${SERIES_COLORS.transfer};">● Data Transfer Cost</span><strong>${toMoney(day.transferCost)}</strong></div>`,
          `<div style="display:flex;justify-content:space-between;gap:16px;"><span style="color:${SERIES_COLORS.other};">● Other Cost</span><strong>${toMoney(day.otherCost)}</strong></div>`,
          `<div style="border-top:1px solid #e6edf1;margin-top:6px;padding-top:6px;display:flex;justify-content:space-between;gap:16px;"><span style="color:#4f6573;">Total</span><strong>${toMoney(day.totalCost)}</strong></div>`,
        ].join("");
      },
    },
    legend: {
      bottom: 0,
      itemWidth: 10,
      itemHeight: 10,
      icon: "roundRect",
      textStyle: { color: "#5a6a74", fontSize: 12 },
      data: ["Storage Cost", "Request Cost", "Data Transfer Cost", "Other Cost"],
    },
    grid: { left: 44, right: 12, top: 24, bottom: 44, containLabel: true },
    xAxis: {
      type: "category",
      data: labels,
      axisLine: { lineStyle: { color: "#d7e4df" } },
      axisLabel: { color: "#5c7370", fontSize: 11, hideOverlap: true, margin: 14 },
    },
    yAxis: {
      type: "value",
      min: 0,
      max: yAxisScale.max,
      interval: yAxisScale.interval,
      axisLabel: {
        color: "#6d837e",
        fontSize: 11,
        formatter: (value: number) => toMoney(value),
      },
      splitLine: { show: true, lineStyle: { color: "#e1eae7", type: "solid", width: 1 } },
    },
    series: [
      { name: "Storage Cost", type: "bar", stack: "total", data: series.storage, itemStyle: { color: SERIES_COLORS.storage }, barMaxWidth: 22 },
      { name: "Request Cost", type: "bar", stack: "total", data: series.request, itemStyle: { color: SERIES_COLORS.request }, barMaxWidth: 22 },
      { name: "Data Transfer Cost", type: "bar", stack: "total", data: series.transfer, itemStyle: { color: SERIES_COLORS.transfer }, barMaxWidth: 22 },
      { name: "Other Cost", type: "bar", stack: "total", data: series.other, itemStyle: { color: SERIES_COLORS.other }, barMaxWidth: 22 },
    ],
  }), [labels, series.other, series.request, series.storage, series.transfer, trendRows, yAxisScale.interval, yAxisScale.max]);

  const hasDateCoverage = trendRows.length > 0;

  return (
    <section className="cost-explorer-chart-panel s3-overview-chart-panel s3-bucket-usage-trend-panel" aria-label="Cost trend">
      <div className="cost-explorer-chart-panel__body">
        {isLoading ? (
          <div className="cost-explorer-chart-skeleton" style={{ minHeight: "360px" }} />
        ) : isError ? (
          <div className="dashboard-empty-state-block">
            <p className="dashboard-empty-state-block__title">Could not load cost trend</p>
            <p className="dashboard-empty-state-block__message">{errorMessage ?? "Something went wrong while loading this chart."}</p>
          </div>
        ) : hasDateCoverage && hasAnyNonZeroCost ? (
          <BaseEChart option={option} height={290} />
        ) : (
          <div className="dashboard-empty-state-block">
            <p className="dashboard-empty-state-block__title">No S3 cost data available for this bucket in the selected date range.</p>
            <p className="dashboard-empty-state-block__message">Try a different date range or verify S3 cost category data ingestion.</p>
          </div>
        )}
      </div>
    </section>
  );
}
