import type { ReactNode } from "react";

type PlaceholderBlockProps = {
  label: string;
  hint?: string;
  children?: ReactNode;
};

export function PlaceholderBlock({ label, hint, children }: PlaceholderBlockProps) {
  return (
    <article className="dashboard-placeholder">
      <div className="dashboard-placeholder__head">
        <p className="dashboard-placeholder__label">{label}</p>
        {hint ? <span className="dashboard-placeholder__hint">{hint}</span> : null}
      </div>
      <div className="dashboard-placeholder__body">{children ?? <div className="dashboard-skeleton-grid" />}</div>
    </article>
  );
}
