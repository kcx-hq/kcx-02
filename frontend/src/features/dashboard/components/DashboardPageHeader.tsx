import type { ReactNode } from "react";

type DashboardPageHeaderProps = {
  title: string;
  actions?: ReactNode;
};

export function DashboardPageHeader({ title, actions }: DashboardPageHeaderProps) {
  return (
    <header className="dashboard-page-header">
      <h1 className="dashboard-page-header__title">{title}</h1>
      {actions ? <div className="dashboard-page-header__actions">{actions}</div> : null}
    </header>
  );
}
