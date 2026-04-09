import type { OptimizationInsightKey } from "../optimization.constants";
import { OptimizationCategoryPlaceholderSection } from "./OptimizationCategoryPlaceholderSection";
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
      return <OptimizationCategoryPlaceholderSection categoryLabel="Idle Resources" />;
    }
    if (activeRecommendationTab === "commitments") {
      return <OptimizationCategoryPlaceholderSection categoryLabel="Commitments" />;
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
