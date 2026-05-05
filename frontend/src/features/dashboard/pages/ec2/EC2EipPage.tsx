import { useEffect, useMemo, useState } from "react";
import type { ColDef, ICellRendererParams, ValueFormatterParams } from "ag-grid-community";
import { Link, useLocation, useNavigate } from "react-router-dom";

import { EmptyStateBlock } from "../../common/components/EmptyStateBlock";
import { BaseDataTable } from "../../common/tables/BaseDataTable";
import { useEc2ElasticIpsQuery } from "../../hooks/useDashboardQueries";
import { EC2InstancesTopBar } from "./components/EC2InstancesTopBar";
import {
  EC2_INSTANCES_DEFAULT_CONTROLS,
  type EC2InstancesControlsState,
} from "./components/ec2Instances.types";

const PAGE_SIZE = 25;
type Ec2ElasticIpState = "all" | "attached" | "unattached" | "unknown";
const currency = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });

const toIsoDate = (value: Date): string => value.toISOString().slice(0, 10);
const getDefaultDateRange = (): { start: string; end: string } => {
  const today = new Date();
  const startOfMonth = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
  return { start: toIsoDate(startOfMonth), end: toIsoDate(today) };
};

const getStateFromControls = (state: EC2InstancesControlsState["state"]): Ec2ElasticIpState => {
  if (state === "running") return "attached";
  if (state === "stopped") return "unattached";
  if (state === "terminated") return "unknown";
  return state === "all" ? "all" : "all";
};

const getControlsStateFromParam = (state: string | null): EC2InstancesControlsState["state"] => {
  if (state === "attached") return "running";
  if (state === "unattached") return "stopped";
  if (state === "unknown") return "terminated";
  return "all";
};

export default function EC2EipPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const queryParams = useMemo(() => new URLSearchParams(location.search), [location.search]);

  const defaults = getDefaultDateRange();
  const [page, setPage] = useState(Number(queryParams.get("page") ?? "1") || 1);

  const [controls, setControls] = useState<EC2InstancesControlsState>({
    ...EC2_INSTANCES_DEFAULT_CONTROLS,
    state: getControlsStateFromParam(queryParams.get("state")),
    search: queryParams.get("search") ?? "",
  });

  const startDate = queryParams.get("startDate") ?? queryParams.get("from") ?? defaults.start;
  const endDate = queryParams.get("endDate") ?? queryParams.get("to") ?? defaults.end;

  useEffect(() => {
    const next = new URLSearchParams(location.search);
    next.set("startDate", startDate);
    next.set("endDate", endDate);
    next.set("state", getStateFromControls(controls.state));
    if (controls.search.trim()) next.set("search", controls.search.trim()); else next.delete("search");
    next.delete("accountId");
    next.delete("region");
    next.set("page", String(page));
    next.set("pageSize", String(PAGE_SIZE));
    const nextSearch = next.toString();
    const currentSearch = location.search.startsWith("?") ? location.search.slice(1) : location.search;
    if (nextSearch !== currentSearch) {
      navigate({ pathname: location.pathname, search: nextSearch }, { replace: true });
    }
  }, [controls.search, controls.state, endDate, location.pathname, location.search, navigate, page, startDate]);

  const query = useEc2ElasticIpsQuery({
    startDate,
    endDate,
    state: getStateFromControls(controls.state),
    search: controls.search.trim() || null,
    accountId: null,
    region: null,
    page,
    pageSize: PAGE_SIZE,
  });

  const rows = query.data?.rows ?? [];
  const summary = query.data?.summary ?? { totalCost: 0, totalEips: 0, unattachedCount: 0, potentialSavings: 0 };

  const columns = useMemo<ColDef<(typeof rows)[number]>[]>(() => [
    { headerName: "Elastic IP / Allocation ID", field: "eipId", minWidth: 220 },
    { headerName: "Public IP", field: "publicIp", minWidth: 130 },
    {
      headerName: "Account",
      minWidth: 180,
      valueGetter: (params) => `${params.data?.accountName ?? "Unknown"} (${params.data?.accountId ?? "unknown"})`,
    },
    { headerName: "Region", field: "region", minWidth: 130 },
    { headerName: "State", field: "state", minWidth: 110 },
    {
      headerName: "Associated Resource",
      minWidth: 200,
      cellRenderer: (params: ICellRendererParams<(typeof rows)[number]>) => {
        const resourceId = params.data?.associatedResourceId;
        if (!resourceId) return "Unattached";
        return (
          <Link to={`/dashboard/inventory/aws/ec2/instances/${resourceId}`} onClick={(event) => event.stopPropagation()}>
            {resourceId}
          </Link>
        );
      },
    },
    {
      headerName: "Cost",
      field: "cost",
      minWidth: 120,
      sort: "desc",
      valueFormatter: (params: ValueFormatterParams) => currency.format(Number(params.value ?? 0)),
    },
    { headerName: "Last Seen", field: "lastSeen", minWidth: 120 },
    { headerName: "Recommendation", field: "recommendation", minWidth: 220 },
    {
      headerName: "Estimated Savings",
      field: "estimatedSavings",
      minWidth: 150,
      valueFormatter: (params: ValueFormatterParams) => currency.format(Number(params.value ?? 0)),
    },
  ], [rows]);

  return (
    <div className="dashboard-page cost-explorer-page">
      <section aria-label="EC2 Elastic IP list">
        <EC2InstancesTopBar
          value={controls}
          instanceTypeOptions={[{ key: "all", label: "All" }]}
          visibleControls={["filters", "state", "search", "reset"]}
          onChange={(next) => {
            setControls(next);
            setPage(1);
          }}
          onReset={() => {
            setControls({ ...EC2_INSTANCES_DEFAULT_CONTROLS });
            setPage(1);
          }}
        />

        <section className="ec2-explorer-summary" aria-label="Elastic IP summary cards" style={{ marginTop: 12 }}>
          {[
            ["Total EIP Cost", currency.format(summary.totalCost)],
            ["Total EIPs", summary.totalEips.toLocaleString()],
            ["Unattached EIPs", summary.unattachedCount.toLocaleString()],
            ["Potential Savings", currency.format(summary.potentialSavings)],
          ].map(([label, value]) => (
            <article key={String(label)} className={`ec2-explorer-summary__card${query.isLoading ? " is-loading" : ""}`}>
              <p className="ec2-explorer-summary__label">{label}</p>
              <p className="ec2-explorer-summary__value">{query.isLoading ? "..." : value}</p>
            </article>
          ))}
        </section>

        <section className="ec2-explorer-table-panel" aria-label="Elastic IP table" style={{ marginTop: 12 }}>
          {query.isLoading ? <p className="dashboard-note">Loading Elastic IP data...</p> : null}
          {query.isError ? (
            <EmptyStateBlock title="Unable to load Elastic IP data" message={query.error.message} />
          ) : rows.length === 0 ? (
            <EmptyStateBlock title="No Elastic IP records found" message="No Elastic IP cost rows match the current filters." />
          ) : (
            <BaseDataTable columnDefs={columns} rowData={rows} pagination paginationPageSize={PAGE_SIZE} autoHeight />
          )}
        </section>
      </section>
    </div>
  );
}
