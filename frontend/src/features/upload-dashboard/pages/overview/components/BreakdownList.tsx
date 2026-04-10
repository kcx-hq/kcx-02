import type { CostBreakdownItem } from "../../../api/dashboardApi";
import { MetricBadge, WidgetShell } from "../../../common/components";
import { currencyFormatterCompact, percentFormatter } from "../utils/overviewFormatters";

type BreakdownListProps = {
  title: string;
  subtitle: string;
  items: CostBreakdownItem[];
  selectedKey: number | null;
  onSelect: (key: number | null) => void;
};

export function BreakdownList({ title, subtitle, items, selectedKey, onSelect }: BreakdownListProps) {
  const max = items.reduce((highest, item) => Math.max(highest, item.billedCost), 0);

  return (
    <WidgetShell title={title} subtitle={subtitle}>
      <div className="overview-breakdown-list">
        {items.slice(0, 7).map((item) => {
          const ratio = max > 0 ? (item.billedCost / max) * 100 : 0;
          const isActive = item.key !== null && selectedKey === item.key;

          return (
            <button
              key={`${title}-${item.key ?? item.name}`}
              type="button"
              className={`overview-breakdown-item${isActive ? " is-active" : ""}`}
              onClick={() => onSelect(isActive ? null : item.key)}
            >
              <div className="overview-breakdown-item__head">
                <span className="overview-breakdown-item__label">{item.name}</span>
                <span className="overview-breakdown-item__value">{currencyFormatterCompact.format(item.billedCost)}</span>
              </div>
              <div className="overview-breakdown-item__track">
                <span className="overview-breakdown-item__bar" style={{ width: `${Math.max(ratio, 3)}%` }} />
              </div>
              <div className="overview-breakdown-item__meta">
                <MetricBadge tone="accent">{percentFormatter.format(item.contributionPct)}%</MetricBadge>
              </div>
            </button>
          );
        })}
      </div>
    </WidgetShell>
  );
}
