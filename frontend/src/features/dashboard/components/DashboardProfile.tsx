import { UserRound } from "lucide-react";

type DashboardProfileProps = {
  collapsed: boolean;
};

export function DashboardProfile({ collapsed }: DashboardProfileProps) {
  return (
    <div className="dashboard-profile" data-collapsed={collapsed ? "true" : "false"} aria-label="Profile section">
      <div className="dashboard-profile__avatar" aria-hidden="true">
        <UserRound size={14} />
      </div>
      <div className="dashboard-profile__meta">
        <p className="dashboard-profile__name">KCX Analyst</p>
        <p className="dashboard-profile__role">FinOps Workspace</p>
      </div>
    </div>
  );
}
