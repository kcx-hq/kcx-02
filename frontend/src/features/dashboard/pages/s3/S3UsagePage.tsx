import { DashboardPageHeader } from "../../components/DashboardPageHeader";
import { DashboardSection } from "../../components/DashboardSection";

export default function S3UsagePage() {
  return (
    <div className="dashboard-page">
      <DashboardPageHeader title="S3 Usage" />
      <DashboardSection title="S3 Usage" description="S3 usage trends and activity metrics.">
        <p className="dashboard-note">Coming soon.</p>
      </DashboardSection>
    </div>
  );
}
