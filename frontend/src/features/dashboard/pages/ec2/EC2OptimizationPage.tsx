import { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { ApiError } from "@/lib/api";

import { WidgetShell } from "../../common/components";
import {
  type Ec2RecommendationRecord,
  type Ec2RecommendationType,
  useEc2RecommendationsQuery,
} from "../../hooks/useDashboardQueries";
import { useDashboardScope } from "../../hooks/useDashboardScope";

const INSTANCES_PAGE_PATH = "/dashboard/inventory/aws/ec2/instances";
const VOLUMES_PAGE_PATH = "/dashboard/inventory/aws/ec2/volumes";

type MainTab = "overview" | "compute" | "storage" | "pricing";

const MAIN_TABS: Array<{ key: MainTab; label: string }> = [
  { key: "overview", label: "Overview" },
  { key: "compute", label: "Compute" },
  { key: "storage", label: "Storage" },
  { key: "pricing", label: "Pricing" },
];

const CURRENCY_FORMATTER = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const NUMBER_FORMATTER = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });

const toIsoDate = (value: Date): string => value.toISOString().slice(0, 10);

const getDefaultDateRange = (): { start: string; end: string } => {
  const today = new Date();
  const startOfMonth = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
  return { start: toIsoDate(startOfMonth), end: toIsoDate(today) };
};

const parseCsvParam = (value: string | null): string[] => {
  if (!value) return [];
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
};

const toTitle = (value: string): string =>
  value
    .replaceAll("_", " ")
    .replaceAll("-", " ")
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");

const formatCurrency = (value: number | null | undefined): string => {
  if (value === null || typeof value === "undefined" || !Number.isFinite(value)) return "-";
  return CURRENCY_FORMATTER.format(value);
};

const formatNumber = (value: number | null | undefined): string => {
  if (value === null || typeof value === "undefined" || !Number.isFinite(value)) return "-";
  return NUMBER_FORMATTER.format(value);
};

const typeLabel = (value: Ec2RecommendationType): string => {
  if (value === "idle_instance") return "Idle Instance";
  if (value === "underutilized_instance") return "Underutilized Instance";
  if (value === "overutilized_instance") return "Overutilized Instance";
  if (value === "unattached_volume") return "Unattached Volume";
  if (value === "old_snapshot") return "Old Snapshot";
  return "Uncovered On-Demand";
};

const rowKey = (item: Ec2RecommendationRecord): string => `${item.category}:${item.type}:${item.resourceType}:${item.resourceId}:${item.id}`;

