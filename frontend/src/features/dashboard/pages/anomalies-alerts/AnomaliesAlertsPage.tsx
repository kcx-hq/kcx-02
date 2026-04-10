import { useMemo } from "react";
import type { ColDef } from "ag-grid-community";
import { AlertTriangle, BellRing } from "lucide-react";

import { KpiCard, KpiGrid, MetricBadge, PageSection } from "../../common/components";
import { BaseDataTable, currencyFormatter } from "../../common/tables/BaseDataTable";
import { TableShell } from "../../common/tables/TableShell";
import type { AnomalyAlertRecord } from "../../api/dashboardApi";
import { useAnomaliesAlertsQuery } from "../../hooks/useDashboardQueries";

const compactCurrencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 1,
});

const toNumber = (value: number | string | null | undefined): number => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

export default function AnomaliesAlertsPage() {
  const query = useAnomaliesAlertsQuery();
  const rows = query.data ?? [];

  const activeAlerts = useMemo(
    () => rows.filter((item) => String(item.status ?? "").toLowerCase() === "open").length,
    [rows],
  );
  const highSeverity = useMemo(
    () => rows.filter((item) => String(item.severity ?? "").toLowerCase() === "high").length,
    [rows],
  );
  const totalDelta = useMemo(() => rows.reduce((sum, item) => sum + Math.abs(toNumber(item.delta_cost)), 0), [rows]);

  const anomalyColumns = useMemo<ColDef<AnomalyAlertRecord>[]>(
    () => [
      { headerName: "Detected", field: "detected_at", minWidth: 138 },
      { headerName: "Usage Date", field: "usage_date", minWidth: 118 },
      { headerName: "Type", field: "anomaly_type", minWidth: 148 },
      { headerName: "Service", field: "service_name", minWidth: 132 },
      { headerName: "Region", field: "region_name", minWidth: 128 },
      {
        headerName: "Expected",
        field: "expected_cost",
        valueFormatter: currencyFormatter,
        minWidth: 118,
      },
      {
        headerName: "Actual",
        field: "actual_cost",
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
      { headerName: "Root Cause Hint", field: "root_cause_hint", minWidth: 220 },
    ],
    [],
  );

  return (
    <div className="dashboard-page anomalies-alerts-page">
      <section className="anomalies-alerts-banner">
        <div>
          <h2 className="anomalies-alerts-banner__title">Anomalies & Alerts</h2>
          <p className="anomalies-alerts-banner__subtitle">
            Track unusual spend signals and optimization actions for your current dashboard scope.
          </p>
        </div>
        <MetricBadge tone="negative">
          <BellRing size={12} />
          Watch Active
        </MetricBadge>
      </section>

      {query.isLoading ? <p className="dashboard-note">Loading anomaly alerts...</p> : null}
      {query.isError ? <p className="dashboard-note">Failed to load anomaly alerts: {query.error.message}</p> : null}

      {query.data ? (
        <>
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

          <PageSection title="Alert Workbench" description="Backend-driven anomaly stream from the anomaly-alerts module.">
            <TableShell
              title="Anomaly Records"
              subtitle={`${rows.length} records in current scope`}
              actions={
                <MetricBadge tone="negative">
                  <AlertTriangle size={12} />
                  High Severity {highSeverity}
                </MetricBadge>
              }
            >
              <BaseDataTable columnDefs={anomalyColumns} rowData={rows} height={420} emptyMessage="No anomalies for current filters." />
            </TableShell>
          </PageSection>
        </>
      ) : null}
    </div>
  );
}
