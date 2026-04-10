import type { ReactNode } from "react";

type ManualDashboardPageContainerProps = {
  children: ReactNode;
};

export function ManualDashboardPageContainer({ children }: ManualDashboardPageContainerProps) {
  return <div className="dashboard-page-container">{children}</div>;
}
