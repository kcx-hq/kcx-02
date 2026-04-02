import { useEffect } from "react";
import type { ReactNode } from "react";

type FilterPanelProps = {
  open: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
};

export function FilterPanel({ open, title, subtitle, onClose, children, footer }: FilterPanelProps) {
  useEffect(() => {
    if (!open) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose, open]);

  return (
    <>
      <div className={`dashboard-template-filter-overlay${open ? " is-open" : ""}`} onClick={onClose} aria-hidden={!open} />
      <aside
        className={`dashboard-template-filter-panel${open ? " is-open" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <header className="dashboard-template-filter-panel__header">
          <div>
            <h3 className="dashboard-template-filter-panel__title">{title}</h3>
            {subtitle ? <p className="dashboard-template-filter-panel__subtitle">{subtitle}</p> : null}
          </div>
          <button type="button" className="dashboard-template-filter-panel__close" onClick={onClose}>
            Close
          </button>
        </header>
        <div className="dashboard-template-filter-panel__body">{children}</div>
        {footer ? <div className="dashboard-template-filter-panel__footer">{footer}</div> : null}
      </aside>
    </>
  );
}
