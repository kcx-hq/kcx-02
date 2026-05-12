export type EC2VolumeDetailTabKey =
  | "overview"
  | "deepDive";

const DETAIL_TABS: Array<{ key: EC2VolumeDetailTabKey; label: string }> = [
  { key: "overview", label: "Overview" },
  { key: "deepDive", label: "Deep Dive" },
];

type EC2VolumeDetailHeaderTabsProps = {
  activeTab: EC2VolumeDetailTabKey;
  onChange: (tab: EC2VolumeDetailTabKey) => void;
};

export function EC2VolumeDetailHeaderTabs({ activeTab, onChange }: EC2VolumeDetailHeaderTabsProps) {
  return (
    <div className="optimization-header-tabs" role="tablist" aria-label="Volume detail sections">
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
