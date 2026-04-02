import { useEffect, useMemo, useRef, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import kcxLogo from "@/assets/logos/kcx-logo.svg";
import { dashboardNavItems } from "../common/navigation";
import { DashboardIcon } from "./DashboardIcon";

export function DashboardSidebar() {
  const [expanded, setExpanded] = useState(false);
  const [desktop, setDesktop] = useState(() =>
    typeof window === "undefined" ? true : window.matchMedia("(min-width: 961px)").matches,
  );
  const sidebarRef = useRef<HTMLElement | null>(null);
  const location = useLocation();
  const collapsed = desktop ? !expanded : false;

  useEffect(() => {
    const mediaQuery = window.matchMedia("(min-width: 961px)");

    const handleMediaChange = (event: MediaQueryListEvent) => {
      setDesktop(event.matches);
      if (!event.matches) {
        setExpanded(false);
      }
    };

    setDesktop(mediaQuery.matches);
    mediaQuery.addEventListener("change", handleMediaChange);
    return () => mediaQuery.removeEventListener("change", handleMediaChange);
  }, []);

  const activeLabel = useMemo(() => {
    const match = dashboardNavItems.find((item) => location.pathname.startsWith(item.path));
    return match?.label ?? "Overview";
  }, [location.pathname]);

  return (
    <aside
      ref={sidebarRef}
      className="dashboard-sidebar"
      data-collapsed={collapsed ? "true" : "false"}
      aria-label="Dashboard Sidebar"
      onMouseEnter={() => {
        if (desktop) {
          setExpanded(true);
        }
      }}
      onMouseLeave={() => {
        if (desktop) {
          setExpanded(false);
        }
      }}
      onFocusCapture={() => {
        if (desktop) {
          setExpanded(true);
        }
      }}
      onBlurCapture={(event) => {
        if (desktop && !event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setExpanded(false);
        }
      }}
    >
      <div className="dashboard-sidebar__header">
        <div className="dashboard-logo" aria-label="KCX Dashboard">
          <img src={kcxLogo} alt="KCX" className="dashboard-logo__image" />
          <span className="dashboard-logo__text">FinOps</span>
        </div>
      </div>

      <div className="dashboard-sidebar__divider" />

      <nav className="dashboard-sidebar__nav" aria-label="Dashboard Navigation">
        {dashboardNavItems.map((item) => (
          <NavLink
            key={item.path}
            to={{ pathname: item.path, search: location.search }}
            className={({ isActive }) =>
              `dashboard-nav-item ${isActive ? "dashboard-nav-item--active" : ""}`
            }
            title={collapsed ? item.label : undefined}
            end
          >
            <DashboardIcon name={item.icon} className="dashboard-nav-item__icon" />
            <span className="dashboard-nav-item__label">{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="dashboard-sidebar__footer">
        <p className="dashboard-sidebar__hint">Current View: {activeLabel}</p>
      </div>
    </aside>
  );
}
