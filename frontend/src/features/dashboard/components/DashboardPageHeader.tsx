import type { ReactNode } from "react";

type DashboardPageHeaderProps = {
  title?: ReactNode;
  actions?: ReactNode;
};

export function DashboardPageHeader({ title, actions }: DashboardPageHeaderProps) {
  const titleNode =
    typeof title === "string" ? <h1 className="dashboard-page-header__title">{title}</h1> : title;

  return (
    <header className="dashboard-page-header">
      {titleNode ? titleNode : <div aria-hidden="true" />}
      {actions ? <div className="dashboard-page-header__actions">{actions}</div> : null}
    </header>
  );
}
