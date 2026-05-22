import { useMemo } from "react";

import { WidgetShell } from "../../../common/components";
import type { S3CostInsightsResponse, S3OptimizationBucketRow } from "../../../api/dashboardTypes";
import { buildDonutGradient, compactCurrencyFormatter } from "../../optimization/optimization.constants";

type SavingOptionInsight = {
  key: string;
  label: string;
  color: string;
  potential: number;
  recommendations: number;
};

type Props = {
  costInsights: S3CostInsightsResponse | undefined;
  lifecycleRows: S3OptimizationBucketRow[];
  isLoading?: boolean;
};

const COLOR_PALETTE = ["#23a282", "#b99abf", "#89b5cf", "#d38b5d", "#6d91d8", "#83b95f"];

const toSavingOptionLabel = (value: string): string => {
  const normalized = String(value ?? "").trim().toUpperCase();
  if (normalized === "STANDARD_TO_IA") return "Standard to Standard-IA";
  if (normalized === "STANDARD_TO_GLACIER") return "Standard to Glacier";
  if (normalized === "STANDARD_TO_DEEP_ARCHIVE") return "Standard to Deep Archive";
  if (normalized === "INTELLIGENT_TIERING") return "Intelligent Tiering";
  if (normalized === "NONCURRENT_VERSION_CLEANUP") return "Noncurrent Cleanup";
  if (normalized === "MULTIPART_UPLOAD_CLEANUP") return "Multipart Cleanup";
  if (normalized === "REPLICATION_OPTIMIZATION") return "Replication Optimization";
  if (normalized === "REQUEST_OPTIMIZATION") return "Request Optimization";
  return normalized
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
};

function S3PotentialSavingWidget({ costInsights }: Pick<Props, "costInsights">) {
  const optionInsights = useMemo<SavingOptionInsight[]>(() => {
    const items = costInsights?.estimatedSavings.items ?? [];
    const grouped = new Map<string, { potential: number; recommendations: number }>();

    for (const item of items) {
      const key = String(item.savingsType ?? "GENERAL_OPTIMIZATION").trim().toUpperCase() || "GENERAL_OPTIMIZATION";
      const existing = grouped.get(key);
      if (!existing) {
        grouped.set(key, {
          potential: Number(item.estimatedMonthlySaving ?? 0),
          recommendations: 1,
        });
        continue;
      }
      existing.potential += Number(item.estimatedMonthlySaving ?? 0);
      existing.recommendations += 1;
    }

    return Array.from(grouped.entries())
      .map(([key, value], index) => ({
        key,
        label: toSavingOptionLabel(key),
        color: COLOR_PALETTE[index % COLOR_PALETTE.length],
        potential: value.potential,
        recommendations: value.recommendations,
      }))
      .sort((a, b) => b.potential - a.potential)
      .slice(0, 6);
  }, [costInsights?.estimatedSavings.items]);

  const totalPotential = useMemo(
    () => optionInsights.reduce((sum, option) => sum + option.potential, 0),
    [optionInsights],
  );
  const donutGradient = useMemo(() => buildDonutGradient(optionInsights), [optionInsights]);
  const primaryOption = optionInsights[0] ?? null;

  return (
    <WidgetShell title="Potential Saving" subtitle="S3 saving options overview">
      <div className="optimization-overview-surface">
        <div className="optimization-overview-donut-panel">
          <div className="optimization-overview-donut" style={{ backgroundImage: donutGradient }}>
            <div className="optimization-overview-donut__center">
              <p className="optimization-overview-donut__value">{compactCurrencyFormatter.format(totalPotential)}</p>
              <p className="optimization-overview-donut__label">Potential / month</p>
            </div>
          </div>
        </div>

        <div className="optimization-overview-insight-list">
          {!primaryOption ? (
            <article className="optimization-overview-insight-item optimization-overview-insight-item--single">
              <div className="optimization-overview-insight-item__head">
                <span className="optimization-overview-insight-item__dot" style={{ backgroundColor: "#d8e7e5" }} />
                <p className="optimization-overview-insight-item__title">No saving options yet</p>
              </div>
              <p className="optimization-overview-insight-item__value">{compactCurrencyFormatter.format(0)}</p>
              <p className="optimization-overview-insight-item__meta">Run S3 optimization signals to populate this view.</p>
            </article>
          ) : (
            <article className="optimization-overview-insight-item optimization-overview-insight-item--single">
              <div className="optimization-overview-insight-item__head">
                <span className="optimization-overview-insight-item__dot" style={{ backgroundColor: primaryOption.color }} />
                <p className="optimization-overview-insight-item__title">{primaryOption.label}</p>
              </div>
              <p className="optimization-overview-insight-item__value">{compactCurrencyFormatter.format(primaryOption.potential)}</p>
              <p className="optimization-overview-insight-item__meta">
                {primaryOption.recommendations} opportunities
              </p>
            </article>
          )}
        </div>
      </div>
    </WidgetShell>
  );
}

