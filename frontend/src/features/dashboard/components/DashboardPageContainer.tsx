import type { ReactNode } from "react";

type DashboardPageContainerProps = {
  children: ReactNode;
};

export function DashboardPageContainer({ children }: DashboardPageContainerProps) {
  return <div className="dashboard-page-container">{children}</div>;
}
