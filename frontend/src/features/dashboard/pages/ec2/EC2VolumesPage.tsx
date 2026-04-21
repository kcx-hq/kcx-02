import { DashboardPageHeader } from "../../components/DashboardPageHeader";
import { DashboardSection } from "../../components/DashboardSection";

export default function EC2VolumesPage() {
  return (
    <div className="dashboard-page">
      <DashboardPageHeader title="EC2 Volumes" />
      <DashboardSection
        title="EC2 Volumes"
        description="Volume-level visibility for EC2 workloads."
      >
        <p className="dashboard-note">Under Progress.</p>
      </DashboardSection>
    </div>
  );
}
