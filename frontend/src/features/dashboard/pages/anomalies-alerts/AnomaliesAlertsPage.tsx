import { useMemo, useState } from "react";
import type { ColDef } from "ag-grid-community";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { useLocation } from "react-router-dom";

import { EmptyStateBlock, KpiCard, MetricBadge, PageSection } from "../../common/components";
import { BaseDataTable, currencyFormatter } from "../../common/tables/BaseDataTable";
import { TableShell } from "../../common/tables/TableShell";
import type { AnomaliesFiltersQuery, AnomalyRecord } from "../../api/dashboardApi";
import { useAnomaliesQuery } from "../../hooks/useDashboardQueries";

const compactCurrencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 1,
});

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "2-digit",
  year: "numeric",
});

const dateTimeFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

const toNumber = (value: number | string | null | undefined): number => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

const formatDate = (value: string | null | undefined): string => {
  if (!value) return "-";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : dateFormatter.format(parsed);
};

const formatDateTime = (value: string | null | undefined): string => {
  if (!value) return "-";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : dateTimeFormatter.format(parsed);
};

const formatPercent = (value: number | string | null | undefined): string => {
  const numeric = toNumber(value);
  const normalized = Math.abs(numeric) <= 1 ? numeric * 100 : numeric;
  return `${normalized.toFixed(1)}%`;
};

const PAGE_SIZE = 10;

