import { CirclePlus, Filter } from "lucide-react";

type AnomalyDetectionHeaderProps = {
  onOpenFilters: () => void;
  asOfLabel: string;
};

export function AnomalyDetectionHeader({ onOpenFilters, asOfLabel }: AnomalyDetectionHeaderProps) {
  return (
    <header className="anomaly-ref-header">
      <div className="anomaly-ref-header__top">
        <div className="anomaly-ref-heading-block">
          <h1 className="anomaly-ref-title">Anomaly Detection</h1>
          <p className="anomaly-ref-asof">{asOfLabel}</p>
        </div>

        <button type="button" className="anomaly-ref-btn anomaly-ref-btn--primary">
          <CirclePlus size={13} />
          New Policy
        </button>
      </div>

      <div className="anomaly-ref-header__filters">
        <button type="button" className="anomaly-ref-btn anomaly-ref-btn--ghost" onClick={onOpenFilters}>
          <Filter size={13} />
          All Filters
        </button>
      </div>
    </header>
  );
}
