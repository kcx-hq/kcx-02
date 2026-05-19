import { useMemo, useState } from "react";
import type { ColDef } from "ag-grid-community";

import { BaseDataTable } from "../../../../common/tables/BaseDataTable";

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 5,
  maximumFractionDigits: 5,
});

const quantityFormatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const quantityFormatterPrecise = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 5,
  maximumFractionDigits: 5,
});
const quantityFormatterCount = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 0,
});

export type S3UsageInsightsRow = {
  usageType: string;
  operation: string;
  cost: number;
  quantity: number;
  unit: string;
};

export type S3BucketUsageRow = {
  bucketName: string;
  quantity: number;
  storageGb?: number;
  transferGb?: number;
  requestCount?: number;
  objectCount?: number;
  region: string;
  dominantUsageType: "Request Heavy" | "Storage Heavy" | "Transfer Heavy" | "Retrieval Heavy" | "Mixed Heavy";
};

type Props = {
  rows: S3UsageInsightsRow[];
  bucketRows?: S3BucketUsageRow[];
  bucketQuantityLabel?: string;
  usageCategory?: "" | "storage" | "data_transfer" | "request" | "object_count";
  showAllCategoryBreakdown?: boolean;
  onBucketClick?: (bucketName: string) => void;
};

export function S3UsageInsightsTable({
  rows,
  bucketRows,
  bucketQuantityLabel = "Usage Quantity",
  usageCategory = "",
  showAllCategoryBreakdown = false,
  onBucketClick,
}: Props) {
  const [search, setSearch] = useState("");
  const normalizedSearch = search.trim().toLowerCase();

  const usageColumnDefs = useMemo<ColDef<any>[]>(
    () => [
      { headerName: "Usage Type", field: "usageType", minWidth: 260 },
      { headerName: "Operation", field: "operation", minWidth: 220 },
      {
        headerName:
          usageCategory === "storage"
            ? "Storage (GB)"
            : usageCategory === "request"
              ? "Requests (Count)"
              : usageCategory === "object_count"
                ? "Object Count"
                : "Usage Quantity",
        field: "quantity",
        minWidth: 170,
        valueFormatter: (params) => quantityFormatter.format(Number(params.value ?? 0)),
      },
      { headerName: "Unit", field: "unit", minWidth: 140 },
      {
        headerName: "Cost",
        field: "cost",
        minWidth: 170,
        valueFormatter: (params) => currencyFormatter.format(Number(params.value ?? 0)),
      },
    ],
    [usageCategory],
  );
  const bucketColumnDefs = useMemo<ColDef<any>[]>(
    () => [
      {
        headerName: "Bucket",
        field: "bucketName",
        minWidth: 320,
        width: 360,
        maxWidth: 420,
        pinned: "left",
        lockPinned: true,
        lockPosition: "left",
        suppressMovable: true,
        flex: 0,
        cellRenderer: (params: { value: string }) => {
          const bucketName = String(params.value ?? "");
          if (!bucketName) return <span>-</span>;
          return (
            <button
              type="button"
              onClick={() => onBucketClick?.(bucketName)}
              style={{
                border: 0,
                background: "transparent",
                padding: 0,
                color: "#1f5c86",
                textDecoration: "underline",
                fontWeight: 600,
                cursor: "pointer",
                textAlign: "left",
              }}
            >
              {bucketName}
            </button>
          );
        },
      },
      {
        headerName: "Storage (GB)",
        field: "storageGb",
        minWidth: 170,
        valueFormatter: (params: { value: number }) => quantityFormatterPrecise.format(Number(params.value ?? 0)),
      },
      {
        headerName: "Transfer (GB)",
        field: "transferGb",
        minWidth: 170,
        valueFormatter: (params: { value: number }) => quantityFormatterPrecise.format(Number(params.value ?? 0)),
      },
      {
        headerName: "Request Count",
        field: "requestCount",
        minWidth: 180,
        valueFormatter: (params: { value: number }) => quantityFormatterCount.format(Number(params.value ?? 0)),
      },
      {
        headerName: "Object Count",
        field: "objectCount",
        minWidth: 170,
        valueFormatter: (params: { value: number }) => quantityFormatterCount.format(Number(params.value ?? 0)),
      },
      { headerName: "Region", field: "region", minWidth: 150 },
      { headerName: "Dominant Usage Type", field: "dominantUsageType", minWidth: 240 },
    ],
    [onBucketClick],
  );

  const showingBucketTable = Array.isArray(bucketRows) && bucketRows.length > 0;
  const filteredBucketRows = useMemo(() => {
    if (!showingBucketTable || normalizedSearch.length === 0) return bucketRows ?? [];
    return (bucketRows ?? []).filter((row) => {
      const bucketName = String(row.bucketName ?? "").toLowerCase();
      const region = String(row.region ?? "").toLowerCase();
      const dominantUsageType = String(row.dominantUsageType ?? "").toLowerCase();
      return (
        bucketName.includes(normalizedSearch) ||
        region.includes(normalizedSearch) ||
        dominantUsageType.includes(normalizedSearch)
      );
    });
  }, [bucketRows, normalizedSearch, showingBucketTable]);

  const filteredUsageRows = useMemo(() => {
    if (showingBucketTable || normalizedSearch.length === 0) return rows;
    return rows.filter((row) => {
      const usageType = String(row.usageType ?? "").toLowerCase();
      const operation = String(row.operation ?? "").toLowerCase();
      const unit = String(row.unit ?? "").toLowerCase();
      return (
        usageType.includes(normalizedSearch) ||
        operation.includes(normalizedSearch) ||
        unit.includes(normalizedSearch)
      );
    });
  }, [rows, normalizedSearch, showingBucketTable]);

  return (
    <div className="s3-usage-table-shell">
      <div className="s3-usage-table-shell__toolbar">
        <input
          type="search"
          className="s3-usage-table-shell__search"
          placeholder={showingBucketTable ? "Search bucket, region, usage info..." : "Search usage type, operation..."}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          aria-label="Search S3 usage table"
        />
      </div>
      <BaseDataTable
        columnDefs={showingBucketTable ? bucketColumnDefs : usageColumnDefs}
        rowData={showingBucketTable ? (filteredBucketRows as any[]) : (filteredUsageRows as any[])}
        emptyMessage="No usage rows available for the selected filters."
        pagination
        paginationPageSize={10}
        autoHeight
      />
    </div>
  );
}
