import { useMemo } from "react";
import type { ColDef, ICellRendererParams } from "ag-grid-community";
import { ChevronsLeft, ChevronLeft, ChevronRight, ChevronsRight } from "lucide-react";

import { BaseDataTable } from "../../../common/tables/BaseDataTable";
import { TableShell } from "../../../common/tables/TableShell";
import type { DatabaseAssetRow, DatabaseAssetsPagination } from "../../../api/dashboardTypes";
import {
  displayDash,
  formatCurrency,
  formatInteger,
  formatPercent,
  formatStorageGb,
  formatThroughput,
} from "./db-assets.formatters";

type DatabaseAssetsTableProps = {
  rows: DatabaseAssetRow[];
  pagination: DatabaseAssetsPagination;
  isLoading?: boolean;
  onRowClick?: (row: DatabaseAssetRow) => void;
  onFirstPage: () => void;
  onPrevPage: () => void;
  onNextPage: () => void;
  onLastPage: () => void;
  onPageSizeChange: (pageSize: number) => void;
};

const statusTone = (value: string): string => {
  const normalized = value.trim().toLowerCase();
  if (["available", "active", "running"].includes(normalized)) return "positive";
  if (["stopped", "stopping", "degraded", "warning"].includes(normalized)) return "neutral";
  return "negative";
};

