import type {
  DatabaseRecommendationType,
  DatabaseRecommendationListItem,
  DatabaseRecommendationListResponse,
} from "../../../api/dashboardTypes";
import { EmptyStateBlock } from "../../../common/components";
import { DatabaseRecommendationsFilters, type DatabaseRecommendationsFiltersValue } from "./db-recommendations-filters";
import { DatabaseRecommendationsTable } from "./db-recommendations-table";
import { formatCurrency, formatInteger } from "./db-recommendations.formatters";

type DatabaseRecommendationFamilyTabProps = {
  tabLabel: string;
  rows: DatabaseRecommendationListItem[];
  listData: DatabaseRecommendationListResponse | undefined;
  filtersState: DatabaseRecommendationsFiltersValue;
  page: number;
  limit: number;
  pageLoading: boolean;
  showError: boolean;
  isRefreshing: boolean;
  isGenerating: boolean;
  actionLabel: "View details" | "Review evidence" | "View";
  tablePreset: DatabaseRecommendationType;
  emptyStateMessage: string;
  onFiltersChange: (next: DatabaseRecommendationsFiltersValue) => void;
  onClearFilters: () => void;
  onOpenRow: (row: DatabaseRecommendationListItem) => void;
  onLimitChange: (nextLimit: number) => void;
  onPrevPage: () => void;
  onNextPage: () => void;
  onRefresh: () => void;
};

const ACTIVE_STATUSES = new Set(["OPEN", "IN_PROGRESS", "SNOOZED"]);

const toUpper = (value: string | null | undefined): string => String(value ?? "").trim().toUpperCase();

const isEvidenceBacked = (value: string | null | undefined): boolean => {
  const normalized = String(value ?? "").trim().toLowerCase();
  return normalized === "inventory_backed" || normalized === "telemetry_backed";
};

function buildFamilySummaryCards(rows: DatabaseRecommendationListItem[], tablePreset: DatabaseRecommendationType) {
  const total = rows.length;
  const openReviews = rows.filter((row) => ACTIVE_STATUSES.has(toUpper(row.status))).length;
  const evidenceBacked = rows.filter((row) => isEvidenceBacked(row.evidence_level)).length;
  const telemetryBacked = rows.filter((row) => String(row.evidence_level ?? "").trim().toLowerCase() === "telemetry_backed").length;
  const warningsTotal = rows.reduce((sum, row) => sum + (Number.isFinite(row.warnings_count) ? row.warnings_count : 0), 0);
  const estimatedSavingsTotal = rows.reduce((sum, row) => {
    const value = row.estimated_monthly_savings;
    if (value == null || value <= 0) return sum;
    return sum + value;
  }, 0);
  const savingsVisibility = estimatedSavingsTotal > 0 ? formatCurrency(estimatedSavingsTotal) : "Not estimated";
  const primaryEvidence = telemetryBacked > 0 ? "telemetry-backed" : evidenceBacked > 0 ? "inventory-backed" : "billing-backed";
  const warningLabel = warningsTotal === 1 ? "1 warning" : `${formatInteger(warningsTotal)} warnings`;

  if (tablePreset === "DB_STORAGE_OPTIMIZATION") {
    const countLabel = total === 1 ? "1 storage recommendation" : `${formatInteger(total)} storage recommendations`;
    const openLabel = openReviews === 1 ? "1 open review" : `${formatInteger(openReviews)} open reviews`;
    const savingsLabel = savingsVisibility === "Not estimated" ? "savings not estimated" : `estimated savings ${savingsVisibility}`;
    return [countLabel, openLabel, primaryEvidence, warningLabel, savingsLabel];
  }

  if (tablePreset === "DB_IDLE_CANDIDATE") {
    const countLabel = total === 1 ? "1 idle candidate" : `${formatInteger(total)} idle candidates`;
    return [countLabel, `${formatInteger(openReviews)} open reviews`, primaryEvidence, warningLabel];
  }

  if (tablePreset === "DB_HA_COST_OPTIMIZATION") {
    const countLabel = total === 1 ? "1 HA review" : `${formatInteger(total)} HA reviews`;
    const postureLabel = "topology review only";
    return [countLabel, `${formatInteger(openReviews)} open reviews`, primaryEvidence, warningLabel, postureLabel];
  }

  const countLabel = total === 1 ? "1 engine/deployment review" : `${formatInteger(total)} engine/deployment reviews`;
  const telemetryHint = telemetryBacked > 0 ? "telemetry-backed" : "sparse telemetry";
  return [countLabel, `${formatInteger(openReviews)} open reviews`, telemetryHint, warningLabel, "metadata-backed"];
}

