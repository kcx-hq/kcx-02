import {
  Activity,
  Boxes,
  ChevronLeft,
  ChevronRight,
  FileText,
  Gauge,
  LayoutDashboard,
  LineChart,
  PieChart,
  ShieldCheck,
  TriangleAlert,
  Wallet,
  type LucideIcon,
} from "lucide-react";

const iconMap: Record<string, LucideIcon> = {
  activity: Activity,
  "file-text": FileText,
  "layout-dashboard": LayoutDashboard,
  "line-chart": LineChart,
  boxes: Boxes,
  "pie-chart": PieChart,
  gauge: Gauge,
  "triangle-alert": TriangleAlert,
  wallet: Wallet,
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