export default function AnomaliesAlertsPage() {
  const location = useLocation();
  const [limit] = useState(PAGE_SIZE);
  const [offset, setOffset] = useState(0);
  const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const globalDateFrom = searchParams.get("billingPeriodStart") ?? searchParams.get("from") ?? "";
  const globalDateTo = searchParams.get("billingPeriodEnd") ?? searchParams.get("to") ?? "";

  const queryFilters = useMemo<AnomaliesFiltersQuery>(
    () => ({
      ...(globalDateFrom ? { date_from: globalDateFrom } : {}),
      ...(globalDateTo ? { date_to: globalDateTo } : {}),
      limit,
      offset,
    }),
    [globalDateFrom, globalDateTo, limit, offset],
  );

  const query = useAnomaliesQuery(queryFilters);
  const rows = query.data?.items ?? [];
  const pagination = query.data?.pagination;

  const activeAlerts = useMemo(
    () => rows.filter((item) => String(item.status ?? "").toLowerCase() === "open").length,
    [rows],
  );
  const highSeverityOpen = useMemo(
    () =>
      rows.filter(
        (item) =>
          String(item.severity ?? "").toLowerCase() === "high" &&
          String(item.status ?? "").toLowerCase() === "open",
      ).length,
    [rows],
  );
  const totalDelta = useMemo(() => rows.reduce((sum, item) => sum + Math.abs(toNumber(item.delta_cost)), 0), [rows]);
  const resolutionRate = useMemo(() => {
    if (!rows.length) return 0;
    const resolved = rows.filter((item) => String(item.status ?? "").toLowerCase() === "resolved").length;
    return (resolved / rows.length) * 100;
  }, [rows]);

  const anomalyColumns = useMemo<ColDef<AnomalyRecord>[]>(
    () => [
      {
        headerName: "Usage Date",
        field: "usage_date",
        valueFormatter: (params) => formatDate(params.value),
        minWidth: 128,
      },
      {
        headerName: "Billing Source",
        field: "billing_source_name",
        minWidth: 170,
        valueGetter: (params) => params.data?.billing_source_name ?? `Source #${params.data?.billing_source_id ?? "-"}`,
      },
      {
        headerName: "Type",
        field: "anomaly_type",
        minWidth: 140,
        valueFormatter: (params) => params.value ?? "unknown",
      },
      {
        headerName: "Actual",
        field: "actual_cost",
        valueFormatter: currencyFormatter,
        minWidth: 118,
      },
      {
        headerName: "Expected",
        field: "expected_cost",
        valueFormatter: currencyFormatter,
        minWidth: 118,
      },
      {
        headerName: "Delta",
        field: "delta_cost",
        valueFormatter: currencyFormatter,
        minWidth: 120,
      },
      {
        headerName: "Delta %",
        field: "delta_percent",
        valueFormatter: (params) => formatPercent(params.value),
        minWidth: 98,
      },
      {
        headerName: "Severity",
        field: "severity",
        minWidth: 110,
        cellRenderer: (params: { value: string }) => (
          <span className={`overview-chip overview-chip--${params.value?.toLowerCase?.() ?? "neutral"}`}>
            {params.value ?? "unknown"}
          </span>
        ),
      },
      {
        headerName: "Status",
        field: "status",
        minWidth: 110,
        cellRenderer: (params: { value: string }) => (
          <span className={`overview-chip overview-chip--status-${params.value?.toLowerCase?.() ?? "neutral"}`}>
            {params.value ?? "unknown"}
          </span>
        ),
      },
      {
        headerName: "Detected",
        field: "detected_at",
        valueFormatter: (params) => formatDateTime(params.value),
        minWidth: 160,
      },
      { headerName: "Root Cause Hint", field: "root_cause_hint", minWidth: 220, flex: 1.3 },
    ],
    [],
  );

  const canGoNext = pagination ? pagination.offset + pagination.limit < pagination.total : false;
  const canGoPrevious = pagination ? pagination.offset > 0 : false;
  const startRow = pagination && pagination.total > 0 ? pagination.offset + 1 : 0;
  const endRow = pagination ? Math.min(pagination.offset + pagination.limit, pagination.total) : 0;
  const totalRows = pagination?.total ?? 0;

  return (
    <div className="dashboard-page anomalies-alerts-page">
      <PageSection>
        <div className="overview-kpi-row overview-kpi-row--report anomalies-kpi-row">
          <KpiCard
            label="Open Anomalies"
            value={String(activeAlerts)}
            delta={`${rows.length} total in range`}
            deltaTone="negative"
            meta="Status: Open"
          />
          <KpiCard
            label="High Severity Open"
            value={String(highSeverityOpen)}
            delta={highSeverityOpen > 0 ? "Needs attention" : "No critical open anomalies"}
            deltaTone={highSeverityOpen > 0 ? "negative" : "positive"}
            meta="Severity: High + Open"
          />
          <KpiCard
            label="Anomaly Cost Impact"
            value={compactCurrencyFormatter.format(totalDelta)}
            delta="Absolute delta cost"
            deltaTone="accent"
            meta="Current date range"
          />
          <KpiCard
            label="Resolution Rate"
            value={`${resolutionRate.toFixed(1)}%`}
            delta={`${rows.length} anomalies evaluated`}
            deltaTone={resolutionRate >= 70 ? "positive" : resolutionRate >= 40 ? "accent" : "negative"}
            meta="Resolved / Total"
          />
        </div>
      </PageSection>

      <TableShell
        title="Anomaly Records"
        subtitle={`Showing ${startRow}-${endRow} of ${totalRows}`}
        actions={
          <div className="anomalies-table-actions">
            <MetricBadge tone="negative">
              <AlertTriangle size={12} />
              High Severity Open {highSeverityOpen}
            </MetricBadge>
            <button type="button" className="anomalies-refresh-button" onClick={() => void query.refetch()}>
              <RefreshCw size={12} />
              Refresh
            </button>
          </div>
        }
      >
        {query.isLoading ? <div className="anomalies-list-skeleton" aria-hidden="true" /> : null}
        {query.isError ? (
          <EmptyStateBlock
            title="Failed to load anomalies"
            message={query.error.message}
            actions={
              <button type="button" className="anomalies-refresh-button" onClick={() => void query.refetch()}>
                Retry
              </button>
            }
          />
        ) : null}
        {!query.isLoading && !query.isError ? (
          <>
            <BaseDataTable
              columnDefs={anomalyColumns}
              rowData={rows}
              height={420}
              emptyMessage="No anomalies found for the selected filters."
            />
            <div className="anomalies-pagination">
              <p className="anomalies-pagination__meta">
                Showing {startRow}-{endRow} of {totalRows}
              </p>
              <div className="anomalies-pagination__actions">
                <button
                  type="button"
                  className="anomalies-pagination__btn"
                  disabled={!canGoPrevious}
                  onClick={() => setOffset((current) => Math.max(0, current - limit))}
                >
                  Previous
                </button>
                <button
                  type="button"
                  className="anomalies-pagination__btn"
                  disabled={!canGoNext}
                  onClick={() => setOffset((current) => current + limit)}
                >
                  Next
                </button>
              </div>
            </div>
          </>
        ) : null}
      </TableShell>
    </div>
  );
}
