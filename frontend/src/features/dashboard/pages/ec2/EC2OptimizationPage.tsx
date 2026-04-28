import { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";
import { WidgetShell } from "../../common/components";
import {
  type Ec2OptimizationInstancesResponse,
  useDashboardFiltersQuery,
  useEc2OptimizationInstancesQuery,
} from "../../hooks/useDashboardQueries";
import { useDashboardScope } from "../../hooks/useDashboardScope";

const DEFAULT_PAGE_SIZE = 25;

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const integerFormatter = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

type MainTab = "overview" | "rightsizing" | "idle_waste" | "coverage" | "performance_risk";

const MAIN_TABS: Array<{ key: MainTab; label: string }> = [
  { key: "overview", label: "Overview" },
  { key: "rightsizing", label: "Rightsizing" },
  { key: "idle_waste", label: "Idle Resources" },
  { key: "coverage", label: "Commitments" },
  { key: "performance_risk", label: "Performance Risk" },
];

const DONUT_COLORS: Record<Exclude<MainTab, "overview">, string> = {
  rightsizing: "#23a282",
  idle_waste: "#b99abf",
  coverage: "#89b5cf",
  performance_risk: "#f09c69",
};

type Ec2OptimizationRecommendationItem =
  Ec2OptimizationInstancesResponse["recommendations"]["rightsizing"][number];

function toIsoDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function getDefaultDateRange(): { start: string; end: string } {
  const today = new Date();
  const startOfMonth = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
  return { start: toIsoDate(startOfMonth), end: toIsoDate(today) };
}

function parseOptionalInt(value: string): number | undefined {
  if (!value || value === "ALL") return undefined;
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : undefined;
}

function getRecommendationBadgeTone(recommendationType: string): string {
  if (recommendationType === "idle_instance") return "border-amber-200 bg-amber-50 text-amber-700";
  if (recommendationType === "underutilized_instance") return "border-sky-200 bg-sky-50 text-sky-700";
  if (recommendationType === "overutilized_instance") return "border-rose-200 bg-rose-50 text-rose-700";
  if (recommendationType === "uncovered_on_demand") return "border-orange-200 bg-orange-50 text-orange-700";
  return "border-indigo-200 bg-indigo-50 text-indigo-700";
}

function getRiskTone(risk: "low" | "medium" | "high"): string {
  if (risk === "low") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (risk === "medium") return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-rose-200 bg-rose-50 text-rose-700";
}

function getStatusTone(status: string): string {
  const normalized = status.trim().toUpperCase();
  if (normalized === "OPEN") return "border-sky-200 bg-sky-50 text-sky-700";
  if (normalized === "RESOLVED") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (normalized === "IGNORED") return "border-slate-300 bg-slate-100 text-slate-700";
  return "border-[color:var(--border-light)] bg-[color:var(--bg-surface)] text-text-secondary";
}

function toUpper(value: string | null): string {
  return value ? value.toUpperCase() : "";
}

function toTitleCase(value: string | null): string {
  if (!value) return "N/A";
  return value
    .toLowerCase()
    .split(/[_\s-]+/)
    .filter((part) => part.length > 0)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(" ");
}

function recommendationTypeLabel(type: string): string {
  if (type === "idle_instance") return "Idle";
  if (type === "underutilized_instance") return "Underutilized";
  if (type === "overutilized_instance") return "Overutilized";
  if (type === "uncovered_on_demand") return "On-Demand";
  if (type === "unattached_ebs_volume" || type === "ebs_attached_to_stopped_instance") return "EBS Waste";
  return "Recommendation";
}

function buildDonutBackground(
  categories: Ec2OptimizationInstancesResponse["overview"]["categories"],
): string {
  if (!categories.length) return "conic-gradient(#e2e8f0 0deg 360deg)";
  let cursor = 0;
  const slices = categories.map((category) => {
    const span = (Math.max(0, category.percent) / 100) * 360;
    const start = cursor;
    const end = cursor + span;
    cursor = end;
    const color = DONUT_COLORS[category.key];
    return `${color} ${start}deg ${end}deg`;
  });
  if (cursor < 360) slices.push(`#e2e8f0 ${cursor}deg 360deg`);
  return `conic-gradient(${slices.join(",")})`;
}

export default function EC2OptimizationPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { scope } = useDashboardScope();
  const defaults = getDefaultDateRange();

  const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const dateFrom = searchParams.get("billingPeriodStart") ?? searchParams.get("from") ?? scope?.from ?? defaults.start;
  const dateTo = searchParams.get("billingPeriodEnd") ?? searchParams.get("to") ?? scope?.to ?? defaults.end;

  const [activeTab, setActiveTab] = useState<MainTab>("overview");
  const [regionFilter, setRegionFilter] = useState("ALL");
  const [riskFilter, setRiskFilter] = useState<"ALL" | "low" | "medium" | "high">("ALL");
  const [statusFilter, setStatusFilter] = useState<"OPEN" | "RESOLVED" | "IGNORED">("OPEN");
  const [page, setPage] = useState(1);

  const dashboardFiltersQuery = useDashboardFiltersQuery({
    billingPeriodStart: dateFrom,
    billingPeriodEnd: dateTo,
  });

  const instancesQuery = useEc2OptimizationInstancesQuery({
    dateFrom,
    dateTo,
    regionKey: parseOptionalInt(regionFilter),
    riskLevel: riskFilter === "ALL" ? undefined : riskFilter,
    status: statusFilter,
  });

  const data = instancesQuery.data;
  const overview = data?.overview;
  const categoryItems = activeTab === "overview" ? [] : (data?.recommendations[activeTab] ?? []);
  const totalItems = categoryItems.length;
  const totalPages = Math.max(1, Math.ceil(Math.max(1, totalItems) / DEFAULT_PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pagedItems = useMemo(() => {
    if (activeTab === "overview") return [];
    const start = (currentPage - 1) * DEFAULT_PAGE_SIZE;
    return categoryItems.slice(start, start + DEFAULT_PAGE_SIZE);
  }, [activeTab, categoryItems, currentPage]);

  const activeCategoryMeta = useMemo(() => {
    if (!overview || activeTab === "overview") return null;
    return overview.categories.find((item) => item.key === activeTab) ?? null;
  }, [activeTab, overview]);

  const donutBackground = buildDonutBackground(overview?.categories ?? []);
  const resetPage = () => setPage(1);

  const openAction = (
    item:
      | Ec2OptimizationRecommendationItem
      | Ec2OptimizationInstancesResponse["overview"]["topActions"][number],
  ) => {
    if (item.drilldownUrl) {
      navigate(item.drilldownUrl);
      return;
    }
    const params = new URLSearchParams(location.search);
    params.set("resourceId", item.resourceId);
    params.set("recommendationId", String(item.recommendationId));
    params.set("from", dateFrom);
    params.set("to", dateTo);
    navigate(`/dashboard/ec2/performance?${params.toString()}`);
  };

  const instancesErrorMessage =
    instancesQuery.error instanceof ApiError
      ? instancesQuery.error.message
      : instancesQuery.error instanceof Error
        ? instancesQuery.error.message
        : "Failed to load EC2 optimization recommendations.";

  return (
    <div className="dashboard-page optimization-page">
      <div className="optimization-header-shell">
        <div className="optimization-header-tabs" role="tablist" aria-label="EC2 optimization sections">
          {MAIN_TABS.map((tab) => {
            return (
              <button
                key={tab.key}
                type="button"
                className={`optimization-header-tab ${activeTab === tab.key ? "is-active" : ""}`}
                onClick={() => {
                  setActiveTab(tab.key);
                  resetPage();
                }}
                role="tab"
                aria-selected={activeTab === tab.key}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {instancesQuery.isLoading ? <p className="dashboard-note">Loading optimization data...</p> : null}
      {instancesQuery.isError ? <p className="dashboard-note">{instancesErrorMessage}</p> : null}

      {activeTab === "overview" ? (
        <div className="optimization-layout">
          <WidgetShell title="Potential Saving" subtitle="Potential saving insights overview">
            {!overview ? (
              <p className="dashboard-note">No optimization recommendations found for this period.</p>
            ) : (
              <div className="optimization-overview-surface">
                <div className="optimization-overview-donut-panel">
                  <div className="optimization-overview-donut" style={{ backgroundImage: donutBackground }}>
                    <div className="optimization-overview-donut__center">
                      <p className="optimization-overview-donut__value">
                        {currencyFormatter.format(overview.totalPotentialSavings)}
                      </p>
                      <p className="optimization-overview-donut__label">Potential / month</p>
                    </div>
                  </div>
                </div>

                <div className="optimization-overview-insight-list">
                  {overview.categories.map((category) => (
                    <button
                      key={category.key}
                      type="button"
                      className="optimization-overview-insight-item text-left"
                      onClick={() => {
                        setActiveTab(category.key);
                        resetPage();
                      }}
                    >
                      <div className="optimization-overview-insight-item__head">
                        <span
                          className="optimization-overview-insight-item__dot"
                          style={{ backgroundColor: DONUT_COLORS[category.key] }}
                        />
                        <p className="optimization-overview-insight-item__title">{category.label}</p>
                      </div>
                      <p className="optimization-overview-insight-item__value">
                        {currencyFormatter.format(category.savings)}
                      </p>
                      <p className="optimization-overview-insight-item__meta">
                        {category.count} recommendations - {category.percent}% of total potential
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </WidgetShell>

          <WidgetShell title="Savings Lifecycle" subtitle="Applied recommendation lifecycle across optimization categories">
            <div className="optimization-verified-surface">
              <article className="optimization-verified-total">
                <p className="optimization-verified-total__label">Total Potential Saving / month</p>
                <p className="optimization-verified-total__value">
                  {currencyFormatter.format(overview?.totalPotentialSavings ?? 0)}
                </p>
              </article>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                <article className="optimization-verified-item">
                  <p className="optimization-overview-insight-item__title">Verified Savings</p>
                  <p className="optimization-overview-insight-item__value">
                    {currencyFormatter.format(overview?.lifecycle.verifiedSavings ?? 0)}
                  </p>
                </article>
                <article className="optimization-verified-item">
                  <p className="optimization-overview-insight-item__title">Applied Actions</p>
                  <p className="optimization-overview-insight-item__value">
                    {integerFormatter.format(overview?.lifecycle.appliedActions ?? 0)}
                  </p>
                </article>
                <article className="optimization-verified-item">
                  <p className="optimization-overview-insight-item__title">Pending Actions</p>
                  <p className="optimization-overview-insight-item__value">
                    {integerFormatter.format(overview?.lifecycle.pendingActions ?? 0)}
                  </p>
                </article>
                <article className="optimization-verified-item">
                  <p className="optimization-overview-insight-item__title">Ignored Recommendations</p>
                  <p className="optimization-overview-insight-item__value">
                    {integerFormatter.format(overview?.lifecycle.ignoredRecommendations ?? 0)}
                  </p>
                </article>
              </div>
            </div>
          </WidgetShell>

          <WidgetShell title="Top Actions" subtitle="Highest-impact EC2 optimization actions">
            {(overview?.topActions.length ?? 0) === 0 ? (
              <p className="dashboard-note">No optimization recommendations found for this period.</p>
            ) : (
              <div className="optimization-recommendation-list">
                {overview?.topActions.map((item) => (
                  <article key={item.recommendationId} className="optimization-recommendation-card">
                    <div>
                      <p className="optimization-recommendation-card__title">{item.title || item.actionLabel}</p>
                      <p className="optimization-recommendation-card__target">{item.resourceName || item.resourceId}</p>
                    </div>
                    <p className="optimization-recommendation-card__saving">
                      {currencyFormatter.format(item.estimatedSavings)}/month
                    </p>
                    <div className="optimization-recommendation-card__chips">
                      <Badge variant="outline" className={cn("rounded-md", getRiskTone(item.riskLevel))}>
                        Risk: {item.riskLevel}
                      </Badge>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-8 rounded-none border-[color:var(--border-light)] bg-transparent text-text-primary hover:bg-transparent"
                        onClick={() => openAction(item)}
                      >
                        {item.actionLabel || "Review"}
                      </Button>
                    </div>
                  </article>
                ))}
              </div>
            )}
            {(overview?.totalPotentialSavings ?? 0) <= 0 ? (
              <p className="dashboard-note">No potential savings detected for this period.</p>
            ) : null}
          </WidgetShell>
        </div>
      ) : (
        <div className="optimization-layout">
          <div className="optimization-recommendation-unified-shell">
            <section className="optimization-rightsizing-shell">
              <section className="optimization-rightsizing-panel">
                <section className="optimization-rightsizing-kpis-bar">
                  <article className="optimization-rightsizing-kpi-inline">
                    <p className="optimization-rightsizing-kpi__label">{activeCategoryMeta?.label ?? "Category"}</p>
                    <p className="optimization-rightsizing-kpi__value">
                      {integerFormatter.format(activeCategoryMeta?.count ?? 0)}
                    </p>
                  </article>
                  <article className="optimization-rightsizing-kpi-inline">
                    <p className="optimization-rightsizing-kpi__label">Potential Savings</p>
                    <p className="optimization-rightsizing-kpi__value">
                      {currencyFormatter.format(activeCategoryMeta?.savings ?? 0)}
                    </p>
                  </article>
                  <article className="optimization-rightsizing-kpi-inline">
                    <p className="optimization-rightsizing-kpi__label">Status</p>
                    <p className="optimization-rightsizing-kpi__value">{statusFilter}</p>
                  </article>
                </section>

                <div className="optimization-rightsizing-filters">
                  <div className="optimization-rightsizing-filter-field">
                    <p className="optimization-rightsizing-filter-label">Region</p>
                    <select
                      value={regionFilter}
                      onChange={(event) => {
                        setRegionFilter(event.target.value);
                        resetPage();
                      }}
                      className="optimization-rightsizing-filter-control"
                    >
                      <option value="ALL">All regions</option>
                      {(dashboardFiltersQuery.data?.regions ?? []).map((option) => (
                        <option key={option.key} value={String(option.key)}>
                          {option.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="optimization-rightsizing-filter-field">
                    <p className="optimization-rightsizing-filter-label">Risk</p>
                    <select
                      value={riskFilter}
                      onChange={(event) => {
                        setRiskFilter(event.target.value as "ALL" | "low" | "medium" | "high");
                        resetPage();
                      }}
                      className="optimization-rightsizing-filter-control"
                    >
                      <option value="ALL">All risk</option>
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                    </select>
                  </div>

                  <div className="optimization-rightsizing-filter-field">
                    <p className="optimization-rightsizing-filter-label">Status</p>
                    <select
                      value={statusFilter}
                      onChange={(event) => {
                        setStatusFilter(event.target.value as "OPEN" | "RESOLVED" | "IGNORED");
                        resetPage();
                      }}
                      className="optimization-rightsizing-filter-control"
                    >
                      <option value="OPEN">Open</option>
                      <option value="RESOLVED">Resolved</option>
                      <option value="IGNORED">Ignored</option>
                    </select>
                  </div>
                </div>

                <div className="optimization-rightsizing-table-scroll">
                  <table className="optimization-rightsizing-table">
                    <thead>
                      <tr>
                        <th>Resource</th>
                        <th>Recommendation</th>
                        <th>Monthly Cost</th>
                        <th>Savings</th>
                        <th>Risk</th>
                        <th>Evidence</th>
                        <th>Recommended Action</th>
                        <th>Status</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {instancesQuery.isLoading ? (
                        <tr>
                          <td colSpan={9} className="optimization-rightsizing-empty">
                            <p className="optimization-rightsizing-empty__title">Loading recommendations...</p>
                          </td>
                        </tr>
                      ) : pagedItems.length === 0 ? (
                        <tr>
                          <td colSpan={9} className="optimization-rightsizing-empty">
                            <p className="optimization-rightsizing-empty__title">No recommendations found</p>
                            <p className="optimization-rightsizing-empty__text">Try changing filters or broadening the selected scope.</p>
                          </td>
                        </tr>
                      ) : (
                        pagedItems.map((item) => (
                          <tr key={item.recommendationId}>
                            <td>
                              <p className="optimization-rightsizing-cell__primary">{item.resourceName || item.resourceId}</p>
                              <p className="optimization-idle-cell__secondary">{item.resourceId}</p>
                              <p className="optimization-idle-cell__secondary">{item.accountName ?? "-"}</p>
                            </td>
                            <td>
                              <div className="flex flex-wrap gap-1">
                                <Badge variant="outline" className={cn("rounded-md", getRecommendationBadgeTone(item.recommendationType))}>
                                  {recommendationTypeLabel(item.recommendationType)}
                                </Badge>
                              </div>
                              <p className="optimization-idle-cell__secondary mt-1">{item.reason || "-"}</p>
                            </td>
                            <td className="optimization-rightsizing-cell__mono">{currencyFormatter.format(item.monthlyCost)}</td>
                            <td className="optimization-rightsizing-cell__mono optimization-rightsizing-cell__saving">
                              {item.estimatedSavings > 0 ? currencyFormatter.format(item.estimatedSavings) : "-"}
                            </td>
                            <td>
                              <span className={`optimization-rightsizing-pill is-risk-${toUpper(item.riskLevel)}`}>
                                {toTitleCase(item.riskLevel)}
                              </span>
                            </td>
                            <td className="optimization-idle-cell__observation">
                              {item.evidence.length > 0
                                ? item.evidence.slice(0, 2).map((entry) => `${entry.label}: ${entry.value}`).join(" | ")
                                : "-"}
                            </td>
                            <td>{item.recommendedAction}</td>
                            <td>
                              <span className={`optimization-rightsizing-pill is-status-${toUpper(item.status)}`}>
                                {toTitleCase(item.status)}
                              </span>
                            </td>
                            <td>
                              <button
                                type="button"
                                className="optimization-rightsizing-view-btn"
                                onClick={() => openAction(item)}
                              >
                                {item.actionLabel || "Review"}
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {!instancesQuery.isLoading && pagedItems.length > 0 ? (
                  <div className="optimization-rightsizing-pagination">
                    <p className="optimization-rightsizing-pagination__info">
                      Page {currentPage} of {Math.max(1, totalPages)}
                    </p>
                    <div className="optimization-rightsizing-pagination__actions">
                      <button
                        type="button"
                        className="optimization-rightsizing-view-btn"
                        disabled={currentPage <= 1}
                        onClick={() => setPage((previous) => Math.max(1, previous - 1))}
                      >
                        Previous
                      </button>
                      <button
                        type="button"
                        className="optimization-rightsizing-view-btn"
                        disabled={currentPage >= totalPages}
                        onClick={() => setPage((previous) => Math.min(totalPages, previous + 1))}
                      >
                        Next
                      </button>
                    </div>
                  </div>
                ) : null}
              </section>
            </section>
          </div>
        </div>
      )}
    </div>
  );
}
