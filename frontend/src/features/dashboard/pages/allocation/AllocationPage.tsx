import { useAllocationQuery } from "../../hooks/useDashboardQueries";
import { DashboardSectionPage } from "../shared/DashboardSectionPage";

export default function AllocationPage() {
  const query = useAllocationQuery();
  return <DashboardSectionPage title="Allocation" query={query} />;
}
