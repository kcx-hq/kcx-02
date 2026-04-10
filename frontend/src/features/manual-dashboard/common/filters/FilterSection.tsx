import type { ReactNode } from "react";

type FilterSectionProps = {
  title: string;
  children: ReactNode;
};

export function FilterSection({ title, children }: FilterSectionProps) {
  return (
    <section className="dashboard-template-filter-section">
      <h4 className="dashboard-template-filter-section__title">{title}</h4>
      <div className="dashboard-template-filter-section__body">{children}</div>
    </section>
  );
}
