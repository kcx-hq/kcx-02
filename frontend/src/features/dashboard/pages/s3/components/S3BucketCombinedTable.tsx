import { useMemo } from "react";
import type { ColDef, ICellRendererParams } from "ag-grid-community";
import { BaseDataTable } from "../../../common/tables/BaseDataTable";

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 5,
  maximumFractionDigits: 5,
});

const decimalFormatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const percentFormatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const bytesToReadable = (value: number | null): string => {
  if (value == null || Number.isNaN(value) || value <= 0) return "--";
  const tebibytes = value / 1024 ** 4;
  if (tebibytes >= 1) return `${decimalFormatter.format(tebibytes)} TB`;
  const gibibytes = value / 1024 ** 3;
  return `${decimalFormatter.format(gibibytes)} GB`;
};

export type S3BucketCombinedRow = {
  bucketName: string;
  account: string;
  region: string;
  grossCost: number;
  storageSizeBytes: number | null;
  objectCount: number | null;
  storageClassMix: string;
  requestCost: number;
  transferCost: number;
  primaryUsagePattern: string;
  monthlyGrowthPct: number | null;
  lastAccessLabel: string;
  lifecycleStatus: string;
  governanceStatus: string;
  publicAccess: string;
  versioning: string;
  encryption: string;
  optimizationSignal: string;
  potentialSavings: number;
  publicRiskScore: number;
  lastAccessOrder: number;
  lastAccessEpoch: number | null;
};

type Props = {
  rows: S3BucketCombinedRow[];
  height?: number;
  onBucketClick?: (bucketName: string) => void;
};

export function S3BucketCombinedTable({ rows, height = 520, onBucketClick }: Props) {
  const columnDefs = useMemo<ColDef<S3BucketCombinedRow>[]>(
    () => [
      {
        headerName: "Bucket Name",
        field: "bucketName",
        width: 260,
        minWidth: 220,
        pinned: "left",
        cellRenderer: (params: ICellRendererParams<S3BucketCombinedRow, string>) => {
          const bucketName = String(params.value ?? "");
          if (!bucketName) return <span>-</span>;
          return (
            <div className="s3-bucket-name-scroll" title={bucketName}>
              <button
                type="button"
                title={`Open details for ${bucketName}`}
                onClick={() => onBucketClick?.(bucketName)}
                className="s3-bucket-name-scroll__btn"
              >
                {bucketName}
              </button>
            </div>
          );
        },
      },
      {
        headerName: "Gross Cost",
        field: "grossCost",
        minWidth: 165,
        valueFormatter: (params) => currencyFormatter.format(Number(params.value ?? 0)),
      },
      {
        headerName: "Storage Size",
        field: "storageSizeBytes",
        minWidth: 150,
        valueFormatter: (params) => bytesToReadable(params.value == null ? null : Number(params.value)),
      },
      {
        headerName: "Monthly Growth",
        field: "monthlyGrowthPct",
        minWidth: 145,
        valueFormatter: (params) => {
          const value = params.value;
          if (value === null || typeof value === "undefined") return "--";
          const numeric = Number(value);
          const sign = numeric > 0 ? "+" : "";
          return `${sign}${percentFormatter.format(numeric)}%`;
        },
      },
      { headerName: "Primary Usage Pattern", field: "primaryUsagePattern", minWidth: 190 },
      { headerName: "Last Access", field: "lastAccessLabel", minWidth: 220 },
      { headerName: "Lifecycle Status", field: "lifecycleStatus", minWidth: 150 },
      { headerName: "Governance Status", field: "governanceStatus", minWidth: 170 },
      {
        headerName: "Potential Savings",
        field: "potentialSavings",
        minWidth: 150,
        valueFormatter: (params) => currencyFormatter.format(Number(params.value ?? 0)),
      },
    ],
    [onBucketClick],
  );

  return (
    <BaseDataTable
      columnDefs={columnDefs}
      rowData={rows}
      height={height}
      emptyMessage="No S3 bucket rows available for the selected scope."
      pagination
      paginationPageSize={15}
      autoHeight
    />
  );
}
