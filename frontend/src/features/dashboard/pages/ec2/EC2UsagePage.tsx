import { useMemo, useState } from "react";
import type { EChartsOption } from "echarts";

import { BaseEChart } from "../../common/charts/BaseEChart";
import { DashboardPageHeader } from "../../components/DashboardPageHeader";
import { DashboardSection } from "../../components/DashboardSection";
import { useEc2InstanceUsageQuery } from "../../hooks/useDashboardQueries";

const integerFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 0,
});

const decimalFormatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

type Granularity = "daily" | "weekly" | "monthly";
type XAxis = "short" | "long" | "iso-date";
type YAxis = "instance-count" | "cumulative";
type Metric = "instance-count" | "moving-average";
type ChartType = "bar" | "line";
type Category = "none" | "region" | "instance_type" | "reservation_type";

type UsageItem = {
  date: string;
  category: string | null;
  value: number;
};

const CATEGORY_LABEL: Record<Category, string> = {
  none: "No Grouping",
  region: "Region",
  instance_type: "Instance Type",
  reservation_type: "Reservation Type",
};

const RESERVATION_SERIES_ORDER = ["on_demand", "reserved", "savings_plan", "spot"] as const;

const RESERVATION_SERIES_LABEL: Record<(typeof RESERVATION_SERIES_ORDER)[number], string> = {
  on_demand: "On-Demand",
  reserved: "Reserved",
  savings_plan: "Savings Plan",
  spot: "Spot",
};

const SERIES_PALETTE = [
  "#2f8f88",
  "#3f68c6",
  "#a05fd1",
  "#da6f40",
  "#1f9d55",
  "#cc5a5a",
  "#5b73a8",
  "#8b6f4d",
];

const toDate = (value: string): Date => new Date(`${value}T00:00:00.000Z`);

