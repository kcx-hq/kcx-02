import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { DashboardLayout } from "../layout/DashboardLayout";
import OverviewPage from "../pages/overview/OverviewPage";
import CostExplorerPage from "../pages/cost-explorer/CostExplorerPage";
import { CostHistoryPage } from "../pages/cost";
import ResourcesPage from "../pages/resources/ResourcesPage";
import AllocationPage from "../pages/allocation/AllocationPage";
import OptimizationPage from "../pages/optimization/OptimizationPage";
import AnomaliesAlertsPage from "../pages/anomalies-alerts/AnomaliesAlertsPage";
import BudgetPage from "../pages/budget/BudgetPage";
import ReportPage from "../pages/report/ReportPage";
import InventoryInstancesPage from "../pages/inventory/InventoryInstancesPage";
import InventorySnapshotsPage from "../pages/inventory/InventorySnapshotsPage";
import InventoryVolumesPage from "../pages/inventory/InventoryVolumesPage";
import AwsInventoryPage from "../pages/inventory/AwsInventoryPage";
import EC2CostPage from "../pages/ec2/EC2CostPage";
import EC2OverviewPage from "../pages/ec2/EC2OverviewPage";
import EC2UsagePage from "../pages/ec2/EC2UsagePage";
import EC2UsageHoursPage from "../pages/ec2/EC2UsageHoursPage";
import EC2PerformancePage from "../pages/ec2/EC2PerformancePage";
import EC2VolumesPage from "../pages/ec2/EC2VolumesPage";
import S3OverviewPage from "../pages/s3/S3OverviewPage";
import S3BucketDetailPage from "../pages/s3/S3BucketDetailPage";
import S3UsagePage from "../pages/s3/S3UsagePage";
import "../styles/tokens.css";
import "../styles/dashboard.css";

function DashboardOverviewRedirect() {
  const location = useLocation();

  return (
    <Navigate
      to={{
        pathname: "/dashboard/overview",
        search: location.search,
      }}
      replace
    />
  );
}

function DashboardCostRedirect() {
  const location = useLocation();

  return (
    <Navigate
      to={{
        pathname: "/dashboard/cost/explorer",
        search: location.search,
      }}
      replace
    />
  );
}

function DashboardInventoryRedirect() {
  const location = useLocation();

  return (
    <Navigate
      to={{
        pathname: "/dashboard/inventory",
        search: location.search,
      }}
      replace
    />
  );
}

function DashboardInventoryEc2Redirect() {
  const location = useLocation();

  return (
    <Navigate
      to={{
        pathname: "/dashboard/inventory/aws/ec2/instances",
        search: location.search,
      }}
      replace
    />
  );
}

function DashboardS3Redirect() {
  const location = useLocation();

  return (
    <Navigate
      to={{
        pathname: "/dashboard/s3/cost",
        search: location.search,
      }}
      replace
    />
  );
}

export default function DashboardRoutes() {
  return (
    <Routes>
      <Route path="/dashboard" element={<DashboardLayout />}>
        <Route index element={<DashboardOverviewRedirect />} />
        <Route path="overview" element={<OverviewPage />} />
        <Route path="cfo-dashboard" element={<OverviewPage />} />
        <Route path="cost" element={<DashboardCostRedirect />} />
        <Route path="cost/explorer" element={<CostExplorerPage />} />
        <Route path="cost/history" element={<CostHistoryPage />} />
        <Route path="cost-explorer" element={<DashboardCostRedirect />} />
        <Route path="ec2/volumes" element={<EC2VolumesPage />} />
        <Route path="ec2" element={<EC2OverviewPage />} />
        <Route path="ec2/cost" element={<EC2CostPage />} />
        <Route path="ec2/usage" element={<EC2UsagePage />} />
        <Route path="ec2/instance-hours" element={<EC2UsageHoursPage />} />
        <Route path="ec2/performance" element={<EC2PerformancePage />} />
        <Route path="s3" element={<DashboardS3Redirect />} />
        <Route path="s3/cost" element={<S3OverviewPage />} />
        <Route path="s3/cost/bucket/:bucketName" element={<S3BucketDetailPage />} />
        <Route path="s3/usage" element={<S3UsagePage />} />
        <Route path="resources" element={<ResourcesPage />} />
        <Route path="allocation" element={<AllocationPage />} />
        <Route path="optimization" element={<OptimizationPage />} />
        <Route path="anomalies-alerts" element={<AnomaliesAlertsPage />} />
        <Route path="budget" element={<BudgetPage />} />
        <Route path="report" element={<ReportPage />} />
        <Route path="inventory" element={<AwsInventoryPage />} />
        <Route path="inventory/aws" element={<DashboardInventoryRedirect />} />
        <Route path="inventory/aws/ec2" element={<DashboardInventoryEc2Redirect />} />
        <Route path="inventory/aws/ec2/instances" element={<InventoryInstancesPage />} />
        <Route path="inventory/aws/ec2/snapshots" element={<InventorySnapshotsPage />} />
        <Route path="inventory/aws/ec2/volumes" element={<InventoryVolumesPage />} />
        <Route path="*" element={<DashboardOverviewRedirect />} />
      </Route>
    </Routes>
  );
}
