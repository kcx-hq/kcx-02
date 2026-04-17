import { useEffect, useMemo, useRef, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import kcxLogo from "@/assets/logos/kcx-logo.svg";
import { dashboardNav, dashboardNavLinks } from "../common/navigation";
import type { DashboardNavGroup } from "../common/navigation";
import { DashboardIcon } from "./DashboardIcon";

export function DashboardSidebar() {
  const [expanded, setExpanded] = useState(false);
  const [desktop, setDesktop] = useState(() =>
    typeof window === "undefined" ? true : window.matchMedia("(min-width: 961px)").matches,
  );
  const sidebarRef = useRef<HTMLElement | null>(null);
  const location = useLocation();
  const collapsed = desktop ? !expanded : false;

  const groupNodes = useMemo(
    () => dashboardNav.filter((node): node is DashboardNavGroup => node.kind === "group"),
    [],
  );

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(groupNodes.map((group) => [group.label, true])),
  );

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

  useEffect(() => {
    setOpenGroups((current) => {
      let changed = false;
      const next = { ...current };

      for (const group of groupNodes) {
        const isActive = group.items.some((item) => location.pathname.startsWith(item.path));
        if (isActive && !next[group.label]) {
          next[group.label] = true;
          changed = true;
        }
      }

      return changed ? next : current;
    });
  }, [groupNodes, location.pathname]);

  const activeLabel = useMemo(() => {
    const match = dashboardNavLinks.find((item) => location.pathname.startsWith(item.path));
    return match?.label ?? "Overview Dashboard";
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
          <span className="dashboard-logo__text-block">
            <span className="dashboard-logo__brand">
              KC<span className="dashboard-logo__brand-x">X</span>
            </span>
            <span className="dashboard-logo__sub">FinOps Platform</span>
          </span>
        </div>
      </div>

      <div className="dashboard-sidebar__divider" />

      <nav className="dashboard-sidebar__nav" aria-label="Dashboard Navigation">
        {dashboardNav.map((node) => {
          if (node.kind === "group") {
            const isGroupActive = node.items.some((item) => location.pathname.startsWith(item.path));
            const isGroupOpen = openGroups[node.label] ?? true;
            const groupId = `dashboard-nav-group-${node.label.toLowerCase().replace(/\s+/g, "-")}`;

            return (
              <div key={node.label} className="dashboard-nav-group">
                <button
                  type="button"
                  className={`dashboard-nav-item dashboard-nav-item--group ${isGroupActive ? "dashboard-nav-item--active" : ""}`}
                  title={collapsed ? node.label : undefined}
                  aria-expanded={isGroupOpen}
                  aria-controls={groupId}
                  onClick={() =>
                    setOpenGroups((current) => ({
                      ...current,
                      [node.label]: !(current[node.label] ?? true),
                    }))
                  }
                >
                  <DashboardIcon name={node.icon} className="dashboard-nav-item__icon" />
                  <span className="dashboard-nav-item__label">{node.label}</span>
                  <span className="dashboard-nav-group__chevron" aria-hidden="true">
                    <DashboardIcon
                      name="chevron-right"
                      className={`dashboard-nav-group__chevron-icon ${isGroupOpen ? "dashboard-nav-group__chevron-icon--open" : ""}`}
                    />
                  </span>
                </button>

                {isGroupOpen ? (
                  <div id={groupId} className="dashboard-nav-submenu">
                    {node.items.map((item) => (
                      <NavLink
                        key={item.path}
                        to={{ pathname: item.path, search: location.search }}
                        className={({ isActive }) =>
                          `dashboard-nav-item dashboard-nav-item--sub ${isActive ? "dashboard-nav-item--active" : ""}`
                        }
                        title={collapsed ? item.label : undefined}
                        end
                      >
                        <DashboardIcon name={item.icon} className="dashboard-nav-item__icon" />
                        <span className="dashboard-nav-item__label">{item.label}</span>
                      </NavLink>
                    ))}
                  </div>
                ) : null}
              </div>
            );
          }

          return (
            <NavLink
              key={node.path}
              to={{ pathname: node.path, search: location.search }}
              className={({ isActive }) =>
                `dashboard-nav-item ${isActive ? "dashboard-nav-item--active" : ""}`
              }
              title={collapsed ? node.label : undefined}
              end
            >
              <DashboardIcon name={node.icon} className="dashboard-nav-item__icon" />
              <span className="dashboard-nav-item__label">{node.label}</span>
            </NavLink>
          );
        })}
      </nav>

      <div className="dashboard-sidebar__footer">
        <p className="dashboard-sidebar__hint">Current View: {activeLabel}</p>
      </div>
    </aside>
  );
}
