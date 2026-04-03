import { Lightbulb } from "lucide-react";
import { PageSection } from "../../../common/components";
import type { SavingsInsights } from "../../../api/dashboardApi";
import { currencyFormatterPrecise, percentFormatter } from "../utils/overviewFormatters";

type OverviewSavingsSectionProps = {
  savingsInsights: SavingsInsights | null;
};

export function OverviewSavingsSection({ savingsInsights }: OverviewSavingsSectionProps) {
  return (
    <PageSection title="Savings Insights" description="Savings quality from list-to-effective cost and optimization posture.">
      {savingsInsights ? (
        <article className="overview-savings-hero">
          <div className="overview-savings-hero__stats">
            <div className="overview-savings-hero__stat">
              <span className="overview-savings-hero__label">List Cost</span>
              <strong className="overview-savings-hero__value">{currencyFormatterPrecise.format(savingsInsights.listCost)}</strong>
            </div>
            <div className="overview-savings-hero__stat">
              <span className="overview-savings-hero__label">Effective Cost</span>
              <strong className="overview-savings-hero__value">{currencyFormatterPrecise.format(savingsInsights.effectiveCost)}</strong>
            </div>
            <div className="overview-savings-hero__stat">
              <span className="overview-savings-hero__label">Absolute Savings</span>
              <strong className="overview-savings-hero__value">
                {currencyFormatterPrecise.format(savingsInsights.absoluteSavings)}
              </strong>
            </div>
            <div className="overview-savings-hero__stat">
              <span className="overview-savings-hero__label">Savings %</span>
              <strong className="overview-savings-hero__value">{percentFormatter.format(savingsInsights.savingsPct)}%</strong>
            </div>
          </div>
          <p className="overview-savings-hero__insight">
            <Lightbulb size={16} />
            <span>{savingsInsights.insightText}</span>
          </p>
        </article>
      ) : (
        <p className="dashboard-note">Savings insights will appear after overview data loads.</p>
      )}
    </PageSection>
  );
}
