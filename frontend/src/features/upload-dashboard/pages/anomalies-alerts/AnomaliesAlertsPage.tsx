import { useMemo, useState } from "react";
import type { ColDef } from "ag-grid-community";
import { AlertTriangle, BellRing, RefreshCw } from "lucide-react";

import { EmptyStateBlock, KpiCard, KpiGrid, MetricBadge, PageSection } from "../../common/components";
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

const PAGE_SIZE_OPTIONS = [25, 50, 100];

export default function AnomaliesAlertsPage() {
  const [billingSourceIdInput, setBillingSourceIdInput] = useState("");
  const [status, setStatus] = useState<"" | "open" | "resolved" | "ignored">("");
  const [severity, setSeverity] = useState<"" | "low" | "medium" | "high">("");
  const [anomalyType, setAnomalyType] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [limit, setLimit] = useState(25);
  const [offset, setOffset] = useState(0);

  const queryFilters = useMemo<AnomaliesFiltersQuery>(
    () => ({
      ...(billingSourceIdInput.trim() ? { billing_source_id: Number(billingSourceIdInput) } : {}),
      ...(status ? { status } : {}),
      ...(severity ? { severity } : {}),
      ...(anomalyType.trim() ? { anomaly_type: anomalyType.trim() } : {}),
      ...(dateFrom ? { date_from: dateFrom } : {}),
      ...(dateTo ? { date_to: dateTo } : {}),
      limit,
      offset,
    }),
    [anomalyType, billingSourceIdInput, dateFrom, dateTo, limit, offset, severity, status],
  );

  const query = useAnomaliesQuery(queryFilters);
  const rows = query.data?.items ?? [];
  const pagination = query.data?.pagination;

  const activeAlerts = useMemo(
    () => rows.filter((item) => String(item.status ?? "").toLowerCase() === "open").length,
    [rows],
  );
  const highSeverity = useMemo(
    () => rows.filter((item) => String(item.severity ?? "").toLowerCase() === "high").length,
    [rows],
  );
  const totalDelta = useMemo(() => rows.reduce((sum, item) => sum + Math.abs(toNumber(item.delta_cost)), 0), [rows]);

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

  const resetFilters = () => {
    setBillingSourceIdInput("");
    setStatus("");
    setSeverity("");
    setAnomalyType("");
    setDateFrom("");
    setDateTo("");
    setLimit(25);
    setOffset(0);
  };

  return (
    <div className="dashboard-page anomalies-alerts-page">
      <section className="anomalies-alerts-banner">
        <div>
          <h2 className="anomalies-alerts-banner__title">Anomalies</h2>
          <p className="anomalies-alerts-banner__subtitle">
            Review detected cost spikes by source, severity, and status using the latest anomaly stream.
          </p>
        </div>
        <MetricBadge tone="negative">
          <BellRing size={12} />
          Watch Active
        </MetricBadge>
      </section>

      <PageSection
        title="Filters"
        description="Refine anomaly results by billing source, date range, severity, and lifecycle status."
        className="anomalies-filter-section"
        actions={
          <button type="button" className="anomalies-filter-reset" onClick={resetFilters}>
            Reset Filters
          </button>
        }
      >
        <div className="anomalies-filter-grid">
          <label className="dashboard-header-field">
            <span className="dashboard-header-field__label">Billing Source ID</span>
            <input
              className="dashboard-header-field__control"
              inputMode="numeric"
              placeholder="e.g. 123"
              value={billingSourceIdInput}
              onChange={(event) => {
                setBillingSourceIdInput(event.target.value.replace(/[^\d]/g, ""));
                setOffset(0);
              }}
            />
          </label>
          <label className="dashboard-header-field">
            <span className="dashboard-header-field__label">Status</span>
            <select
              className="dashboard-header-field__control"
              value={status}
              onChange={(event) => {
                setStatus(event.target.value as typeof status);
                setOffset(0);
              }}
            >
              <option value="">All</option>
              <option value="open">Open</option>
              <option value="resolved">Resolved</option>
              <option value="ignored">Ignored</option>
            </select>
          </label>
          <label className="dashboard-header-field">
            <span className="dashboard-header-field__label">Severity</span>
            <select
              className="dashboard-header-field__control"
              value={severity}
              onChange={(event) => {
                setSeverity(event.target.value as typeof severity);
                setOffset(0);
              }}
            >
              <option value="">All</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </label>
          <label className="dashboard-header-field">
            <span className="dashboard-header-field__label">Anomaly Type</span>
            <input
              className="dashboard-header-field__control"
              placeholder="cost_spike"
              value={anomalyType}
              onChange={(event) => {
                setAnomalyType(event.target.value);
                setOffset(0);
              }}
            />
          </label>
          <label className="dashboard-header-field">
            <span className="dashboard-header-field__label">Date From</span>
            <input
              className="dashboard-header-field__control"
              type="date"
              value={dateFrom}
              onChange={(event) => {
                setDateFrom(event.target.value);
                setOffset(0);
              }}
            />
          </label>
          <label className="dashboard-header-field">
            <span className="dashboard-header-field__label">Date To</span>
            <input
              className="dashboard-header-field__control"
              type="date"
              value={dateTo}
              onChange={(event) => {
                setDateTo(event.target.value);
                setOffset(0);
              }}
            />
          </label>
        </div>
      </PageSection>

      <PageSection>
        <KpiGrid>
          <KpiCard
            label="Total Active Alerts"
            value={String(activeAlerts)}
            delta={`${rows.length} detected records`}
            deltaTone="negative"
            meta="Current scope"
          />
          <KpiCard
            label="High Severity Anomalies"
            value={String(highSeverity)}
            delta={highSeverity > 0 ? "Needs attention" : "No high severity"}
            deltaTone={highSeverity > 0 ? "negative" : "positive"}
            meta="Based on anomaly severity"
          />
          <KpiCard
            label="Total Cost Delta"
            value={compactCurrencyFormatter.format(totalDelta)}
            delta="Absolute impact"
            deltaTone="accent"
            meta="Across listed anomalies"
          />
        </KpiGrid>
      </PageSection>

      <PageSection title="Anomaly Workbench" description="Daily cost spike anomalies from fact_anomalies.">
        <TableShell
          title="Anomaly Records"
          subtitle={`Showing ${startRow}-${endRow} of ${totalRows}`}
          actions={
            <div className="anomalies-table-actions">
              <MetricBadge tone="negative">
                <AlertTriangle size={12} />
                High Severity {highSeverity}
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
                  <label className="anomalies-pagination__limit">
                    <span>Rows</span>
                    <select
                      value={limit}
                      onChange={(event) => {
                        setLimit(Number(event.target.value));
                        setOffset(0);
                      }}
                    >
                      {PAGE_SIZE_OPTIONS.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </label>
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
      </PageSection>
    </div>
  );
}
