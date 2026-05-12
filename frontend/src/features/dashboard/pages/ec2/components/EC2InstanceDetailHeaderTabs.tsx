export type EC2InstanceDetailTabKey =
  | "overview"
  | "cost-breakdown"
  | "usage"
  | "storage"
  | "pricing-efficiency"
  | "recommendations"
  | "metadata";

const DETAIL_TABS: Array<{ key: EC2InstanceDetailTabKey; label: string }> = [
  { key: "overview", label: "Overview" },
  { key: "cost-breakdown", label: "Cost Breakdown" },
  { key: "usage", label: "Usage" },
  { key: "storage", label: "Storage" },
  { key: "pricing-efficiency", label: "Pricing & Efficiency" },
  { key: "recommendations", label: "Recommendations" },
  { key: "metadata", label: "Metadata" },
];

type EC2InstanceDetailHeaderTabsProps = {
  activeTab: EC2InstanceDetailTabKey;
  onChange: (tab: EC2InstanceDetailTabKey) => void;
};

export function EC2InstanceDetailHeaderTabs({ activeTab, onChange }: EC2InstanceDetailHeaderTabsProps) {
  return (
    <div className="optimization-header-tabs" role="tablist" aria-label="Instance detail sections">
      {DETAIL_TABS.map((tab) => (
        <button
          type="button"
          key={tab.key}
          className={`optimization-header-tab ${activeTab === tab.key ? "is-active" : ""}`}
          onClick={() => onChange(tab.key)}
          role="tab"
          aria-selected={activeTab === tab.key}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
