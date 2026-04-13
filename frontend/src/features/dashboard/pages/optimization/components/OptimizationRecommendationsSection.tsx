import type { OptimizationInsightKey } from "../optimization.constants";
import { OptimizationCategoryPlaceholderSection } from "./OptimizationCategoryPlaceholderSection";
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
    return <OptimizationCategoryPlaceholderSection categoryLabel="Storage" />;
  };

  return (
    <div className="optimization-layout">
      <div className="optimization-recommendation-unified-shell">
        {renderSection()}
      </div>
    </div>
  );
}
