import { logger } from "../../../utils/logger.js";
import { Ec2RecommendationsRepository } from "./ec2-recommendations.repository.js";
import type {
  Ec2RecommendationRecord,
  Ec2RecommendationType,
  Ec2RecommendationsQuery,
  Ec2RecommendationsResponse,
  Ec2RefreshRecommendationsInput,
} from "./ec2-recommendations.types.js";
import { classifyExplorerCostCategory } from "../classification/cost-category-classifier.js";
import { classifyDataTransferSignals } from "../classification/data-transfer-classifier.js";
import { classifyInstanceSignals } from "../classification/instance-classifier.js";
import { classifyVolumeSignals } from "../classification/volume-classifier.js";
import { classifySnapshotSignals } from "../classification/snapshot-classifier.js";
import { classifyElasticIpSignals } from "../classification/elastic-ip-classifier.js";

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

const mapTypeToCategory = (type: Ec2RecommendationType): "compute" | "storage" | "pricing" | "network" => {
  if (type === "unattached_volume" || type === "old_snapshot" || type === "orphaned_snapshot") return "storage";
  if (type === "uncovered_on_demand") return "pricing";
  if (
    type === "high_internet_data_transfer" ||
    type === "high_inter_region_data_transfer" ||
    type === "high_inter_az_data_transfer" ||
    type === "low_cpu_high_network" ||
    type === "high_nat_gateway_cost" ||
    type === "unattached_elastic_ip"
  ) return "network";
  return "compute";
};

export class Ec2RecommendationsService {
  private readonly repository: Ec2RecommendationsRepository;

