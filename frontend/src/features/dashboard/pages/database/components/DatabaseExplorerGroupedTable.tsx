import { useMemo } from "react";
import type { ColDef, ValueFormatterParams } from "ag-grid-community";

import { BaseDataTable } from "../../../common/tables/BaseDataTable";
import { TableShell } from "../../../common/tables/TableShell";
import type {
  DatabaseExplorerMetric,
  DatabaseExplorerTableRow,
  DatabaseUsageCapabilityFamily,
} from "../../../api/dashboardTypes";
import { formatCurrency, formatInteger, formatNumber, NULL_MARKER } from "./databaseExplorer.formatters";

type DatabaseExplorerGroupedTableProps = {
  metric: DatabaseExplorerMetric;
  capabilityFamily?: DatabaseUsageCapabilityFamily;
  rows: DatabaseExplorerTableRow[];
  isLoading?: boolean;
  onRowClick?: (row: DatabaseExplorerTableRow) => void;
};

export function DatabaseExplorerGroupedTable({
  metric,
  capabilityFamily,
  rows,
  isLoading = false,
  onRowClick,
}: DatabaseExplorerGroupedTableProps) {
  const usageColumns: ColDef<DatabaseExplorerTableRow>[] = [
    { headerName: "Rank", field: "rank", type: "numericColumn", valueFormatter: (params) => (params.value == null ? NULL_MARKER : String(params.value)) },
    { headerName: "In-scope Resources", field: "inScopeResources", type: "numericColumn", valueFormatter: (params) => formatInteger(params.value) },
    { headerName: "Telemetry Covered", field: "telemetryCoveredResources", type: "numericColumn", valueFormatter: (params) => formatInteger(params.value) },
    { headerName: "Coverage %", field: "coverageRate", type: "numericColumn", valueFormatter: (params) => (params.value == null ? NULL_MARKER : `${(Number(params.value) * 100).toFixed(1)}%`) },
    { headerName: "Primary Metric", field: "primaryMetricValue", type: "numericColumn", valueFormatter: (params) => formatNumber(params.value) },
    { headerName: "Confidence", field: "confidence", minWidth: 120 },
    { headerName: "State", field: "state", minWidth: 120 },
  ];
  const capabilityColumns: Record<DatabaseUsageCapabilityFamily, ColDef<DatabaseExplorerTableRow>[]> = {
    compute_pressure: [
      { headerName: "Avg CPU", field: "avgCpu", type: "numericColumn", valueFormatter: (params) => formatNumber(params.value) },
      { headerName: "Peak CPU", field: "peakCpu", type: "numericColumn", valueFormatter: (params) => formatNumber(params.value) },
    ],
    connection_pressure: [
      { headerName: "Avg Connections", field: "avgConnections", type: "numericColumn", valueFormatter: (params) => formatNumber(params.value) },
      { headerName: "Peak Connections", field: "peakConnections", type: "numericColumn", valueFormatter: (params) => formatNumber(params.value) },
    ],
    io_activity: [
      { headerName: "Read IOPS", field: "readIops", type: "numericColumn", valueFormatter: (params) => formatNumber(params.value) },
      { headerName: "Write IOPS", field: "writeIops", type: "numericColumn", valueFormatter: (params) => formatNumber(params.value) },
      { headerName: "Total IOPS", field: "totalIops", type: "numericColumn", valueFormatter: (params) => formatNumber(params.value) },
    ],
    throughput_activity: [
      { headerName: "Read Throughput", field: "readThroughputBytes", type: "numericColumn", valueFormatter: (params) => formatNumber(params.value) },
      { headerName: "Write Throughput", field: "writeThroughputBytes", type: "numericColumn", valueFormatter: (params) => formatNumber(params.value) },
      { headerName: "Total Throughput", field: "totalThroughputBytes", type: "numericColumn", valueFormatter: (params) => formatNumber(params.value) },
    ],
    storage_pressure: [
      { headerName: "Storage Used", field: "storageUsedGb", type: "numericColumn", valueFormatter: (params) => formatNumber(params.value) },
      { headerName: "Allocated Storage", field: "allocatedStorageGb", type: "numericColumn", valueFormatter: (params) => formatNumber(params.value) },
    ],
  };
  const columnDefs = useMemo<ColDef<DatabaseExplorerTableRow>[]>(
    () => {
      if (metric === "usage") {
        return [
          { headerName: "Group", field: "group", minWidth: 180, sort: undefined },
          ...usageColumns,
          ...(capabilityColumns[capabilityFamily ?? "compute_pressure"] ?? []),
        ];
      }
      return [
        { headerName: "Group", field: "group", minWidth: 180, sort: undefined },
        {
          headerName: "Total Cost",
          field: "totalCost",
          sort: "desc",
          type: "numericColumn",
          valueFormatter: (params: ValueFormatterParams<DatabaseExplorerTableRow>) => formatCurrency(params.value),
        },
        {
          headerName: "Compute",
          field: "computeCost",
          type: "numericColumn",
          valueFormatter: (params: ValueFormatterParams<DatabaseExplorerTableRow>) => formatCurrency(params.value),
        },
        {
          headerName: "Storage",
          field: "storageCost",
          type: "numericColumn",
          valueFormatter: (params: ValueFormatterParams<DatabaseExplorerTableRow>) => formatCurrency(params.value),
        },
        {
          headerName: "IO",
          field: "ioCost",
          type: "numericColumn",
          valueFormatter: (params: ValueFormatterParams<DatabaseExplorerTableRow>) => formatCurrency(params.value),
        },
        {
          headerName: "Backup",
          field: "backupCost",
          type: "numericColumn",
          valueFormatter: (params: ValueFormatterParams<DatabaseExplorerTableRow>) => formatCurrency(params.value),
        },
        {
          headerName: "Resource Count",
          field: "resourceCount",
          type: "numericColumn",
          valueFormatter: (params: ValueFormatterParams<DatabaseExplorerTableRow>) => formatInteger(params.value),
        },
      ];
    },
    [capabilityFamily, metric],
  );

  return (
    <TableShell
      title={metric === "usage" ? "Operational Concentration" : "Grouped Database Costs"}
      subtitle={metric === "usage" ? "Usage concentration grouped by the selected dimension" : "Database cost and usage grouped by the selected dimension"}
    >
      {isLoading ? (
        <p className="dashboard-note">Loading database table...</p>
      ) : (
        <BaseDataTable
          rowData={rows}
          columnDefs={columnDefs}
          height={360}
          emptyMessage="No database data for selected filters"
          onRowClick={onRowClick}
        />
      )}
    </TableShell>
  );
}
