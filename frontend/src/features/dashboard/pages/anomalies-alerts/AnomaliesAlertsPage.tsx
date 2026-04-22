import { useMemo, useState } from "react";
import { AnomalyDetectionHeader } from "./components/AnomalyDetectionHeader";
import { type AnomalyFiltersState, AnomalyFiltersPanel } from "./components/AnomalyFiltersPanel";
import { AnomalyDetectionKpis } from "./components/AnomalyDetectionKpis";
import { AnomalyDetectionTable } from "./components/AnomalyDetectionTable";

const DEFAULT_FILTERS: AnomalyFiltersState = {
  timePeriod: "Last 14 days",
  accountName: "All",
  service: "All",
  region: "All",
  marketplace: "All",
  costImpactType: "Increase",
  costImpactOperator: "Greater than ($)",
  costImpactValue: "",
};

export default function AnomaliesAlertsPage() {
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const [draftFilters, setDraftFilters] = useState<AnomalyFiltersState>(DEFAULT_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState<AnomalyFiltersState>(DEFAULT_FILTERS);

  const insights = useMemo(() => {
    const items = [
      `Time: ${appliedFilters.timePeriod}`,
      `Account: ${appliedFilters.accountName}`,
      `Service: ${appliedFilters.service}`,
      `Region: ${appliedFilters.region}`,
      `Marketplace: ${appliedFilters.marketplace}`,
      `Impact Type: ${appliedFilters.costImpactType}`,
    ];

    if (appliedFilters.costImpactValue.trim()) {
      items.push(`Cost Impact: ${appliedFilters.costImpactOperator} ${appliedFilters.costImpactValue}`);
    } else {
      items.push(`Cost Impact: ${appliedFilters.costImpactOperator}`);
    }

    return items;
  }, [appliedFilters]);

  function openFilters() {
    setDraftFilters(appliedFilters);
    setIsFiltersOpen(true);
  }

  function resetDraftFilters() {
    setDraftFilters(DEFAULT_FILTERS);
  }

  function applyFilters() {
    setAppliedFilters(draftFilters);
    setIsFiltersOpen(false);
  }

  return (
    <section className="dashboard-page anomalies-alerts-page anomaly-ref-page" aria-label="Anomaly Detection">
      <AnomalyDetectionHeader onOpenFilters={openFilters} />

      <section className="anomaly-ref-insights" aria-label="Applied filter insights">
        {insights.map((item) => (
          <span key={item} className="anomaly-ref-insight-chip">
            {item}
          </span>
        ))}
      </section>

      <AnomalyDetectionKpis />
      <AnomalyDetectionTable />

      <AnomalyFiltersPanel
        open={isFiltersOpen}
        filters={draftFilters}
        onChange={setDraftFilters}
        onReset={resetDraftFilters}
        onCancel={() => setIsFiltersOpen(false)}
        onApply={applyFilters}
      />
    </section>
  );
}
