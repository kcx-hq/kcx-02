import { useMemo, useRef, useState, type MouseEvent } from "react";
import type { ColDef, ICellRendererParams } from "ag-grid-community";

import { BaseDataTable } from "../../common/tables/BaseDataTable";
import { useS3CostInsightsQuery } from "../../hooks/useDashboardQueries";

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 5,
  maximumFractionDigits: 5,
});

type S3BucketTableRow = {
  bucketName: string;
  cost: number;
  storage: number;
  requests: number;
  transfer: number;
  region: string;
  owner: string;
  retrieval: number;
  other: number;
  trendPct: number;
};

function BucketNameCell(params: ICellRendererParams<S3BucketTableRow, string>) {
  const extendedParams = params as ICellRendererParams<S3BucketTableRow, string> & {
    expandedBucketName?: string | null;
    onExpandBucket?: (bucketName: string) => void;
  };
  const bucketName = String(params.value ?? "");
  const expanded = bucketName.length > 0 && extendedParams.expandedBucketName === bucketName;
  const textRef = useRef<HTMLDivElement | null>(null);

  const handleDoubleClick = (event: MouseEvent<HTMLDivElement>) => {
    event.stopPropagation();
    if (bucketName.length > 0) {
      extendedParams.onExpandBucket?.(bucketName);
    }
    if (!textRef.current) return;
    const selection = window.getSelection();
    if (!selection) return;
    const range = document.createRange();
    range.selectNodeContents(textRef.current);
    selection.removeAllRanges();
    selection.addRange(range);
  };

  return (
    <div
      onDoubleClick={handleDoubleClick}
      style={{ display: "flex", alignItems: "center", width: "100%", height: "100%", cursor: "text" }}
    >
      <div
        ref={textRef}
        title={bucketName}
        style={{
          display: "block",
          padding: 0,
          margin: 0,
          textAlign: "left",
          width: "100%",
          overflow: expanded ? "visible" : "hidden",
          textOverflow: expanded ? "clip" : "ellipsis",
          whiteSpace: expanded ? "normal" : "nowrap",
          fontSize: 10,
          lineHeight: "16px",
          userSelect: "text",
          backgroundColor: expanded ? "#e6f3ef" : "#f4faf7",
          borderRadius: 4,
        }}
      >
        {bucketName}
      </div>
    </div>
  );
}

export default function S3CostPage() {
  const query = useS3CostInsightsQuery();
  const [expandedBucketName, setExpandedBucketName] = useState<string | null>(null);
  const totalS3Cost = Number(query.data?.kpis.totalS3Cost ?? 0);
  const monthToDateCost = Number(query.data?.kpis.monthToDateCost ?? 0);
  const effectiveCost = Number(query.data?.kpis.effectiveCost ?? 0);
  const rows = (query.data?.bucketTable ?? []) as S3BucketTableRow[];

  const columnDefs = useMemo<ColDef<S3BucketTableRow>[]>(
    () => [
      {
        headerName: "Bucket",
        field: "bucketName",
        width: 280,
        minWidth: 280,
        maxWidth: 280,
        pinned: "left",
        cellRenderer: BucketNameCell,
        cellRendererParams: {
          expandedBucketName,
          onExpandBucket: setExpandedBucketName,
        },
      },
      {
        headerName: "Cost",
        field: "cost",
        minWidth: 140,
        valueFormatter: (params) => currencyFormatter.format(Number(params.value ?? 0)),
      },
      {
        headerName: "Storage",
        field: "storage",
        minWidth: 140,
        valueFormatter: (params) => currencyFormatter.format(Number(params.value ?? 0)),
      },
      {
        headerName: "Request",
        field: "requests",
        minWidth: 140,
        valueFormatter: (params) => currencyFormatter.format(Number(params.value ?? 0)),
      },
      {
        headerName: "Transfer",
        field: "transfer",
        minWidth: 140,
        valueFormatter: (params) => currencyFormatter.format(Number(params.value ?? 0)),
      },
      {
        headerName: "Other",
        field: "other",
        minWidth: 140,
        valueFormatter: (params) => currencyFormatter.format(Number(params.value ?? 0)),
      },
      {
        headerName: "Region",
        field: "region",
        minWidth: 140,
      },
      {
        headerName: "Owner",
        field: "owner",
        minWidth: 160,
      },
    ],
    [expandedBucketName],
  );

  return (
    <div className="dashboard-page">
      {query.isLoading ? <p className="dashboard-note">Loading S3 bucket insights...</p> : null}
      {query.isError ? <p className="dashboard-note">Failed to load S3 bucket insights: {query.error.message}</p> : null}

      {!query.isLoading && !query.isError ? (
        <>
          <div className="cost-explorer-chart-insights" aria-label="S3 cost metrics">
            <article className="cost-explorer-insight-tile">
              <p className="cost-explorer-insight-tile__label">Total S3 Cost</p>
              <p className="cost-explorer-insight-tile__value">{currencyFormatter.format(totalS3Cost)}</p>
            </article>
            <article className="cost-explorer-insight-tile">
              <p className="cost-explorer-insight-tile__label">Month to Date Cost</p>
              <p className="cost-explorer-insight-tile__value">{currencyFormatter.format(monthToDateCost)}</p>
            </article>
            <article className="cost-explorer-insight-tile">
              <p className="cost-explorer-insight-tile__label">Effective Cost</p>
              <p className="cost-explorer-insight-tile__value">{currencyFormatter.format(effectiveCost)}</p>
            </article>
          </div>
          <BaseDataTable
            columnDefs={columnDefs}
            rowData={rows}
            height={520}
            emptyMessage="No S3 bucket data available for the selected scope."
          />
        </>
      ) : null}
    </div>
  );
}
