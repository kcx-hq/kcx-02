import { useEffect, useMemo, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { useIngestionStatus } from "@/features/client-home/hooks/useIngestionStatus";
import { ManualDashboardGlobalHeader } from "../components/ManualDashboardGlobalHeader";
import { ManualDashboardPageContainer } from "../components/ManualDashboardPageContainer";
import { ManualDashboardSidebar } from "../components/ManualDashboardSidebar";

export function ManualDashboardLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const [terminalError, setTerminalError] = useState<string | null>(null);

  const ingestionRunId = useMemo(() => {
    const params = new URLSearchParams(location.search);
    const value = params.get("ingestionRunId");
    return value && value.trim().length > 0 ? value.trim() : null;
  }, [location.search]);

  const ingestionStatus = useIngestionStatus({
    ingestionRunId,
    enabled: Boolean(ingestionRunId),
  });

  const isWaitingForIngestion = Boolean(ingestionRunId) && (!ingestionStatus.status || ingestionStatus.isRunning);

  useEffect(() => {
    if (!ingestionRunId || !ingestionStatus.isTerminal || !ingestionStatus.status) return;

    if (ingestionStatus.status.status === "failed") {
      setTerminalError(
        ingestionStatus.status.errorMessage?.trim() || "Ingestion failed. Showing current dashboard scope.",
      );
    } else {
      setTerminalError(null);
    }

    const params = new URLSearchParams(location.search);
    params.delete("ingestionRunId");
    navigate(
      {
        pathname: location.pathname,
        search: params.toString(),
      },
      { replace: true },
    );
  }, [ingestionRunId, ingestionStatus.isTerminal, ingestionStatus.status, location.pathname, location.search, navigate]);

  return (
    <div className="kcx-dashboard">
      <div className="dashboard-shell">
        <ManualDashboardSidebar />

        <main className="dashboard-main" aria-label="Manual dashboard content">
          <div className="dashboard-main__inner">
            <ManualDashboardPageContainer>
              <ManualDashboardGlobalHeader />
              {terminalError ? (
                <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                  {terminalError}
                </div>
              ) : null}
              {isWaitingForIngestion ? (
                <section className="dashboard-placeholder">
                  <div className="dashboard-placeholder__head">
                    <p className="dashboard-placeholder__label">Ingestion In Progress</p>
                    <span className="dashboard-placeholder__hint">
                      {ingestionStatus.status?.statusMessage || "Preparing dashboard data..."}
                    </span>
                  </div>
                  <div className="dashboard-placeholder__body">
                    <div className="dashboard-skeleton-grid" />
                  </div>
                </section>
              ) : (
                <Outlet />
              )}
            </ManualDashboardPageContainer>
          </div>
        </main>
      </div>
    </div>
  );
}
