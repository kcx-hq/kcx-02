import { useOverviewQuery } from "../../hooks/useDashboardQueries";
import { DashboardSectionPage } from "../shared/DashboardSectionPage";

export default function OverviewPage() {
  const query = useOverviewQuery();
  return <DashboardSectionPage title="Overview" query={query} />;
}
