import type { ReactNode } from "react";

type ManualDashboardSectionProps = {
  title: string;
  description?: string;
  children: ReactNode;
};

export function ManualDashboardSection({ title, description, children }: ManualDashboardSectionProps) {
  return (
    <section className="dashboard-section">
      <div className="dashboard-section__head">
        <h2 className="dashboard-section__title">{title}</h2>
        {description ? <p className="dashboard-section__description">{description}</p> : null}
      </div>
      <div className="dashboard-section__body">{children}</div>
    </section>
  );
}
