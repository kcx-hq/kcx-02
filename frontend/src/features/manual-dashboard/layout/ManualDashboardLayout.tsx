import { Outlet } from "react-router-dom";
import { ManualDashboardGlobalHeader } from "../components/ManualDashboardGlobalHeader";
import { ManualDashboardPageContainer } from "../components/ManualDashboardPageContainer";
import { ManualDashboardSidebar } from "../components/ManualDashboardSidebar";

export function ManualDashboardLayout() {
  return (
    <div className="kcx-dashboard">
      <div className="dashboard-shell">
        <ManualDashboardSidebar />

        <main className="dashboard-main" aria-label="Manual dashboard content">
          <div className="dashboard-main__inner">
            <ManualDashboardPageContainer>
              <ManualDashboardGlobalHeader />
              <Outlet />
            </ManualDashboardPageContainer>
          </div>
        </main>
      </div>
    </div>
  );
}
