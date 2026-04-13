import type { ReactNode } from "react";

type TableShellProps = {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
};

export function TableShell({ title, subtitle, actions, children }: TableShellProps) {
  return (
    <article className="dashboard-table-shell">
      <header className="dashboard-table-shell__header">
        <div className="dashboard-table-shell__meta">
          <h3 className="dashboard-table-shell__title">{title}</h3>
          {subtitle ? <p className="dashboard-table-shell__subtitle">{subtitle}</p> : null}
        </div>
        {actions ? <div className="dashboard-table-shell__actions">{actions}</div> : null}
      </header>
      <div className="dashboard-table-shell__body">{children}</div>
    </article>
  );
}
