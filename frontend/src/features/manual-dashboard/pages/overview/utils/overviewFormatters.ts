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

const DAILY_LOOKBACK_DAYS = 30;

const parsePointDateUtc = (value: string): Date | null => {
  if (!value) {
    return null;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split("-").map(Number);
    return new Date(Date.UTC(year, month - 1, day));
  }
  if (/^\d{4}-\d{2}$/.test(value)) {
    const [year, month] = value.split("-").map(Number);
    return new Date(Date.UTC(year, month - 1, 1));
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return new Date(Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate()));
};

const toIsoDateUtc = (date: Date): string => {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const formatShortDayLabel = (isoDate: string): string => {
  const parsed = parsePointDateUtc(isoDate);
  if (!parsed) {
    return isoDate;
  }
  return parsed.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
};

const formatFullDayLabel = (isoDate: string): string => {
  const parsed = parsePointDateUtc(isoDate);
  if (!parsed) {
    return isoDate;
  }
  return parsed.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
};

const buildDailyRollingPoints = (
  points: Array<{ month: string; budget: number; actual: number; forecast: number }>,
): Array<{ date: string; budget: number; actual: number; forecast: number }> => {
  const byDate = new Map<string, { budget: number; actual: number; forecast: number }>();
  for (const point of points) {
    const parsed = parsePointDateUtc(point.month);
    if (!parsed) {
      continue;
    }
    byDate.set(toIsoDateUtc(parsed), { budget: point.budget, actual: point.actual, forecast: point.forecast });
  }

  const end = new Date();
  const endUtc = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate()));
  const startUtc = new Date(endUtc);
  startUtc.setUTCDate(endUtc.getUTCDate() - (DAILY_LOOKBACK_DAYS - 1));

  const daily: Array<{ date: string; budget: number; actual: number; forecast: number }> = [];
  let lastBudget = 0;
  let lastForecast = 0;

  for (let i = 0; i < DAILY_LOOKBACK_DAYS; i += 1) {
    const cursor = new Date(startUtc);
    cursor.setUTCDate(startUtc.getUTCDate() + i);
    const key = toIsoDateUtc(cursor);
    const existing = byDate.get(key);
    if (existing) {
      lastBudget = existing.budget;
      lastForecast = existing.forecast;
      daily.push({ date: key, budget: existing.budget, actual: existing.actual, forecast: existing.forecast });
    } else {
      daily.push({ date: key, budget: lastBudget, actual: 0, forecast: lastForecast });
    }
  }

  return daily;
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
): EChartsOption => {
  const dailyPoints = buildDailyRollingPoints(points);
  const axisDates = dailyPoints.map((point) => point.date);
  const tickStep = Math.max(1, Math.ceil(axisDates.length / 8));

  return {
  color: ["#3f6ed7", "#1f8b7a", "#ca8b17"],
  tooltip: {
    trigger: "axis",
    formatter: (params: any) => {
      const seriesParams = Array.isArray(params) ? params : [params];
      const axisDate = seriesParams[0]?.axisValue as string | undefined;
      const lines = [`<div style="margin-bottom:4px;">${formatFullDayLabel(axisDate ?? "")}</div>`];

      for (const param of seriesParams) {
        lines.push(
          `${param.marker}${param.seriesName}: <strong>${currencyFormatterPrecise.format(Number(param.value ?? 0))}</strong>`,
        );
      }
      return lines.join("<br/>");
    },
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
    data: axisDates,
    name: "Date",
    nameLocation: "middle",
    nameGap: 48,
    nameTextStyle: {
      color: "#445b58",
      fontSize: 12,
      fontWeight: 600,
    },
    axisLine: { lineStyle: { color: "#d7e4df" } },
    axisTick: { alignWithLabel: true },
    axisLabel: {
      color: "#5c7370",
      fontSize: 11,
      hideOverlap: true,
      interval: (index: number) => index % tickStep !== 0,
      rotate: axisDates.length > 14 ? 35 : 0,
      margin: 12,
      formatter: (value: string) => formatShortDayLabel(value),
    },
  },
  yAxis: {
    type: "value",
    name: "Cost ($)",
    nameLocation: "middle",
    nameGap: 68,
    nameRotate: 90,
    nameTextStyle: {
      color: "#445b58",
      fontSize: 12,
      fontWeight: 600,
    },
    splitLine: { lineStyle: { color: "#e5efec" } },
    axisLine: { lineStyle: { color: "#d7e4df" } },
    axisLabel: {
      color: "#6d837e",
      fontSize: 11,
      formatter: (value: number) => currencyFormatterCompact.format(value),
    },
  },
  grid: {
    left: 74,
    right: 20,
    top: 42,
    bottom: 74,
  },
  series: [
    {
      name: "Budget",
      type: "line",
      smooth: true,
      data: dailyPoints.map((point) => point.budget),
      symbolSize: 6,
      lineStyle: { width: 2.2 },
    },
    {
      name: "Actual",
      type: "line",
      smooth: true,
      data: dailyPoints.map((point) => point.actual),
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
      data: dailyPoints.map((point) => point.forecast),
      symbolSize: 6,
      lineStyle: { width: 2.2, type: "dashed" },
    },
  ],
  };
};
