import { useMemo } from "react";
import type { ColDef } from "ag-grid-community";

import { BaseDataTable } from "../../common/tables/BaseDataTable";
import { DashboardPageHeader } from "../../components/DashboardPageHeader";
import { DashboardSection } from "../../components/DashboardSection";
import { useEc2InstanceHoursQuery } from "../../hooks/useDashboardQueries";

type InstanceHoursRow = {
  accountName: string;
  instanceId: string;
  instanceName: string | null;
  instanceType: string | null;
  availabilityZone: string | null;
  isSpot: boolean;
  totalHours: number;
  computeCost: number;
};

const hoursFormatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export default function EC2UsageHoursPage() {
  const query = useEc2InstanceHoursQuery();
  const rows = (query.data?.items ?? []) as InstanceHoursRow[];

  const activeFilters = [
    `Date: ${query.data?.filtersApplied.startDate ?? "-"} to ${query.data?.filtersApplied.endDate ?? "-"}`,
    `Account Key: ${query.data?.filtersApplied.subAccountKey ?? "All"}`,
    `Region Key: ${query.data?.filtersApplied.regionKey ?? "All"}`,
    `Connection: ${query.data?.filtersApplied.cloudConnectionId ?? "All"}`,
  ];

  const columnDefs = useMemo<ColDef<InstanceHoursRow>[]>(
    () => [
      {
        headerName: "Account Name",
        field: "accountName",
        minWidth: 180,
      },
      {
        headerName: "Instance Name",
        field: "instanceName",
        minWidth: 180,
        valueGetter: (params) => params.data?.instanceName ?? params.data?.instanceId ?? "Unspecified",
      },
      {
        headerName: "Instance Type",
        field: "instanceType",
        minWidth: 130,
        valueGetter: (params) => params.data?.instanceType ?? "Unspecified",
      },
      {
        headerName: "Availability Zone",
        field: "availabilityZone",
        minWidth: 160,
        valueGetter: (params) => params.data?.availabilityZone ?? "Unspecified",
      },
      {
        headerName: "Spot",
        field: "isSpot",
        minWidth: 90,
        valueFormatter: (params) => (params.value ? "Yes" : "No"),
      },
      {
        headerName: "Total Hours",
        field: "totalHours",
        minWidth: 120,
        valueFormatter: (params) => hoursFormatter.format(Number(params.value ?? 0)),
      },
      {
        headerName: "Compute Cost",
        field: "computeCost",
        minWidth: 130,
        valueFormatter: (params) => currencyFormatter.format(Number(params.value ?? 0)),
      },
    ],
    [],
  );

  return (
    <div className="dashboard-page">
      <DashboardPageHeader title="EC2 Instance Hours" />

      <DashboardSection
        title="EC2 Instance Hours"
        description="Per-instance hours and compute cost over the selected date range."
      >
        <div className="cost-explorer-chip-bar">
          <div className="cost-explorer-chip-row">
            {activeFilters.map((item) => (
              <span key={item} className="cost-explorer-chip">
                <span className="cost-explorer-chip__edit">{item}</span>
              </span>
            ))}
          </div>
        </div>

        {query.isLoading ? <p className="dashboard-note">Loading EC2 instance hours...</p> : null}
        {query.isError ? <p className="dashboard-note">Failed to load EC2 instance hours: {query.error.message}</p> : null}
        {!query.isLoading && !query.isError ? (
          <BaseDataTable
            columnDefs={columnDefs}
            rowData={rows}
            height={500}
            emptyMessage="No EC2 instance hours found for the selected filters."
          />
        ) : null}
      </DashboardSection>
    </div>
  );
}

