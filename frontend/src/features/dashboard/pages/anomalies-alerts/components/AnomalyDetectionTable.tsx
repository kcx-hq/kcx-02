import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Download, Search } from "lucide-react";
import { Link } from "react-router-dom";

const TABLE_HEADERS = [
  "Start Date",
  "Duration",
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
  getRowHref?: (row: AnomalyTableRow) => string | null;
  getRowState?: (row: AnomalyTableRow) => unknown;
};

const CELL_VALUE_BY_HEADER: Record<string, (row: AnomalyTableRow) => string> = {
  "Start Date": (row) => row.startDate,
  Duration: (row) => row.duration,
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

const HEADER_CELL_CLASS: Record<string, string> = {
  "Start Date": "is-date",
  Duration: "is-duration",
  "Account Name": "is-account",
  Service: "is-service",
  Region: "is-region",
  "Cost Impact Type": "is-impact-type",
  "Cost Impact": "is-numeric",
  "Cost Impact Percentage": "is-numeric",
  Cost: "is-numeric",
  Status: "is-status",
  Severity: "is-severity",
};

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100] as const;

export function AnomalyDetectionTable({
  rows,
  activeCount,
  inactiveCount,
  searchTerm,
  onSearchTermChange,
  isLoading,
  errorMessage,
  getRowHref,
  getRowState,
}: AnomalyDetectionTableProps) {
  const [pageSize, setPageSize] = useState<number>(10);
  const [page, setPage] = useState<number>(1);

  useEffect(() => {
    setPage(1);
  }, [searchTerm, rows.length, pageSize, isLoading]);

  const totalRows = rows.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageStartIndex = totalRows === 0 ? 0 : (safePage - 1) * pageSize;
  const pageEndExclusive = Math.min(pageStartIndex + pageSize, totalRows);
  const pagedRows = useMemo(() => rows.slice(pageStartIndex, pageEndExclusive), [rows, pageStartIndex, pageEndExclusive]);

  const rangeStart = totalRows === 0 ? 0 : pageStartIndex + 1;
  const rangeEnd = totalRows === 0 ? 0 : pageEndExclusive;
  const hasPrev = safePage > 1;
  const hasNext = safePage < totalPages;

  return (
    <section className="anomaly-ref-table-shell" aria-label="Anomaly table">
      <div className="anomaly-ref-table-toolbar">
        <div className="anomaly-ref-table-toolbar__left">
          {isLoading ? (
            <>
              <span className="anomaly-ref-toolbar-skeleton anomaly-ref-toolbar-skeleton--btn-lg" aria-hidden="true" />
              <span className="anomaly-ref-toolbar-skeleton anomaly-ref-toolbar-skeleton--btn-sm" aria-hidden="true" />
            </>
          ) : (
            <>
              <button type="button" className="anomaly-ref-btn anomaly-ref-btn--subtle">
                Submit Feedback
              </button>
              <button type="button" className="anomaly-ref-btn anomaly-ref-btn--subtle">
                <Download size={13} />
                Export
              </button>
            </>
          )}
        </div>

        <div className="anomaly-ref-table-toolbar__right">
          {isLoading ? (
            <>
              <span className="anomaly-ref-toolbar-skeleton anomaly-ref-toolbar-skeleton--pill" aria-hidden="true" />
              <span className="anomaly-ref-toolbar-skeleton anomaly-ref-toolbar-skeleton--pill" aria-hidden="true" />
              <span className="anomaly-ref-toolbar-skeleton anomaly-ref-toolbar-skeleton--search" aria-hidden="true" />
            </>
          ) : (
            <>
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
            </>
          )}
        </div>
      </div>

      <div className="anomaly-ref-table-scroll">
        <table className="anomaly-ref-table">
          <colgroup>
            <col style={{ width: "120px" }} />
            <col style={{ width: "120px" }} />
            <col style={{ width: "180px" }} />
            <col style={{ width: "140px" }} />
            <col style={{ width: "130px" }} />
            <col style={{ width: "150px" }} />
            <col style={{ width: "130px" }} />
            <col style={{ width: "170px" }} />
            <col style={{ width: "130px" }} />
            <col style={{ width: "110px" }} />
            <col style={{ width: "110px" }} />
          </colgroup>
          <thead>
            <tr>
              {TABLE_HEADERS.map((header) => (
                <th key={header} className={HEADER_CELL_CLASS[header] ?? ""}>
                  {isLoading ? <span className="anomaly-ref-header-placeholder" aria-hidden="true" /> : header}
                </th>
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
              ? pagedRows.map((row) => (
                  <tr key={row.id}>
                    {TABLE_HEADERS.map((header) => {
                      const value = CELL_VALUE_BY_HEADER[header](row);
                      const cellClass = HEADER_CELL_CLASS[header] ?? "";
                      return (
                        <td key={`${header}-${row.id}`} className={cellClass}>
                          {header === "Start Date" && getRowHref ? (
                            <Link to={getRowHref(row) ?? "#"} state={getRowState ? getRowState(row) : undefined} className="anomaly-ref-date-link">
                              <span>{value}</span>
                            </Link>
                          ) : (
                            value
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))
              : null}
          </tbody>
        </table>
      </div>

      <div className="anomaly-ref-pagination">
        {isLoading ? (
          <>
            <div className="anomaly-ref-pagination__left">
              <span className="anomaly-ref-pagination-skeleton anomaly-ref-pagination-skeleton--label" aria-hidden="true" />
              <span className="anomaly-ref-pagination-skeleton anomaly-ref-pagination-skeleton--field" aria-hidden="true" />
              <span className="anomaly-ref-pagination-skeleton anomaly-ref-pagination-skeleton--meta" aria-hidden="true" />
            </div>
            <div className="anomaly-ref-pagination__right">
              <span className="anomaly-ref-pagination-skeleton anomaly-ref-pagination-skeleton--page" aria-hidden="true" />
              <span className="anomaly-ref-pagination-skeleton anomaly-ref-pagination-skeleton--icon" aria-hidden="true" />
              <span className="anomaly-ref-pagination-skeleton anomaly-ref-pagination-skeleton--icon" aria-hidden="true" />
              <span className="anomaly-ref-pagination-skeleton anomaly-ref-pagination-skeleton--icon" aria-hidden="true" />
              <span className="anomaly-ref-pagination-skeleton anomaly-ref-pagination-skeleton--icon" aria-hidden="true" />
            </div>
          </>
        ) : (
          <>
            <div className="anomaly-ref-pagination__left">
              <label className="anomaly-ref-pagination__label" htmlFor="anomaly-page-size">
                Page Size:
              </label>
              <label className="cost-explorer-field anomaly-ref-pagination__size-field">
                <select
                  id="anomaly-page-size"
                  value={pageSize}
                  onChange={(event) => {
                    const next = Number(event.target.value);
                    setPageSize(next);
                    setPage(1);
                  }}
                  disabled={isLoading}
                >
                  {PAGE_SIZE_OPTIONS.map((size) => (
                    <option key={size} value={size}>
                      {size}
                    </option>
                  ))}
                </select>
              </label>
              <span className="anomaly-ref-pagination__meta">
                {rangeStart} to {rangeEnd} of {totalRows}
              </span>
            </div>

            <div className="anomaly-ref-pagination__right">
              <span className="anomaly-ref-pagination__page">Page {safePage} of {totalPages}</span>
              <button type="button" className="anomaly-ref-pagination__icon-btn" onClick={() => setPage(1)} disabled={!hasPrev || isLoading} aria-label="First page">
                <ChevronsLeft size={14} />
              </button>
              <button type="button" className="anomaly-ref-pagination__icon-btn" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={!hasPrev || isLoading} aria-label="Previous page">
                <ChevronLeft size={14} />
              </button>
              <button type="button" className="anomaly-ref-pagination__icon-btn" onClick={() => setPage((current) => Math.min(totalPages, current + 1))} disabled={!hasNext || isLoading} aria-label="Next page">
                <ChevronRight size={14} />
              </button>
              <button type="button" className="anomaly-ref-pagination__icon-btn" onClick={() => setPage(totalPages)} disabled={!hasNext || isLoading} aria-label="Last page">
                <ChevronsRight size={14} />
              </button>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
