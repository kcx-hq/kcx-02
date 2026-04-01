export type DashboardSummaryItem = {
  label: string;
  value: string;
};

export type DashboardSectionResponse = {
  section: string;
  title: string;
  message: string;
  summary: DashboardSummaryItem[];
};

export function getOverviewDashboardData(): DashboardSectionResponse {
  return {
    section: "overview",
    title: "Overview",
    message: "Overview dashboard data fetched successfully",
    summary: [
      { label: "trackedProviders", value: "3" },
      { label: "monthlySpend", value: "$148.2K" },
      { label: "activeAlerts", value: "4" },
    ],
  };
}
