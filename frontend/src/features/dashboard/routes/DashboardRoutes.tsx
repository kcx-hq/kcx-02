import { Navigate, Route, Routes } from "react-router-dom";
import { DashboardLayout } from "../layout/DashboardLayout";
import OverviewPage from "../pages/overview/OverviewPage";
import CostAnalysisPage from "../pages/cost-analysis/CostAnalysisPage";
import CostDriverPage from "../pages/cost-driver/CostDriverPage";
import DataQualityPage from "../pages/data-quality/DataQualityPage";
import ReportPage from "../pages/report/ReportPage";
import "../styles/tokens.css";
import "../styles/dashboard.css";

export default function DashboardRoutes() {
  return (
    <Routes>
      <Route path="/dashboard" element={<DashboardLayout />}>
        <Route index element={<Navigate to="/dashboard/overview" replace />} />
        <Route path="overview" element={<OverviewPage />} />
        <Route path="cost-analysis" element={<CostAnalysisPage />} />
        <Route path="cost-driver" element={<CostDriverPage />} />
        <Route path="data-quality" element={<DataQualityPage />} />
        <Route path="report" element={<ReportPage />} />
        <Route path="*" element={<Navigate to="/dashboard/overview" replace />} />
      </Route>
    </Routes>
  );
}