const formatMonthKey = (date: Date): string =>
  `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;

const formatDateLabel = (usageDate: string): { short: string; long: string } => {
  const date = toDate(usageDate);
  return {
    short: date.toLocaleDateString("en-US", { month: "short", day: "2-digit", timeZone: "UTC" }),
    long: date.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" }),
  };
};

const getWeekStart = (usageDate: string): string => {
  const date = toDate(usageDate);
  const day = date.getUTCDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  date.setUTCDate(date.getUTCDate() + mondayOffset);
  return date.toISOString().slice(0, 10);
};

const rollingAverage = (values: number[], windowSize: number): number[] =>
  values.map((_, index) => {
    const start = Math.max(0, index - (windowSize - 1));
    const window = values.slice(start, index + 1);
    const total = window.reduce((sum, value) => sum + value, 0);
    return window.length > 0 ? total / window.length : 0;
  });

const toCumulative = (values: number[]): number[] => {
  let running = 0;
  return values.map((value) => {
    running += value;
    return running;
  });
};

export default function EC2UsagePage() {
  const [granularity, setGranularity] = useState<Granularity>("daily");
  const [xAxis, setXAxis] = useState<XAxis>("short");
  const [yAxis, setYAxis] = useState<YAxis>("instance-count");
  const [metric, setMetric] = useState<Metric>("instance-count");
  const [chartType, setChartType] = useState<ChartType>("bar");
  const [category, setCategory] = useState<Category>("none");

  const query = useEc2InstanceUsageQuery({ category });
  const baseItems = (query.data?.items ?? []) as UsageItem[];

  const aggregatedSeries = useMemo(() => {
    const bucketKeys = new Set<string>();
    const seriesByName = new Map<string, Map<string, number>>();

    const toBucket = (dateValue: string): string =>
      granularity === "daily"
        ? dateValue
        : granularity === "weekly"
          ? getWeekStart(dateValue)
          : formatMonthKey(toDate(dateValue));

    baseItems.forEach((item) => {
      const bucket = toBucket(item.date);
      bucketKeys.add(bucket);
      const seriesName =
        category === "none"
          ? "Instance Count"
          : category === "reservation_type"
            ? RESERVATION_SERIES_LABEL[(item.category ?? "on_demand") as keyof typeof RESERVATION_SERIES_LABEL] ??
              RESERVATION_SERIES_LABEL.on_demand
            : item.category ?? "Unspecified";
      if (!seriesByName.has(seriesName)) {
        seriesByName.set(seriesName, new Map<string, number>());
      }
      const bucketMap = seriesByName.get(seriesName);
      if (!bucketMap) return;
      bucketMap.set(bucket, (bucketMap.get(bucket) ?? 0) + item.value);
    });

    const labels = [...bucketKeys].sort((left, right) => left.localeCompare(right));
    const allSeries = [...seriesByName.entries()].map(([name, bucketMap]) => {
      const rawValues = labels.map((label) => bucketMap.get(label) ?? 0);
      const metricValues =
        metric === "instance-count"
          ? rawValues
          : rollingAverage(rawValues, granularity === "daily" ? 7 : 3);
      const values = yAxis === "cumulative" ? toCumulative(metricValues) : metricValues;
      return { name, values };
    });

    const reservationSeries =
      category === "reservation_type"
        ? RESERVATION_SERIES_ORDER.map((key) => {
            const name = RESERVATION_SERIES_LABEL[key];
            return allSeries.find((seriesItem) => seriesItem.name === name) ?? {
              name,
              values: Array(labels.length).fill(0),
            };
          })
        : allSeries;

    const series =
      category === "none"
        ? reservationSeries.slice(0, 1)
        : category === "reservation_type"
          ? reservationSeries
          : reservationSeries.sort((left, right) => left.name.localeCompare(right.name));

    return { labels, series };
  }, [baseItems, category, granularity, metric, yAxis]);

  const labels = aggregatedSeries.labels;
  const series = aggregatedSeries.series;
  const chartReady = labels.length > 0 && series.some((item) => item.values.some((value) => value > 0));

  const chartOption = useMemo<EChartsOption>(
    () => ({
      tooltip: {
        trigger: "axis",
        axisPointer: { type: chartType === "bar" ? "shadow" : "line" },
        valueFormatter: (value) =>
          yAxis === "cumulative"
            ? integerFormatter.format(Number(value ?? 0))
            : decimalFormatter.format(Number(value ?? 0)),
      },
      legend: {
        show: category !== "none",
        top: 0,
      },
      grid: {
        left: 12,
        right: 12,
        top: category === "none" ? 28 : 46,
        bottom: 20,
        containLabel: true,
      },
      xAxis: {
        type: "category",
        data: labels.map((label) => {
          if (xAxis === "iso-date") return label;
          if (granularity === "monthly") {
            const monthDate = new Date(`${label}-01T00:00:00.000Z`);
            return monthDate.toLocaleDateString("en-US", {
              month: xAxis === "short" ? "short" : "long",
              year: "numeric",
              timeZone: "UTC",
            });
          }
          const dateLabel = formatDateLabel(label);
          return xAxis === "short" ? dateLabel.short : dateLabel.long;
        }),
        axisLabel: {
          color: "#48605f",
          fontSize: 12,
        },
        axisTick: { show: false },
      },
      yAxis: {
        type: "value",
        name: yAxis === "cumulative" ? "Cumulative Instances" : "Instances",
        nameGap: 14,
        axisLabel: {
          color: "#48605f",
          formatter: (value: number) =>
            yAxis === "cumulative" ? integerFormatter.format(value) : decimalFormatter.format(value),
        },
        splitLine: {
          lineStyle: {
            color: "rgba(80, 125, 123, 0.16)",
          },
        },
      },
      series: series.map((seriesEntry, index) => {
        const color = SERIES_PALETTE[index % SERIES_PALETTE.length];
        return {
          name: seriesEntry.name,
          type: chartType,
          stack: chartType === "bar" && category !== "none" ? "category-group" : undefined,
          barMaxWidth: chartType === "bar" ? 24 : undefined,
          smooth: chartType === "line",
          symbol: chartType === "line" ? "circle" : "none",
          lineStyle: chartType === "line" ? { width: 2.6 } : undefined,
          areaStyle: chartType === "line" && category === "none" ? { color: `${color}20` } : undefined,
          itemStyle: {
            color,
            borderRadius: chartType === "bar" ? [4, 4, 0, 0] : 0,
          },
          data: seriesEntry.values,
        };
      }),
    }),
    [category, chartType, granularity, labels, series, xAxis, yAxis],
  );

  const activeFilters = [
    `Granularity: ${granularity}`,
    `xAxis: ${xAxis}`,
    `yAxis: ${yAxis}`,
    `Category: ${CATEGORY_LABEL[category]}`,
    `Metrics: ${metric}`,
    `Chart: ${chartType}`,
  ];

  const clearAll = () => {
    setGranularity("daily");
    setXAxis("short");
    setYAxis("instance-count");
    setCategory("none");
    setMetric("instance-count");
    setChartType("bar");
  };

  return (
    <div className="dashboard-page">
      <DashboardPageHeader title="EC2 Instance Usage" />

      <DashboardSection
        title="EC2 Instance Usage"
        description="Daily count of running EC2 instances with optional category grouping."
      >
        <div className="optimization-rightsizing-filters optimization-idle-filters">
          <div className="optimization-rightsizing-filter-field">
            <p className="optimization-rightsizing-filter-label">Granularity</p>
            <select
              className="optimization-rightsizing-filter-control"
              value={granularity}
              onChange={(event) => setGranularity(event.target.value as Granularity)}
            >
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
          </div>
          <div className="optimization-rightsizing-filter-field">
            <p className="optimization-rightsizing-filter-label">Category</p>
            <select
              className="optimization-rightsizing-filter-control"
              value={category}
              onChange={(event) => setCategory(event.target.value as Category)}
            >
              <option value="none">No Grouping</option>
              <option value="region">Region</option>
              <option value="instance_type">Instance Type</option>
              <option value="reservation_type">Reservation Type</option>
            </select>
          </div>
          <div className="optimization-rightsizing-filter-field">
            <p className="optimization-rightsizing-filter-label">xAxis</p>
            <select
              className="optimization-rightsizing-filter-control"
              value={xAxis}
              onChange={(event) => setXAxis(event.target.value as XAxis)}
            >
              <option value="short">Short Date</option>
              <option value="long">Long Date</option>
              <option value="iso-date">ISO Date</option>
            </select>
          </div>
          <div className="optimization-rightsizing-filter-field">
            <p className="optimization-rightsizing-filter-label">yAxis</p>
            <select
              className="optimization-rightsizing-filter-control"
              value={yAxis}
              onChange={(event) => setYAxis(event.target.value as YAxis)}
            >
              <option value="instance-count">Instance Count</option>
              <option value="cumulative">Cumulative</option>
            </select>
          </div>
          <div className="optimization-rightsizing-filter-field">
            <p className="optimization-rightsizing-filter-label">Metrics</p>
            <select
              className="optimization-rightsizing-filter-control"
              value={metric}
              onChange={(event) => setMetric(event.target.value as Metric)}
            >
              <option value="instance-count">Instance Count</option>
              <option value="moving-average">Moving Average</option>
            </select>
          </div>
          <div className="optimization-rightsizing-filter-field">
            <p className="optimization-rightsizing-filter-label">Chart Type</p>
            <select
              className="optimization-rightsizing-filter-control"
              value={chartType}
              onChange={(event) => setChartType(event.target.value as ChartType)}
            >
              <option value="bar">Bar Chart</option>
              <option value="line">Line Chart</option>
            </select>
          </div>
        </div>

        <div className="cost-explorer-chip-bar">
          <div className="cost-explorer-chip-row">
            {activeFilters.map((item) => (
              <span key={item} className="cost-explorer-chip">
                <span className="cost-explorer-chip__edit">{item}</span>
              </span>
            ))}
          </div>
          <button type="button" className="cost-explorer-chip-bar__clear cost-explorer-chip-bar__clear--inline" onClick={clearAll}>
            Clear all
          </button>
        </div>

        {query.isLoading ? <p className="dashboard-note">Loading EC2 instance usage...</p> : null}
        {query.isError ? (
          <p className="dashboard-note">Failed to load EC2 instance usage: {query.error.message}</p>
        ) : null}
        {!query.isLoading && !query.isError && !chartReady ? (
          <p className="dashboard-note">No EC2 instance usage data available for the selected filters.</p>
        ) : null}

        {chartReady ? (
          <>
            <BaseEChart option={chartOption} height={420} />
          </>
        ) : null}
      </DashboardSection>
    </div>
  );
}
