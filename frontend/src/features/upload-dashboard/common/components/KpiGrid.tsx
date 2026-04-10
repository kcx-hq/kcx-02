import type { ReactNode } from "react";

type KpiGridProps = {
  children: ReactNode;
};

export function KpiGrid({ children }: KpiGridProps) {
  return <div className="dashboard-kpi-grid">{children}</div>;
}
