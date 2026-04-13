import { useState } from "react";
import { useOptimizationQuery } from "../../hooks/useDashboardQueries";
import {
  OptimizationHeaderTabs,
  OptimizationOverviewSection,
  OptimizationRecommendationsSection,
  type OptimizationTopTab,
} from "./components";

export default function OptimizationPage() {
  const query = useOptimizationQuery();
  const [activeTopTab, setActiveTopTab] = useState<OptimizationTopTab>("overview");

  return (
    <div className="dashboard-page optimization-page">
      <OptimizationHeaderTabs activeTopTab={activeTopTab} onChange={setActiveTopTab} />

      {query.isLoading ? <p className="dashboard-note">Loading optimization data...</p> : null}
      {query.isError ? <p className="dashboard-note">Failed to load optimization: {query.error.message}</p> : null}

      {activeTopTab === "overview" ? <OptimizationOverviewSection /> : null}
      {activeTopTab !== "overview" ? (
        <OptimizationRecommendationsSection activeRecommendationTab={activeTopTab} />
      ) : null}
    </div>
  );
}
