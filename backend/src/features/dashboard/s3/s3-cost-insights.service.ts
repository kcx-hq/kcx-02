import type { DashboardScope } from "../dashboard.types.js";
import { S3CostInsightsRepository } from "./s3-cost-insights.repository.js";
import { S3BucketScoreService } from "./s3-bucket-score.service.js";
import { S3FinopsActionItemService } from "./s3-finops-action-item.service.js";
import { S3LifecycleRecommendationService } from "./s3-lifecycle-recommendation.service.js";
import { S3OwnerMappingService } from "./s3-owner-mapping.service.js";
import { S3RequestCostIntelligenceService } from "./s3-request-cost-intelligence.service.js";
import { S3SavingsEstimationService } from "./s3-savings-estimation.service.js";
import { S3StorageAnomalyService } from "./s3-storage-anomaly.service.js";
import type { S3CostInsightsFilters, S3CostInsightsResponse, S3ExecutiveSummaryCard } from "./s3-cost-insights.types.js";

const toDate = (value: string): Date => new Date(`${value}T00:00:00.000Z`);

const toIsoDate = (value: Date): string => value.toISOString().slice(0, 10);

const buildMonthToDateScope = (scope: DashboardScope): DashboardScope | null => {
  const fromDate = toDate(scope.from);
  const toDateValue = toDate(scope.to);
  if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDateValue.getTime()) || fromDate > toDateValue) {
    return null;
  }

  const monthStart = new Date(Date.UTC(toDateValue.getUTCFullYear(), toDateValue.getUTCMonth(), 1));
  const mtdFrom = fromDate > monthStart ? fromDate : monthStart;
  return {
    ...scope,
    from: toIsoDate(mtdFrom),
    to: scope.to,
  };
};

const buildPreviousRange = (from: string, to: string): { from: string; to: string } | null => {
  const fromDate = toDate(from);
  const toDateValue = toDate(to);

  if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDateValue.getTime()) || fromDate > toDateValue) {
    return null;
  }

  const diffDays = Math.floor((toDateValue.getTime() - fromDate.getTime()) / 86_400_000) + 1;
  const previousTo = new Date(fromDate);
  previousTo.setUTCDate(previousTo.getUTCDate() - 1);
  const previousFrom = new Date(previousTo);
  previousFrom.setUTCDate(previousFrom.getUTCDate() - (diffDays - 1));

  return {
    from: toIsoDate(previousFrom),
    to: toIsoDate(previousTo),
  };
};

