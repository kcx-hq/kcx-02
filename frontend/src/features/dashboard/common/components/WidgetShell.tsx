import type { ReactNode } from "react";

type WidgetShellProps = {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
};

export function WidgetShell({ title, subtitle, actions, children }: WidgetShellProps) {
  return (
    <article className="dashboard-widget-shell">
      <header className="dashboard-widget-shell__header">
        <div className="dashboard-widget-shell__meta">
          <h3 className="dashboard-widget-shell__title">{title}</h3>
          {subtitle ? <p className="dashboard-widget-shell__subtitle">{subtitle}</p> : null}
        </div>
        {actions ? <div className="dashboard-widget-shell__actions">{actions}</div> : null}
      </header>
      <div className="dashboard-widget-shell__body">{children}</div>
    </article>
  );
}
