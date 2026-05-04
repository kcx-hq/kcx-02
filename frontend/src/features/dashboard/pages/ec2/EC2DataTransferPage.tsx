import { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import type { ColDef, ValueFormatterParams } from "ag-grid-community";
import type { EChartsOption } from "echarts";

import type { Ec2DataTransferFiltersQuery, Ec2DataTransferResponse } from "../../api/dashboardApi";
import { EmptyStateBlock } from "../../common/components/EmptyStateBlock";
import { BaseEChart } from "../../common/charts/BaseEChart";
import { BaseDataTable } from "../../common/tables/BaseDataTable";
import { useEc2DataTransferQuery } from "../../hooks/useDashboardQueries";
import { useDashboardScope } from "../../hooks/useDashboardScope";
import { EC2InstancesContextChips } from "./components/EC2InstancesContextChips";
import { EC2DataTransferTopBar } from "./components/EC2DataTransferTopBar";
import {
  EC2_DATA_TRANSFER_DEFAULT_CONTROLS,
  type EC2DataTransferControlsState,
} from "./components/ec2DataTransfer.types";

const currency = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });
const numberFmt = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });
const COLORS = ["#2f8f88", "#3f68c6", "#c27d2f", "#8a66cf"];

const summaryFallback: Ec2DataTransferResponse["summary"] = {
  totalCost: 0,
  totalUsageGb: 0,
  resourceCount: 0,
  internetCost: 0,
  interRegionCost: 0,
  interAzCost: 0,
  unknownCost: 0,
  potentialSavings: 0,
};

const INSTANCE_LIST_PATH = "/dashboard/inventory/aws/ec2/instances";
const toTransferTypeFromSeriesName = (value: string): "internet" | "inter_region" | "inter_az" | "unknown" | null => {
  const normalized = value.trim().toLowerCase();
  if (normalized === "internet") return "internet";
  if (normalized === "inter-region") return "inter_region";
  if (normalized === "inter-az") return "inter_az";
  if (normalized === "unknown") return "unknown";
  return null;
};

