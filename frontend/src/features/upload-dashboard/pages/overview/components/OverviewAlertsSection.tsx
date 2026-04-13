import { useMemo } from "react";
import type { ColDef } from "ag-grid-community";
import { AlertTriangle } from "lucide-react";

import type {
  OverviewAnomaliesResponse,
  OverviewAnomaly,
  OverviewRecommendation,
  OverviewRecommendationsResponse,
} from "../../../api/dashboardApi";
import { MetricBadge, PageSection } from "../../../common/components";
import { BaseDataTable, currencyFormatter } from "../../../common/tables/BaseDataTable";
import { TableShell } from "../../../common/tables/TableShell";
import { currencyFormatterCompact } from "../utils/overviewFormatters";

type OverviewAlertsSectionProps = {
  anomaliesLoading: boolean;
  anomaliesErrorMessage: string | null;
  anomaliesData: OverviewAnomaliesResponse | undefined;
  anomaliesPage: number;
  onAnomaliesPrev: () => void;
  onAnomaliesNext: () => void;
  recommendationsLoading: boolean;
  recommendationsErrorMessage: string | null;
  recommendationsData: OverviewRecommendationsResponse | undefined;
  recommendationsPage: number;
  onRecommendationsPrev: () => void;
  onRecommendationsNext: () => void;
};

export function OverviewAlertsSection({
  anomaliesLoading,
  anomaliesErrorMessage,
  anomaliesData,
  anomaliesPage,
  onAnomaliesPrev,
  onAnomaliesNext,
  recommendationsLoading,
  recommendationsErrorMessage,
  recommendationsData,
  recommendationsPage,
  onRecommendationsPrev,
  onRecommendationsNext,
}: OverviewAlertsSectionProps) {
  const anomalyColumns = useMemo<ColDef<OverviewAnomaly>[]>(
    () => [
      { headerName: "Date", field: "anomalyDate", minWidth: 120 },
      { headerName: "Service", field: "serviceName", minWidth: 140 },
      { headerName: "Region", field: "regionName", minWidth: 130 },
      { headerName: "Cost Impact", field: "costImpact", valueFormatter: currencyFormatter, minWidth: 130 },
      {
        headerName: "Severity",
        field: "severity",
        minWidth: 120,
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
    ],
    [],
  );

  const recommendationColumns = useMemo<ColDef<OverviewRecommendation>[]>(
    () => [
      { headerName: "Type", field: "recommendationType", minWidth: 140 },
      { headerName: "Service", field: "serviceName", minWidth: 130 },
      { headerName: "Savings", field: "estimatedSavings", valueFormatter: currencyFormatter, minWidth: 130 },
      { headerName: "Risk", field: "riskLevel", minWidth: 110 },
      { headerName: "Status", field: "status", minWidth: 110 },
      {
        headerName: "Actions",
        field: "actions",
        minWidth: 180,
        cellRenderer: (params: { data?: OverviewRecommendation }) => {
          const recommendation = params.data;
          if (!recommendation) return null;

          return (
            <div className="overview-actions-cell">
              <span className={`overview-action${recommendation.actions.viewEnabled ? "" : " is-disabled"}`}>View</span>
              <span className={`overview-action${recommendation.actions.applyEnabled ? "" : " is-disabled"}`}>Apply</span>
            </div>
          );
        },
      },
    ],
    [],
  );

  return (
    <PageSection
      title="Alerts & Recommendations"
      description="Active anomalies and recommendations with severity, effort, risk, and actions."
    >
      <div className="dashboard-showcase-grid dashboard-showcase-grid--tables">
        <TableShell
          title="Active Anomalies"
          subtitle={
            anomaliesData
              ? `${anomaliesData.summary.activeCount} active, ${anomaliesData.summary.highSeverityCount} high severity`
              : "Recent anomalies in selected scope"
          }
          actions={<MetricBadge tone="negative">High Severity Explicit</MetricBadge>}
        >
          {anomaliesLoading ? <p className="dashboard-note">Loading anomalies...</p> : null}
          {anomaliesErrorMessage ? <p className="dashboard-note">Failed to load anomalies: {anomaliesErrorMessage}</p> : null}
          {anomaliesData ? (
            <>
              <BaseDataTable
                columnDefs={anomalyColumns}
                rowData={anomaliesData.items}
                height={250}
                emptyMessage="No anomalies for current filters."
              />
              <div className="overview-pagination">
                <button type="button" className="overview-pagination__btn" disabled={anomaliesPage <= 1} onClick={onAnomaliesPrev}>
                  Previous
                </button>
                <span className="overview-pagination__meta">
                  Page {anomaliesData.pagination.page} / {Math.max(1, anomaliesData.pagination.totalPages)}
                </span>
                <button
                  type="button"
                  className="overview-pagination__btn"
                  disabled={anomaliesPage >= Math.max(1, anomaliesData.pagination.totalPages)}
                  onClick={onAnomaliesNext}
                >
                  Next
                </button>
              </div>
            </>
          ) : null}
        </TableShell>

        <TableShell
          title="Recommendations"
          subtitle={
            recommendationsData
              ? `${recommendationsData.summary.activeCount} active, ${currencyFormatterCompact.format(
                  recommendationsData.summary.estimatedSavingsTotal,
                )} estimated savings`
              : "Optimization opportunities in selected scope"
          }
          actions={
            <MetricBadge tone="accent">
              <AlertTriangle size={12} />
              Action Matrix
            </MetricBadge>
          }
        >
          {recommendationsLoading ? <p className="dashboard-note">Loading recommendations...</p> : null}
          {recommendationsErrorMessage ? (
            <p className="dashboard-note">Failed to load recommendations: {recommendationsErrorMessage}</p>
          ) : null}
          {recommendationsData ? (
            <>
              <BaseDataTable
                columnDefs={recommendationColumns}
                rowData={recommendationsData.items}
                height={250}
                emptyMessage="No recommendations for current filters."
              />
              <div className="overview-pagination">
                <button
                  type="button"
                  className="overview-pagination__btn"
                  disabled={recommendationsPage <= 1}
                  onClick={onRecommendationsPrev}
                >
                  Previous
                </button>
                <span className="overview-pagination__meta">
                  Page {recommendationsData.pagination.page} / {Math.max(1, recommendationsData.pagination.totalPages)}
                </span>
                <button
                  type="button"
                  className="overview-pagination__btn"
                  disabled={recommendationsPage >= Math.max(1, recommendationsData.pagination.totalPages)}
                  onClick={onRecommendationsNext}
                >
                  Next
                </button>
              </div>
            </>
          ) : null}
        </TableShell>
      </div>
    </PageSection>
  );
}