export default function EC2OptimizationPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { scope } = useDashboardScope();
  const defaults = getDefaultDateRange();

  const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const dateFrom = searchParams.get("billingPeriodStart") ?? searchParams.get("from") ?? scope?.from ?? defaults.start;
  const dateTo = searchParams.get("billingPeriodEnd") ?? searchParams.get("to") ?? scope?.to ?? defaults.end;

  const [activeTab, setActiveTab] = useState<MainTab>("overview");

  const query = useEc2RecommendationsQuery({
    dateFrom,
    dateTo,
    region: searchParams.get("region") ?? undefined,
    account: searchParams.get("subAccountKey") ?? searchParams.get("account") ?? undefined,
    team: searchParams.get("team") ?? undefined,
    product: searchParams.get("product") ?? undefined,
    environment: searchParams.get("environment") ?? searchParams.get("env") ?? undefined,
    tags: parseCsvParam(searchParams.get("tags")),
  });

  const data = query.data;
  const computeRows = data?.recommendations.compute ?? [];
  const storageRows = data?.recommendations.storage ?? [];
  const pricingRows = data?.recommendations.pricing ?? [];

  const openResource = (item: Ec2RecommendationRecord) => {
    if (item.resourceType === "instance") {
      navigate({ pathname: `${INSTANCES_PAGE_PATH}/${item.resourceId}`, search: searchParams.toString() });
      return;
    }
    if (item.resourceType === "volume") {
      navigate({ pathname: `${VOLUMES_PAGE_PATH}/${item.resourceId}`, search: searchParams.toString() });
    }
  };

  const errorMessage =
    query.error instanceof ApiError
      ? query.error.message
      : query.error instanceof Error
        ? query.error.message
        : null;

  return (
    <div className="dashboard-page optimization-page">
      <div className="optimization-header-shell">
        <div className="optimization-header-tabs" role="tablist" aria-label="EC2 optimization sections">
          {MAIN_TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              className={`optimization-header-tab ${activeTab === tab.key ? "is-active" : ""}`}
              onClick={() => setActiveTab(tab.key)}
              role="tab"
              aria-selected={activeTab === tab.key}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {query.isLoading ? <p className="dashboard-note">Loading optimization data...</p> : null}
      {errorMessage ? <p className="dashboard-note">{errorMessage}</p> : null}

      {activeTab === "overview" ? (
        <div className="optimization-layout">
          <WidgetShell title="Overview" subtitle="Category-based EC2 optimization recommendations">
            <div className="optimization-verified-surface">
              <article className="optimization-verified-total">
                <p className="optimization-verified-total__label">Total Potential Monthly Saving</p>
                <p className="optimization-verified-total__value">
                  {formatCurrency(data?.overview.totalPotentialMonthlySaving ?? 0)}
                </p>
              </article>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <article className="optimization-verified-item">
                  <p className="optimization-overview-insight-item__title">Compute</p>
                  <p className="optimization-overview-insight-item__value">{data?.overview.countByCategory.compute ?? 0}</p>
                  <p className="dashboard-note">{formatCurrency(data?.overview.savingByCategory.compute ?? 0)}</p>
                </article>
                <article className="optimization-verified-item">
                  <p className="optimization-overview-insight-item__title">Storage</p>
                  <p className="optimization-overview-insight-item__value">{data?.overview.countByCategory.storage ?? 0}</p>
                  <p className="dashboard-note">{formatCurrency(data?.overview.savingByCategory.storage ?? 0)}</p>
                </article>
                <article className="optimization-verified-item">
                  <p className="optimization-overview-insight-item__title">Pricing</p>
                  <p className="optimization-overview-insight-item__value">{data?.overview.countByCategory.pricing ?? 0}</p>
                  <p className="dashboard-note">{formatCurrency(data?.overview.savingByCategory.pricing ?? 0)}</p>
                </article>
              </div>
            </div>
          </WidgetShell>

          <WidgetShell title="Recommendation Types" subtitle="Count by recommendation type">
            <div className="optimization-rightsizing-table-scroll">
              <table className="optimization-rightsizing-table">
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>Count</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(data?.overview.countByType ?? {}).map(([type, count]) => (
                    <tr key={type}>
                      <td>{typeLabel(type as Ec2RecommendationType)}</td>
                      <td>{count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </WidgetShell>
        </div>
      ) : null}

      {activeTab === "compute" ? (
        <WidgetShell title="Compute" subtitle="Compute optimization recommendations">
          <div className="optimization-rightsizing-table-scroll">
            <table className="optimization-rightsizing-table">
              <thead>
                <tr>
                  <th>Instance</th>
                  <th>Issue Type</th>
                  <th>CPU</th>
                  <th>Network</th>
                  <th>Cost</th>
                  <th>Evidence</th>
                  <th>Action</th>
                  <th>Saving</th>
                  <th>Risk</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {computeRows.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="optimization-rightsizing-empty"><p className="optimization-rightsizing-empty__title">No compute recommendations found</p></td>
                  </tr>
                ) : (
                  computeRows.map((item) => {
                    const metadata = item.metadata ?? {};
                    const cpu = typeof metadata.cpu === "number" ? metadata.cpu : null;
                    const network = typeof metadata.avg_daily_network_mb === "number" ? metadata.avg_daily_network_mb : null;
                    const cost = typeof metadata.total_cost === "number" ? metadata.total_cost : null;
                    return (
                      <tr key={rowKey(item)} onClick={() => openResource(item)} className="cursor-pointer">
                        <td>{item.resourceName}</td>
                        <td>{typeLabel(item.type)}</td>
                        <td>{cpu === null ? "-" : `${formatNumber(cpu)}%`}</td>
                        <td>{network === null ? "-" : `${formatNumber(network)} MB`}</td>
                        <td>{formatCurrency(cost)}</td>
                        <td>{item.evidence || "-"}</td>
                        <td>{item.action || "-"}</td>
                        <td>{formatCurrency(item.estimatedMonthlySaving)}</td>
                        <td>{toTitle(item.risk)}</td>
                        <td>{toTitle(item.status)}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </WidgetShell>
      ) : null}

      {activeTab === "storage" ? (
        <WidgetShell title="Storage" subtitle="Storage optimization recommendations">
          <div className="optimization-rightsizing-table-scroll">
            <table className="optimization-rightsizing-table">
              <thead>
                <tr>
                  <th>Resource</th>
                  <th>Resource Type</th>
                  <th>Issue Type</th>
                  <th>Size</th>
                  <th>Cost</th>
                  <th>State</th>
                  <th>Evidence</th>
                  <th>Action</th>
                  <th>Saving</th>
                  <th>Risk</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {storageRows.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="optimization-rightsizing-empty"><p className="optimization-rightsizing-empty__title">No storage recommendations found</p></td>
                  </tr>
                ) : (
                  storageRows.map((item) => {
                    const metadata = item.metadata ?? {};
                    const sizeGb = typeof metadata.size_gb === "number" ? metadata.size_gb : null;
                    const state = typeof metadata.state === "string" ? metadata.state : null;
                    const cost = typeof metadata.total_cost === "number" ? metadata.total_cost : typeof metadata.snapshot_cost === "number" ? metadata.snapshot_cost : null;
                    return (
                      <tr
                        key={rowKey(item)}
                        onClick={item.resourceType === "snapshot" ? undefined : () => openResource(item)}
                        className={item.resourceType === "snapshot" ? "" : "cursor-pointer"}
                      >
                        <td>{item.resourceName}</td>
                        <td>{toTitle(item.resourceType)}</td>
                        <td>{typeLabel(item.type)}</td>
                        <td>{sizeGb === null ? "-" : `${formatNumber(sizeGb)} GB`}</td>
                        <td>{formatCurrency(cost)}</td>
                        <td>{state ?? "-"}</td>
                        <td>{item.evidence || "-"}</td>
                        <td>{item.action || "-"}</td>
                        <td>{formatCurrency(item.estimatedMonthlySaving)}</td>
                        <td>{toTitle(item.risk)}</td>
                        <td>{toTitle(item.status)}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </WidgetShell>
      ) : null}

      {activeTab === "pricing" ? (
        <WidgetShell title="Pricing" subtitle="Pricing optimization recommendations">
          <div className="optimization-rightsizing-table-scroll">
            <table className="optimization-rightsizing-table">
              <thead>
                <tr>
                  <th>Instance</th>
                  <th>Issue Type</th>
                  <th>Cost</th>
                  <th>Coverage</th>
                  <th>Evidence</th>
                  <th>Action</th>
                  <th>Saving</th>
                  <th>Risk</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {pricingRows.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="optimization-rightsizing-empty"><p className="optimization-rightsizing-empty__title">No pricing recommendations found</p></td>
                  </tr>
                ) : (
                  pricingRows.map((item) => {
                    const metadata = item.metadata ?? {};
                    const computeCost = typeof metadata.compute_cost === "number" ? metadata.compute_cost : null;
                    const coveredHours = typeof metadata.covered_hours === "number" ? metadata.covered_hours : null;
                    return (
                      <tr key={rowKey(item)} onClick={() => openResource(item)} className="cursor-pointer">
                        <td>{item.resourceName}</td>
                        <td>{typeLabel(item.type)}</td>
                        <td>{formatCurrency(computeCost)}</td>
                        <td>{coveredHours === 0 ? "Not covered" : coveredHours === null ? "-" : "Covered"}</td>
                        <td>{item.evidence || "-"}</td>
                        <td>{item.action || "-"}</td>
                        <td>{formatCurrency(item.estimatedMonthlySaving)}</td>
                        <td>{toTitle(item.risk)}</td>
                        <td>{toTitle(item.status)}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </WidgetShell>
      ) : null}
    </div>
  );
}