export function DatabaseAssetsTable({
  rows,
  pagination,
  isLoading = false,
  onRowClick,
  onFirstPage,
  onPrevPage,
  onNextPage,
  onLastPage,
  onPageSizeChange,
}: DatabaseAssetsTableProps) {
  const columnDefs = useMemo<ColDef<DatabaseAssetRow>[]>(
    () => [
      {
        headerName: "DB Identifier",
        minWidth: 220,
        cellRenderer: (params: ICellRendererParams<DatabaseAssetRow>) => {
          const row = params.data;
          if (!row) return "-";
          const primary = displayDash(row.dbIdentifier || row.resourceName);
          const secondary = row.resourceId && row.resourceId !== row.dbIdentifier ? row.resourceId : null;
          return (
            <div>
              <div>{primary}</div>
              {secondary ? <small style={{ opacity: 0.75 }}>{secondary}</small> : null}
            </div>
          );
        },
      },
      {
        headerName: "Engine",
        minWidth: 180,
        cellRenderer: (params: ICellRendererParams<DatabaseAssetRow>) => {
          const row = params.data;
          if (!row) return "-";
          const primary = displayDash(row.dbEngine);
          const secondary = displayDash(row.dbEngineVersion || row.dbService);
          return (
            <div>
              <div>{primary}</div>
              {secondary !== "-" ? <small style={{ opacity: 0.75 }}>{secondary}</small> : null}
            </div>
          );
        },
      },
      { headerName: "Instance Class", field: "instanceClass", minWidth: 150, valueFormatter: (p) => displayDash(p.value) },
      {
        headerName: "Region",
        minWidth: 140,
        valueGetter: (p) => p.data?.regionId || p.data?.regionName || "-",
      },
      {
        headerName: "Storage (GB)",
        minWidth: 130,
        valueGetter: (p) => p.data?.allocatedStorageGb ?? p.data?.storageUsedGb,
        valueFormatter: (p) => formatStorageGb(p.value),
      },
      {
        headerName: "IOPS / Throughput",
        minWidth: 170,
        cellRenderer: (params: ICellRendererParams<DatabaseAssetRow>) => {
          const row = params.data;
          if (!row) return "-";
          return (
            <div>
              <div>{formatInteger(row.avgIops)}</div>
              <small style={{ opacity: 0.75 }}>{formatThroughput(row.avgThroughputBytes)}</small>
            </div>
          );
        },
      },
      {
        headerName: "CPU %",
        minWidth: 110,
        cellRenderer: (params: ICellRendererParams<DatabaseAssetRow>) => {
          const row = params.data;
          if (!row) return "-";
          return (
            <div>
              <div>{formatPercent(row.avgCpu)}</div>
              {row.maxCpu !== null && typeof row.maxCpu !== "undefined" ? <small style={{ opacity: 0.75 }}>max {formatPercent(row.maxCpu)}</small> : null}
            </div>
          );
        },
      },
      {
        headerName: "Connections",
        minWidth: 130,
        cellRenderer: (params: ICellRendererParams<DatabaseAssetRow>) => {
          const row = params.data;
          if (!row) return "-";
          return (
            <div>
              <div>{formatInteger(row.avgConnections)}</div>
              {row.maxConnections !== null && typeof row.maxConnections !== "undefined" ? <small style={{ opacity: 0.75 }}>max {formatInteger(row.maxConnections)}</small> : null}
            </div>
          );
        },
      },
      { headerName: "Total Cost", field: "totalCost", minWidth: 130, valueFormatter: (p) => formatCurrency(p.value) },
      {
        headerName: "Status",
        minWidth: 120,
        cellRenderer: (params: ICellRendererParams<DatabaseAssetRow>) => {
          const value = String(params.data?.status ?? "").trim();
          if (!value) return <span className="cost-explorer-chip">-</span>;
          const tone = statusTone(value);
          const color = tone === "positive" ? "#0f766e" : tone === "negative" ? "#b91c1c" : "#334155";
          return <span className="cost-explorer-chip" style={{ color }}>{value}</span>;
        },
      },
      {
        headerName: "Recommendation",
        minWidth: 130,
        cellRenderer: (params: ICellRendererParams<DatabaseAssetRow>) => {
          const count = Number(params.data?.recommendationCount ?? 0);
          if (!Number.isFinite(count) || count <= 0) return <span style={{ opacity: 0.75 }}>None</span>;
          return <span className="cost-explorer-chip">{formatInteger(count)}</span>;
        },
      },
    ],
    [],
  );

  const totalPages = Math.max(1, pagination.totalPages || 1);
  const currentPage = Math.min(Math.max(1, pagination.page || 1), totalPages);
  const hasPrev = currentPage > 1;
  const hasNext = currentPage < totalPages;
  const total = Math.max(0, pagination.total || 0);
  const start = total === 0 ? 0 : (currentPage - 1) * pagination.pageSize + 1;
  const end = total === 0 ? 0 : Math.min(currentPage * pagination.pageSize, total);

  return (
    <TableShell title="Assets" subtitle="Database assets list across connected services">
      {isLoading ? <p className="dashboard-note">Loading assets...</p> : null}
      <div className="db-assets-table-wrap">
        <BaseDataTable
          columnDefs={columnDefs}
          rowData={rows}
          emptyMessage="No database assets found for current filters."
          onRowClick={onRowClick}
        />
      </div>
      <div className="db-assets-pagination">
        <div className="db-assets-pagination__left">
          <span className="db-assets-pagination__label">Page Size:</span>
          <label className="cost-explorer-field db-assets-pagination__size-field">
            <select
              className="cost-explorer-field__control"
              aria-label="Page size"
              value={pagination.pageSize}
              onChange={(event) => onPageSizeChange(Number(event.target.value))}
            >
              {[10, 20, 50].map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </label>
          <span className="db-assets-pagination__meta">{formatInteger(start)} to {formatInteger(end)} of {formatInteger(total)}</span>
        </div>
        <div className="db-assets-pagination__right">
          <span className="db-assets-pagination__page">Page {currentPage} of {totalPages}</span>
          <button type="button" className="db-assets-pagination__icon-btn" onClick={onFirstPage} disabled={!hasPrev} aria-label="First page">
            <ChevronsLeft size={16} />
          </button>
          <button type="button" className="db-assets-pagination__icon-btn" onClick={onPrevPage} disabled={!hasPrev} aria-label="Previous page">
            <ChevronLeft size={16} />
          </button>
          <button type="button" className="db-assets-pagination__icon-btn" onClick={onNextPage} disabled={!hasNext} aria-label="Next page">
            <ChevronRight size={16} />
          </button>
          <button type="button" className="db-assets-pagination__icon-btn" onClick={onLastPage} disabled={!hasNext} aria-label="Last page">
            <ChevronsRight size={16} />
          </button>
        </div>
      </div>
    </TableShell>
  );
}
