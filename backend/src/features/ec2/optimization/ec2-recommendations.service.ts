import { logger } from "../../../utils/logger.js";
import { Ec2RecommendationDetectorsService } from "../recommendations/ec2-recommendation-detectors.service.js";
import { Ec2RecommendationsRepository } from "./ec2-recommendations.repository.js";
import type {
  Ec2RecommendationRecord,
  Ec2RecommendationsQuery,
  Ec2RecommendationsResponse,
  Ec2RefreshRecommendationsInput,
} from "./ec2-recommendations.types.js";

const LB_COST_TYPES = new Set([
  "idle_load_balancer",
  "low_traffic_load_balancer",
  "high_data_processing_cost",
]);

const LB_RELIABILITY_TYPES = new Set([
  "unhealthy_targets",
  "high_error_rate",
]);

const hasAllTags = (tags: Record<string, unknown> | null, required: string[]): boolean => {
  if (required.length === 0) return true;
  if (!tags) return false;
  const entries = Object.entries(tags).flatMap(([k, v]) => {
    const value = String(v ?? "");
    return [k.toLowerCase(), value.toLowerCase(), `${k}:${value}`.toLowerCase()];
  });
  return required.every((tag) => entries.some((entry) => entry.includes(tag.toLowerCase())));
};

export class Ec2RecommendationsService {
  private readonly repository: Ec2RecommendationsRepository;
  private readonly detectors: Ec2RecommendationDetectorsService;

  constructor(
    repository: Ec2RecommendationsRepository = new Ec2RecommendationsRepository(),
    detectors: Ec2RecommendationDetectorsService = new Ec2RecommendationDetectorsService(),
  ) {
    this.repository = repository;
    this.detectors = detectors;
  }

  async refreshRecommendations(input: Ec2RefreshRecommendationsInput): Promise<{ created: number; updated: number; resolved: number }> {
    const [instances, volumes, snapshots, networkLineItems, usageSummaries, eipCandidates] = await Promise.all([
      this.repository.getInstanceCandidates(input),
      this.repository.getVolumeCandidates(input),
      this.repository.getSnapshotCandidates(input),
      this.repository.getInstanceNetworkCostLineItems(input),
      this.repository.getInstanceUsageSummaries(input),
      this.repository.getUnattachedEipCandidates(input),
    ]);

    const generated = this.detectors.generate({
      input,
      instances,
      volumes,
      snapshots,
      networkLineItems,
      usageSummaries,
      eipCandidates,
    });

    const result = await this.repository.upsertGeneratedRecommendations(generated);
    logger.info("EC2 recommendations refresh completed", {
      tenantId: input.tenantId,
      billingSourceId: input.billingSourceId,
      generatedCount: generated.length,
      created: result.created,
      updated: result.updated,
      resolved: result.resolved,
    });
    return result;
  }

  async getRecommendations(input: Ec2RecommendationsQuery): Promise<Ec2RecommendationsResponse> {
    const rows = await this.repository.getPersistedRecommendations(input);
    const filtered = rows.filter((row) => hasAllTags((row.metadata?.tags as Record<string, unknown> | null) ?? null, input.tags));
    const compute = filtered.filter((row) => row.category === "compute");
    const storage = filtered.filter((row) => row.category === "storage");
    const pricing = filtered.filter((row) => row.category === "pricing");
    const network = filtered.filter((row) =>
      row.category === "network" ||
      row.category === "cost_optimization" ||
      row.category === "reliability" ||
      LB_COST_TYPES.has(row.type) ||
      LB_RELIABILITY_TYPES.has(row.type),
    );

    const totals: Ec2RecommendationsResponse["overview"] = {
      totalPotentialMonthlySaving: 0,
      countByCategory: { compute: 0, storage: 0, pricing: 0, network: 0 },
      savingByCategory: { compute: 0, storage: 0, pricing: 0, network: 0 },
      countByType: {
        idle_instance: 0,
        underutilized_instance: 0,
        overutilized_instance: 0,
        unattached_volume: 0,
        old_snapshot: 0,
        orphaned_snapshot: 0,
        uncovered_on_demand: 0,
        high_internet_data_transfer: 0,
        high_inter_region_data_transfer: 0,
        high_inter_az_data_transfer: 0,
        low_cpu_high_network: 0,
        high_nat_gateway_cost: 0,
        unattached_elastic_ip: 0,
        idle_load_balancer: 0,
        low_traffic_load_balancer: 0,
        unhealthy_targets: 0,
        high_error_rate: 0,
        high_data_processing_cost: 0,
      },
    };

    for (const row of filtered) {
      totals.totalPotentialMonthlySaving += row.estimatedMonthlySaving;
      const summaryCategory =
        row.category === "compute" ||
        row.category === "storage" ||
        row.category === "pricing" ||
        row.category === "network"
          ? row.category
          : "network";
      totals.countByCategory[summaryCategory] += 1;
      totals.savingByCategory[summaryCategory] += row.estimatedMonthlySaving;
      totals.countByType[row.type] += 1;
    }

    return {
      overview: totals,
      recommendations: { compute, storage, pricing, network },
    };
  }

  async updateStatus(input: {
    tenantId: string;
    id: number;
    status: Ec2RecommendationRecord["status"];
    reason: string | null;
    snoozedUntil: string | null;
  }): Promise<boolean> {
    return this.repository.updateRecommendationStatus(input);
  }
}
