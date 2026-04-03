import { PageSection } from "../../../common/components";
import type { CostBreakdownItem } from "../../../api/dashboardApi";
import { BreakdownList } from "./BreakdownList";

type OverviewBreakdownSectionProps = {
  topServices: CostBreakdownItem[];
  topAccounts: CostBreakdownItem[];
  selectedServiceKey: number | null;
  selectedAccountKey: number | null;
  onSelectService: (key: number | null) => void;
  onSelectAccount: (key: number | null) => void;
};

export function OverviewBreakdownSection({
  topServices,
  topAccounts,
  selectedServiceKey,
  selectedAccountKey,
  onSelectService,
  onSelectAccount,
}: OverviewBreakdownSectionProps) {
  return (
    <PageSection
      title="Breakdown"
      description="Top services, accounts, and regions by billed cost. Click a service row to filter the dashboard."
    >
      <div className="dashboard-showcase-grid dashboard-showcase-grid--charts">
        <BreakdownList
          title="Top Services"
          subtitle="Horizontal spend distribution"
          items={topServices}
          selectedKey={selectedServiceKey}
          onSelect={onSelectService}
        />
        <BreakdownList
          title="Top Accounts"
          subtitle="Largest sub-account contributors"
          items={topAccounts}
          selectedKey={selectedAccountKey}
          onSelect={onSelectAccount}
        />
      </div>
    </PageSection>
  );
}
