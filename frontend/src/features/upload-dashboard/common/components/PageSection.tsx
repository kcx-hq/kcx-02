import type { ReactNode } from "react";
import { SectionHeader } from "./SectionHeader";

type PageSectionProps = {
  children: ReactNode;
  title?: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
};

export function PageSection({ children, title, description, actions, className }: PageSectionProps) {
  const sectionClassName = className ? `dashboard-template-section ${className}` : "dashboard-template-section";
  const headerProps = title
    ? {
        title,
        ...(description ? { description } : {}),
        ...(actions ? { actions } : {}),
      }
    : null;

  return (
    <section className={sectionClassName}>
      {headerProps ? <SectionHeader {...headerProps} /> : null}
      <div className="dashboard-template-section__body">{children}</div>
    </section>
  );
}
