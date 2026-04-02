import { useCostExplorerQuery } from "../../hooks/useDashboardQueries";
import { DashboardSectionPage } from "../shared/DashboardSectionPage";

export default function CostExplorerPage() {
  const query = useCostExplorerQuery();
  return <DashboardSectionPage title="Cost Explorer" query={query} />;
}
