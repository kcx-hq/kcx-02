import { Navigate, Route, Routes, useLocation, useParams } from "react-router-dom";
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
import EC2SnapshotsPage from "../pages/ec2/EC2SnapshotsPage";
import AwsInventoryPage from "../pages/inventory/AwsInventoryPage";
import EC2ExplorerPage from "../pages/ec2/EC2ExplorerPage";
import EC2VolumesPage from "../pages/ec2/EC2VolumesPage";
import EC2OptimizationPage from "../pages/ec2/EC2OptimizationPage";
import S3UsageBucketDetailPage from "../pages/s3/S3UsageBucketDetailPage";
import S3OptimizationPage from "../pages/s3/S3OptimizationPage";
import S3BucketPage from "../pages/s3/S3BucketPage";
import S3BucketInfoPage from "../pages/s3/S3BucketInfoPage";
import PolicyPage from "../pages/policy/PolicyPage";
import S3PolicyPage from "../pages/policy/S3PolicyPage";
import "../styles/tokens.css";
import "../styles/dashboard.css";
import EC2InstancesPage from "../pages/ec2/EC2InstancesPage";
import EC2InstanceDetailPage from "../pages/ec2/EC2InstanceDetailPage";
import EC2VolumeDetailPage from "../pages/ec2/EC2VolumeDetailPage";
import EC2EipPage from "../pages/ec2/EC2EipPage";
import DatabaseExplorerPage from "../pages/database/DatabaseExplorerPage";
import DatabaseAssetsPage from "../pages/database/db-assets-page";
import DatabaseAssetDetailPage from "../pages/database/DatabaseAssetDetailPage";
import DatabaseRecommendationsPage from "../pages/database/DatabaseRecommendationsPage";
import LoadBalancerExplorerPage from "../pages/load-balancer/LoadBalancerExplorerPage";
import LoadBalancerListPage from "../pages/load-balancer/LoadBalancerListPage";
import LoadBalancerDetailPage from "../pages/load-balancer/LoadBalancerDetailPage";
import LoadBalancerOptimizationPage from "../pages/load-balancer/LoadBalancerOptimizationPage";

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

function DashboardEc2DataTransferRedirect() {
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  params.set("metric", "data-transfer");
  params.set("groupBy", "transfer-type");
  params.set("usageType", "network");
  return (
    <Navigate
      to={{
        pathname: "/dashboard/ec2/explorer",
        search: params.toString(),
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

function DashboardS3ExplorerRedirect() {
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

function DashboardS3BucketDetailRedirect() {
  const location = useLocation();
  const params = useParams<{ bucketName: string }>();
  const bucketName = String(params.bucketName ?? "").trim();
  return (
    <Navigate
      to={{
        pathname: `/dashboard/s3/bucket/${encodeURIComponent(bucketName)}`,
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
        <Route path="ec2/explorer" element={<EC2ExplorerPage />} />
        <Route path="load-balancer/explorer" element={<LoadBalancerExplorerPage />} />
        <Route path="load-balancer/optimization" element={<LoadBalancerOptimizationPage />} />
        <Route path="ec2/volumes" element={<EC2VolumesPage />} />
        <Route path="ec2/optimization" element={<EC2OptimizationPage />} />
        <Route path="ec2/network/data-transfer" element={<DashboardEc2DataTransferRedirect />} />
        <Route path="ec2/network/elastic-ip" element={<EC2EipPage />} />
        <Route path="s3" element={<DashboardS3Redirect />} />
        <Route path="s3/overview" element={<DashboardS3Redirect />} />
        <Route path="s3/explorer" element={<DashboardS3ExplorerRedirect />} />
        <Route path="s3/bucket" element={<S3BucketInfoPage />} />
        <Route path="s3/bucket/:bucketName" element={<S3UsageBucketDetailPage />} />
        <Route path="s3/cost" element={<S3BucketPage />} />
        <Route path="s3/cost/bucket/:bucketName" element={<DashboardS3BucketDetailRedirect />} />
        <Route path="s3/usage" element={<S3BucketPage />} />
        <Route path="s3/usage/bucket/:bucketName" element={<DashboardS3BucketDetailRedirect />} />
        <Route path="s3/optimization" element={<S3OptimizationPage />} />
        <Route path="policy" element={<PolicyPage />} />
        <Route path="policy/s3" element={<S3PolicyPage />} />
        <Route path="services/database" element={<DatabaseExplorerPage />} />
        <Route path="services/database/assets" element={<DatabaseAssetsPage />} />
        <Route path="services/database/recommendations" element={<DatabaseRecommendationsPage />} />
        <Route path="services/database/assets/:resourceId" element={<DatabaseAssetDetailPage />} />
        <Route path="resources" element={<ResourcesPage />} />
        <Route path="allocation" element={<AllocationPage />} />
        <Route path="optimization" element={<OptimizationPage />} />
        <Route path="anomalies-alerts" element={<AnomaliesAlertsPage />} />
        <Route path="budget" element={<BudgetPage />} />
        <Route path="report" element={<ReportPage />} />
        <Route path="inventory" element={<AwsInventoryPage />} />
        <Route path="inventory/aws" element={<DashboardInventoryRedirect />} />
        <Route path="inventory/aws/ec2" element={<DashboardInventoryEc2Redirect />} />
        <Route path="inventory/aws/ec2/instances" element={<EC2InstancesPage />} />
        <Route path="inventory/aws/ec2/elastic-ip" element={<EC2EipPage />} />
        <Route path="inventory/aws/ec2/instances/:instanceId" element={<EC2InstanceDetailPage />} />
        <Route path="inventory/aws/load-balancer/list" element={<LoadBalancerListPage />} />
        <Route path="inventory/aws/load-balancer/list/:loadBalancerId" element={<LoadBalancerDetailPage />} />
        <Route path="inventory/aws/ec2/snapshots" element={<EC2SnapshotsPage />} />
        <Route path="inventory/aws/ec2/volumes" element={<EC2VolumesPage />} />
        <Route path="inventory/aws/ec2/volumes/:volumeId" element={<EC2VolumeDetailPage />} />
        <Route path="*" element={<DashboardOverviewRedirect />} />
      </Route>
    </Routes>
  );
}
