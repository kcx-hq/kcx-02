import { useEffect, useMemo, useRef, useState } from "react";
import type { ColDef } from "ag-grid-community";
import { ChevronDown } from "lucide-react";

import { EmptyStateBlock } from "../../../common/components/EmptyStateBlock";
import { BaseDataTable } from "../../../common/tables/BaseDataTable";

const detailCostFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 5,
  maximumFractionDigits: 5,
});

const detailQuantityFormatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 5,
});

const detailPercentFormatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const formatDateLabel = (value: string): string => {
  if (!value) return "--";
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric", timeZone: "UTC" });
};

type CostExplorerBreakdownSectionProps = {
  isLoading: boolean;
  isError: boolean;
  errorMessage?: string;
  chartReady: boolean;
  topBreakdowns: Array<{
    key: "service" | "service-category" | "resource" | "account" | "region";
    label: string;
    rows: Array<{
      name: string;
      subtitle?: string;
      costLabel: string;
      changeLabel: string;
      changeTone: "positive" | "negative" | "neutral";
    }>;
  }>;
  serviceDetailRows?: Array<{
    serviceName: string;
    resourceName: string;
    usageType: string;
    region: string;
    usageQuantity: number;
    unit: string;
    totalCost: number;
    date: string;
    percentageOfTotalServiceCost: number;
  }>;
  rowsPerPage: 5 | 10 | 15;
  onRowsPerPageChange: (limit: 5 | 10 | 15) => void;
  breakdownPagination: {
    currentPage: number;
    totalPages: number;
    totalRows: number;
    startRow: number;
    endRow: number;
  } | null;
  onBreakdownPageChange: (page: number) => void;
  onRetry: () => void;
  onReset: () => void;
};

