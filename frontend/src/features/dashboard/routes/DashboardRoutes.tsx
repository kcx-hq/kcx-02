import { Navigate, Route, Routes } from "react-router-dom";
import { DashboardLayout } from "../layout/DashboardLayout";
import OverviewPage from "../pages/overview/OverviewPage";
import CostExplorerPage from "../pages/cost-explorer/CostExplorerPage";
import ResourcesPage from "../pages/resources/ResourcesPage";
import AllocationPage from "../pages/allocation/AllocationPage";
import OptimizationPage from "../pages/optimization/OptimizationPage";
import AnomaliesAlertsPage from "../pages/anomalies-alerts/AnomaliesAlertsPage";
import BudgetPage from "../pages/budget/BudgetPage";
import ReportPage from "../pages/report/ReportPage";
import "../styles/tokens.css";
import "../styles/dashboard.css";

export default function DashboardRoutes() {
  return (
    <Routes>
      <Route path="/dashboard" element={<DashboardLayout />}>
        <Route index element={<Navigate to="/dashboard/overview" replace />} />
        <Route path="overview" element={<OverviewPage />} />
        <Route path="cost-explorer" element={<CostExplorerPage />} />
        <Route path="resources" element={<ResourcesPage />} />
        <Route path="allocation" element={<AllocationPage />} />
        <Route path="optimization" element={<OptimizationPage />} />
        <Route path="anomalies-alerts" element={<AnomaliesAlertsPage />} />
        <Route path="budget" element={<BudgetPage />} />
        <Route path="report" element={<ReportPage />} />
        <Route path="*" element={<Navigate to="/dashboard/overview" replace />} />
      </Route>
    </Routes>
  );
}
