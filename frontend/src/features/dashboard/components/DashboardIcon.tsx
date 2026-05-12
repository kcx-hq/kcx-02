import { LayoutDashboard } from "lucide-react";
import {
  sidebarIconMap,
  type SidebarIconKey,
} from "../common/sidebarIconMap";

type DashboardIconProps = {
  name: SidebarIconKey;
  className?: string;
};

export function DashboardIcon({ name, className }: DashboardIconProps) {
  const Icon = sidebarIconMap[name] ?? LayoutDashboard;
  return <Icon className={className} aria-hidden="true" />;
}
