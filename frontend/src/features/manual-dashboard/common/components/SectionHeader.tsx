import type { ReactNode } from "react";

type SectionHeaderProps = {
  title: string;
  description?: string;
  actions?: ReactNode;
};

export function SectionHeader({ title, description, actions }: SectionHeaderProps) {
  return (
    <header className="dashboard-template-header">
      <div className="dashboard-template-header__content">
        <h2 className="dashboard-template-header__title">{title}</h2>
        {description ? <p className="dashboard-template-header__description">{description}</p> : null}
      </div>
      {actions ? <div className="dashboard-template-header__actions">{actions}</div> : null}
    </header>
  );
}
