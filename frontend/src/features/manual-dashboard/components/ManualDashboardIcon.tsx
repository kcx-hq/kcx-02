import {
  LayoutDashboard,
  LineChart,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react";

const iconMap: Record<string, LucideIcon> = {
  "layout-dashboard": LayoutDashboard,
  "line-chart": LineChart,
  "triangle-alert": TriangleAlert,
};

type ManualDashboardIconProps = {
  name: string;
  className?: string;
};

export function ManualDashboardIcon({ name, className }: ManualDashboardIconProps) {
  const Icon = iconMap[name] ?? LayoutDashboard;
  return <Icon className={className} aria-hidden="true" />;
}