const sanitizeFilters = (filters?: Partial<S3CostInsightsFilters>): S3CostInsightsFilters => {
  const toUnique = (values: unknown[] | undefined): string[] =>
    Array.from(
      new Set(
        (Array.isArray(values) ? values : [])
          .map((value) => String(value ?? "").trim())
          .filter((value) => value.length > 0),
      ),
    );

  const allowedCostBy: S3CostInsightsFilters["costBy"][] = ["date", "bucket", "region", "account"];
  const allowedSeriesBy: S3CostInsightsFilters["seriesBy"][] = [
    "none",
    "cost_category",
    "usage_type",
    "operation",
    "bucket",
    "storage_class",
  ];
  const allowedYAxisMetric: S3CostInsightsFilters["yAxisMetric"][] = [
    "gross_cost",
    "billed_cost",
    "effective_cost",
    "amortized_cost",
    "usage_quantity",
  ];
  const allowedCostCategory = new Set([
    "Storage",
    "Request",
    "Transfer",
    "Retrieval",
    "Other",
  ]);
  const allowedUsageYAxis = new Set(["storage_gb", "request_count", "transfer_gb", "object_count", "api_operations"]);
  const inputYAxisMetric = String(filters?.yAxisMetric ?? "").trim();
  const inferredUsageYAxisFromCategory =
    (Array.isArray(filters?.costCategory) && filters?.costCategory.length === 1
      ? String(filters?.costCategory?.[0] ?? "").trim().toLowerCase()
      : "") === "request"
      ? "request_count"
      : (Array.isArray(filters?.costCategory) && filters?.costCategory.length === 1
          ? String(filters?.costCategory?.[0] ?? "").trim().toLowerCase()
          : "") === "transfer"
        ? "transfer_gb"
        : (Array.isArray(filters?.costCategory) && filters?.costCategory.length === 1
            ? String(filters?.costCategory?.[0] ?? "").trim().toLowerCase()
            : "") === "storage"
          ? "storage_gb"
          : null;
  const explicitUsageYAxis =
    filters?.usageYAxis && allowedUsageYAxis.has(String(filters.usageYAxis))
      ? (String(filters.usageYAxis) as NonNullable<S3CostInsightsFilters["usageYAxis"]>)
      : null;
  const resolvedUsageYAxis = explicitUsageYAxis ?? inferredUsageYAxisFromCategory;
  const shouldUseImplicitUsageQuantity =
    inputYAxisMetric.length === 0 &&
    filters?.seriesBy === "bucket" &&
    resolvedUsageYAxis !== null;

  return {
    costCategory: toUnique(filters?.costCategory as string[]).filter((item) =>
      allowedCostCategory.has(item),
    ) as S3CostInsightsFilters["costCategory"],
    seriesValues: toUnique(filters?.seriesValues as string[]),
    bucket: filters?.bucket && String(filters.bucket).trim().length > 0 ? String(filters.bucket).trim() : null,
    storageClass: toUnique(filters?.storageClass as string[]),
    region: toUnique(filters?.region as string[]),
    account: toUnique(filters?.account as string[]),
    costBy: allowedCostBy.includes(filters?.costBy as S3CostInsightsFilters["costBy"])
      ? (filters?.costBy as S3CostInsightsFilters["costBy"])
      : "date",
    seriesBy: allowedSeriesBy.includes(filters?.seriesBy as S3CostInsightsFilters["seriesBy"])
      ? (filters?.seriesBy as S3CostInsightsFilters["seriesBy"])
      : "bucket",
    yAxisMetric: shouldUseImplicitUsageQuantity
      ? "usage_quantity"
      : allowedYAxisMetric.includes(filters?.yAxisMetric as S3CostInsightsFilters["yAxisMetric"])
        ? (filters?.yAxisMetric as S3CostInsightsFilters["yAxisMetric"])
        : "gross_cost",
    usageYAxis: resolvedUsageYAxis,
  };
};

export class S3CostInsightsService {
  constructor(
    private readonly repository: S3CostInsightsRepository = new S3CostInsightsRepository(),
    private readonly anomalyService: S3StorageAnomalyService = new S3StorageAnomalyService(),
    private readonly bucketScoreService: S3BucketScoreService = new S3BucketScoreService(),
    private readonly lifecycleRecommendationService: S3LifecycleRecommendationService = new S3LifecycleRecommendationService(),
    private readonly savingsEstimationService: S3SavingsEstimationService = new S3SavingsEstimationService(),
    private readonly ownerMappingService: S3OwnerMappingService = new S3OwnerMappingService(),
    private readonly requestCostIntelligenceService: S3RequestCostIntelligenceService = new S3RequestCostIntelligenceService(),
    private readonly actionItemService: S3FinopsActionItemService = new S3FinopsActionItemService(),
  ) {}

