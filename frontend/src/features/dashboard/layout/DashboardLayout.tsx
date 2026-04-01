import { Outlet } from "react-router-dom";
import { DashboardGlobalHeader } from "../components/DashboardGlobalHeader";
import { DashboardPageContainer } from "../components/DashboardPageContainer";
import { DashboardSidebar } from "../components/DashboardSidebar";

export function DashboardLayout() {
  return (
    <div className="kcx-dashboard">
      <div className="dashboard-shell">
        <DashboardSidebar />

        <main className="dashboard-main" aria-label="Dashboard content">
          <div className="dashboard-main__inner">
            <DashboardPageContainer>
              <DashboardGlobalHeader />
              <Outlet />
            </DashboardPageContainer>
          </div>
        </main>
      </div>
    </div>
  );
}
