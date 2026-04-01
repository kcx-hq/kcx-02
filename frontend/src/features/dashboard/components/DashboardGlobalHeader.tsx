import { Bell, Funnel } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { dashboardNavItems } from "../common/navigation";

const rootCrumb = "Dashboard";

export function DashboardGlobalHeader() {
  const location = useLocation();
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false);

  const currentLabel = useMemo(() => {
    const match = dashboardNavItems.find((item) => location.pathname.startsWith(item.path));
    return match?.label ?? "Overview";
  }, [location.pathname]);

  useEffect(() => {
    if (!isFilterPanelOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsFilterPanelOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isFilterPanelOpen]);

  return (
    <>
      <header className="dashboard-global-header">
        <nav className="dashboard-global-header__breadcrumbs" aria-label="Breadcrumb">
          <span className="dashboard-breadcrumb dashboard-breadcrumb--muted">{rootCrumb}</span>
          <span className="dashboard-breadcrumb__separator" aria-hidden="true">
            /
          </span>
          <span className="dashboard-breadcrumb dashboard-breadcrumb--current">{currentLabel}</span>
        </nav>

        <div className="dashboard-global-header__actions">
          <button
            type="button"
            className="dashboard-header-action dashboard-header-action--filter"
            onClick={() => setIsFilterPanelOpen(true)}
            aria-haspopup="dialog"
            aria-expanded={isFilterPanelOpen}
            aria-controls="dashboard-filter-panel"
          >
            <Funnel className="dashboard-header-action__icon" aria-hidden="true" />
            <span>Filter</span>
          </button>
          <button
            type="button"
            className="dashboard-header-action dashboard-header-action--icon"
            aria-label="Notifications"
          >
            <Bell className="dashboard-header-action__icon" aria-hidden="true" />
          </button>
        </div>
      </header>

      <div
        className={`dashboard-filter-overlay${isFilterPanelOpen ? " is-open" : ""}`}
        onClick={() => setIsFilterPanelOpen(false)}
        aria-hidden={!isFilterPanelOpen}
      />

      <aside
        id="dashboard-filter-panel"
        className={`dashboard-filter-panel${isFilterPanelOpen ? " is-open" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label="Dashboard filters"
      >
        <div className="dashboard-filter-panel__header">
          <div>
            <h2 className="dashboard-filter-panel__title">Filters</h2>
            <p className="dashboard-filter-panel__subtitle">Refine the current dashboard view</p>
          </div>
          <button
            type="button"
            className="dashboard-filter-panel__close"
            onClick={() => setIsFilterPanelOpen(false)}
            aria-label="Close filters"
          >
            Close
          </button>
        </div>

        <div className="dashboard-filter-panel__body">
          <label className="dashboard-filter-field">
            <span className="dashboard-filter-field__label">Provider</span>
            <select defaultValue="all" className="dashboard-filter-field__control">
              <option value="all">All Providers</option>
              <option value="aws">AWS</option>
              <option value="azure">Azure</option>
              <option value="gcp">GCP</option>
            </select>
          </label>

          <div className="dashboard-filter-field">
            <span className="dashboard-filter-field__label">Accounts</span>
            <div className="dashboard-filter-checklist">
              <label>
                <input type="checkbox" defaultChecked />
                <span>prod-core</span>
              </label>
              <label>
                <input type="checkbox" defaultChecked />
                <span>analytics</span>
              </label>
              <label>
                <input type="checkbox" />
                <span>sandbox</span>
              </label>
            </div>
          </div>

          <label className="dashboard-filter-field">
            <span className="dashboard-filter-field__label">Region</span>
            <select defaultValue="all" className="dashboard-filter-field__control">
              <option value="all">All Regions</option>
              <option value="us-east-1">us-east-1</option>
              <option value="us-west-2">us-west-2</option>
              <option value="eu-west-1">eu-west-1</option>
            </select>
          </label>

          <label className="dashboard-filter-field">
            <span className="dashboard-filter-field__label">Cost Category</span>
            <select defaultValue="all" className="dashboard-filter-field__control">
              <option value="all">All Categories</option>
              <option value="compute">Compute</option>
              <option value="storage">Storage</option>
              <option value="network">Network</option>
            </select>
          </label>

          <div className="dashboard-filter-field">
            <span className="dashboard-filter-field__label">Date Range</span>
            <div className="dashboard-filter-radio-group">
              <label>
                <input type="radio" name="dashboard-date-range" defaultChecked />
                <span>Last 7 days</span>
              </label>
              <label>
                <input type="radio" name="dashboard-date-range" />
                <span>Last 30 days</span>
              </label>
              <label>
                <input type="radio" name="dashboard-date-range" />
                <span>This quarter</span>
              </label>
            </div>
          </div>
        </div>

        <div className="dashboard-filter-panel__footer">
          <button type="button" className="dashboard-filter-panel__btn dashboard-filter-panel__btn--ghost">
            Reset
          </button>
          <button type="button" className="dashboard-filter-panel__btn dashboard-filter-panel__btn--primary">
            Apply
          </button>
        </div>
      </aside>
    </>
  );
}