export function DatabaseRecommendationFamilyTab({
  tabLabel,
  rows,
  listData,
  filtersState,
  page,
  limit,
  pageLoading,
  showError,
  isRefreshing,
  isGenerating,
  actionLabel,
  tablePreset,
  emptyStateMessage,
  onFiltersChange,
  onClearFilters,
  onOpenRow,
  onLimitChange,
  onPrevPage,
  onNextPage,
  onRefresh,
}: DatabaseRecommendationFamilyTabProps) {
  const summaryParts = buildFamilySummaryCards(rows, tablePreset);

  return (
    <>
      <DatabaseRecommendationsFilters
        value={filtersState}
        filterOptions={listData?.filterOptions}
        onChange={onFiltersChange}
        onClear={onClearFilters}
      />

      {!showError ? (
        <section className="dashboard-table-shell">
          <div className="dashboard-table-shell__body">
            <p className="dashboard-note">
              {summaryParts.join(" · ")}
            </p>
          </div>
        </section>
      ) : null}

      {pageLoading ? <p className="dashboard-note">Loading database recommendations...</p> : null}
      {showError ? <p className="dashboard-note">Unable to load database recommendations.</p> : null}

      {!showError && !pageLoading && rows.length === 0 ? (
        <EmptyStateBlock
          title={`No ${tabLabel.toLowerCase()} recommendations`}
          message={emptyStateMessage}
          actions={(
            <button type="button" className="cost-explorer-state-btn" onClick={onRefresh} disabled={isGenerating}>
              {isGenerating ? "Refreshing..." : "Refresh recommendations"}
            </button>
          )}
        />
      ) : null}

      {!showError && rows.length > 0 ? (
        <>
          <DatabaseRecommendationsTable
            rows={rows}
            isLoading={isRefreshing && !pageLoading}
            onRowClick={onOpenRow}
            actionLabel={actionLabel}
            preset={tablePreset}
          />
          <div className="db-assets-pagination">
            <div className="db-assets-pagination__left">
              <span className="db-assets-pagination__label">Page Size:</span>
              <label className="cost-explorer-field db-assets-pagination__size-field">
                <select
                  className="cost-explorer-field__control"
                  aria-label="Page size"
                  value={limit}
                  onChange={(event) => onLimitChange(Number(event.target.value))}
                >
                  {[10, 20, 50].map((size) => (
                    <option key={size} value={size}>
                      {size}
                    </option>
                  ))}
                </select>
              </label>
              <span className="db-assets-pagination__meta">
                Page {listData?.pagination.page ?? page} of {Math.max(1, listData?.pagination.totalPages ?? 1)}
              </span>
            </div>
            <div className="db-assets-pagination__right">
              <button
                type="button"
                className="db-assets-pagination__icon-btn"
                disabled={(listData?.pagination.page ?? page) <= 1}
                onClick={onPrevPage}
              >
                Prev
              </button>
              <button
                type="button"
                className="db-assets-pagination__icon-btn"
                disabled={(listData?.pagination.page ?? page) >= Math.max(1, listData?.pagination.totalPages ?? 1)}
                onClick={onNextPage}
              >
                Next
              </button>
            </div>
          </div>
        </>
      ) : null}
    </>
  );
}
