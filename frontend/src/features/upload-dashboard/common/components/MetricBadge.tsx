import type { ReactNode } from "react";

type MetricBadgeTone = "positive" | "negative" | "neutral" | "accent";

type MetricBadgeProps = {
  children: ReactNode;
  tone?: MetricBadgeTone;
};

export function MetricBadge({ children, tone = "neutral" }: MetricBadgeProps) {
  return <span className={`dashboard-metric-badge dashboard-metric-badge--${tone}`}>{children}</span>;
}