export function CostExplorerBreakdownSection({
  isLoading,
  isError,
  errorMessage,
  chartReady,
  topBreakdowns,
  serviceDetailRows = [],
  rowsPerPage,
  onRowsPerPageChange,
  breakdownPagination,
  onBreakdownPageChange,
  onRetry,
  onReset,
}: CostExplorerBreakdownSectionProps) {
  const rowsMenuRef = useRef<HTMLDivElement | null>(null);
  const [rowsMenuOpen, setRowsMenuOpen] = useState(false);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (rowsMenuRef.current?.contains(target)) return;
      setRowsMenuOpen(false);
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setRowsMenuOpen(false);
      }
    };

    window.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("keydown", handleEscape);
    return () => {
      window.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("keydown", handleEscape);
    };
  }, []);

  const serviceDetailColumns = useMemo<ColDef<(typeof serviceDetailRows)[number]>[]>(
    () => [
      { headerName: "Service Name", field: "serviceName", minWidth: 170, pinned: "left" },
      { headerName: "Resource Name", field: "resourceName", minWidth: 220 },
      { headerName: "Usage Type", field: "usageType", minWidth: 220 },
      { headerName: "Region", field: "region", minWidth: 140 },
      {
        headerName: "Usage Quantity",
        field: "usageQuantity",
        minWidth: 160,
        valueFormatter: (params) => detailQuantityFormatter.format(Number(params.value ?? 0)),
      },
      { headerName: "Unit", field: "unit", minWidth: 110 },
      {
        headerName: "Total Cost",
        field: "totalCost",
        minWidth: 160,
        valueFormatter: (params) => detailCostFormatter.format(Number(params.value ?? 0)),
      },
      {
        headerName: "Date",
        field: "date",
        minWidth: 140,
        valueFormatter: (params) => formatDateLabel(String(params.value ?? "")),
      },
      {
        headerName: "Percentage of Total Service Cost",
        field: "percentageOfTotalServiceCost",
        minWidth: 250,
        valueFormatter: (params) => `${detailPercentFormatter.format(Number(params.value ?? 0))}%`,
      },
    ],
    [serviceDetailRows],
  );

  return (
    <section className="cost-explorer-table-panel" aria-label="Services by cost table">
      {isLoading ? <div className="cost-explorer-chart-skeleton" aria-hidden="true" /> : null}
      {isError ? (
        <EmptyStateBlock
          title="Unable to load cost breakdown"
          message={errorMessage || "An unexpected error occurred."}
          actions={
            <button type="button" className="cost-explorer-state-btn" onClick={onRetry}>
              Retry
            </button>
          }
        />
      ) : null}
      {!isLoading && !isError && !chartReady ? (
        <EmptyStateBlock
          title="No breakdown data for this filter context"
          message="Try expanding the date range or reducing comparison layers."
          actions={
            <button type="button" className="cost-explorer-state-btn" onClick={onReset}>
              Reset filters
            </button>
          }
        />
      ) : null}
      {!isLoading && !isError && chartReady && topBreakdowns.length ? (
        <div className={`cost-explorer-breakdown-grid${topBreakdowns.length === 1 ? " is-single" : ""}`} aria-label="Cost breakdowns">
          {topBreakdowns.map((group) => (
            <div
              key={group.key}
              className={`cost-explorer-breakdown-block${group.key === "service" ? " cost-explorer-breakdown-block--service" : ""}`}
            >
              {group.key !== "service" ? (
                <div className="cost-explorer-breakdown-block__head">
                  <p className="cost-explorer-breakdown-block__title">{group.label}</p>
                  <div className="cost-explorer-breakdown-controls">
                    <div className="cost-explorer-breakdown-limit" ref={rowsMenuRef}>
                      <button
                        type="button"
                        className={`cost-explorer-breakdown-limit__trigger${rowsMenuOpen ? " is-open" : ""}`}
                        onClick={() => setRowsMenuOpen((current) => !current)}
                        aria-haspopup="menu"
                        aria-expanded={rowsMenuOpen}
                      >
                        <span>Rows: {rowsPerPage}</span>
                        <ChevronDown size={14} aria-hidden="true" />
                      </button>
                      {rowsMenuOpen ? (
                        <div className="cost-explorer-breakdown-limit__menu" role="menu" aria-label="Rows per page">
                          {[5, 10, 15].map((limit) => {
                            const limitValue = limit as 5 | 10 | 15;
                            const isActive = rowsPerPage === limitValue;
                            return (
                              <button
                                key={limit}
                                type="button"
                                role="menuitemradio"
                                aria-checked={isActive}
                                className={`cost-explorer-breakdown-limit__item${isActive ? " is-active" : ""}`}
                                onClick={() => {
                                  onRowsPerPageChange(limitValue);
                                  setRowsMenuOpen(false);
                                }}
                              >
                                {limit}
                              </button>
                            );
                          })}
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              ) : null}
              <div
                className={`cost-explorer-breakdown-table-wrap${group.key === "service" ? " cost-explorer-breakdown-table-wrap--service" : ""}`}
              >
                {group.key === "service" ? (
                  <BaseDataTable
                    columnDefs={serviceDetailColumns}
                    rowData={serviceDetailRows}
                    height={520}
                    emptyMessage="No service detail rows available for this filter context."
                    pagination
                    paginationPageSize={10}
                    autoHeight
                  />
                ) : (
                  <table className="cost-explorer-breakdown-table">
                    <thead>
                      <tr>
                        <th scope="col">Name</th>
                        <th scope="col">Cost</th>
                        <th scope="col">Change</th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.rows.map((row) => (
                        <tr key={`${group.key}-${row.name}`}>
                          <td>
                            <div className="cost-explorer-breakdown-table__name-main">{row.name}</div>
                            {row.subtitle ? <div className="cost-explorer-breakdown-table__name-sub">{row.subtitle}</div> : null}
                          </td>
                          <td>{row.costLabel}</td>
                          <td className={`cost-explorer-breakdown-table__change is-${row.changeTone}`}>{row.changeLabel}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
              {breakdownPagination && group.key !== "service" ? (
                <div className="cost-explorer-breakdown-pagination">
                  <p className="cost-explorer-breakdown-pagination__meta">
                    {breakdownPagination.startRow}-{breakdownPagination.endRow} of {breakdownPagination.totalRows}
                  </p>
                  <div className="cost-explorer-breakdown-pagination__actions">
                    <button
                      type="button"
                      className="cost-explorer-breakdown-pagination__btn"
                      disabled={breakdownPagination.currentPage <= 1}
                      onClick={() => onBreakdownPageChange(breakdownPagination.currentPage - 1)}
                    >
                      Prev
                    </button>
                    <span className="cost-explorer-breakdown-pagination__page">
                      Page {breakdownPagination.currentPage} / {breakdownPagination.totalPages}
                    </span>
                    <button
                      type="button"
                      className="cost-explorer-breakdown-pagination__btn"
                      disabled={breakdownPagination.currentPage >= breakdownPagination.totalPages}
                      onClick={() => onBreakdownPageChange(breakdownPagination.currentPage + 1)}
                    >
                      Next
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}

