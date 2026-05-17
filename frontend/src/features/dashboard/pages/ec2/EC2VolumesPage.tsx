import { X } from "lucide-react";
import { useMemo, useState } from "react";
import { useLocation } from "react-router-dom";

import { useDashboardScope } from "../../hooks/useDashboardScope";
import { useEc2ExplorerQuery } from "../../hooks/useDashboardQueries";
import {
  EC2_EXPLORER_DEFAULT_CONTROLS,
  EC2ExplorerChart,
  EC2ExplorerTable,
  EC2ExplorerTopControls,
  EC2SummaryCards,
} from "./components";
import {
  METRIC_OPTIONS,
  type EC2ExplorerControlsState,
  getValidGroupByForMetric,
} from "./ec2ExplorerControls.types";

const parseNumberOrNull = (value: string): number | null => {
  const normalized = value.trim();
  if (normalized.length === 0) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
};

const defaultSummary = {
  totalCost: 0,
  previousCost: 0,
  trendPercent: 0,
  instanceCount: 0,
  volumeCount: 0,
  attachedInstanceCount: 0,
  unattachedVolumeCount: 0,
  storageGb: 0,
  storageGbHours: 0,
  avgCpu: 0,
  totalNetworkGb: 0,
};

const toApiGroupBy = (
  groupBy: EC2ExplorerControlsState["groupBy"],
):
  | "none"
  | "account"
  | "region"
  | "availability_zone"
  | "instance_type"
  | "reservation_type"
  | "cost_category"
  | "usage_type"
  | "operation"
  | "instance_state"
  | "recommendation"
  | "volume"
  | "volume_type"
  | "attachment_state"
  | "instance"
  | "storage_tier"
  | "iops_tier"
  | "size_bucket"
  | "lifecycle_state"
  | "transfer_type"
  | "source_region"
  | "destination_region"
  | "tag" =>
  groupBy === "instance-type"
    ? "instance_type"
    : groupBy === "reservation-type"
      ? "reservation_type"
      : groupBy === "cost-category"
        ? "cost_category"
        : groupBy === "availability-zone"
          ? "availability_zone"
          : groupBy === "usage-type"
            ? "usage_type"
            : groupBy === "transfer-type"
              ? "transfer_type"
              : groupBy === "source-region"
                ? "source_region"
                : groupBy === "destination-region"
                  ? "destination_region"
                  : groupBy === "instance-state"
                    ? "instance_state"
                    : groupBy;

