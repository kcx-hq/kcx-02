import { useBudgetQuery } from "../../hooks/useDashboardQueries";
import { DashboardSectionPage } from "../shared/DashboardSectionPage";

export default function BudgetPage() {
  const query = useBudgetQuery();
  return <DashboardSectionPage title="Budget" query={query} />;
}
