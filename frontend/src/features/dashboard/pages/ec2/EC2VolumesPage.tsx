import { ClientInventoryVolumesPage } from "@/features/client-home/pages/ClientInventoryVolumesPage"
import { DashboardPageHeader } from "../../components/DashboardPageHeader"

export default function EC2VolumesPage() {
  return (
    <div className="dashboard-page">
      <DashboardPageHeader title="EC2 Volumes" />
      <ClientInventoryVolumesPage />
    </div>
  )
}
