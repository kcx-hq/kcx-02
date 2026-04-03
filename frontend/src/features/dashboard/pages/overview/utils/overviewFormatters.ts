import type { EChartsOption } from "echarts";

export const currencyFormatterCompact = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 2,
});

export const currencyFormatterPrecise = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export const percentFormatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

export const parseOptionalInt = (value: string | null): number | null => {
  if (!value) {
    return null;
  }
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null;
  }
  return parsed;
};

export const parseDateValue = (value: string | null): string | null => {
  if (!value) {
    return null;
  }
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
};

export const getMonthLabel = (value: string): string => {
  const [year, month] = value.split("-");
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, 1));
  return date.toLocaleDateString("en-US", { month: "short", year: "2-digit", timeZone: "UTC" });
};

export const toSeverityTone = (severity: string): "positive" | "negative" | "accent" | "neutral" => {
  const normalized = severity.toLowerCase();
  if (normalized === "high") return "negative";
  if (normalized === "medium") return "accent";
  if (normalized === "low") return "positive";
  return "neutral";
};

export const getStatusTone = (status: string): "positive" | "negative" | "accent" | "neutral" => {
  const normalized = status.toLowerCase();
  if (normalized === "open") return "negative";
  if (normalized === "accepted" || normalized === "completed" || normalized === "resolved") return "positive";
  if (normalized === "ignored" || normalized === "dismissed") return "neutral";
  return "accent";
};

export const buildTrendOption = (
  points: Array<{ month: string; budget: number; actual: number; forecast: number }>,
): EChartsOption => ({
  color: ["#3f6ed7", "#1f8b7a", "#ca8b17"],
  tooltip: {
    trigger: "axis",
    valueFormatter: (value) => currencyFormatterPrecise.format(Number(value ?? 0)),
  },
  legend: {
    top: 0,
    icon: "roundRect",
    textStyle: { color: "#5c7370", fontSize: 11 },
    itemHeight: 6,
    itemWidth: 16,
  },
  xAxis: {
    type: "category",
    boundaryGap: false,
    data: points.map((point) => getMonthLabel(point.month)),
    axisLine: { lineStyle: { color: "#d7e4df" } },
    axisLabel: { color: "#5c7370", fontSize: 11 },
  },
  yAxis: {
    type: "value",
    splitLine: { lineStyle: { color: "#e5efec" } },
    axisLabel: {
      color: "#6d837e",
      fontSize: 11,
      formatter: (value: number) => currencyFormatterCompact.format(value),
    },
  },
  series: [
    {
      name: "Budget",
      type: "line",
      smooth: true,
      data: points.map((point) => point.budget),
      symbolSize: 6,
      lineStyle: { width: 2.2 },
    },
    {
      name: "Actual",
      type: "line",
      smooth: true,
      data: points.map((point) => point.actual),
      symbolSize: 6,
      lineStyle: { width: 2.2 },
      areaStyle: {
        color: {
          type: "linear",
          x: 0,
          y: 0,
          x2: 0,
          y2: 1,
          colorStops: [
            { offset: 0, color: "rgba(31, 139, 122, 0.22)" },
            { offset: 1, color: "rgba(31, 139, 122, 0.02)" },
          ],
        },
      },
    },
    {
      name: "Forecast",
      type: "line",
      smooth: true,
      data: points.map((point) => point.forecast),
      symbolSize: 6,
      lineStyle: { width: 2.2, type: "dashed" },
    },
  ],
});
