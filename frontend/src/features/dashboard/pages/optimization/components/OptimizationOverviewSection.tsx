import { useMemo } from "react";
import { WidgetShell } from "../../../common/components";
import {
  buildDonutGradient,
  compactCurrencyFormatter,
  optimizationInsights,
  type SavingInsight,
} from "../optimization.constants";

function SavingsPotentialWidget({ insights }: { insights: SavingInsight[] }) {
  const totalPotential = useMemo(() => insights.reduce((sum, item) => sum + item.potential, 0), [insights]);
  const donutGradient = useMemo(() => buildDonutGradient(insights), [insights]);

  return (
    <WidgetShell title="Savings Potential" subtitle="Potential savings split by optimization insight">
      <div className="optimization-potential-content">
        <div className="optimization-donut-card">
          <div className="optimization-donut" style={{ backgroundImage: donutGradient }}>
            <div className="optimization-donut__center">
              <p className="optimization-donut__value">{compactCurrencyFormatter.format(totalPotential)}</p>
              <p className="optimization-donut__label">Potential / month</p>
            </div>
          </div>

          <div className="optimization-donut-legend">
            {insights.map((item) => (
              <div key={item.key} className="optimization-donut-legend__item">
                <span className="optimization-donut-legend__dot" style={{ backgroundColor: item.color }} />
                <span className="optimization-donut-legend__name">{item.shortLabel}</span>
                <span className="optimization-donut-legend__value">{compactCurrencyFormatter.format(item.potential)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </WidgetShell>
  );
}

function RealizedSavingWidget({ insights }: { insights: SavingInsight[] }) {
  return (
    <WidgetShell title="Realized Saving" subtitle="Savings captured through completed optimization actions">
      <section className="optimization-realized-grid">
        {insights.map((item) => {
          const completionRatio = item.potential > 0 ? (item.realized / item.potential) * 100 : 0;
          return (
            <article key={item.key} className="optimization-realized-item">
              <div className="optimization-realized-item__head">
                <p className="optimization-realized-item__title">{item.label}</p>
                <p className="optimization-realized-item__value">{compactCurrencyFormatter.format(item.realized)}</p>
              </div>
              <div className="optimization-realized-progress">
                <span
                  className="optimization-realized-progress__fill"
                  style={{ width: `${Math.min(100, completionRatio)}%`, backgroundColor: item.color }}
                />
              </div>
              <p className="optimization-realized-item__meta">{Math.round(completionRatio)}% of potential captured</p>
            </article>
          );
        })}
      </section>
    </WidgetShell>
  );
}

export function OptimizationOverviewSection() {
  return (
    <div className="optimization-layout">
      <section>
        <SavingsPotentialWidget insights={optimizationInsights} />
      </section>
      <RealizedSavingWidget insights={optimizationInsights} />
    </div>
  );
}
