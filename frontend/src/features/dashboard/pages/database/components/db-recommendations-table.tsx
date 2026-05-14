import { useMemo } from "react";
import type { ColDef, ICellRendererParams } from "ag-grid-community";

import { BaseDataTable } from "../../../common/tables/BaseDataTable";
import { TableShell } from "../../../common/tables/TableShell";
import type { DatabaseRecommendationListItem } from "../../../api/dashboardTypes";
import {
  confidenceLabel,
  evidenceLabel,
  formatCurrency,
  formatDate,
  statusLabel,
} from "./db-recommendations.formatters";
import type { DatabaseRecommendationType } from "../../../api/dashboardTypes";

type DatabaseRecommendationTablePreset = DatabaseRecommendationType | "generic";

type DatabaseRecommendationsTableProps = {
  rows: DatabaseRecommendationListItem[];
  isLoading?: boolean;
  onRowClick?: (row: DatabaseRecommendationListItem) => void;
  actionLabel?: "View details" | "Review evidence" | "View";
  preset?: DatabaseRecommendationTablePreset;
};

const toneColor = (value: string): string => {
  const normalized = value.toLowerCase();
  if (normalized === "high" || normalized === "telemetry backed" || normalized === "open" || normalized === "in progress") return "#0f766e";
  if (normalized === "medium" || normalized === "inventory backed" || normalized === "snoozed") return "#334155";
  if (normalized === "low" || normalized === "billing only" || normalized === "dismissed" || normalized === "completed") return "#475569";
  return "#334155";
};

