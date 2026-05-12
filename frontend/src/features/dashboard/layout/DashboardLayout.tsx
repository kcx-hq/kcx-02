import { Outlet, useLocation } from "react-router-dom";
import { DashboardGlobalHeader } from "../components/DashboardGlobalHeader";
import { DashboardPageContainer } from "../components/DashboardPageContainer";
import { DashboardSidebar } from "../components/DashboardSidebar";
import { DashboardScopeProvider } from "../context/DashboardScopeContext";
import { useDashboardScope } from "../hooks/useDashboardScope";

function S3ExplorerLoadingSkeleton() {
  return (
    <div className="s3-bucket-page">
      <div className="s3-bucket-tabs" role="tablist" aria-label="S3 bucket section switcher">
        <button type="button" role="tab" aria-selected className="s3-bucket-tab is-active">
          Cost
        </button>
        <button type="button" role="tab" aria-selected={false} className="s3-bucket-tab">
          Usage
        </button>
      </div>

      <div className="dashboard-page s3-overview-page" aria-hidden="true">
        <section className="cost-explorer-control-surface s3-overview-filter-panel s3-overview-filter-panel--loading">
          <div className="cost-explorer-toolbar-row">
            <div className="cost-explorer-toolbar-item s3-overview-filter-panel__item--cost-by">
              <button type="button" className="cost-explorer-toolbar-trigger" disabled>
                <span className="cost-explorer-toolbar-trigger__label">Cost by</span>
                <span className="cost-explorer-toolbar-trigger__row">
                  <span className="cost-explorer-toolbar-trigger__value">Bucket</span>
                </span>
              </button>
            </div>
            <div className="cost-explorer-toolbar-item s3-overview-filter-panel__item--y-axis">
              <button type="button" className="cost-explorer-toolbar-trigger" disabled>
                <span className="cost-explorer-toolbar-trigger__label">Y-Axis</span>
                <span className="cost-explorer-toolbar-trigger__row">
                  <span className="cost-explorer-toolbar-trigger__value">Billed Cost ($)</span>
                </span>
              </button>
            </div>
            <div className="cost-explorer-toolbar-item s3-overview-filter-panel__item--x-axis">
              <button type="button" className="cost-explorer-toolbar-trigger" disabled>
                <span className="cost-explorer-toolbar-trigger__label">X-Axis</span>
                <span className="cost-explorer-toolbar-trigger__row">
                  <span className="cost-explorer-toolbar-trigger__value">date</span>
                </span>
              </button>
            </div>
            <div className="cost-explorer-toolbar-item s3-overview-filter-panel__item--region">
              <button type="button" className="cost-explorer-toolbar-trigger" disabled>
                <span className="cost-explorer-toolbar-trigger__label">Region</span>
                <span className="cost-explorer-toolbar-trigger__row">
                  <span className="cost-explorer-toolbar-trigger__value">All</span>
                </span>
              </button>
            </div>
          </div>
          <div className="cost-explorer-chip-bar">
            <div className="cost-explorer-chip-row">
              <span className="cost-explorer-chip">
                <span className="cost-explorer-chip__edit">Cost By: Bucket</span>
              </span>
              <span className="cost-explorer-chip">
                <span className="cost-explorer-chip__edit">X-Axis: date</span>
              </span>
            </div>
          </div>
        </section>
        <section className="cost-explorer-chart-panel s3-overview-chart-panel">
          <div className="cost-explorer-chart-panel__body">
            <div className="cost-explorer-chart-skeleton cost-explorer-chart-skeleton--bars" style={{ minHeight: "420px" }} />
          </div>
        </section>
        <section className="s3-overview-table-panel">
          <div className="s3-usage-table-skeleton">
            <div className="s3-usage-table-skeleton__toolbar" />
            <div className="s3-usage-table-skeleton__header" />
            <div className="s3-usage-table-skeleton__row" />
            <div className="s3-usage-table-skeleton__row" />
            <div className="s3-usage-table-skeleton__row" />
            <div className="s3-usage-table-skeleton__row" />
            <div className="s3-usage-table-skeleton__row" />
            <div className="s3-usage-table-skeleton__row" />
          </div>
        </section>
      </div>
    </div>
  );
}

function DashboardScopeGate() {
  const { scope, isLoading, isError, error } = useDashboardScope();
  const location = useLocation();
  const isS3ExplorerLikeRoute =
    location.pathname.startsWith("/dashboard/s3/cost") ||
    location.pathname.startsWith("/dashboard/s3/usage") ||
    location.pathname.startsWith("/dashboard/s3/explorer");

  if (isLoading && !scope) {
    if (isS3ExplorerLikeRoute) {
      return <S3ExplorerLoadingSkeleton />;
    }
    return <p className="dashboard-note">Resolving dashboard scope...</p>;
  }

  if (isError || !scope) {
    return <p className="dashboard-note">Failed to resolve dashboard scope: {error?.message ?? "Unknown error"}</p>;
  }

  return <Outlet />;
}

export function DashboardLayout() {
  return (
    <div className="kcx-dashboard">
      <div className="dashboard-shell">
        <DashboardSidebar />

        <main className="dashboard-main" aria-label="Dashboard content">
          <div className="dashboard-main__inner">
            <DashboardScopeProvider>
              <DashboardPageContainer>
                <DashboardGlobalHeader />
                <DashboardScopeGate />
              </DashboardPageContainer>
            </DashboardScopeProvider>
          </div>
        </main>
      </div>
    </div>
  );
}
