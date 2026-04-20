import { DashboardPageHeader } from "../../components/DashboardPageHeader";
import { DashboardSection } from "../../components/DashboardSection";

export default function EC2CostPage() {
  return (
    <div className="dashboard-page">
      <DashboardPageHeader title="EC2 Cost" />
      <DashboardSection title="Cost" description="EC2 cost insights and breakdowns.">
        <p className="dashboard-note">Coming soon.</p>
      </DashboardSection>
    </div>
  );
}

