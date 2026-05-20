import { Outlet, useLocation } from "react-router-dom";
import { DashboardGlobalHeader } from "../components/DashboardGlobalHeader";
import { DashboardPageContainer } from "../components/DashboardPageContainer";
import { DashboardSidebar } from "../components/DashboardSidebar";
import { DashboardScopeProvider } from "../context/DashboardScopeContext";
import { useDashboardScope } from "../hooks/useDashboardScope";
import { OverviewDashboardSkeleton } from "../pages/overview/components";
import { CostExplorerSkeleton } from "../pages/cost-explorer/components";
import { HistorySectionSkeleton } from "../pages/cost/history/components/HistorySectionSkeleton";
import { EC2ExplorerUnifiedSkeleton } from "../pages/ec2/components";
import { CostExplorerSkeleton as S3CostExplorerSkeleton } from "../pages/s3/components/CostExplorerSkeleton";

function S3BucketLoadingSkeleton() {
  return (
    <div className="dashboard-page">
      <div className="s3-bucket-section s3-bucket-section--skeleton" aria-label="Loading S3 bucket insights">
        <section className="cost-explorer-widget-shell s3-bucket-kpi-shell">
          <div className="s3-bucket-kpi-row" aria-hidden="true">
            {Array.from({ length: 4 }).map((_, index) => (
              <article key={`s3-bucket-kpi-skeleton-${index}`} className="s3-bucket-kpi-tile s3-bucket-kpi-tile--skeleton">
                <div className="s3-bucket-skeleton-line s3-bucket-skeleton-line--label" />
                <div className="s3-bucket-skeleton-line s3-bucket-skeleton-line--value" />
              </article>
            ))}
          </div>
        </section>
        <section className="cost-explorer-widget-shell s3-bucket-table-shell">
          <div className="s3-bucket-table-skeleton" aria-hidden="true">
            <div className="s3-bucket-table-skeleton__header">
              {Array.from({ length: 8 }).map((_, index) => (
                <span key={`s3-bucket-head-${index}`} className="s3-bucket-skeleton-line s3-bucket-skeleton-line--cell" />
              ))}
            </div>
            <div className="s3-bucket-table-skeleton__body">
              {Array.from({ length: 11 }).map((_, rowIndex) => (
                <div key={`s3-bucket-row-${rowIndex}`} className="s3-bucket-table-skeleton__row">
                  {Array.from({ length: 8 }).map((_, colIndex) => (
                    <span
                      key={`s3-bucket-cell-${rowIndex}-${colIndex}`}
                      className="s3-bucket-skeleton-line s3-bucket-skeleton-line--cell"
                    />
                  ))}
                </div>
              ))}
            </div>
            <div className="s3-bucket-table-skeleton__footer">
              <span className="s3-bucket-skeleton-line s3-bucket-skeleton-line--pagination-left" />
              <span className="s3-bucket-skeleton-line s3-bucket-skeleton-line--pagination-right" />
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

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
        <S3CostExplorerSkeleton />
      </div>
    </div>
  );
}

function DashboardScopeLoadingSkeleton() {
  return (
    <div className="dashboard-scope-skeleton" aria-hidden="true">
      <section className="dashboard-scope-skeleton__kpis">
        {Array.from({ length: 6 }).map((_, index) => (
          <article key={`scope-kpi-${index}`} className="dashboard-scope-skeleton__card">
            <div className="dashboard-scope-skeleton__block dashboard-scope-skeleton__block--label" />
            <div className="dashboard-scope-skeleton__block dashboard-scope-skeleton__block--value" />
            <div className="dashboard-scope-skeleton__block dashboard-scope-skeleton__block--meta" />
          </article>
        ))}
      </section>
      <section className="dashboard-scope-skeleton__grid">
        <div className="dashboard-scope-skeleton__panel dashboard-scope-skeleton__panel--wide" />
        <div className="dashboard-scope-skeleton__panel" />
        <div className="dashboard-scope-skeleton__panel" />
      </section>
    </div>
  );
}

function DashboardScopeErrorState({ message }: { message: string }) {
  return (
    <section className="dashboard-scope-error" role="alert">
      <h2 className="dashboard-scope-error__title">Unable to initialize dashboard scope</h2>
      <p className="dashboard-scope-error__message">{message}</p>
    </section>
  );
}

function DashboardScopeGate() {
  const { scope, isLoading, isError, error } = useDashboardScope();
  const location = useLocation();
  const isEc2Route =
    location.pathname.startsWith("/dashboard/ec2/") ||
    location.pathname.startsWith("/dashboard/inventory/aws/ec2/");
  const isOverviewRoute =
    location.pathname === "/dashboard/overview" || location.pathname === "/dashboard/cfo-dashboard";
  const isCostExplorerRoute =
    location.pathname.startsWith("/dashboard/cost/explorer") || location.pathname.startsWith("/dashboard/cost-explorer");
  const isCostHistoryRoute = location.pathname.startsWith("/dashboard/cost/history");
  const isEc2ExplorerRoute = location.pathname.startsWith("/dashboard/ec2/explorer");
  const isS3BucketRoute = location.pathname.startsWith("/dashboard/s3/bucket");
  const isS3ExplorerLikeRoute =
    location.pathname.startsWith("/dashboard/s3/cost") ||
    location.pathname.startsWith("/dashboard/s3/usage") ||
    location.pathname.startsWith("/dashboard/s3/explorer");

  if (isLoading && !scope) {
    if (isEc2Route) {
      return <Outlet />;
    }
    if (isOverviewRoute) {
      return <OverviewDashboardSkeleton />;
    }
    if (isCostExplorerRoute) {
      return (
        <div className="dashboard-page cost-explorer-page">
          <CostExplorerSkeleton />
        </div>
      );
    }
    if (isCostHistoryRoute) {
      return (
        <div className="dashboard-page cost-history-page">
          <HistorySectionSkeleton />
        </div>
      );
    }
    if (isEc2ExplorerRoute) {
      return (
        <div className="dashboard-page cost-explorer-page ec2-explorer-page">
          <EC2ExplorerUnifiedSkeleton />
        </div>
      );
    }
    if (isS3BucketRoute) {
      return <S3BucketLoadingSkeleton />;
    }
    if (isS3ExplorerLikeRoute) {
      return <S3ExplorerLoadingSkeleton />;
    }
    return <DashboardScopeLoadingSkeleton />;
  }

  if (isError || !scope) {
    return <DashboardScopeErrorState message={error?.message ?? "Unknown error"} />;
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
