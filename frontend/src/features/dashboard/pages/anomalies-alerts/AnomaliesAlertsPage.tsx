import { useAnomaliesAlertsQuery } from "../../hooks/useDashboardQueries";
import { DashboardSectionPage } from "../shared/DashboardSectionPage";

export default function AnomaliesAlertsPage() {
  const query = useAnomaliesAlertsQuery();
  return <DashboardSectionPage title="Anomalies & Alerts" query={query} />;
}