export function DatabaseRecommendationsTable({
  rows,
  isLoading = false,
  onRowClick,
  actionLabel = "View details",
  preset = "generic",
}: DatabaseRecommendationsTableProps) {
  const warningsCell = (params: ICellRendererParams<DatabaseRecommendationListItem>) => {
    const row = params.data;
    const count = row?.warnings_count ?? 0;
    return <span className="cost-explorer-chip">{String(count)}</span>;
  };

  const recommendationColumn: ColDef<DatabaseRecommendationListItem> = {
    headerName: "Recommendation",
    minWidth: 280,
    cellRenderer: (params: ICellRendererParams<DatabaseRecommendationListItem>) => {
      const row = params.data;
      if (!row) return "-";
      return (
        <div>
          <div>{row.title || "-"}</div>
          {row.description ? <small style={{ opacity: 0.75 }}>{row.description}</small> : null}
        </div>
      );
    },
  };

  const resourceColumn: ColDef<DatabaseRecommendationListItem> = {
    headerName: "Resource",
    minWidth: 220,
    cellRenderer: (params: ICellRendererParams<DatabaseRecommendationListItem>) => {
      const row = params.data;
      if (!row) return "-";
      return (
        <div>
          <div
            title={row.resource_id ?? "-"}
            style={{ maxWidth: 280, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
          >
            {row.resource_id || "-"}
          </div>
          {row.cloud_connection_id ? (
            <small
              title={row.cloud_connection_id}
              style={{ opacity: 0.75, display: "block", maxWidth: 280, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
            >
              {row.cloud_connection_id}
            </small>
          ) : null}
        </div>
      );
    },
  };

  const evidenceColumn: ColDef<DatabaseRecommendationListItem> = {
    headerName: "Evidence",
    minWidth: 160,
    cellRenderer: (params: ICellRendererParams<DatabaseRecommendationListItem>) => {
      const label = evidenceLabel(params.data?.evidence_level ?? null);
      return <span className="cost-explorer-chip" style={{ color: toneColor(label) }}>{label}</span>;
    },
  };

  const confidenceColumn: ColDef<DatabaseRecommendationListItem> = {
    headerName: "Confidence",
    minWidth: 130,
    cellRenderer: (params: ICellRendererParams<DatabaseRecommendationListItem>) => {
      const label = confidenceLabel(params.data?.confidence ?? null);
      return <span className="cost-explorer-chip" style={{ color: toneColor(label) }}>{label}</span>;
    },
  };

  const statusColumn: ColDef<DatabaseRecommendationListItem> = {
    headerName: "Status",
    minWidth: 120,
    cellRenderer: (params: ICellRendererParams<DatabaseRecommendationListItem>) => {
      const value = statusLabel(String(params.data?.status ?? "-"));
      return <span className="cost-explorer-chip" style={{ color: toneColor(value) }}>{value}</span>;
    },
  };

  const updatedColumn: ColDef<DatabaseRecommendationListItem> = {
    headerName: "Updated",
    minWidth: 130,
    cellRenderer: (params: ICellRendererParams<DatabaseRecommendationListItem>) => formatDate(params.data?.updated_at ?? null),
  };

  const savingsColumn: ColDef<DatabaseRecommendationListItem> = {
    headerName: "Estimated Savings",
    minWidth: 160,
    cellRenderer: (params: ICellRendererParams<DatabaseRecommendationListItem>) => {
      const savings = params.data?.estimated_monthly_savings;
      if (savings == null || savings <= 0) return "Not estimated";
      return formatCurrency(savings);
    },
  };

  const warningsColumn: ColDef<DatabaseRecommendationListItem> = {
    headerName: "Warnings",
    minWidth: 120,
    cellRenderer: warningsCell,
  };

  const actionColumn: ColDef<DatabaseRecommendationListItem> = {
    headerName: "Action",
    minWidth: 150,
    sortable: false,
    filter: false,
    cellRenderer: (params: ICellRendererParams<DatabaseRecommendationListItem>) => {
      const row = params.data;
      if (!row || !onRowClick) return "-";
      return (
        <button
          type="button"
          className="cost-explorer-state-btn"
          onClick={(event) => {
            event.stopPropagation();
            onRowClick(row);
          }}
        >
          {actionLabel}
        </button>
      );
    },
  };

  const columnsByPreset: Record<DatabaseRecommendationTablePreset, ColDef<DatabaseRecommendationListItem>[]> = {
    DB_STORAGE_OPTIMIZATION: [
      recommendationColumn,
      resourceColumn,
      evidenceColumn,
      warningsColumn,
      savingsColumn,
      statusColumn,
      actionColumn,
    ],
    DB_IDLE_CANDIDATE: [
      recommendationColumn,
      resourceColumn,
      confidenceColumn,
      evidenceColumn,
      warningsColumn,
      updatedColumn,
      actionColumn,
    ],
    DB_HA_COST_OPTIMIZATION: [
      recommendationColumn,
      resourceColumn,
      confidenceColumn,
      warningsColumn,
      statusColumn,
      updatedColumn,
      actionColumn,
    ],
    DB_ENGINE_DEPLOYMENT_OPTIMIZATION: [
      recommendationColumn,
      resourceColumn,
      evidenceColumn,
      confidenceColumn,
      warningsColumn,
      updatedColumn,
      actionColumn,
    ],
    DB_RIGHTSIZING_CANDIDATE: [
      recommendationColumn,
      resourceColumn,
      confidenceColumn,
      evidenceColumn,
      warningsColumn,
      updatedColumn,
      actionColumn,
    ],
    generic: [
      recommendationColumn,
      resourceColumn,
      evidenceColumn,
      confidenceColumn,
      statusColumn,
      savingsColumn,
      updatedColumn,
      actionColumn,
    ],
  };

  const columnDefs = useMemo<ColDef<DatabaseRecommendationListItem>[]>(
    () => columnsByPreset[preset] ?? columnsByPreset.generic,
    [columnsByPreset, preset],
  );

  return (
    <TableShell title="Recommendations" subtitle="Database recommendations for the selected scope and filters">
      {isLoading ? <p className="dashboard-note">Loading recommendations...</p> : null}
      <BaseDataTable
        columnDefs={columnDefs}
        rowData={rows}
        emptyMessage="No database recommendations found for current filters."
        onRowClick={onRowClick}
      />
    </TableShell>
  );
}
