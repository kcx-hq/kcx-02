import { OverviewRepository, toCostInsightText } from "./overview.repository.js";
import type { DashboardScope } from "../dashboard.types.js";
import type {
  AnomaliesResponse,
  BudgetActualForecastPoint,
  CostBreakdownItem,
  FiltersResponse,
  OverviewDashboardResponse,
  OverviewFilters,
  OverviewKpis,
  RecommendationsResponse,
  SavingsInsights,
} from "./overview.types.js";

const roundTo = (value: number, decimals: number): number => {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
};

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

  async getTotalSpend(scope: DashboardScope): Promise<{ totalSpend: number }> {
    const totalSpend = await this.overviewRepository.getTotalSpendByScope(scope);
    return { totalSpend };
  }

  async getOverview(filters: OverviewFilters): Promise<OverviewDashboardResponse> {
    const [kpis, budgetVsActualForecast, topServices, topAccounts, topRegions, savingsInsights, anomalies, recommendations] =
      await Promise.all([
        this.getKpis(filters),
        this.overviewRepository.getBudgetVsActualForecast(filters),
        this.getTopServices(filters),
        this.getTopAccounts(filters),
        this.getTopRegions(filters),
        this.getSavingsInsights(filters),
        this.getAnomalies(filters),
        this.getRecommendations(filters),
      ]);

    return {
      filtersApplied: {
        billingPeriodStart: filters.billingPeriodStart,
        billingPeriodEnd: filters.billingPeriodEnd,
        forecastingEnabled: filters.forecastingEnabled,
        accountKeys: filters.accountKeys,
        serviceKeys: filters.serviceKeys,
        regionKeys: filters.regionKeys,
        severity: filters.severity,
        status: filters.status,
        page: filters.page,
        pageSize: filters.pageSize,
        sortBy: filters.sortBy,
        sortOrder: filters.sortOrder,
      },
      kpis,
      budgetVsActualForecast,
      topServices,
      topAccounts,
      topRegions,
      savingsInsights,
      anomaliesPreview: {
        items: anomalies.items.slice(0, 5),
        total: anomalies.pagination.total,
      },
      recommendationsPreview: {
        items: recommendations.items.slice(0, 5),
        total: recommendations.pagination.total,
      },
    };
  }

  async getKpis(filters: OverviewFilters): Promise<OverviewKpis> {
    const [currentSummary, previousPeriodSpend, topRegion, topAccount, activeAnomalies, activeRecommendations, highSeverityAnomalyCount] =
      await Promise.all([
        this.overviewRepository.getCostSummary(filters),
        this.overviewRepository.getPreviousPeriodSpend(filters),
        this.overviewRepository.getTopRegion(filters),
        this.overviewRepository.getTopAccount(filters),
        this.overviewRepository.getActiveAnomaliesCount(filters),
        this.overviewRepository.getActiveRecommendationsCount(filters),
        this.overviewRepository.getHighSeverityAnomalyCount(filters),
      ]);

    const savingsAchieved = Math.max(0, currentSummary.listCost - currentSummary.effectiveCost);

    return {
      totalSpend: currentSummary.billedCost,
      previousPeriodSpend,
      savingsAchieved,
      topRegion,
      topAccount,
      activeAlerts: activeAnomalies + activeRecommendations,
      highSeverityAnomalyCount,
    };
  }

  async getBudgetVsActualForecast(filters: OverviewFilters): Promise<BudgetActualForecastPoint[]> {
    return this.overviewRepository.getBudgetVsActualForecast(filters);
  }

  async getTopServices(filters: OverviewFilters, limit: number = 10): Promise<CostBreakdownItem[]> {
    return this.overviewRepository.getTopServices(filters, limit);
  }

  async getTopAccounts(filters: OverviewFilters, limit: number = 10): Promise<CostBreakdownItem[]> {
    return this.overviewRepository.getTopAccounts(filters, limit);
  }

  async getTopRegions(filters: OverviewFilters, limit?: number): Promise<CostBreakdownItem[]> {
    return this.overviewRepository.getTopRegions(filters, limit);
  }

  async getSavingsInsights(filters: OverviewFilters): Promise<SavingsInsights> {
    const [summary, topServices] = await Promise.all([
      this.overviewRepository.getCostSummary(filters),
      this.getTopServices(filters, 1),
    ]);

    const absoluteSavings = Math.max(0, summary.listCost - summary.effectiveCost);
    const savingsPct = summary.listCost > 0 ? roundTo((absoluteSavings / summary.listCost) * 100, 2) : 0;

    return {
      listCost: summary.listCost,
      effectiveCost: summary.effectiveCost,
      absoluteSavings,
      savingsPct,
      insightText: toCostInsightText(summary.billedCost, absoluteSavings, savingsPct, topServices[0] ?? null),
    };
  }

  async getAnomalies(filters: OverviewFilters): Promise<AnomaliesResponse> {
    const [paginated, activeCount, highSeverityCount] = await Promise.all([
      this.overviewRepository.getAnomalies(filters),
      this.overviewRepository.getActiveAnomaliesCount(filters),
      this.overviewRepository.getHighSeverityAnomalyCount(filters),
    ]);

    return {
      ...paginated,
      summary: {
        activeCount,
        highSeverityCount,
      },
    };
  }

  async getRecommendations(filters: OverviewFilters): Promise<RecommendationsResponse> {
    const [paginated, activeCount, estimatedSavingsTotal] = await Promise.all([
      this.overviewRepository.getRecommendations(filters),
      this.overviewRepository.getActiveRecommendationsCount(filters),
      this.overviewRepository.getRecommendationsEstimatedSavingsTotal(filters),
    ]);

    return {
      ...paginated,
      summary: {
        activeCount,
        estimatedSavingsTotal: roundTo(estimatedSavingsTotal, 2),
      },
    };
  }

  async getFilterOptions(filters: OverviewFilters): Promise<FiltersResponse> {
    return this.overviewRepository.getFilterOptions(filters);
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