export default function EC2DataTransferPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { scope } = useDashboardScope();
  const [controls, setControls] = useState<EC2DataTransferControlsState>(EC2_DATA_TRANSFER_DEFAULT_CONTROLS);
  const scopeParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const scopeStartDate =
    scope?.from ??
    scopeParams.get("from") ??
    scopeParams.get("billingPeriodStart") ??
    scopeParams.get("startDate") ??
    undefined;
  const scopeEndDate =
    scope?.to ??
    scopeParams.get("to") ??
    scopeParams.get("billingPeriodEnd") ??
    scopeParams.get("endDate") ??
    undefined;

  const filters = useMemo<Ec2DataTransferFiltersQuery>(() => ({
    transferType: controls.transferType === "all" ? null : controls.transferType,
    region: controls.scopeFilters.region.length === 1 ? controls.scopeFilters.region[0] : null,
  }), [controls.scopeFilters.region, controls.transferType]);

  const query = useEc2DataTransferQuery(filters, true);
  const summary = query.data?.summary ?? summaryFallback;

  const trendOption = useMemo<EChartsOption>(() => {
    const trend = query.data?.trend ?? [];
    return {
      color: COLORS,
      tooltip: { trigger: "axis" },
      legend: { top: 4 },
      grid: { left: 60, right: 16, top: 44, bottom: 24 },
      xAxis: { type: "category", data: trend.map((item) => item.date) },
      yAxis: { type: "value" },
      series: [
        { name: "Internet", type: "bar", stack: "total", data: trend.map((item) => item.internetCost) },
        { name: "Inter-Region", type: "bar", stack: "total", data: trend.map((item) => item.interRegionCost) },
        { name: "Inter-AZ", type: "bar", stack: "total", data: trend.map((item) => item.interAzCost) },
        { name: "Unknown", type: "bar", stack: "total", data: trend.map((item) => item.unknownCost) },
      ],
    };
  }, [query.data?.trend]);

  const breakdownCols = useMemo<ColDef<Ec2DataTransferResponse["breakdown"][number]>[]>(() => [
    { headerName: "Transfer Type", field: "label", minWidth: 220 },
    { headerName: "Billed Usage GB", field: "usageGb", valueFormatter: (p: ValueFormatterParams) => numberFmt.format(Number(p.value ?? 0)) },
    { headerName: "Cost", field: "cost", valueFormatter: (p: ValueFormatterParams) => currency.format(Number(p.value ?? 0)) },
    { headerName: "% of Data Transfer", field: "percentageOfDataTransferCost", valueFormatter: (p: ValueFormatterParams) => `${numberFmt.format(Number(p.value ?? 0))}%` },
    { headerName: "Resource Count", field: "resourceCount" },
    { headerName: "Recommendations", field: "recommendationCount" },
  ], []);

  const activeChips = useMemo(() => {
    const chips: Array<{ id: string; label: string; onRemove?: () => void }> = [];
    controls.scopeFilters.region.forEach((region) => {
      chips.push({
        id: `region-${region}`,
        label: `Region: ${region}`,
        onRemove: () =>
          setControls((current) => ({
            ...current,
            scopeFilters: {
              ...current.scopeFilters,
              region: current.scopeFilters.region.filter((item) => item !== region),
            },
          })),
      });
    });
    if (controls.transferType !== "all") {
      chips.push({
        id: "transfer-type",
        label: `Transfer: ${controls.transferType.replace("_", "-")}`,
        onRemove: () => setControls((current) => ({ ...current, transferType: "all" })),
      });
    }
    return chips;
  }, [controls.scopeFilters.region, controls.transferType]);

  const navigateToInstances = (transferType: "internet" | "inter_region" | "inter_az" | "unknown") => {
    const next = new URLSearchParams(location.search);
    next.set("transferType", transferType);
    if (scopeStartDate) next.set("startDate", scopeStartDate);
    if (scopeEndDate) next.set("endDate", scopeEndDate);
    navigate({ pathname: INSTANCE_LIST_PATH, search: next.toString() });
  };

  return (
    <div className="dashboard-page cost-explorer-page">
      <EC2DataTransferTopBar
        value={controls}
        onChange={(next) => setControls(next)}
        onReset={() => setControls(EC2_DATA_TRANSFER_DEFAULT_CONTROLS)}
      >
        <EC2InstancesContextChips
          chips={activeChips}
          onClearAll={() => setControls(EC2_DATA_TRANSFER_DEFAULT_CONTROLS)}
        />
      </EC2DataTransferTopBar>

      <section className="ec2-explorer-head-stack" aria-label="EC2 data transfer summary">
        <div className="ec2-explorer-summary" aria-label="summary cards">
          {[
            ["Total Data Transfer Cost", currency.format(summary.totalCost)],
            ["Total Billed Usage GB", numberFmt.format(summary.totalUsageGb)],
            ["Resources", summary.resourceCount.toLocaleString()],
            ["Potential Savings", currency.format(summary.potentialSavings)],
          ].map(([label, value]) => (
            <article key={label} className={`ec2-explorer-summary__card${query.isLoading ? " is-loading" : ""}`}>
              <p className="ec2-explorer-summary__label">{label}</p>
              <p className="ec2-explorer-summary__value">{query.isLoading ? "..." : value}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="ec2-explorer-chart-panel" aria-label="trend chart">
        {query.isLoading ? <p className="dashboard-note">Loading trend...</p> : null}
        {query.isError ? (
          <EmptyStateBlock title="Unable to load trend" message={query.error.message} />
        ) : (
          <BaseEChart
            option={trendOption}
            height={360}
            onPointClick={(params) => {
              const record = params as { seriesName?: string };
              const transferType = record.seriesName ? toTransferTypeFromSeriesName(record.seriesName) : null;
              if (!transferType) return;
              navigateToInstances(transferType);
            }}
          />
        )}
      </section>

      <section className="ec2-explorer-table-panel" aria-label="breakdown table">
        {query.isLoading ? <p className="dashboard-note">Loading data transfer breakdown...</p> : null}
        {query.isError ? (
          <EmptyStateBlock title="Unable to load data transfer breakdown" message={query.error.message} />
        ) : (
          <BaseDataTable
            columnDefs={breakdownCols}
            rowData={query.data?.breakdown ?? []}
            autoHeight
            onRowClick={(row) => navigateToInstances(row.transferType)}
          />
        )}
      </section>
    </div>
  );
}
