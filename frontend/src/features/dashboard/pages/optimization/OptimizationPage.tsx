import { useOptimizationQuery } from "../../hooks/useDashboardQueries";
import { DashboardSectionPage } from "../shared/DashboardSectionPage";

export default function OptimizationPage() {
  const query = useOptimizationQuery();
  return <DashboardSectionPage title="Optimization" query={query} />;
}