function S3RealizedSavingWidget({ costInsights, lifecycleRows }: Pick<Props, "costInsights" | "lifecycleRows">) {
  const totalRealized = useMemo(
    () =>
      lifecycleRows.reduce((sum, row) => {
        const realized = Number(row.lifecycleSavings?.realizedMonthlySavings ?? 0);
        return sum + (Number.isFinite(realized) ? realized : 0);
      }, 0),
    [lifecycleRows],
  );

  const trackedPotential = useMemo(
    () =>
      lifecycleRows.reduce((sum, row) => {
        const min = Number(row.lifecycleSavings?.estimatedMonthlySavingsMin ?? 0);
        const max = Number(row.lifecycleSavings?.estimatedMonthlySavingsMax ?? 0);
        const midpoint = (Math.max(min, 0) + Math.max(max, 0)) / 2;
        return sum + midpoint;
      }, 0),
    [lifecycleRows],
  );

  const backlogSummary = costInsights?.finopsActionBacklog.summary;
  const metricCards = [
    {
      key: "total",
      label: "Estimated + Realized Saving / month",
      value: totalRealized + trackedPotential,
      meta: "",
      color: "#23a282",
      valueType: "currency" as const,
      wide: true,
    },
    {
      key: "realized",
      label: "Realized Saving / month",
      value: totalRealized,
      meta: `${lifecycleRows.filter((row) => row.lifecycleSavings?.status === "realized").length} buckets realized`,
      color: "#23a282",
      valueType: "currency" as const,
    },
    {
      key: "tracked",
      label: "Tracked Lifecycle Potential",
      value: trackedPotential,
      meta: `${lifecycleRows.filter((row) => row.lifecycleSavings?.status === "tracking").length} buckets tracking`,
      color: "#b99abf",
      valueType: "currency" as const,
    },
    {
      key: "backlog-open",
      label: "Open FinOps Actions",
      value: Number(backlogSummary?.open ?? 0),
      meta: `${Number(backlogSummary?.slaBreached ?? 0)} SLA breached`,
      color: "#89b5cf",
      valueType: "number" as const,
    },
  ];

  return (
    <WidgetShell title="Savings Execution" subtitle="Realized and in-progress S3 savings">
      <div className="optimization-verified-surface">
        <div className="optimization-verified-grid">
          {metricCards.map((card) => (
            <article key={card.key} className={`optimization-verified-item${card.wide ? " optimization-verified-item--wide" : ""}`}>
              <p className="optimization-overview-insight-item__title">{card.label}</p>
              <p className="optimization-overview-insight-item__value">
                {card.valueType === "currency" ? compactCurrencyFormatter.format(card.value) : card.value}
              </p>
              {card.meta ? <p className="optimization-overview-insight-item__meta">{card.meta}</p> : null}
            </article>
          ))}
        </div>
      </div>
    </WidgetShell>
  );
}

function S3OptimizationOverviewSkeleton() {
  return (
    <div className="optimization-layout" aria-label="Loading S3 optimization overview">
      <section>
        <WidgetShell title="Potential Saving" subtitle="S3 saving options overview">
          <div className="optimization-overview-surface">
            <div className="optimization-overview-donut-panel">
              <div className="optimization-overview-donut optimization-overview-donut--skeleton" />
            </div>
            <div className="optimization-overview-insight-list">
              <article className="optimization-overview-insight-item optimization-overview-insight-item--single optimization-overview-insight-item--skeleton">
                <div className="optimization-overview-insight-item__head">
                  <span className="optimization-overview-insight-item__dot optimization-overview-insight-item__dot--skeleton" style={{ width: 12, height: 12 }} />
                  <span className="optimization-overview-skeleton-bar optimization-overview-skeleton-bar--title" />
                </div>
                <span className="optimization-overview-skeleton-bar optimization-overview-skeleton-bar--value" />
                <span className="optimization-overview-skeleton-bar optimization-overview-skeleton-bar--meta" />
              </article>
            </div>
          </div>
        </WidgetShell>
      </section>
      <section>
        <WidgetShell title="Savings Execution" subtitle="Realized and in-progress S3 savings">
          <div className="optimization-verified-surface">
            <div className="optimization-verified-grid">
              {Array.from({ length: 4 }).map((_, index) => (
                <article key={`optimization-overview-kpi-skeleton-${index}`} className="optimization-verified-item optimization-overview-insight-item--skeleton">
                  <span className="optimization-overview-skeleton-bar optimization-overview-skeleton-bar--title" />
                  <span className="optimization-overview-skeleton-bar optimization-overview-skeleton-bar--verified-total" />
                  <span className="optimization-overview-skeleton-bar optimization-overview-skeleton-bar--meta" />
                </article>
              ))}
            </div>
          </div>
        </WidgetShell>
      </section>
    </div>
  );
}

export function S3OptimizationOverviewSection({ costInsights, lifecycleRows, isLoading = false }: Props) {
  if (isLoading) {
    return <S3OptimizationOverviewSkeleton />;
  }
  return (
    <div className="optimization-layout">
      <section>
        <S3PotentialSavingWidget costInsights={costInsights} />
      </section>
      <section>
        <S3RealizedSavingWidget costInsights={costInsights} lifecycleRows={lifecycleRows} />
      </section>
    </div>
  );
}
