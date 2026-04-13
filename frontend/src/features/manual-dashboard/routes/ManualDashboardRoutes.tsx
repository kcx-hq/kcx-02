import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { ManualDashboardLayout } from "../layout/ManualDashboardLayout";
import OverviewPage from "../pages/overview/OverviewPage";
import CostExplorerPage from "../pages/cost-explorer/CostExplorerPage";
import AnomaliesAlertsPage from "../pages/anomalies-alerts/AnomaliesAlertsPage";
import "../styles/tokens.css";
import "../styles/manual-dashboard.css";

function ManualDashboardOverviewRedirect() {
  const location = useLocation();

  return (
    <Navigate
      to={{
        pathname: "/uploads-dashboard/overview",
        search: location.search,
      }}
      replace
    />
  );
}

export default function ManualDashboardRoutes() {
  return (
    <Routes>
      <Route path="/uploads-dashboard" element={<ManualDashboardLayout />}>
        <Route index element={<ManualDashboardOverviewRedirect />} />
        <Route path="overview" element={<OverviewPage />} />
        <Route path="cost-explorer" element={<CostExplorerPage />} />
        <Route path="anomalies-alerts" element={<AnomaliesAlertsPage />} />
        <Route path="*" element={<ManualDashboardOverviewRedirect />} />
      </Route>
    </Routes>
  );
}
