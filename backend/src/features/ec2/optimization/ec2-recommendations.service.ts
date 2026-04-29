import { logger } from "../../../utils/logger.js";
import { Ec2RecommendationsRepository } from "./ec2-recommendations.repository.js";
import type {
  Ec2RecommendationRecord,
  Ec2RecommendationType,
  Ec2RecommendationsQuery,
  Ec2RecommendationsResponse,
  Ec2RefreshRecommendationsInput,
} from "./ec2-recommendations.types.js";

const DAY_MS = 86_400_000;

const normalize = (value: string | null | undefined): string => (value ?? "").trim().toLowerCase();
const normalizeOptionalId = (value: string | null | undefined): string | null => {
  const normalized = (value ?? "").trim();
  return normalized.length > 0 ? normalized : null;
};

const ageDays = (at: Date | null, dateTo: string): number | null => {
  if (!at) return null;
  const end = Date.parse(`${dateTo}T00:00:00.000Z`);
  if (!Number.isFinite(end)) return null;
  return Math.max(0, Math.floor((end - at.getTime()) / DAY_MS));
};

const hasProtectedTag = (tags: Record<string, unknown> | null): boolean => {
  if (!tags) return false;
  for (const [k, v] of Object.entries(tags)) {
    const key = k.toLowerCase();
    const value = String(v ?? "").toLowerCase();
    if (!["protected", "do_not_delete", "retain", "retention_lock"].includes(key)) continue;
    if (value === "true" || value === "1" || value === "yes" || value === "locked") return true;
  }
  return false;
};

const hasAllTags = (tags: Record<string, unknown> | null, required: string[]): boolean => {
  if (required.length === 0) return true;
  if (!tags) return false;
  const entries = Object.entries(tags).flatMap(([k, v]) => {
    const value = String(v ?? "");
    return [k.toLowerCase(), value.toLowerCase(), `${k}:${value}`.toLowerCase()];
  });
  return required.every((tag) => entries.some((entry) => entry.includes(tag.toLowerCase())));
};

const mapTypeToCategory = (type: Ec2RecommendationType): "compute" | "storage" | "pricing" => {
  if (type === "unattached_volume" || type === "old_snapshot") return "storage";
  if (type === "uncovered_on_demand") return "pricing";
  return "compute";
};

export class Ec2RecommendationsService {
  private readonly repository: Ec2RecommendationsRepository;

  constructor(repository: Ec2RecommendationsRepository = new Ec2RecommendationsRepository()) {
    this.repository = repository;
  }

