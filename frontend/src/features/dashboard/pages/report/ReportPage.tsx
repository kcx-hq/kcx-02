import { useReportQuery } from "../../hooks/useDashboardQueries";
import { DashboardSectionPage } from "../shared/DashboardSectionPage";

export default function ReportPage() {
  const query = useReportQuery();
  return <DashboardSectionPage title="Report" query={query} />;
}
