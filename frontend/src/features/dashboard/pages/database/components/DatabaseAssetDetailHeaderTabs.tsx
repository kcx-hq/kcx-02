export type DatabaseAssetDetailTabKey =
  | "overview"
  | "cost"
  | "usage"
  | "storage"
  | "performance"
  | "topology"
  | "metadata";

const DETAIL_TABS: Array<{ key: DatabaseAssetDetailTabKey; label: string }> = [
  { key: "overview", label: "Overview" },
  { key: "cost", label: "Cost" },
  { key: "usage", label: "Usage" },
  { key: "storage", label: "Storage" },
  { key: "performance", label: "Performance" },
  { key: "topology", label: "Topology" },
  { key: "metadata", label: "Metadata" },
];

type DatabaseAssetDetailHeaderTabsProps = {
  activeTab: DatabaseAssetDetailTabKey;
  onChange: (tab: DatabaseAssetDetailTabKey) => void;
};

export function DatabaseAssetDetailHeaderTabs({
  activeTab,
  onChange,
}: DatabaseAssetDetailHeaderTabsProps) {
  return (
    <div className="optimization-header-tabs" role="tablist" aria-label="Database asset detail sections">
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
