import { Download, Search } from "lucide-react";

const TABLE_HEADERS = [
  "Start Date",
  "Insight",
  "Duration",
  "Account ID",
  "Account Name",
  "Service",
  "Region",
  "Cost Impact Type",
  "Cost Impact",
  "Cost Impact Percentage",
  "Cost",
  "Status",
  "Severity",
];

export type AnomalyTableRow = {
  id: string;
  startDate: string;
  insight: string;
  duration: string;
  accountId: string;
  accountName: string;
  service: string;
  region: string;
  costImpactType: string;
  costImpact: string;
  costImpactPercentage: string;
  cost: string;
  status: string;
  severity: string;
};

type AnomalyDetectionTableProps = {
  rows: AnomalyTableRow[];
  activeCount: number;
  inactiveCount: number;
  searchTerm: string;
  onSearchTermChange: (value: string) => void;
  isLoading: boolean;
  errorMessage: string | null;
};

const CELL_VALUE_BY_HEADER: Record<string, (row: AnomalyTableRow) => string> = {
  "Start Date": (row) => row.startDate,
  Insight: (row) => row.insight,
  Duration: (row) => row.duration,
  "Account ID": (row) => row.accountId,
  "Account Name": (row) => row.accountName,
  Service: (row) => row.service,
  Region: (row) => row.region,
  "Cost Impact Type": (row) => row.costImpactType,
  "Cost Impact": (row) => row.costImpact,
  "Cost Impact Percentage": (row) => row.costImpactPercentage,
  Cost: (row) => row.cost,
  Status: (row) => row.status,
  Severity: (row) => row.severity,
};

export function AnomalyDetectionTable({
  rows,
  activeCount,
  inactiveCount,
  searchTerm,
  onSearchTermChange,
  isLoading,
  errorMessage,
}: AnomalyDetectionTableProps) {
  return (
    <section className="anomaly-ref-table-shell" aria-label="Anomaly table">
      <div className="anomaly-ref-table-toolbar">
        <div className="anomaly-ref-table-toolbar__left">
          <button type="button" className="anomaly-ref-btn anomaly-ref-btn--subtle">
            Submit Feedback
          </button>
          <button type="button" className="anomaly-ref-btn anomaly-ref-btn--subtle">
            <Download size={13} />
            Export
          </button>
        </div>

        <div className="anomaly-ref-table-toolbar__right">
          <span className="anomaly-ref-pill anomaly-ref-pill--active">Active {activeCount}</span>
          <span className="anomaly-ref-pill">Inactive {inactiveCount}</span>
          <label className="anomaly-ref-search" aria-label="Search">
            <Search size={13} />
            <input
              type="text"
              placeholder="Search"
              value={searchTerm}
              onChange={(event) => onSearchTermChange(event.target.value)}
            />
          </label>
        </div>
      </div>

      <div className="anomaly-ref-table-scroll">
        <table className="anomaly-ref-table">
          <thead>
            <tr>
              {TABLE_HEADERS.map((header) => (
                <th key={header}>{header}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading
              ? Array.from({ length: 10 }).map((_, rowIndex) => (
                  <tr key={`loading-row-${rowIndex}`}>
                    {TABLE_HEADERS.map((header) => (
                      <td key={`${header}-${rowIndex}`}>
                        <span className="anomaly-ref-cell-placeholder" />
                      </td>
                    ))}
                  </tr>
                ))
              : null}
            {!isLoading && errorMessage ? (
              <tr>
                <td colSpan={TABLE_HEADERS.length}>{errorMessage}</td>
              </tr>
            ) : null}
            {!isLoading && !errorMessage && rows.length === 0 ? (
              <tr>
                <td colSpan={TABLE_HEADERS.length}>No anomalies found for selected filters.</td>
              </tr>
            ) : null}
            {!isLoading && !errorMessage
              ? rows.map((row) => (
                  <tr key={row.id}>
                    {TABLE_HEADERS.map((header) => (
                      <td key={`${header}-${row.id}`}>{CELL_VALUE_BY_HEADER[header](row)}</td>
                    ))}
                  </tr>
                ))
              : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}
