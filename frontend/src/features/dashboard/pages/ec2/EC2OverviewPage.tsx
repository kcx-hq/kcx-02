import { useMemo } from "react";
import type { EChartsOption } from "echarts";
import { useLocation, useNavigate } from "react-router-dom";

import { BaseEChart } from "../../common/charts/BaseEChart";
import { KpiCard, WidgetShell } from "../../common/components";
import { useEc2OverviewQuery } from "../../hooks/useDashboardQueries";

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const integerFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 0,
});

const decimalFormatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

const parseOptionalInt = (value: string | null): number | null => {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : null;
};

const toDateLabel = (value: string): string => {
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "2-digit",
    timeZone: "UTC",
  });
};

export default function EC2OverviewPage() {
  const location = useLocation();
  const navigate = useNavigate();

  const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const regionKey = parseOptionalInt(searchParams.get("regionKey")) ?? null;
  const instanceType = searchParams.get("instanceType") ?? "ALL";
  const state = searchParams.get("state") ?? "ALL";

  const overviewQuery = useEc2OverviewQuery({
    ...(typeof regionKey === "number" ? { regionKey } : {}),
    ...(instanceType !== "ALL" ? { instanceType } : {}),
    ...(state !== "ALL" ? { state } : {}),
  });

  const navigateToInstances = (extra: Record<string, string | null>) => {
    const params = new URLSearchParams();
    const from = searchParams.get("from") ?? searchParams.get("billingPeriodStart");
    const to = searchParams.get("to") ?? searchParams.get("billingPeriodEnd");
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    if (typeof regionKey === "number") params.set("regionKey", String(regionKey));
    if (instanceType !== "ALL") params.set("instanceType", instanceType);
    if (state !== "ALL") params.set("state", state);

    Object.entries(extra).forEach(([key, value]) => {
      if (!value || value.trim().length === 0) {
        params.delete(key);
      } else {
        params.set(key, value);
      }
    });

    navigate({
      pathname: "/dashboard/inventory/aws/ec2/instances",
      search: params.toString(),
    });
  };

  const trendLabels = overviewQuery.data?.trends.map((item) => toDateLabel(item.date)) ?? [];
  const runningSeries = overviewQuery.data?.trends.map((item) => item.runningInstanceCount) ?? [];
  const computeCostSeries = overviewQuery.data?.trends.map((item) => item.computeCost) ?? [];

  const runningTrendOption = useMemo<EChartsOption>(
    () => ({
      tooltip: { trigger: "axis" },
      grid: { left: 10, right: 10, top: 18, bottom: 14, containLabel: true },
      xAxis: {
        type: "category",
        data: trendLabels,
        axisLine: { lineStyle: { color: "#d7e4df" } },
        axisLabel: { color: "#5c7370", fontSize: 11 },
      },
      yAxis: {
        type: "value",
        axisLine: { show: false },
        splitLine: { lineStyle: { color: "#e1eae7", type: "dashed" } },
        axisLabel: { color: "#6d837e", fontSize: 11 },
      },
      series: [
        {
          name: "Running Instances",
          type: "line",
          smooth: true,
          showSymbol: trendLabels.length <= 35,
          symbol: "circle",
          symbolSize: 6,
          lineStyle: { width: 2.2, color: "#2f8f88" },
          itemStyle: { color: "#2f8f88" },
          areaStyle: { color: "rgba(47,143,136,0.10)" },
          data: runningSeries,
        },
      ],
    }),
    [runningSeries, trendLabels],
  );

  const computeCostTrendOption = useMemo<EChartsOption>(
    () => ({
      tooltip: {
        trigger: "axis",
        valueFormatter: (value) => currencyFormatter.format(Number(value ?? 0)),
      },
      grid: { left: 10, right: 10, top: 18, bottom: 14, containLabel: true },
      xAxis: {
        type: "category",
        data: trendLabels,
        axisLine: { lineStyle: { color: "#d7e4df" } },
        axisLabel: { color: "#5c7370", fontSize: 11 },
      },
      yAxis: {
        type: "value",
        axisLine: { show: false },
        splitLine: { lineStyle: { color: "#e1eae7", type: "dashed" } },
        axisLabel: {
          color: "#6d837e",
          fontSize: 11,
          formatter: (value: number) => `$${Math.round(value).toLocaleString()}`,
        },
      },
      series: [
        {
          name: "Compute Cost",
          type: "bar",
          barMaxWidth: 22,
          itemStyle: { color: "#3f68c6" },
          data: computeCostSeries,
        },
      ],
    }),
    [computeCostSeries, trendLabels],
  );

  const kpis = overviewQuery.data?.kpis;

  return (
    <div className="dashboard-page ec2-overview-page">
      {overviewQuery.isLoading ? <p className="dashboard-note">Loading EC2 overview...</p> : null}
      {overviewQuery.isError ? (
        <p className="dashboard-note">Failed to load EC2 overview: {overviewQuery.error.message}</p>
      ) : null}

      {kpis ? (
        <section className="overview-kpi-strip overview-kpi-board">
          <div className="overview-kpi-row overview-kpi-row--report ec2-overview-kpi-row">
            <button
              type="button"
              className="ec2-overview-kpi-button"
              onClick={() => navigateToInstances({})}
            >
              <KpiCard label="Total Instances" value={integerFormatter.format(kpis.totalInstances)} />
            </button>
            <button
              type="button"
              className="ec2-overview-kpi-button"
              onClick={() => navigateToInstances({ state: "running" })}
            >
              <KpiCard label="Running" value={integerFormatter.format(kpis.runningInstances)} />
            </button>
            <button
              type="button"
              className="ec2-overview-kpi-button"
              onClick={() => navigateToInstances({ state: "stopped" })}
            >
              <KpiCard label="Stopped" value={integerFormatter.format(kpis.stoppedInstances)} />
            </button>
            <button
              type="button"
              className="ec2-overview-kpi-button"
              onClick={() => navigateToInstances({ utilizationSignal: "idle" })}
            >
              <KpiCard label="Idle" value={integerFormatter.format(kpis.idleInstances)} />
            </button>
            <button
              type="button"
              className="ec2-overview-kpi-button"
              onClick={() => navigateToInstances({ utilizationSignal: "underutilized" })}
            >
              <KpiCard label="Underutilized" value={integerFormatter.format(kpis.underutilizedInstances)} />
            </button>
            <button
              type="button"
              className="ec2-overview-kpi-button"
              onClick={() => navigateToInstances({ utilizationSignal: "overutilized" })}
            >
              <KpiCard label="Overutilized" value={integerFormatter.format(kpis.overutilizedInstances)} />
            </button>
            <button
              type="button"
              className="ec2-overview-kpi-button"
              onClick={() => navigateToInstances({})}
            >
              <KpiCard label="Total Compute Cost" value={currencyFormatter.format(kpis.totalComputeCost)} />
            </button>
            <button
              type="button"
              className="ec2-overview-kpi-button"
              onClick={() => navigateToInstances({})}
            >
              <KpiCard label="Total Instance Hours" value={decimalFormatter.format(kpis.totalInstanceHours)} />
            </button>
          </div>
        </section>
      ) : null}

      {overviewQuery.data ? (
        <div className="dashboard-showcase-grid dashboard-showcase-grid--charts ec2-overview-trends-grid">
          <WidgetShell title="Instance Count Trend" subtitle="Daily running instances">
            <BaseEChart option={runningTrendOption} height={300} />
          </WidgetShell>
          <WidgetShell title="Compute Cost Trend" subtitle="Daily compute cost">
            <BaseEChart option={computeCostTrendOption} height={300} />
          </WidgetShell>
        </div>
      ) : null}
    </div>
  );
}
