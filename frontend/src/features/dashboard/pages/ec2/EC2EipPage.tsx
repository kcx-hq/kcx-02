import { useEffect, useMemo, useState } from "react";
import type { ColDef, ICellRendererParams, ValueFormatterParams } from "ag-grid-community";
import { Link, useLocation, useNavigate } from "react-router-dom";

import { EmptyStateBlock } from "../../common/components/EmptyStateBlock";
import { BaseDataTable } from "../../common/tables/BaseDataTable";
import { useEc2ElasticIpsQuery } from "../../hooks/useDashboardQueries";
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

function ElasticIpSkeleton() {
  return (
    <>
      <section className="ec2-explorer-summary ec2-explorer-summary--eip" aria-label="Loading Elastic IP summary cards" style={{ marginTop: 12 }}>
        {Array.from({ length: 4 }).map((_, index) => (
          <article key={`eip-summary-skeleton-${index}`} className="ec2-explorer-summary__card is-loading">
            <div className="ec2-explorer-summary__skeleton" aria-hidden="true">
              <span className="ec2-explorer-summary__skeleton-line ec2-explorer-summary__skeleton-line--label" />
              <span className="ec2-explorer-summary__skeleton-line ec2-explorer-summary__skeleton-line--value" />
            </div>
          </article>
        ))}
      </section>

      <section className="ec2-explorer-table-panel" aria-label="Loading Elastic IP table" style={{ marginTop: 12 }}>
        <div className="eip-table-skeleton" aria-hidden="true">
          <div className="eip-table-skeleton__head">
            {Array.from({ length: 10 }).map((_, index) => (
              <span key={`eip-head-${index}`} />
            ))}
          </div>
          <div className="eip-table-skeleton__body">
            {Array.from({ length: 6 }).map((_, rowIndex) => (
              <div key={`eip-row-${rowIndex}`} className="eip-table-skeleton__row">
                {Array.from({ length: 10 }).map((__, colIndex) => (
                  <span key={`eip-cell-${rowIndex}-${colIndex}`} className={colIndex === 0 ? "is-wide" : ""} />
                ))}
              </div>
            ))}
          </div>
          <div className="eip-table-skeleton__scroll" />
          <div className="eip-table-skeleton__footer">
            <span className="eip-table-skeleton__block eip-table-skeleton__block--size" />
            <span className="eip-table-skeleton__block eip-table-skeleton__block--count" />
            <span className="eip-table-skeleton__block eip-table-skeleton__block--pager" />
          </div>
        </div>
      </section>
    </>
  );
}

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
  const isSectionLoading = query.isPending || (!query.data && !query.error);
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
        {isSectionLoading ? <ElasticIpSkeleton /> : null}
        {!isSectionLoading ? (
          <>
        <section className="ec2-explorer-summary ec2-explorer-summary--eip" aria-label="Elastic IP summary cards" style={{ marginTop: 12 }}>
          {[
            ["Total EIP Cost", currency.format(summary.totalCost)],
            ["Total EIPs", summary.totalEips.toLocaleString()],
            ["Unattached EIPs", summary.unattachedCount.toLocaleString()],
            ["Potential Savings", currency.format(summary.potentialSavings)],
          ].map(([label, value]) => (
            <article key={String(label)} className="ec2-explorer-summary__card">
              <p className="ec2-explorer-summary__label">{label}</p>
              <p className="ec2-explorer-summary__value">{value}</p>
            </article>
          ))}
        </section>

        <section className="ec2-explorer-table-panel" aria-label="Elastic IP table" style={{ marginTop: 12 }}>
          {query.isError ? (
            <EmptyStateBlock title="Unable to load Elastic IP data" message={query.error.message} />
          ) : rows.length === 0 ? (
            <EmptyStateBlock title="No Elastic IP records found" message="No Elastic IP cost rows match the current filters." />
          ) : (
            <BaseDataTable columnDefs={columns} rowData={rows} pagination paginationPageSize={PAGE_SIZE} autoHeight />
          )}
        </section>
          </>
        ) : null}
      </section>
    </div>
  );
}
