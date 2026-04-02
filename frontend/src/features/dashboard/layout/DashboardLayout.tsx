import { Outlet } from "react-router-dom";
import { DashboardGlobalHeader } from "../components/DashboardGlobalHeader";
import { DashboardPageContainer } from "../components/DashboardPageContainer";
import { DashboardSidebar } from "../components/DashboardSidebar";
import { DashboardScopeProvider } from "../context/DashboardScopeContext";
import { useDashboardScope } from "../hooks/useDashboardScope";

function DashboardScopeGate() {
  const { scope, isLoading, isError, error } = useDashboardScope();

  if (isLoading) {
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
