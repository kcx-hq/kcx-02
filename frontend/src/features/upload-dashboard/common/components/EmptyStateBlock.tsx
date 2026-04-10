import type { ReactNode } from "react";

type EmptyStateBlockProps = {
  title: string;
  message?: string;
  actions?: ReactNode;
};

export function EmptyStateBlock({ title, message, actions }: EmptyStateBlockProps) {
  return (
    <div className="dashboard-empty-state-block">
      <p className="dashboard-empty-state-block__title">{title}</p>
      {message ? <p className="dashboard-empty-state-block__message">{message}</p> : null}
      {actions ? <div className="dashboard-empty-state-block__actions">{actions}</div> : null}
    </div>
  );
}