  async getInsights(
    scope: DashboardScope,
    filters?: Partial<S3CostInsightsFilters>,
    options?: { responseMode?: "full" | "core" | "quick" | "overview" },
  ): Promise<S3CostInsightsResponse> {
    const responseMode = options?.responseMode ?? "full";
    const isQuickMode = responseMode === "quick";
    const isOverviewMode = responseMode === "overview";
    const isCoreMode = responseMode === "core" || responseMode === "quick";
    const isLeanMode = isCoreMode || isOverviewMode;
    const shouldSkipDeepInsights = isCoreMode || isOverviewMode;
    const effectiveFilters = sanitizeFilters(filters);
    const monthToDateScope = buildMonthToDateScope(scope);
    const previousScope =
      scope.scopeType === "global"
        ? (() => {
            const previousRange = buildPreviousRange(scope.from, scope.to);
            if (!previousRange) return null;
            return {
              ...scope,
              from: previousRange.from,
              to: previousRange.to,
            };
          })()
        : null;
    const quickFilterOptions: S3CostInsightsResponse["filterOptions"] = {
      costCategory: ["Storage", "Request", "Transfer", "Retrieval", "Other"],
      usageType: [],
      operation: [],
      bucket: [],
      storageClass: [],
      region: [],
      account: [],
      costBy: ["date", "bucket", "region", "account"],
      seriesBy: ["none", "bucket", "usage_type", "cost_category", "operation", "storage_class"],
      yAxisMetric: ["gross_cost", "effective_cost", "billed_cost", "amortized_cost", "usage_quantity"],
    };

    const [
      totalS3Cost,
      monthToDateCost,
      effectiveCost,
      bucketCostKpis,
      usageTypeCostKpis,
      usageSummaryKpis,
      storageCostDashboard,
      bucketCosts,
      trend,
      featureTrend,
      breakdown,
      filterOptions,
    ] = await Promise.all([
      this.repository.getTotalS3Cost(scope),
      monthToDateScope ? this.repository.getTotalS3Cost(monthToDateScope) : Promise.resolve(0),
      this.repository.getTotalS3EffectiveCost(scope),
      this.repository.getBucketCostKpis(scope, effectiveFilters),
      this.repository.getUsageTypeCostKpis(scope, effectiveFilters),
      this.repository.getUsageSummaryKpis(scope, effectiveFilters).catch((error: unknown) => {
        console.error("[S3CostInsightsService] Failed to load usage summary KPIs", error);
        return {
          totalStorageGb: 0,
          totalRequests: 0,
          totalTransferGb: 0,
          totalObjectCount: 0,
        };
      }),
      isLeanMode
        ? Promise.resolve({
            latestUsageDate: null,
            totalStorageByClass: [
              { storageClass: "STANDARD" as const, bytes: 0, gib: 0, estimatedMonthlyCost: 0 },
              { storageClass: "STANDARD_IA" as const, bytes: 0, gib: 0, estimatedMonthlyCost: 0 },
              { storageClass: "GLACIER" as const, bytes: 0, gib: 0, estimatedMonthlyCost: 0 },
              { storageClass: "DEEP_ARCHIVE" as const, bytes: 0, gib: 0, estimatedMonthlyCost: 0 },
            ],
            dailyStorageGrowth: { fromDate: null, toDate: null, bytesGrowth: 0, gibGrowth: 0, growthPct: null },
            estimatedMonthlyCost: {
              total: 0,
              byClass: { STANDARD: 0, STANDARD_IA: 0, GLACIER: 0, DEEP_ARCHIVE: 0 },
            },
            costTrend: [],
            expensiveBuckets: [],
          })
        : this.repository.getStorageCostDashboard(scope),
      isLeanMode ? Promise.resolve([]) : this.repository.getBucketCosts(scope),
      isLeanMode ? Promise.resolve([]) : this.repository.getTrend(scope),
      isLeanMode ? Promise.resolve([]) : this.repository.getFeatureTrend(scope),
      this.repository.getBreakdownChart(scope, effectiveFilters).catch((error: unknown) => {
        console.error("[S3CostInsightsService] Failed to load breakdown chart", error);
        return { labels: [], series: [], operationGroupTooltip: [] };
      }),
      isCoreMode
        ? Promise.resolve(quickFilterOptions)
        : this.repository.getBreakdownFilterOptions(scope).catch((error: unknown) => {
            console.error("[S3CostInsightsService] Failed to load breakdown filter options", error);
            return quickFilterOptions;
          }),
    ]);

    const [costCategoryTable, usageOperationTable, currentBucketTable, previousBucketTable] = await Promise.all([
      isCoreMode
        ? Promise.resolve([])
        : this.repository.getCostCategoryTable(scope, effectiveFilters).catch((error: unknown) => {
          console.error("[S3CostInsightsService] Failed to load costCategoryTable", error);
          return [];
        }),
      isCoreMode
        ? Promise.resolve([])
        : this.repository.getUsageOperationTable(scope, effectiveFilters).catch((error: unknown) => {
          console.error("[S3CostInsightsService] Failed to load usageOperationTable", error);
          return [];
        }),
      isQuickMode
        ? Promise.resolve([])
        : this.repository.getBucketCostBreakdown(scope, effectiveFilters, 5000, {
          includeAttributionTags: !isLeanMode,
        }).catch((error: unknown) => {
          console.error("[S3CostInsightsService] Failed to load currentBucketTable", error);
          return [];
        }),
      isCoreMode
        ? Promise.resolve([])
        : previousScope
        ? this.repository.getBucketCostBreakdown(previousScope, effectiveFilters).catch((error: unknown) => {
            console.error("[S3CostInsightsService] Failed to load previousBucketTable", error);
            return [];
          })
        : Promise.resolve([]),
    ]);
    const [currentUsageTypeCostTable, previousUsageTypeCostTable] = await Promise.all([
      isQuickMode
        ? Promise.resolve([])
        : this.repository.getUsageTypeCostTable(scope, effectiveFilters).catch((error: unknown) => {
            console.error("[S3CostInsightsService] Failed to load currentUsageTypeCostTable", error);
            return [];
          }),
      isCoreMode
        ? Promise.resolve([])
        : previousScope
          ? this.repository.getUsageTypeCostTable(previousScope, effectiveFilters).catch((error: unknown) => {
              console.error("[S3CostInsightsService] Failed to load previousUsageTypeCostTable", error);
              return [];
            })
          : Promise.resolve([]),
    ]);
    const [currentStorageTypeCostTable, previousStorageTypeCostTable] = await Promise.all([
      isQuickMode
        ? Promise.resolve([])
        : this.repository.getStorageTypeCostTable(scope, effectiveFilters).catch((error: unknown) => {
            console.error("[S3CostInsightsService] Failed to load currentStorageTypeCostTable", error);
            return [];
          }),
      isCoreMode
        ? Promise.resolve([])
        : previousScope
          ? this.repository.getStorageTypeCostTable(previousScope, effectiveFilters).catch((error: unknown) => {
              console.error("[S3CostInsightsService] Failed to load previousStorageTypeCostTable", error);
              return [];
            })
          : Promise.resolve([]),
    ]);

    const previousGrossByUsageType = new Map(
      previousUsageTypeCostTable.map((row) => [row.usageType, row.grossCost]),
    );
    const usageTypeCostTable = currentUsageTypeCostTable.map((row) => {
      const previousGross = previousGrossByUsageType.get(row.usageType) ?? 0;
      const trendPct = previousGross > 0 ? ((row.grossCost - previousGross) / previousGross) * 100 : 0;
      return {
        ...row,
        trendPct,
      };
    });
    const previousGrossByStorageType = new Map(
      previousStorageTypeCostTable.map((row) => [row.storageType, row.grossCost]),
    );
    const storageTypeCostTable = currentStorageTypeCostTable.map((row) => {
      const previousGross = previousGrossByStorageType.get(row.storageType) ?? 0;
      const trendPct = previousGross > 0 ? ((row.grossCost - previousGross) / previousGross) * 100 : 0;
      return {
        ...row,
        trendPct,
      };
    });
    const storageLensByBucket = shouldSkipDeepInsights
      ? new Map()
      : await this.repository
        .getBucketStorageLens(
          scope,
          currentBucketTable.map((row) => row.bucketName),
        )
        .catch((error: unknown) => {
          console.warn("[S3CostInsightsService] Storage Lens snapshot lookup failed; using CUR fallback only", error);
          return new Map();
        });

    const previousCostByBucket = new Map(previousBucketTable.map((row) => [row.bucketName, row.cost]));
    const currentByBucket = new Map(currentBucketTable.map((row) => [row.bucketName, row]));
    const bucketUsageRollup = await this.repository.getBucketUsageRollup(scope, effectiveFilters).catch((error: unknown) => {
      console.warn("[S3CostInsightsService] Failed to load bucket usage rollup; using fallback values", error);
      return new Map();
    });
    const bucketNames = Array.from(
      new Set([
        ...currentBucketTable.map((row) => row.bucketName),
        ...Array.from(bucketUsageRollup.keys()),
      ]),
    );
    const bucketTable = bucketNames.map((bucketName) => {
      const row = currentByBucket.get(bucketName);
      const previousCost = previousCostByBucket.get(bucketName) ?? 0;
      const cost = row?.cost ?? 0;
      const trendPct = previousCost > 0 ? ((cost - previousCost) / previousCost) * 100 : 0;
      const storageLens = storageLensByBucket.get(bucketName) ?? null;
      const rollup = bucketUsageRollup.get(bucketName);
      const storageSizeGb = rollup?.storageGb ?? (
        storageLens?.storageClassDistribution?.reduce((sum: number, item: { bytes: number }) => sum + (Number(item.bytes ?? 0) / (1024 ** 3)), 0) ?? null
      );
      const dominantUsageType = rollup?.dominantUsageType ?? "Mixed Heavy";
      const tableRow = {
        bucketName,
        account: row?.account ?? "Unspecified",
        cost,
        storage: row?.storage ?? 0,
        requests: row?.requests ?? 0,
        transfer: row?.transfer ?? 0,
        owner: row?.owner ?? "Unassigned",
        savings: row?.savings ?? 0,
        retrieval: row?.retrieval ?? 0,
        other: row?.other ?? 0,
        replicationStatus: row?.replicationStatus ?? null,
        versioningStatus: row?.versioningStatus ?? null,
        encryptionStatus: row?.encryptionStatus ?? null,
        publicAccessStatus: row?.publicAccessStatus ?? "Unknown",
        trendPct,
        driver: dominantUsageType,
        objectCount: rollup?.objectCount ?? storageLens?.objectCount ?? null,
        storageGb: storageSizeGb,
        storageSizeGb,
        transferGb: rollup?.transferGb ?? 0,
        requestCount: rollup?.requestCount ?? 0,
        usageInfo: `Primary usage: ${dominantUsageType}`,
        region: rollup?.region ?? row?.region ?? "global",
        dominantUsageType,
        storageLens,
      };
      console.log({
        bucketName: tableRow.bucketName,
        storageGb: tableRow.storageGb ?? 0,
        transferGb: tableRow.transferGb ?? 0,
        requestCount: tableRow.requestCount ?? 0,
        objectCount: tableRow.objectCount ?? 0,
      });
      return tableRow;
    });

    const anomaliesResult = shouldSkipDeepInsights
      ? { items: [], total: 0 }
      : await this.anomalyService.getStorageGrowthAnomalies(scope).catch((error: unknown) => {
        console.warn("[S3CostInsightsService] Failed to compute storage anomalies", error);
        return { items: [], total: 0 };
      });

    const bucketBase = shouldSkipDeepInsights
      ? []
      : await this.bucketScoreService
        .buildBucketBase(scope, bucketTable, storageLensByBucket)
        .catch((error: unknown) => {
          console.warn("[S3CostInsightsService] Failed to build bucket base features", error);
          return [];
        });
    const bucketBaseByBucketName = new Map(bucketBase.map((item) => [item.bucketName, item]));
    const bucketTableWithConfig = bucketTable.map((row) => {
        const config = shouldSkipDeepInsights ? undefined : bucketBaseByBucketName.get(row.bucketName);
        const primaryUsagePattern = (() => {
          const driver = String(row.driver ?? "").trim();
          return driver.length > 0 ? `${driver} heavy` : "Balanced";
        })();
        const optimizationSignal = (() => {
          const publicStatus = String(config?.publicAccessStatus ?? row.publicAccessStatus ?? "Unknown").toLowerCase();
          const lifecycleMissing = !config?.hasLifecyclePolicy;
          if (publicStatus === "public") return "At Risk";
          if (lifecycleMissing) return "Needs Review";
          if ((row.trendPct ?? 0) >= 20) return "Growth Watch";
          return "Optimized";
        })();
        return {
          ...row,
          replicationStatus: config?.replicationStatus ?? row.replicationStatus ?? null,
          versioningStatus: config?.versioningStatus ?? row.versioningStatus ?? null,
          encryptionStatus: config?.encryptionStatus ?? row.encryptionStatus ?? null,
          publicAccessStatus: config?.publicAccessStatus ?? row.publicAccessStatus ?? "Unknown",
          primaryUsagePattern,
          optimizationSignal,
        };
      });
    console.log("bucketTable", bucketTableWithConfig.slice(0, 3));

    const optimizationScores = shouldSkipDeepInsights
      ? { items: [], total: 0 }
      : this.bucketScoreService.buildOptimizationScores(bucketBase, anomaliesResult.items);
    const healthScores = shouldSkipDeepInsights
      ? { items: [], total: 0 }
      : this.bucketScoreService.buildHealthScores(
        bucketBase,
        optimizationScores.items,
        anomaliesResult.items,
      );
    const storageClassEfficiency = shouldSkipDeepInsights ? [] : this.bucketScoreService.buildStorageClassEfficiency(bucketBase);
    const lifecycleRecommendations = shouldSkipDeepInsights
      ? { items: [], total: 0 }
      : this.lifecycleRecommendationService.buildRecommendations(
        bucketBase,
        anomaliesResult.items,
      );
    const savings = shouldSkipDeepInsights
      ? { items: [], totalMonthlySaving: 0, totalAnnualSaving: 0 }
      : this.savingsEstimationService.buildSavingsEstimates(lifecycleRecommendations.items);

    const ownerMap = shouldSkipDeepInsights ? new Map() : this.ownerMappingService.buildOwnerMap(bucketBase, bucketTableWithConfig);
    const priorityByBucket = new Map(optimizationScores.items.map((item) => [item.bucketName, item.priorityLevel]));
    const backlog = shouldSkipDeepInsights
      ? { items: [], summary: { open: 0, inProgress: 0, implemented: 0, slaBreached: 0 } }
      : this.actionItemService.buildBacklog(lifecycleRecommendations.items, ownerMap, priorityByBucket);
    const ownerInsights = shouldSkipDeepInsights
      ? { items: [], unownedExpensiveBuckets: 0 }
      : this.actionItemService.buildOwnerInsights(backlog.items);
    const requestCostIntelligence = shouldSkipDeepInsights
      ? { items: [], totalRequestCost: 0 }
      : await this.requestCostIntelligenceService
        .getRequestCostIntelligence(scope)
        .catch((error: unknown) => {
          console.warn("[S3CostInsightsService] Failed to build request cost intelligence", error);
          return { items: [], totalRequestCost: 0 };
        });

    const executiveSummaryCards = this.buildExecutiveSummaryCards({
      totalS3Cost,
      monthToDateCost,
      storageCostDashboard,
      anomaliesCount: anomaliesResult.total,
      backlogOpen: backlog.summary.open,
      optimizationOpportunityMonthly: savings.totalMonthlySaving,
      annualizedSavingsPotential: savings.totalAnnualSaving,
      bucketsWithoutLifecycle: bucketBase.filter((bucket) => !bucket.hasLifecyclePolicy).length,
      unownedExpensiveBuckets: ownerInsights.unownedExpensiveBuckets,
      topBusinessUnitByCost:
        ownerInsights.items
          .slice()
          .sort((a, b) => b.totalMonthlySavingsOpportunity - a.totalMonthlySavingsOpportunity)[0]
          ?.businessUnit ?? "UNMAPPED",
      topBucketByGrowth: anomaliesResult.items[0]?.bucketName ?? "n/a",
      savingsImplementedMonthly: 0,
    });

    return {
      section: "s3-cost-insights",
      title: "S3 Cost Insights",
      message: "S3 cost insights loaded",
      filtersApplied: {
        from: scope.from,
        to: scope.to,
        scopeType: scope.scopeType,
        s3Filters: effectiveFilters,
      },
      columnsUsed: [
        "service_name",
        "billed_cost",
        "effective_cost",
        "usage_start_time",
        "list_cost",
        "usage_type",
        "product_usage_type",
        "operation",
        "line_item_description",
        "region_name",
        "sub_account_name",
        "tag_value",
      ],
      kpis: {
        totalS3Cost,
        monthToDateCost,
        effectiveCost,
        bucketCostKpis,
        usageTypeCostKpis,
        usageSummaryKpis,
      },
      storageCostDashboard: {
        currency: "USD",
        ...storageCostDashboard,
      },
      bucketTable: bucketTableWithConfig,
      costCategoryTable,
      usageOperationTable,
      usageTypeCostTable,
      storageTypeCostTable,
      chart: {
        bucketCosts,
        trend,
        featureTrend,
        breakdown,
      },
      filterOptions,
      storageAnomalies: {
        items: anomaliesResult.items,
        total: anomaliesResult.total,
      },
      bucketOptimizationScores: optimizationScores,
      bucketHealthScores: healthScores,
      lifecycleRecommendations,
      estimatedSavings: savings,
      finopsActionBacklog: backlog,
      ownerInsights,
      requestCostIntelligence,
      storageClassEfficiency: {
        items: storageClassEfficiency,
      },
      executiveSummary: {
        cards: executiveSummaryCards,
      },
    };
  }