  constructor(repository: Ec2RecommendationsRepository = new Ec2RecommendationsRepository()) {
    this.repository = repository;
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

      const instanceSignals = classifyInstanceSignals({
        isIdleCandidate: null,
        isUnderutilizedCandidate: null,
        isOverutilizedCandidate: null,
        uncoveredHours: null,
        avgCpu,
        avgDailyNetworkMb,
        pricingType,
        coveredHours: row.coveredHours,
        totalHours: runningHours,
        runningHours,
        runningDays: activeDays,
        computeCost,
        totalCost,
      });
      let classified = false;
      if (instanceSignals.primaryCondition === "idle") {
        generated.push({
          ...common,
          category: "compute",
          type: "idle_instance",
          problem: "Instance appears idle while running.",
          evidence: `state=running, running_hours=${runningHours.toFixed(1)}, avg_cpu=${(avgCpu ?? 0).toFixed(2)}%, avg_daily_network_mb=${(avgDailyNetworkMb ?? 0).toFixed(2)}, total_cost=${totalCost.toFixed(2)}`,
          action: "Stop or terminate instance",
          estimatedMonthlySaving: totalCost,
          risk: "low",
          effort: "low",
        });
        classified = true;
      } else if (instanceSignals.primaryCondition === "underutilized") {
        generated.push({
          ...common,
          category: "compute",
          type: "underutilized_instance",
          problem: "Instance is underutilized for current sizing.",
          evidence: `state=running, running_hours=${runningHours.toFixed(1)}, avg_cpu=${(avgCpu ?? 0).toFixed(2)}%, avg_daily_network_mb=${(avgDailyNetworkMb ?? 0).toFixed(2)}, total_cost=${totalCost.toFixed(2)}`,
          action: "Downsize instance",
          estimatedMonthlySaving: Math.max(0, totalCost * 0.35),
          risk: "medium",
          effort: "medium",
        });
        classified = true;
      } else if (instanceSignals.primaryCondition === "overutilized") {
        generated.push({
          ...common,
          category: "compute",
          type: "overutilized_instance",
          problem: "Instance is overutilized and may be undersized.",
          evidence: `state=running, running_hours=${runningHours.toFixed(1)}, avg_cpu=${(avgCpu ?? 0).toFixed(2)}%, total_cost=${totalCost.toFixed(2)}`,
          action: "Upsize instance or investigate workload",
          estimatedMonthlySaving: 0,
          risk: "high",
          effort: "medium",
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

      if (instanceSignals.signals.includes("uncovered_on_demand") && computeCost !== null && computeCost > 5 && activeDays !== null && activeDays >= 3) {
        generated.push({
          ...common,
          category: "pricing",
          type: "uncovered_on_demand",
          problem: "On-demand usage is not covered by RI or Savings Plan.",
          evidence: `running_hours=${runningHours.toFixed(1)}, pricing_type=on_demand, compute_cost=${computeCost.toFixed(2)}, active_days=${activeDays.toFixed(2)}, covered_by_ri_or_sp=false`,
          action: "Consider Reserved Instance or Savings Plan",
          estimatedMonthlySaving: Math.max(0, computeCost * 0.2),
          risk: "low",
          effort: "low",
        });
      }
    }

    for (const row of volumes) {
      const attachmentId = normalizeOptionalId(row.attachedInstanceId);
      const age = ageDays(row.discoveredAt ?? row.createdAt ?? row.firstSeenAt, input.dateTo);
      const normalizedState = normalize(row.volumeState || row.factState);
      const classifiedVolume = classifyVolumeSignals({
        isAttached: !(row.isUnattached === true || attachmentId === null),
        attachedInstanceState: row.attachedInstanceState,
        isIdleCandidate: false,
        isUnderutilizedCandidate: false,
        volumeReadOps: row.avgReadOps,
        volumeWriteOps: row.avgWriteOps,
        volumeReadBytes: row.avgReadBytes,
        volumeWriteBytes: row.avgWriteBytes,
        volumeCost: row.volumeCost,
      });
      if (
        normalizedState === "available" &&
        classifiedVolume.signals.includes("unattached") &&
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
          effort: "low",
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
      const snapshotSignals = classifySnapshotSignals({
        likelyOrphaned:
          row.sourceVolumeId === null ||
          row.hasActiveSourceVolume === false ||
          row.sourceVolumeDeletedAt !== null ||
          normalize(row.sourceVolumeState) === "deleted" ||
          normalize(row.sourceVolumeState) === "deleting" ||
          normalize(row.sourceVolumeState) === "unavailable" ||
          normalize(row.sourceVolumeState) === "error" ||
          normalize(row.sourceVolumeState) === "failed",
        ageDays: age,
      });

      if ((row.snapshotCost ?? 0) <= 5 || protectedSnapshot) {
        continue;
      }

      const isOrphaned = snapshotSignals.signals.includes("orphaned");
      const isOld = snapshotSignals.signals.includes("old");
      if (!isOrphaned && !isOld) {
        continue;
      }

      const recommendationType: Ec2RecommendationType = isOrphaned
        ? "orphaned_snapshot"
        : "old_snapshot";

      if (recommendationType === "orphaned_snapshot") {
        generated.push({
          tenantId: input.tenantId,
          cloudConnectionId: row.cloudConnectionId,
          billingSourceId: row.billingSourceId ?? input.billingSourceId,
          category: "storage",
          type: "orphaned_snapshot",
          resourceType: "snapshot",
          resourceId: row.snapshotId,
          resourceName: "Orphaned Snapshot",
          accountId: row.awsAccountId,
          region: row.awsRegionCode,
          problem: "Snapshot source volume is missing or no longer active",
          evidence: `snapshot_age_days=${age}, snapshot_cost=${(row.snapshotCost ?? 0).toFixed(2)}, source_volume_id=${row.sourceVolumeId ?? "null"}, source_volume_state=${row.sourceVolumeState ?? "null"}, has_active_source_volume=${row.hasActiveSourceVolume === true ? "true" : "false"}, protected=false`,
          action: "Delete snapshot after retention review",
          currentMonthlyCost: row.snapshotCost ?? 0,
          estimatedMonthlySaving: row.snapshotCost ?? 0,
          projectedMonthlyCost: 0,
          risk: "low",
          effort: "low",
          observationStart,
          observationEnd,
          metadata: {
            state: row.snapshotState,
            snapshot_age_days: age,
            source_volume_id: row.sourceVolumeId,
            source_volume_state: row.sourceVolumeState,
            has_active_source_volume: row.hasActiveSourceVolume,
            source_volume_deleted_at: row.sourceVolumeDeletedAt?.toISOString?.() ?? null,
            classifier_primary_condition: snapshotSignals.primaryCondition,
            classifier_signals: snapshotSignals.signals,
            tags: row.tagsJson,
          },
        });
        continue;
      }

      if (recommendationType === "old_snapshot") {
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
          effort: "low",
          observationStart,
          observationEnd,
          metadata: {
            state: row.snapshotState,
            snapshot_age_days: age,
            source_volume_id: row.sourceVolumeId,
            source_volume_state: row.sourceVolumeState,
            has_active_source_volume: row.hasActiveSourceVolume,
            source_volume_deleted_at: row.sourceVolumeDeletedAt?.toISOString?.() ?? null,
            classifier_primary_condition: snapshotSignals.primaryCondition,
            classifier_signals: snapshotSignals.signals,
            tags: row.tagsJson,
          },
        });
      }
    }

    const perInstanceNetwork = new Map<
      string,
      {
        common: {
          cloudConnectionId: string | null;
          billingSourceId: number | null;
          awsAccountId: string | null;
          awsRegionCode: string | null;
          instanceId: string;
          instanceName: string;
        };
        totalsByType: Map<string, { cost: number; usageGb: number; fromRegion: string | null; toRegion: string | null }>;
        totalNetworkCost: number;
      }
    >();
    for (const row of networkLineItems) {
      const explorerCategory = classifyExplorerCostCategory({
        usageType: row.usageType,
        productUsageType: row.productUsageType,
        productFamily: row.productFamily,
        operation: row.operation,
        lineItemDescription: row.lineItemDescription,
        fromLocation: row.fromLocation,
        toLocation: row.toLocation,
        fromRegionCode: row.fromRegionCode,
        toRegionCode: row.toRegionCode,
      });
      let networkType: "Internet Data Transfer" | "Inter-Region Data Transfer" | "Inter-AZ Data Transfer" | "NAT Gateway" | "Other Network" = "Other Network";
      if (explorerCategory === "nat_gateway") {
        networkType = "NAT Gateway";
      } else if (explorerCategory === "data_transfer") {
        const transfer = classifyDataTransferSignals({
          usageType: row.usageType,
          productUsageType: row.productUsageType,
          productFamily: row.productFamily,
          operation: row.operation,
          lineItemDescription: row.lineItemDescription,
          fromLocation: row.fromLocation,
          toLocation: row.toLocation,
          fromRegionCode: row.fromRegionCode,
          toRegionCode: row.toRegionCode,
        }).transferType;
        if (transfer === "internet") networkType = "Internet Data Transfer";
        else if (transfer === "inter_region") networkType = "Inter-Region Data Transfer";
        else if (transfer === "inter_az") networkType = "Inter-AZ Data Transfer";
      }
      if (networkType === "Other Network") continue;
      const key = `${row.cloudConnectionId ?? ""}::${row.billingSourceId ?? ""}::${row.instanceId}`;
      const existing = perInstanceNetwork.get(key) ?? {
        common: {
          cloudConnectionId: row.cloudConnectionId,
          billingSourceId: row.billingSourceId ?? input.billingSourceId,
          awsAccountId: row.awsAccountId,
          awsRegionCode: row.awsRegionCode,
          instanceId: row.instanceId,
          instanceName: row.instanceName ?? row.instanceId,
        },
        totalsByType: new Map(),
        totalNetworkCost: 0,
      };
      const usageGb = Math.max(0, row.usageQuantity ?? 0);
      const metric = existing.totalsByType.get(networkType) ?? { cost: 0, usageGb: 0, fromRegion: null, toRegion: null };
      metric.cost += Math.max(0, row.cost ?? 0);
      metric.usageGb += usageGb;
      metric.fromRegion = metric.fromRegion ?? row.fromRegionCode;
      metric.toRegion = metric.toRegion ?? row.toRegionCode;
      existing.totalsByType.set(networkType, metric);
      existing.totalNetworkCost += Math.max(0, row.cost ?? 0);
      perInstanceNetwork.set(key, existing);
    }

    for (const [, value] of perInstanceNetwork) {
      const totalNetworkCost = Math.max(0, value.totalNetworkCost);
      const mkBase = (type: string, problem: string, action: string, estimatedMonthlySaving: number, risk: "low" | "medium") => {
        const metric = value.totalsByType.get(type);
        if (!metric) return null;
        const percent = totalNetworkCost > 0 ? (metric.cost / totalNetworkCost) * 100 : 0;
        return {
          tenantId: input.tenantId,
          cloudConnectionId: value.common.cloudConnectionId,
          billingSourceId: value.common.billingSourceId,
          category: "network",
          resourceType: "ec2_instance",
          resourceId: value.common.instanceId,
          resourceName: value.common.instanceName,
          accountId: value.common.awsAccountId,
          region: value.common.awsRegionCode,
          problem,
          action,
          currentMonthlyCost: metric.cost,
          estimatedMonthlySaving: Math.max(0, estimatedMonthlySaving),
          projectedMonthlyCost: Math.max(0, metric.cost - estimatedMonthlySaving),
          risk,
          effort: "medium",
          observationStart,
          observationEnd,
          metadata: {
            network_type: type,
            cost: metric.cost,
            usage_gb: metric.usageGb,
            percent_of_network_cost: percent,
            from_region: metric.fromRegion,
            to_region: metric.toRegion,
          },
        };
      };

      const internet = value.totalsByType.get("Internet Data Transfer");
      if (internet) {
        const internetPct = totalNetworkCost > 0 ? (internet.cost / totalNetworkCost) * 100 : 0;
        if (internet.cost >= 10 || internetPct >= 30 || internet.usageGb >= 50) {
          const rec = mkBase(
            "Internet Data Transfer",
            "High internet data transfer cost detected.",
            "Use CDN/caching, reduce public egress, compress payloads, or move frequent consumers closer to the workload.",
            internet.cost * 0.3,
            "low",
          );
          if (rec) generated.push({ ...rec, type: "high_internet_data_transfer", evidence: `Internet transfer cost=${internet.cost.toFixed(2)}, usage_gb=${internet.usageGb.toFixed(2)}, percent_of_network_cost=${internetPct.toFixed(2)}%` });
        }
      }

      const interRegion = value.totalsByType.get("Inter-Region Data Transfer");
      if (interRegion) {
        const interRegionPct = totalNetworkCost > 0 ? (interRegion.cost / totalNetworkCost) * 100 : 0;
        if (interRegion.cost >= 5 || interRegionPct >= 20 || interRegion.usageGb >= 25) {
          const rec = mkBase(
            "Inter-Region Data Transfer",
            "Cross-region data transfer detected.",
            "Co-locate dependent services in the same region, reduce cross-region calls, or replicate/cache data closer to consumers.",
            interRegion.cost * 0.4,
            "medium",
          );
          if (rec) generated.push({ ...rec, type: "high_inter_region_data_transfer", evidence: `Inter-region transfer cost=${interRegion.cost.toFixed(2)}, usage_gb=${interRegion.usageGb.toFixed(2)}, from_region=${interRegion.fromRegion ?? "-"}, to_region=${interRegion.toRegion ?? "-"}, percent_of_network_cost=${interRegionPct.toFixed(2)}%` });
        }
      }

      const interAz = value.totalsByType.get("Inter-AZ Data Transfer");
      if (interAz) {
        const interAzPct = totalNetworkCost > 0 ? (interAz.cost / totalNetworkCost) * 100 : 0;
        if (interAz.cost >= 5 || interAzPct >= 20 || interAz.usageGb >= 25) {
          const rec = mkBase(
            "Inter-AZ Data Transfer",
            "Cross-AZ data transfer detected.",
            "Review AZ placement, reduce chatty cross-AZ communication, or place dependent workloads closer together where resilience requirements allow.",
            interAz.cost * 0.25,
            "medium",
          );
          if (rec) generated.push({ ...rec, type: "high_inter_az_data_transfer", evidence: `Inter-AZ transfer cost=${interAz.cost.toFixed(2)}, usage_gb=${interAz.usageGb.toFixed(2)}, percent_of_network_cost=${interAzPct.toFixed(2)}%` });
        }
      }

      const nat = value.totalsByType.get("NAT Gateway");
      if (nat) {
        const natPct = totalNetworkCost > 0 ? (nat.cost / totalNetworkCost) * 100 : 0;
        if (nat.cost >= 10 || natPct >= 20) {
          const rec = mkBase(
            "NAT Gateway",
            "NAT Gateway cost is significant.",
            "Evaluate VPC endpoints for AWS service traffic, reduce private subnet egress through NAT, or review NAT architecture.",
            nat.cost * 0.3,
            "medium",
          );
          if (rec) generated.push({ ...rec, type: "high_nat_gateway_cost", evidence: `NAT Gateway cost=${nat.cost.toFixed(2)}, usage_gb=${nat.usageGb.toFixed(2)}, percent_of_network_cost=${natPct.toFixed(2)}%` });
        }
      }
    }

    for (const row of usageSummaries) {
      const isRunning = normalize(row.state) === "running";
      const avgCpu = row.avgCpu ?? 0;
      const totalNetworkUsageGb = row.totalNetworkUsageGb ?? 0;
      const totalEffectiveCost = row.totalEffectiveCost ?? 0;
      if (!isRunning || avgCpu >= 5 || totalNetworkUsageGb < 10 || totalEffectiveCost < 5) continue;
      generated.push({
        tenantId: input.tenantId,
        cloudConnectionId: row.cloudConnectionId,
        billingSourceId: row.billingSourceId ?? input.billingSourceId,
        category: "network",
        type: "low_cpu_high_network",
        resourceType: "ec2_instance",
        resourceId: row.instanceId,
        resourceName: row.instanceName ?? row.instanceId,
        accountId: row.awsAccountId,
        region: row.awsRegionCode,
        problem: "Low CPU with high network activity.",
        evidence: `avg_cpu=${avgCpu.toFixed(2)}%, total_network_usage_gb=${totalNetworkUsageGb.toFixed(2)}, total_cost=${totalEffectiveCost.toFixed(2)}, running_days=${(row.runningDays ?? 0).toFixed(0)}`,
        action: "Investigate whether the instance is acting as a proxy, relay, stale service, or unnecessary network endpoint. Consider consolidating, shutting down, or replacing with a managed service.",
        currentMonthlyCost: totalEffectiveCost,
        estimatedMonthlySaving: Math.max(0, totalEffectiveCost * 0.2),
        projectedMonthlyCost: Math.max(0, totalEffectiveCost * 0.8),
        risk: "medium",
        effort: "medium",
        observationStart,
        observationEnd,
        metadata: {
          avg_cpu: avgCpu,
          network_usage_gb: totalNetworkUsageGb,
          total_effective_cost: totalEffectiveCost,
          running_days: row.runningDays ?? 0,
        },
      });
    }

    for (const row of eipCandidates) {
      const classificationBlob = [row.allocationId, row.publicIp, row.associationStatus, row.isAttached ? "attached" : "unattached"].filter(Boolean).join(" ");
      const eipSignals = classifyElasticIpSignals(classificationBlob);
      if (!eipSignals.signals.includes("unattached")) continue;
      const cost = (row.estimatedEipCost ?? 0) > 0 ? (row.estimatedEipCost ?? 0) : 3.6;
      generated.push({
        tenantId: input.tenantId,
        cloudConnectionId: row.cloudConnectionId,
        billingSourceId: row.billingSourceId ?? input.billingSourceId,
        category: "network",
        type: "unattached_elastic_ip",
        resourceType: "elastic_ip",
        resourceId: row.allocationId || row.publicIp || "unknown_eip",
        resourceName: row.publicIp ?? row.allocationId,
        accountId: row.awsAccountId,
        region: row.awsRegionCode,
        problem: "Unattached Elastic IP detected.",
        evidence: `public_ip=${row.publicIp ?? "-"}, allocation_id=${row.allocationId}, region=${row.awsRegionCode ?? "-"}, estimated_cost=${cost.toFixed(2)}`,
        action: "Release unused Elastic IP address.",
        currentMonthlyCost: cost,
        estimatedMonthlySaving: cost,
        projectedMonthlyCost: 0,
        risk: "low",
        effort: "low",
        observationStart,
        observationEnd,
        metadata: {
          allocation_id: row.allocationId,
          public_ip: row.publicIp,
          region: row.awsRegionCode,
          eip_cost: row.estimatedEipCost ?? null,
          association_status: row.associationStatus,
          is_attached: row.isAttached,
        },
      });
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
    const network = filtered.filter((row) => row.category === "network");

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
      recommendations: { compute, storage, pricing, network },
    };
  }

  async updateStatus(input: { tenantId: string; id: number; status: Ec2RecommendationRecord["status"] }): Promise<boolean> {
    return this.repository.updateRecommendationStatus(input);
  }
}
