import { useResourcesQuery } from "../../hooks/useDashboardQueries";
import { DashboardSectionPage } from "../shared/DashboardSectionPage";

export default function ResourcesPage() {
  const query = useResourcesQuery();
  return <DashboardSectionPage title="Resources" query={query} />;
}
