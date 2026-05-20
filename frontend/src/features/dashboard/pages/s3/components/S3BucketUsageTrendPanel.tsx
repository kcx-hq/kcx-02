import { useMemo } from "react";
import type { EChartsOption } from "echarts";

import { BaseEChart } from "../../../common/charts/BaseEChart";
import type { S3BucketDetailResponse } from "../../../api/dashboardApi";

type Props = {
  charts: S3BucketDetailResponse["charts"] | undefined;
  isLoading?: boolean;
  isError?: boolean;
  errorMessage?: string;
};

const numberFormatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const countFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 0,
});

const xAxisFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "2-digit",
  timeZone: "UTC",
});

const SERIES_COLORS: Record<string, string> = {
  storage: "#2f8f78",
  transfer: "#2f72b7",
  request: "#b48a2f",
};

const SERIES_ORDER: Array<{ key: "storage" | "request" | "transfer"; label: string; yAxisName: string }> = [
  { key: "storage", label: "Storage Usage vs Date", yAxisName: "Storage (GB)" },
  { key: "request", label: "Request Usage vs Date", yAxisName: "Requests (Count)" },
  { key: "transfer", label: "Transfer Usage vs Date", yAxisName: "Transfer (GB)" },
];

export function S3BucketUsageTrendPanel({ charts, isLoading = false, isError = false, errorMessage }: Props) {
  const labels = useMemo(() => {
    const source = charts?.storageUsage ?? charts?.requestUsage ?? charts?.transferUsage ?? [];
    return source.map((item) => {
      const label = String(item.date ?? "");
      const parsed = new Date(`${label}T00:00:00.000Z`);
      return Number.isNaN(parsed.getTime()) ? label : xAxisFormatter.format(parsed);
    });
  }, [charts?.requestUsage, charts?.storageUsage, charts?.transferUsage]);

  const seriesByType = useMemo(() => {
    const storage = (charts?.storageUsage ?? []).map((item) => (item.value == null ? null : Number(item.value)));
    const request = (charts?.requestUsage ?? []).map((item) => (item.value == null ? null : Number(item.value)));
    const transfer = (charts?.transferUsage ?? []).map((item) => (item.value == null ? null : Number(item.value)));
    return new Map<"storage" | "request" | "transfer", Array<number | null>>([
      ["storage", storage],
      ["request", request],
      ["transfer", transfer],
    ]);
  }, [charts?.requestUsage, charts?.storageUsage, charts?.transferUsage]);

  const chartItems = useMemo(
    () =>
      SERIES_ORDER.map((entry) => {
        const values = seriesByType.get(entry.key) ?? [];
        const valueFormatter = entry.key === "request" ? countFormatter : numberFormatter;
        const option: EChartsOption = {
          tooltip: {
            trigger: "axis",
            valueFormatter: (value: unknown) => valueFormatter.format(Number(value ?? 0)),
          },
          grid: { left: 40, right: 10, top: 20, bottom: 30, containLabel: true },
          xAxis: {
            type: "category",
            name: "Date",
            nameLocation: "middle",
            nameGap: 32,
            nameTextStyle: { color: "#6d837e", fontSize: 11 },
            data: labels,
            axisLine: { lineStyle: { color: "#d7e4df" } },
            axisLabel: { color: "#5c7370", fontSize: 11, hideOverlap: true, margin: 14 },
          },
          yAxis: {
            type: "value",
            name: entry.yAxisName,
            nameLocation: "middle",
            nameRotate: 90,
            nameGap: 52,
            nameTextStyle: { color: "#6d837e", fontSize: 11 },
            splitLine: { show: true, lineStyle: { color: "#e1eae7", type: "solid", width: 1 } },
            axisLabel: {
              color: "#6d837e",
              fontSize: 11,
              formatter: (value: number) => valueFormatter.format(value),
            },
          },
          series: [
            {
              name: entry.label.replace(" Usage vs Date", ""),
              type: "line",
              smooth: true,
              showSymbol: labels.length <= 60,
              symbolSize: 5,
              lineStyle: { width: 2.3, color: SERIES_COLORS[entry.key] },
              itemStyle: { color: SERIES_COLORS[entry.key] },
              data: values,
            },
          ],
        };
        return { ...entry, values, option };
      }),
    [labels, seriesByType],
  );

  const hasChartData = labels.length > 0 && chartItems.some((item) => item.values.some((value) => Number(value ?? 0) > 0));

  return (
    <section className="cost-explorer-chart-panel s3-overview-chart-panel s3-bucket-usage-trend-panel" aria-label="Bucket usage vs date">
      <div className="cost-explorer-chart-panel__body">
        {isLoading ? (
          <div className="cost-explorer-chart-skeleton" style={{ minHeight: "360px" }} />
        ) : isError ? (
          <div className="dashboard-empty-state-block">
            <p className="dashboard-empty-state-block__title">Could not load usage trend</p>
            <p className="dashboard-empty-state-block__message">{errorMessage ?? "Something went wrong while loading this chart."}</p>
          </div>
        ) : hasChartData ? (
          <div className="s3-bucket-usage-trend-panel__stack">
            {chartItems.map((item) => (
              <article key={item.key} className="s3-bucket-usage-trend-panel__item">
                <h3 className="s3-bucket-usage-trend-panel__item-title">{item.label}</h3>
                <BaseEChart option={item.option} height={230} />
              </article>
            ))}
          </div>
        ) : (
          <div className="dashboard-empty-state-block">
            <p className="dashboard-empty-state-block__title">No usage trend data</p>
            <p className="dashboard-empty-state-block__message">No storage, transfer, or request usage data is available for this bucket.</p>
          </div>
        )}
      </div>
    </section>
  );
}