export default function EC2VolumesPage() {
  const location = useLocation();
  const { scope } = useDashboardScope();
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

  const [controls, setControls] = useState<EC2ExplorerControlsState>({
    ...EC2_EXPLORER_DEFAULT_CONTROLS,
    metric: "volumes",
    groupBy: getValidGroupByForMetric("volumes", "none"),
  });

  const filters = useMemo(
    () => ({
      startDate: scopeStartDate,
      endDate: scopeEndDate,
      metric: "volumes" as const,
      granularity: controls.granularity,
      volumeView: controls.volumeView,
      groupBy: toApiGroupBy(controls.groupBy),
      tagKey: controls.groupBy === "tag" ? controls.scopeFilters.tags[0] ?? "owner" : null,
      regions: controls.scopeFilters.region,
      tags: controls.scopeFilters.tags.map((tagValue) => `tag:${tagValue}`),
      groupValues: controls.groupByValues,
      minCost: parseNumberOrNull(controls.thresholds.costMin),
      maxCost: parseNumberOrNull(controls.thresholds.costMax),
      minCpu: parseNumberOrNull(controls.thresholds.cpuMin),
      maxCpu: parseNumberOrNull(controls.thresholds.cpuMax),
      minNetwork: parseNumberOrNull(controls.thresholds.networkMin),
      maxNetwork: parseNumberOrNull(controls.thresholds.networkMax),
      states: [],
      instanceTypes: [],
    }),
    [controls, scopeEndDate, scopeStartDate],
  );

  const query = useEc2ExplorerQuery(filters, Boolean(scope));
  const isSectionLoading = !scope || query.isFetching || !query.data;

  const metricLabel = METRIC_OPTIONS.find((option) => option.key === "volumes")?.label ?? "Volumes";

  const resetControls = () => {
    setControls({
      ...EC2_EXPLORER_DEFAULT_CONTROLS,
      metric: "volumes",
      groupBy: getValidGroupByForMetric("volumes", "none"),
    });
  };

  const chips = useMemo(() => {
    const configLabel =
      controls.volumeView === "storage_hours"
        ? "Storage Hours"
        : controls.volumeView === "cost"
          ? "Cost"
          : controls.volumeView === "count"
            ? "Count"
            : "Storage";
    const groupByLabel = toApiGroupBy(controls.groupBy).replace(/_/g, " ");
    const list: Array<{ id: string; label: string; value: string; onRemove: () => void }> = [
      {
        id: "metric",
        label: "Metric",
        value: "Volumes",
        onRemove: resetControls,
      },
      {
        id: "config",
        label: "View",
        value: configLabel,
        onRemove: () =>
          setControls((current) => ({
            ...current,
            volumeView: EC2_EXPLORER_DEFAULT_CONTROLS.volumeView,
          })),
      },
      {
        id: "groupBy",
        label: "Group By",
        value: groupByLabel.replace(/\b\w/g, (match) => match.toUpperCase()),
        onRemove: () =>
          setControls((current) => ({
            ...current,
            groupBy: getValidGroupByForMetric("volumes", EC2_EXPLORER_DEFAULT_CONTROLS.groupBy),
            groupByValues: [],
          })),
      },
    ];
    return list;
  }, [controls]);

  return (
    <div className="dashboard-page cost-explorer-page ec2-explorer-page">
      <section className="ec2-explorer-head-stack" aria-label="EC2 volumes controls and summary">
        <EC2ExplorerTopControls value={controls} onChange={setControls} loading={isSectionLoading} showMetricTabs={false}>
          <div className="cost-explorer-chip-bar" aria-label="Selected filter summary">
            <div className="cost-explorer-chip-row">
              {isSectionLoading ? (
                <>
                  <span className="ec2-explorer-filter-skeleton-chip ec2-explorer-filter-skeleton-chip--lg" aria-hidden="true" />
                  <span className="ec2-explorer-filter-skeleton-chip ec2-explorer-filter-skeleton-chip--md" aria-hidden="true" />
                  <span className="ec2-explorer-filter-skeleton-chip ec2-explorer-filter-skeleton-chip--md2" aria-hidden="true" />
                  <span className="ec2-explorer-filter-skeleton-chip ec2-explorer-filter-skeleton-chip--clear" aria-hidden="true" />
                </>
              ) : (
                <>
                  {chips.map((chip) => (
                    <span key={chip.id} className="cost-explorer-chip">
                      <span className="cost-explorer-chip__edit">
                        {chip.label}: {chip.value}
                      </span>
                      <button type="button" className="cost-explorer-chip__remove" onClick={chip.onRemove} aria-label={`Remove ${chip.label}`}>
                        <X size={13} aria-hidden="true" />
                      </button>
                    </span>
                  ))}
                  <button type="button" className="cost-explorer-chip-bar__clear cost-explorer-chip-bar__clear--inline" onClick={resetControls}>
                    Clear all
                  </button>
                </>
              )}
            </div>
          </div>
        </EC2ExplorerTopControls>

        <EC2SummaryCards summary={query.data?.summary ?? defaultSummary} loading={isSectionLoading} metric="volumes" />
      </section>

      <section className="ec2-explorer-chart-panel" aria-label="EC2 volumes chart panel">
        <EC2ExplorerChart
          title={`${metricLabel} Breakdown`}
          chartType={controls.chartType}
          canUseStackedBar
          showChartTypeSelector={false}
          onChartTypeChange={(nextChartType) => {
            setControls((current) => ({ ...current, chartType: nextChartType }));
          }}
          graph={
            query.data?.graph
              ? {
                  ...query.data.graph,
                  type: controls.chartType,
                }
              : {
                  type: controls.chartType,
                  xKey: "date",
                  series: [],
                }
          }
          loading={isSectionLoading}
          error={query.isError ? query.error : null}
          onRetry={() => {
            void query.refetch();
          }}
          onPointClick={() => {
            // no-op for volumes page
          }}
        />
      </section>

      <section className="ec2-explorer-table-panel" aria-label="EC2 volumes table panel">
        <EC2ExplorerTable
          metric="volumes"
          groupBy={controls.groupBy}
          loading={isSectionLoading}
          error={query.isError ? query.error : null}
          table={query.data?.table ?? null}
          onRetry={() => {
            void query.refetch();
          }}
          onRowClick={() => {
            // no-op for now
          }}
        />
      </section>
    </div>
  );
}
