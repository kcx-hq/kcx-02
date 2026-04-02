import type { DashboardScope } from "../dashboard.types.js";
import { OverviewRepository } from "./overview.repository.js";
import type { TotalSpendResponse } from "./overview.types.js";

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

export class OverviewService {
  constructor(private readonly overviewRepository: OverviewRepository = new OverviewRepository()) {}

  async getTotalSpend(scope: DashboardScope): Promise<TotalSpendResponse> {
    const totalSpend = await this.overviewRepository.getTotalSpend(scope);

    return {
      totalSpend,
    };
  }
}

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
