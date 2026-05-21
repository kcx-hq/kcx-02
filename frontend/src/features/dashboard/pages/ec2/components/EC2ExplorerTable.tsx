import { useMemo } from "react";
import type { ColDef, ICellRendererParams } from "ag-grid-community";

import { BaseDataTable } from "../../../common/tables/BaseDataTable";
import { EmptyStateBlock } from "../../../common/components/EmptyStateBlock";

type EC2ExplorerTableRow = { id: string; [key: string]: string | number | null };

type EC2ExplorerTableProps = {
  metric: "cost" | "usage" | "instances" | "volumes" | "data-transfer";
  groupBy: string;
  loading: boolean;
  error: Error | null;
  table: {
    columns: Array<{ key: string; label: string }>;
    rows: EC2ExplorerTableRow[];
  } | null;
  onRetry: () => void;
  onRowClick: (row: EC2ExplorerTableRow) => void;
  onRecommendationClick?: (row: EC2ExplorerTableRow) => void;
};

const formatCellValue = (value: string | number | null): string => {
  if (value === null || typeof value === "undefined") return "0";
  if (typeof value === "number") {
    if (Number.isInteger(value)) return value.toLocaleString();
    return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
  }
  return value;
};

const CURRENCY_FORMATTER = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 5,
});

const formatCost = (value: string | number | null): string => {
  const numeric = typeof value === "number" ? value : Number(value ?? 0);
  return CURRENCY_FORMATTER.format(Number.isFinite(numeric) ? numeric : 0);
};

const formatGb = (value: string | number | null): string => {
  const numeric = typeof value === "number" ? value : Number(value ?? 0);
  return `${(Number.isFinite(numeric) ? numeric : 0).toFixed(2)} GB`;
};

export function EC2ExplorerTable({
  metric,
  groupBy,
  loading,
  error,
  table,
  onRetry,
  onRowClick,
  onRecommendationClick,
}: EC2ExplorerTableProps) {
  const columnDefs = useMemo<ColDef<EC2ExplorerTableRow>[]>(() => {
    if (!table) return [];
    const isDataTransferMetric = metric === "data-transfer";
    const isTransferTypeGrouping = groupBy === "transfer-type" || groupBy === "transfer_type";
    const gbColumns = new Set(["internetGb", "interAzGb", "regionalGb", "totalGb", "usageGb"]);
    const usageGbColumns = new Set(["networkInGb", "networkOutGb", "networkTotalGb"]);
    const cpuColumns = new Set(["avgCpu", "maxCpu"]);
    const costColumns = new Set([
      "cost",
      "dataTransferCost",
      "grossCost",
      "computeCost",
      "ebsCost",
      "snapshotCost",
      "eipCost",
      "otherCost",
    ]);
    const percentColumns = new Set(["pct", "percentOfTotal", "percentOfTransferCost"]);
    const countColumns = new Set(["instanceCount", "resourceCount"]);
    const defs = table.columns.map((column) => {
      const isRecommendationColumn = /recommendation/i.test(column.key) || /recommendation/i.test(column.label);
      return {
        headerName: column.label,
        field: column.key,
        minWidth: column.key === "group" ? 220 : column.key === "mainCostDriver" ? 170 : 130,
        maxWidth: column.key === "group" || column.key === "mainCostDriver" ? undefined : 190,
        pinned: column.key === "group" ? "left" : undefined,
        lockPinned: column.key === "group",
        suppressMovable: column.key === "group",
        cellClass: costColumns.has(column.key) || percentColumns.has(column.key) || countColumns.has(column.key)
          ? "ec2-explorer-table__cell--numeric s3-analytics-number-cell"
          : undefined,
        headerClass: costColumns.has(column.key) || percentColumns.has(column.key) || countColumns.has(column.key)
          ? "ec2-explorer-table__header--numeric"
          : undefined,
        valueFormatter: (params) => {
          const row = params.data;
          if (
            column.key === "resourceCount"
            && Number(params.value ?? 0) === 0
            && Number(row?.unmappedResourceCount ?? 0) > 0
          ) {
            return "Unmapped";
          }
          if (isDataTransferMetric && costColumns.has(column.key)) {
            return formatCost(params.value as string | number | null);
          }
          if (isDataTransferMetric && gbColumns.has(column.key)) {
            return formatGb(params.value as string | number | null);
          }
          if (usageGbColumns.has(column.key)) {
            return formatGb(params.value as string | number | null);
          }
          if (cpuColumns.has(column.key)) {
            if (params.value === null || typeof params.value === "undefined" || String(params.value).trim() === "") return "-";
            const numeric = Number(params.value ?? 0);
            return `${(Number.isFinite(numeric) ? numeric : 0).toFixed(2)}%`;
          }
          if (isDataTransferMetric && isTransferTypeGrouping && column.key === "pct") {
            const numeric = Number(params.value ?? 0);
            return `${(Number.isFinite(numeric) ? numeric : 0).toFixed(2)}%`;
          }
          if (costColumns.has(column.key)) {
            return formatCost(params.value as string | number | null);
          }
          if (percentColumns.has(column.key)) {
            const numeric = Number(params.value ?? 0);
            return `${(Number.isFinite(numeric) ? numeric : 0).toFixed(2)}%`;
          }
          if (countColumns.has(column.key)) {
            const numeric = Number(params.value ?? 0);
            return Number.isFinite(numeric) ? Math.round(numeric).toLocaleString() : "0";
          }
          return formatCellValue(params.value as string | number | null);
        },
        cellRenderer: isRecommendationColumn && onRecommendationClick
          ? (params: ICellRendererParams<EC2ExplorerTableRow, string | number | null>) => (
              <button
                type="button"
                className="optimization-rightsizing-view-btn"
                onClick={(event) => {
                  event.stopPropagation();
                  if (params.data) onRecommendationClick(params.data);
                }}
              >
                {formatCellValue(params.value ?? null)}
              </button>
            )
          : undefined,
      } satisfies ColDef<EC2ExplorerTableRow>;
    });
    return defs.map((columnDef) => {
      if (table.columns.some((column) => column.key === "dataTransferCost") && columnDef.field === "dataTransferCost") {
        return { ...columnDef, sort: "desc" as const };
      }
      return columnDef;
    });
  }, [groupBy, metric, onRecommendationClick, table]);

  if (loading) {
    return <div className="ec2-explorer-table__skeleton" aria-hidden="true" />;
  }

  if (error) {
    return (
      <EmptyStateBlock
        title="Unable to load explorer table"
        message={error.message || "An unexpected error occurred."}
        actions={
          <button type="button" className="cost-explorer-state-btn" onClick={onRetry}>
            Retry
          </button>
        }
      />
    );
  }

  if (!table || table.columns.length === 0 || table.rows.length === 0) {
    return (
      <EmptyStateBlock
        title="No data found"
        message="No data found for current filters. Try removing thresholds or filters."
      />
    );
  }

  return (
    <section className="ec2-explorer-table" aria-label="EC2 explorer table">
      <BaseDataTable
        columnDefs={columnDefs}
        rowData={table.rows}
        pagination
        paginationPageSize={10}
        autoHeight
        onRowClick={onRowClick}
      />
    </section>
  );
}
