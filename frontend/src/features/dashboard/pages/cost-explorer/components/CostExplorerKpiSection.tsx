type CostExplorerKpiSectionProps = {
  kpis: Array<{
    label: string;
    value: string;
    tone?: "default" | "positive" | "negative";
  }>;
};

export function CostExplorerKpiSection({ kpis }: CostExplorerKpiSectionProps) {
  return (
    <section className="cost-explorer-kpi-surface" aria-label="Cost explorer key metrics">
      <div className="cost-explorer-chart-insights">
        {kpis.map((kpi) => (
          <article key={kpi.label} className={`cost-explorer-insight-tile${kpi.tone ? ` is-${kpi.tone}` : ""}`}>
            <p className="cost-explorer-insight-tile__label">{kpi.label}</p>
            <p className="cost-explorer-insight-tile__value">{kpi.value}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
