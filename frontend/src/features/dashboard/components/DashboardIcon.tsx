import {
  Activity,
  ChevronLeft,
  ChevronRight,
  FileText,
  LayoutDashboard,
  LineChart,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";

const iconMap: Record<string, LucideIcon> = {
  activity: Activity,
  "file-text": FileText,
  "layout-dashboard": LayoutDashboard,
  "line-chart": LineChart,
  "shield-check": ShieldCheck,
  "chevron-left": ChevronLeft,
  "chevron-right": ChevronRight,
};

type DashboardIconProps = {
  name: string;
  className?: string;
};

export function DashboardIcon({ name, className }: DashboardIconProps) {
  const Icon = iconMap[name] ?? LayoutDashboard;
  return <Icon className={className} aria-hidden="true" />;
}