  async refreshRecommendations(input: Ec2RefreshRecommendationsInput): Promise<{ created: number; updated: number; resolved: number }> {
    const [instances, volumes, snapshots] = await Promise.all([
      this.repository.getInstanceCandidates(input),
      this.repository.getVolumeCandidates(input),
      this.repository.getSnapshotCandidates(input),
    ]);

    const generated: Array<Record<string, unknown>> = [];
    const observationStart = new Date(`${input.dateFrom}T00:00:00.000Z`);
    const observationEnd = new Date(`${input.dateTo}T00:00:00.000Z`);

    for (const row of instances) {
      const state = normalize(row.state);
      const runningHours = row.runningHours;
      const avgCpu = row.avgCpu;
      const avgDailyNetworkMb = row.avgDailyNetworkMb;
      const totalCost = row.totalCost;
      const computeCost = row.computeCost;
      const pricingType = normalize(row.pricingType);
      const coveredByRi = (row.coveredHours ?? 0) > 0;
      const activeDays = runningHours === null ? null : runningHours / 24;

      if (state !== "running" || runningHours === null || runningHours < 24 || totalCost === null || totalCost <= 5) {
        continue;
      }

      const common = {
        tenantId: input.tenantId,
        cloudConnectionId: row.cloudConnectionId,
        billingSourceId: row.billingSourceId ?? input.billingSourceId,
        resourceType: "ec2_instance",
        resourceId: row.instanceId,
        resourceName: row.instanceName ?? row.instanceId,
        accountId: row.awsAccountId,
        region: row.awsRegionCode,
        currentMonthlyCost: totalCost,
        projectedMonthlyCost: 0,
        observationStart,
        observationEnd,
        metadata: {
          cpu: avgCpu,
          avg_daily_network_mb: avgDailyNetworkMb,
          running_hours: runningHours,
          compute_cost: computeCost,
          pricing_type: pricingType,
          covered_hours: row.coveredHours,
          tags: row.tagsJson,
        },
      };

      let classified = false;
      if (avgCpu !== null && avgDailyNetworkMb !== null && avgCpu < 5 && avgDailyNetworkMb < 100) {
        generated.push({
          ...common,
          category: "compute",
          type: "idle_instance",
          problem: "Instance appears idle while running.",
          evidence: `state=running, running_hours=${runningHours.toFixed(1)}, avg_cpu=${avgCpu.toFixed(2)}%, avg_daily_network_mb=${avgDailyNetworkMb.toFixed(2)}, total_cost=${totalCost.toFixed(2)}`,
          action: "Stop or terminate instance",
          estimatedMonthlySaving: totalCost,
          risk: "low",
        });
        classified = true;
      } else if (avgCpu !== null && avgDailyNetworkMb !== null && avgCpu >= 5 && avgCpu < 20 && avgDailyNetworkMb < 1024) {
        generated.push({
          ...common,
          category: "compute",
          type: "underutilized_instance",
          problem: "Instance is underutilized for current sizing.",
          evidence: `state=running, running_hours=${runningHours.toFixed(1)}, avg_cpu=${avgCpu.toFixed(2)}%, avg_daily_network_mb=${avgDailyNetworkMb.toFixed(2)}, total_cost=${totalCost.toFixed(2)}`,
          action: "Downsize instance",
          estimatedMonthlySaving: Math.max(0, totalCost * 0.35),
          risk: "medium",
        });
        classified = true;
      } else if (avgCpu !== null && avgCpu > 75) {
        generated.push({
          ...common,
          category: "compute",
          type: "overutilized_instance",
          problem: "Instance is overutilized and may be undersized.",
          evidence: `state=running, running_hours=${runningHours.toFixed(1)}, avg_cpu=${avgCpu.toFixed(2)}%, total_cost=${totalCost.toFixed(2)}`,
          action: "Upsize instance or investigate workload",
          estimatedMonthlySaving: 0,
          risk: "high",
        });
        classified = true;
      }

      if (!classified && (avgCpu === null || avgDailyNetworkMb === null)) {
        logger.info("EC2 recommendation rule skipped due to missing metrics", {
          tenantId: input.tenantId,
          resourceId: row.instanceId,
          missing: {
            avgCpu: avgCpu === null,
            avgDailyNetworkMb: avgDailyNetworkMb === null,
          },
        });
      }

      if (
        pricingType === "on_demand" &&
        computeCost !== null &&
        computeCost > 5 &&
        activeDays !== null &&
        activeDays >= 3 &&
        !coveredByRi
      ) {
        generated.push({
          ...common,
          category: "pricing",
          type: "uncovered_on_demand",
          problem: "On-demand usage is not covered by RI or Savings Plan.",
          evidence: `running_hours=${runningHours.toFixed(1)}, pricing_type=on_demand, compute_cost=${computeCost.toFixed(2)}, active_days=${activeDays.toFixed(2)}, covered_by_ri_or_sp=false`,
          action: "Consider Reserved Instance or Savings Plan",
          estimatedMonthlySaving: Math.max(0, computeCost * 0.2),
          risk: "low",
        });
      }
    }

    for (const row of volumes) {
      const attachmentId = normalizeOptionalId(row.attachedInstanceId);
      const age = ageDays(row.discoveredAt ?? row.createdAt ?? row.firstSeenAt, input.dateTo);
      const normalizedState = normalize(row.volumeState || row.factState);
      const consideredUnattached = row.isUnattached === true || attachmentId === null;
      if (
        normalizedState === "available" &&
        consideredUnattached &&
        (row.volumeCost ?? 0) > 5 &&
        age !== null
      ) {
        generated.push({
          tenantId: input.tenantId,
          cloudConnectionId: row.cloudConnectionId,
          billingSourceId: row.billingSourceId ?? input.billingSourceId,
          category: "storage",
          type: "unattached_volume",
          resourceType: "ebs_volume",
          resourceId: row.volumeId,
          resourceName: row.volumeName ?? row.volumeId,
          accountId: row.awsAccountId,
          region: row.awsRegionCode,
          problem: "Volume is unattached and incurring cost.",
          evidence: `volume_state=available, attached_instance_id=null, volume_cost=${(row.volumeCost ?? 0).toFixed(2)}, age_days=${age}`,
          action: "Delete volume after backup review",
          currentMonthlyCost: row.volumeCost ?? 0,
          estimatedMonthlySaving: row.volumeCost ?? 0,
          projectedMonthlyCost: 0,
          risk: "low",
          observationStart,
          observationEnd,
          metadata: {
            size_gb: row.sizeGb,
            state: row.volumeState,
            tags: row.tagsJson,
          },
        });
      }
    }

    for (const row of snapshots) {
      const age = ageDays(row.startTime, input.dateTo);
      const protectedSnapshot = hasProtectedTag(row.tagsJson);
      if (age === null) {
        logger.info("Snapshot recommendation skipped due to missing age", {
          tenantId: input.tenantId,
          snapshotId: row.snapshotId,
        });
        continue;
      }
      if (age >= 90 && (row.snapshotCost ?? 0) > 5 && !protectedSnapshot) {
        generated.push({
          tenantId: input.tenantId,
          cloudConnectionId: row.cloudConnectionId,
          billingSourceId: row.billingSourceId ?? input.billingSourceId,
          category: "storage",
          type: "old_snapshot",
          resourceType: "snapshot",
          resourceId: row.snapshotId,
          resourceName: row.snapshotId,
          accountId: row.awsAccountId,
          region: row.awsRegionCode,
          problem: "Snapshot is old and may exceed retention policy.",
          evidence: `snapshot_age_days=${age}, snapshot_cost=${(row.snapshotCost ?? 0).toFixed(2)}, protected=false`,
          action: "Delete snapshot after retention review",
          currentMonthlyCost: row.snapshotCost ?? 0,
          estimatedMonthlySaving: row.snapshotCost ?? 0,
          projectedMonthlyCost: 0,
          risk: "low",
          observationStart,
          observationEnd,
          metadata: {
            state: row.snapshotState,
            snapshot_age_days: age,
            tags: row.tagsJson,
          },
        });
      }
    }

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

    const totals: Ec2RecommendationsResponse["overview"] = {
      totalPotentialMonthlySaving: 0,
      countByCategory: { compute: 0, storage: 0, pricing: 0 },
      savingByCategory: { compute: 0, storage: 0, pricing: 0 },
      countByType: {
        idle_instance: 0,
        underutilized_instance: 0,
        overutilized_instance: 0,
        unattached_volume: 0,
        old_snapshot: 0,
        uncovered_on_demand: 0,
      },
    };

    for (const row of filtered) {
      totals.totalPotentialMonthlySaving += row.estimatedMonthlySaving;
      totals.countByCategory[row.category] += 1;
      totals.savingByCategory[row.category] += row.estimatedMonthlySaving;
      totals.countByType[row.type] += 1;
    }

    return {
      overview: totals,
      recommendations: { compute, storage, pricing },
    };
  }

  async updateStatus(input: { tenantId: string; id: number; status: Ec2RecommendationRecord["status"] }): Promise<boolean> {
    return this.repository.updateRecommendationStatus(input);
  }
}
