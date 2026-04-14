import type { OptimizationInsightKey } from "../optimization.constants";
import { OptimizationCommitmentSection } from "./OptimizationCommitmentSection";
import { OptimizationIdleResourcesSection } from "./OptimizationIdleResourcesSection";
import { OptimizationRightsizingSection } from "./OptimizationRightsizingSection";

type OptimizationRecommendationsSectionProps = {
  activeRecommendationTab: OptimizationInsightKey;
};

export function OptimizationRecommendationsSection({ activeRecommendationTab }: OptimizationRecommendationsSectionProps) {
  const renderSection = () => {
    if (activeRecommendationTab === "rightsizing") {
      return <OptimizationRightsizingSection />;
    }
    if (activeRecommendationTab === "idle-resources") {
      return <OptimizationIdleResourcesSection />;
    }
    if (activeRecommendationTab === "commitments") {
      return <OptimizationCommitmentSection />;
    }
    return <OptimizationCommitmentSection />;
  };

  return (
    <div className="optimization-layout">
      <div className="optimization-recommendation-unified-shell">
        {renderSection()}
      </div>
    </div>
  );
}
