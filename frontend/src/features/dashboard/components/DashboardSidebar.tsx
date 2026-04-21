import { useEffect, useMemo, useRef, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import kcxLogo from "@/assets/logos/kcx-logo.svg";
import { handleAppLinkClick } from "@/lib/navigation";
import { dashboardNav, dashboardNavLinks } from "../common/navigation";
import type { DashboardNavGroup, DashboardNavLink } from "../common/navigation";
import { DashboardIcon } from "./DashboardIcon";

function getGroupKey(label: string, parentPath?: string): string {
  return parentPath ? `${parentPath}::${label}` : label;
}

function isNavGroupActive(pathname: string, group: DashboardNavGroup): boolean {
  return group.items.some((item) => isNavItemActive(pathname, item));
}

function isNavItemActive(pathname: string, item: DashboardNavLink): boolean {
  return (
    pathname.startsWith(item.path) ||
    (item.children ?? []).some((group) => isNavGroupActive(pathname, group))
  );
}

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

  const nestedGroupNodes = useMemo(
    () =>
      dashboardNav.flatMap((node) =>
        node.kind === "link"
          ? (node.children ?? []).map((group) => ({ parentPath: node.path, group }))
          : [],
      ),
    [],
  );

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() =>
    Object.fromEntries([
      ...groupNodes.map((group) => [getGroupKey(group.label), true] as const),
      ...nestedGroupNodes.map(
        ({ parentPath, group }) => [getGroupKey(group.label, parentPath), true] as const,
      ),
    ]),
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
        const groupKey = getGroupKey(group.label);
        const isActive = isNavGroupActive(location.pathname, group);
        if (isActive && !next[groupKey]) {
          next[groupKey] = true;
          changed = true;
        }
      }

      for (const { parentPath, group } of nestedGroupNodes) {
        const groupKey = getGroupKey(group.label, parentPath);
        const isActive = isNavGroupActive(location.pathname, group);
        if (isActive && !next[groupKey]) {
          next[groupKey] = true;
          changed = true;
        }
      }

      return changed ? next : current;
    });
  }, [groupNodes, location.pathname, nestedGroupNodes]);

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
            const groupKey = getGroupKey(node.label);
            const isGroupActive = isNavGroupActive(location.pathname, node);
            const isGroupOpen = openGroups[groupKey] ?? true;
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
                      [groupKey]: !(current[groupKey] ?? true),
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
                          `dashboard-nav-item dashboard-nav-item--sub ${isActive || isNavItemActive(location.pathname, item) ? "dashboard-nav-item--active" : ""}`
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

          const childGroups = node.children ?? [];
          if (childGroups.length > 0) {
            const isNodeActive = isNavItemActive(location.pathname, node);

            return (
              <div key={node.path} className="dashboard-nav-group">
                <NavLink
                  to={{ pathname: node.path, search: location.search }}
                  className={({ isActive }) =>
                    `dashboard-nav-item ${isActive || isNodeActive ? "dashboard-nav-item--active" : ""}`
                  }
                  title={collapsed ? node.label : undefined}
                  end
                >
                  <DashboardIcon name={node.icon} className="dashboard-nav-item__icon" />
                  <span className="dashboard-nav-item__label">{node.label}</span>
                </NavLink>

                <div className="dashboard-nav-submenu">
                  {childGroups.map((group) => {
                    const groupKey = getGroupKey(group.label, node.path);
                    const isGroupActive = isNavGroupActive(location.pathname, group);
                    const isGroupOpen = openGroups[groupKey] ?? true;
                    const groupId = `dashboard-nav-group-${groupKey
                      .toLowerCase()
                      .replace(/[^a-z0-9]+/g, "-")}`;

                    return (
                      <div key={groupKey} className="dashboard-nav-group">
                        <button
                          type="button"
                          className={`dashboard-nav-item dashboard-nav-item--group dashboard-nav-item--sub ${isGroupActive ? "dashboard-nav-item--active" : ""}`}
                          title={collapsed ? group.label : undefined}
                          aria-expanded={isGroupOpen}
                          aria-controls={groupId}
                          onClick={() =>
                            setOpenGroups((current) => ({
                              ...current,
                              [groupKey]: !(current[groupKey] ?? true),
                            }))
                          }
                        >
                          <DashboardIcon name={group.icon} className="dashboard-nav-item__icon" />
                          <span className="dashboard-nav-item__label">{group.label}</span>
                          <span className="dashboard-nav-group__chevron" aria-hidden="true">
                            <DashboardIcon
                              name="chevron-right"
                              className={`dashboard-nav-group__chevron-icon ${isGroupOpen ? "dashboard-nav-group__chevron-icon--open" : ""}`}
                            />
                          </span>
                        </button>

                        {isGroupOpen ? (
                          <div id={groupId} className="dashboard-nav-submenu">
                            {group.items.map((item) => (
                              <NavLink
                                key={item.path}
                                to={{ pathname: item.path, search: location.search }}
                                className={({ isActive }) =>
                                  `dashboard-nav-item dashboard-nav-item--sub ${isActive || isNavItemActive(location.pathname, item) ? "dashboard-nav-item--active" : ""}`
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
                  })}
                </div>
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
        <a
          href="/client/overview"
          onClick={(event) => handleAppLinkClick(event, "/client/overview")}
          className="dashboard-sidebar__client-home-btn"
          title={collapsed ? "Client Home" : undefined}
        >
          <DashboardIcon name="house" className="dashboard-sidebar__client-home-btn-icon" />
          <span className="dashboard-sidebar__client-home-btn-label">Client Home</span>
        </a>
        <p className="dashboard-sidebar__hint">Current View: {activeLabel}</p>
      </div>
    </aside>
  );
}