  private buildExecutiveSummaryCards(input: {
    totalS3Cost: number;
    monthToDateCost: number;
    storageCostDashboard: {
      estimatedMonthlyCost: { total: number };
      dailyStorageGrowth: { gibGrowth: number; growthPct: number | null };
    };
    anomaliesCount: number;
    backlogOpen: number;
    optimizationOpportunityMonthly: number;
    annualizedSavingsPotential: number;
    bucketsWithoutLifecycle: number;
    unownedExpensiveBuckets: number;
    topBusinessUnitByCost: string;
    topBucketByGrowth: string;
    savingsImplementedMonthly: number;
  }): S3ExecutiveSummaryCard[] {
    const forecastedMonthEndCost = input.monthToDateCost * 1.15;
    return [
      {
        key: "totalS3Cost",
        label: "Total S3 Cost",
        value: input.totalS3Cost,
        trend: { direction: "flat", valuePct: null },
        confidence: "HIGH",
        formula: "SUM(CUR billed_cost for S3 in selected range)",
        dataSource: ["fact_cost_line_items", "dim_service", "dim_resource"],
        drilldownTarget: "/dashboard/s3/cost?section=cost-overview",
      },
      {
        key: "estimatedMonthlyStorageCost",
        label: "Estimated Monthly Storage Cost",
        value: input.storageCostDashboard.estimatedMonthlyCost.total,
        trend: { direction: "up", valuePct: input.storageCostDashboard.dailyStorageGrowth.growthPct },
        confidence: "MEDIUM",
        formula: "SUM(storage_class_gib * class_price_per_gb_month)",
        dataSource: ["s3_storage_lens_daily"],
        drilldownTarget: "/dashboard/s3/cost?section=storage-dashboard",
      },
      {
        key: "mtdCost",
        label: "MTD Cost",
        value: input.monthToDateCost,
        trend: { direction: "flat", valuePct: null },
        confidence: "HIGH",
        formula: "SUM(CUR billed_cost from month-start to to-date)",
        dataSource: ["fact_cost_line_items"],
        drilldownTarget: "/dashboard/s3/cost?section=mtd",
      },
      {
        key: "forecastedMonthEndCost",
        label: "Forecasted Month-End Cost",
        value: forecastedMonthEndCost,
        trend: { direction: "up", valuePct: 15 },
        confidence: "LOW",
        formula: "MTD * projection factor",
        dataSource: ["fact_cost_line_items"],
        drilldownTarget: "/dashboard/s3/cost?section=forecast",
      },
      {
        key: "sevenDayStorageGrowthGib",
        label: "7-Day Storage Growth",
        value: input.storageCostDashboard.dailyStorageGrowth.gibGrowth,
        trend: { direction: input.storageCostDashboard.dailyStorageGrowth.gibGrowth >= 0 ? "up" : "down", valuePct: input.storageCostDashboard.dailyStorageGrowth.growthPct },
        confidence: "MEDIUM",
        formula: "latest_total_gib - total_gib_7d_ago",
        dataSource: ["s3_storage_lens_daily"],
        drilldownTarget: "/dashboard/s3/cost?section=anomalies",
      },
      {
        key: "highRiskBuckets",
        label: "High-Risk Buckets",
        value: input.anomaliesCount,
        trend: { direction: "up", valuePct: null },
        confidence: "MEDIUM",
        formula: "count(anomalies severity in HIGH/CRITICAL)",
        dataSource: ["s3_storage_lens_daily", "s3_bucket_config_snapshot"],
        drilldownTarget: "/dashboard/s3/cost?section=anomalies",
      },
      {
        key: "optimizationOpportunityMonthly",
        label: "Optimization Opportunity",
        value: input.optimizationOpportunityMonthly,
        trend: { direction: "up", valuePct: null },
        confidence: "MEDIUM",
        formula: "sum(estimated monthly savings across recommendations)",
        dataSource: ["derived recommendations"],
        drilldownTarget: "/dashboard/s3/cost?section=recommendations",
      },
      {
        key: "annualizedSavingsPotential",
        label: "Annualized Savings Potential",
        value: input.annualizedSavingsPotential,
        trend: { direction: "up", valuePct: null },
        confidence: "MEDIUM",
        formula: "monthly_opportunity * 12",
        dataSource: ["derived recommendations"],
        drilldownTarget: "/dashboard/s3/cost?section=savings",
      },
      {
        key: "bucketsWithoutLifecycle",
        label: "Buckets Without Lifecycle",
        value: input.bucketsWithoutLifecycle,
        trend: { direction: "up", valuePct: null },
        confidence: "HIGH",
        formula: "count(bucket where lifecycle_rules_count = 0)",
        dataSource: ["s3_bucket_config_snapshot"],
        drilldownTarget: "/dashboard/s3/cost?section=recommendations",
      },
      {
        key: "unownedExpensiveBuckets",
        label: "Unowned Expensive Buckets",
        value: input.unownedExpensiveBuckets,
        trend: { direction: "up", valuePct: null },
        confidence: "LOW",
        formula: "count(unmapped owner with high savings opportunity)",
        dataSource: ["dim_tag", "bucket owner mapping"],
        drilldownTarget: "/dashboard/s3/cost?section=owner",
      },
      {
        key: "topBusinessUnitByCost",
        label: "Top Business Unit by Cost",
        value: input.topBusinessUnitByCost,
        trend: { direction: "flat", valuePct: null },
        confidence: "LOW",
        formula: "max(cost grouped by BU mapping)",
        dataSource: ["owner mapping", "bucket costs"],
        drilldownTarget: "/dashboard/s3/cost?section=owner",
      },
      {
        key: "topBucketByGrowth",
        label: "Top Bucket by Growth",
        value: input.topBucketByGrowth,
        trend: { direction: "up", valuePct: null },
        confidence: "MEDIUM",
        formula: "bucket with max 7-day growth",
        dataSource: ["s3_storage_lens_daily"],
        drilldownTarget: "/dashboard/s3/cost?section=anomalies",
      },
      {
        key: "costAnomalies",
        label: "Cost Anomalies",
        value: input.anomaliesCount,
        trend: { direction: "up", valuePct: null },
        confidence: "MEDIUM",
        formula: "count(detected anomaly records)",
        dataSource: ["s3_bucket_daily_anomalies (derived)"],
        drilldownTarget: "/dashboard/s3/cost?section=anomalies",
      },
      {
        key: "savingsImplementedMonthly",
        label: "Savings Implemented",
        value: input.savingsImplementedMonthly,
        trend: { direction: "flat", valuePct: null },
        confidence: "LOW",
        formula: "sum(realized savings from implemented actions)",
        dataSource: ["s3_finops_action_items"],
        drilldownTarget: "/dashboard/s3/cost?section=backlog",
      },
    ];
  }
}
