import { useMemo } from "react";
import type { ColDef, ICellRendererParams } from "ag-grid-community";

import { BaseDataTable } from "../../../common/tables/BaseDataTable";

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 5,
  maximumFractionDigits: 5,
});

const numberFormatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const percentFormatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export type S3CostCategoryTableRow = {
  costCategory: "Storage" | "Request" | "Transfer" | "Retrieval" | "Other";
  cost: number;
  usageQuantity: number;
  pricingUnit: string;
  percentOfBucketCost: number;
};

type Props = {
  rows: S3CostCategoryTableRow[];
  height?: number;
  emptyMessage?: string;
};

const buildCostCategoryLink = (category: S3CostCategoryTableRow["costCategory"]): string => {
  if (typeof window === "undefined") {
    return `/dashboard/s3/cost?s3SeriesBy=cost_category&s3SeriesValues=${encodeURIComponent(category)}`;
  }
  const params = new URLSearchParams(window.location.search);
  params.set("s3SeriesBy", "cost_category");
  params.set("s3SeriesValues", category);
  return `/dashboard/s3/cost?${params.toString()}`;
};

function CostCategoryLinkCell(params: ICellRendererParams<S3CostCategoryTableRow, string>) {
  const value = String(params.value ?? "");
  if (!value) return <span>-</span>;
  return (
    <a
      href={buildCostCategoryLink(value as S3CostCategoryTableRow["costCategory"])}
      title={`Filter by ${value}`}
      style={{
        color: "#1f5c86",
        textDecoration: "underline",
        fontWeight: 600,
      }}
    >
      {value}
    </a>
  );
}

export function S3CostCategoryTable({
  rows,
  height = 420,
  emptyMessage = "No cost category rows available for this selection.",
}: Props) {
  const columnDefs = useMemo<ColDef<S3CostCategoryTableRow>[]>(
    () => [
      {
        headerName: "Cost Category",
        field: "costCategory",
        minWidth: 180,
        cellRenderer: CostCategoryLinkCell,
      },
      {
        headerName: "Cost",
        field: "cost",
        minWidth: 160,
        valueFormatter: (params) => currencyFormatter.format(Number(params.value ?? 0)),
      },
      {
        headerName: "Usage Quantity",
        field: "usageQuantity",
        minWidth: 170,
        valueFormatter: (params) => numberFormatter.format(Number(params.value ?? 0)),
      },
      {
        headerName: "Pricing Unit",
        field: "pricingUnit",
        minWidth: 150,
      },
      {
        headerName: "% of Bucket Cost",
        field: "percentOfBucketCost",
        minWidth: 170,
        valueFormatter: (params) => `${percentFormatter.format(Number(params.value ?? 0))}%`,
      },
    ],
    [],
  );

  return (
    <BaseDataTable
      columnDefs={columnDefs}
      rowData={rows}
      height={height}
      emptyMessage={emptyMessage}
      pagination
      paginationPageSize={10}
      autoHeight
    />
  );
}
