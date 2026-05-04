import type { ReactNode } from "react";

type KpiGridProps = {
  children: ReactNode;
  className?: string;
};

export function KpiGrid({ children, className }: KpiGridProps) {
  const gridClassName = className ? `dashboard-kpi-grid ${className}` : "dashboard-kpi-grid";
  return <div className={gridClassName}>{children}</div>;
}
