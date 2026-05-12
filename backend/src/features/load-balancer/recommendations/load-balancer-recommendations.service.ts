import { logger } from "../../../utils/logger.js";
import {
  LOAD_BALANCER_RECOMMENDATION_TEMPLATES,
  type LoadBalancerRecommendationType,
} from "./load-balancer-recommendations.types.js";
import { LoadBalancerRecommendationsRepository } from "./load-balancer-recommendations.repository.js";

type RefreshInput = {
  tenantId: string;
  dateFrom: string;
  dateTo: string;
  cloudConnectionId: string | null;
  billingSourceId: number | null;
};

const toMonthlyCost = (totalCost: number, activeDays: number): number => {
  if (!Number.isFinite(totalCost) || totalCost <= 0) return 0;
  if (!Number.isFinite(activeDays) || activeDays <= 0) return totalCost;
  return (totalCost / activeDays) * 30;
};

export class LoadBalancerRecommendationsService {
  private readonly repository: LoadBalancerRecommendationsRepository;

  constructor(
    repository: LoadBalancerRecommendationsRepository = new LoadBalancerRecommendationsRepository(),
  ) {
    this.repository = repository;
  }

  async refreshRecommendations(
    input: RefreshInput,
  ): Promise<{ created: number; updated: number; resolved: number }> {
    if (!input.cloudConnectionId) {
      throw new Error("cloudConnectionId is required for load balancer recommendation refresh");
    }

    logger.info("Load balancer recommendations run started", {
      tenantId: input.tenantId,
      cloudConnectionId: input.cloudConnectionId,
      billingSourceId: input.billingSourceId,
      dateFrom: input.dateFrom,
      dateTo: input.dateTo,
    });

    try {
      const candidates = await this.repository.getCandidates(input);
      const generated: Array<Record<string, unknown>> = [];
      const observationStart = new Date(`${input.dateFrom}T00:00:00.000Z`);
      const observationEnd = new Date(`${input.dateTo}T00:00:00.000Z`);
      const detectorHits: Record<LoadBalancerRecommendationType, number> = {
        idle_load_balancer: 0,
        low_traffic_load_balancer: 0,
        unhealthy_targets: 0,
        high_error_rate: 0,
        high_data_processing_cost: 0,
      };

      for (const row of candidates) {
        const activeDays = Number(row.activeDays ?? 0);
        const totalCost = Number(row.totalCost ?? 0);
        const dataProcessingCost = Number(row.dataProcessingCost ?? 0);
        const requestCount = Number(row.requestCount ?? 0);
        const processedGb = Number(row.processedGb ?? 0);
        const avgActiveConnections = Number(row.avgActiveConnections ?? 0);
        const avgHealthyHosts = Number(row.avgHealthyHosts ?? 0);
        const avgUnhealthyHosts = Number(row.avgUnhealthyHosts ?? 0);
        const maxHealthyHosts = Number(row.maxHealthyHosts ?? 0);
        const maxUnhealthyHosts = Number(row.maxUnhealthyHosts ?? 0);
        const unhealthyDays = Number(row.unhealthyDays ?? 0);
        const errorCount = Number(row.errorCount ?? 0);
        const errorRate = requestCount > 0 ? (errorCount / requestCount) * 100 : 0;
        const dataProcessingCostPercent =
          totalCost > 0 ? (dataProcessingCost / totalCost) * 100 : 0;
        const currentMonthlyCost = Math.max(0, toMonthlyCost(totalCost, activeDays));

        if (activeDays >= 7 && totalCost > 0 && requestCount <= 100 && processedGb <= 0.1 && avgActiveConnections <= 1) {
          const type: LoadBalancerRecommendationType = "idle_load_balancer";
          const template = LOAD_BALANCER_RECOMMENDATION_TEMPLATES[type];
          generated.push({
            tenantId: input.tenantId,
            cloudConnectionId: row.cloudConnectionId ?? input.cloudConnectionId,
            billingSourceId: input.billingSourceId,
            category: template.category,
            type,
            resourceType: "load_balancer",
            resourceId: row.loadBalancerArn,
            resourceName: row.loadBalancerName ?? row.loadBalancerArn,
            accountId: row.accountId,
            region: row.region,
            problem: "Load balancer appears idle while still incurring cost.",
            evidence:
              `active_days=${activeDays}, total_cost=${totalCost.toFixed(2)}, request_count=${requestCount.toFixed(0)}, ` +
              `processed_gb=${processedGb.toFixed(4)}, avg_active_connections=${avgActiveConnections.toFixed(2)}`,
            action: template.action,
            currentMonthlyCost,
            estimatedMonthlySaving: currentMonthlyCost,
            projectedMonthlyCost: 0,
            risk: template.risk,
            effort: template.effort,
            observationStart,
            observationEnd,
            metadata: {
              action_label: template.actionLabel,
              load_balancer_type: row.loadBalancerType,
              load_balancer_state: row.loadBalancerState,
              active_days: activeDays,
              total_cost: totalCost,
              request_count: requestCount,
              processed_gb: processedGb,
              avg_active_connections: avgActiveConnections,
              tags: row.tags,
            },
          });
          detectorHits[type] += 1;
          continue;
        }

        if (
          activeDays >= 14 &&
          totalCost > 0 &&
          requestCount > 100 &&
          requestCount < 10000 &&
          processedGb < 5 &&
          avgActiveConnections < 5
        ) {
          const type: LoadBalancerRecommendationType = "low_traffic_load_balancer";
          const template = LOAD_BALANCER_RECOMMENDATION_TEMPLATES[type];
          const estimatedMonthlySaving = Math.max(0, currentMonthlyCost * 0.5);
          generated.push({
            tenantId: input.tenantId,
            cloudConnectionId: row.cloudConnectionId ?? input.cloudConnectionId,
            billingSourceId: input.billingSourceId,
            category: template.category,
            type,
            resourceType: "load_balancer",
            resourceId: row.loadBalancerArn,
            resourceName: row.loadBalancerName ?? row.loadBalancerArn,
            accountId: row.accountId,
            region: row.region,
            problem: "Load balancer has low traffic relative to ongoing monthly cost.",
            evidence:
              `active_days=${activeDays}, total_cost=${totalCost.toFixed(2)}, request_count=${requestCount.toFixed(0)}, ` +
              `processed_gb=${processedGb.toFixed(4)}, avg_active_connections=${avgActiveConnections.toFixed(2)}`,
            action: template.action,
            currentMonthlyCost,
            estimatedMonthlySaving,
            projectedMonthlyCost: Math.max(0, currentMonthlyCost - estimatedMonthlySaving),
            risk: template.risk,
            effort: template.effort,
            observationStart,
            observationEnd,
            metadata: {
              action_label: template.actionLabel,
              load_balancer_type: row.loadBalancerType,
              load_balancer_state: row.loadBalancerState,
              active_days: activeDays,
              total_cost: totalCost,
              request_count: requestCount,
              processed_gb: processedGb,
              avg_active_connections: avgActiveConnections,
              tags: row.tags,
            },
          });
          detectorHits[type] += 1;
        }

        const unhealthyTargetsTriggered =
          avgUnhealthyHosts > 0 || (maxUnhealthyHosts > 0 && unhealthyDays >= 2);
        if (unhealthyTargetsTriggered) {
          const type: LoadBalancerRecommendationType = "unhealthy_targets";
          const template = LOAD_BALANCER_RECOMMENDATION_TEMPLATES[type];
          const allTargetsUnhealthy =
            maxUnhealthyHosts > 0 && maxHealthyHosts <= 0 && avgHealthyHosts <= 0;
          const risk = allTargetsUnhealthy ? "high" : "medium";
          generated.push({
            tenantId: input.tenantId,
            cloudConnectionId: row.cloudConnectionId ?? input.cloudConnectionId,
            billingSourceId: input.billingSourceId,
            category: template.category,
            type,
            resourceType: "load_balancer",
            resourceId: row.loadBalancerArn,
            resourceName: row.loadBalancerName ?? row.loadBalancerArn,
            accountId: row.accountId,
            region: row.region,
            problem: "Load balancer has unhealthy targets during the observation period.",
            evidence:
              `avg_unhealthy_hosts=${avgUnhealthyHosts.toFixed(4)}, max_unhealthy_hosts=${maxUnhealthyHosts.toFixed(4)}, ` +
              `unhealthy_days=${unhealthyDays}, avg_healthy_hosts=${avgHealthyHosts.toFixed(4)}, max_healthy_hosts=${maxHealthyHosts.toFixed(4)}`,
            action: template.action,
            currentMonthlyCost,
            estimatedMonthlySaving: 0,
            projectedMonthlyCost: currentMonthlyCost,
            risk,
            effort: template.effort,
            observationStart,
            observationEnd,
            metadata: {
              action_label: template.actionLabel,
              load_balancer_type: row.loadBalancerType,
              load_balancer_state: row.loadBalancerState,
              avg_healthy_hosts: avgHealthyHosts,
              avg_unhealthy_hosts: avgUnhealthyHosts,
              max_healthy_hosts: maxHealthyHosts,
              max_unhealthy_hosts: maxUnhealthyHosts,
              unhealthy_days: unhealthyDays,
              all_targets_unhealthy: allTargetsUnhealthy,
              tags: row.tags,
            },
          });
          detectorHits[type] += 1;
        }

        if (errorCount >= 100 && errorRate >= 1) {
          const type: LoadBalancerRecommendationType = "high_error_rate";
          const template = LOAD_BALANCER_RECOMMENDATION_TEMPLATES[type];
          const risk = errorRate >= 5 ? "high" : "medium";
          generated.push({
            tenantId: input.tenantId,
            cloudConnectionId: row.cloudConnectionId ?? input.cloudConnectionId,
            billingSourceId: input.billingSourceId,
            category: template.category,
            type,
            resourceType: "load_balancer",
            resourceId: row.loadBalancerArn,
            resourceName: row.loadBalancerName ?? row.loadBalancerArn,
            accountId: row.accountId,
            region: row.region,
            problem: "Load balancer error rate is elevated.",
            evidence:
              `error_count=${errorCount.toFixed(0)}, request_count=${requestCount.toFixed(0)}, error_rate=${errorRate.toFixed(2)}%, ` +
              `elb_5xx_plus_target_5xx=true`,
            action: template.action,
            currentMonthlyCost,
            estimatedMonthlySaving: 0,
            projectedMonthlyCost: currentMonthlyCost,
            risk,
            effort: template.effort,
            observationStart,
            observationEnd,
            metadata: {
              action_label: template.actionLabel,
              load_balancer_type: row.loadBalancerType,
              load_balancer_state: row.loadBalancerState,
              error_count: errorCount,
              request_count: requestCount,
              error_rate_percent: errorRate,
              tags: row.tags,
            },
          });
          detectorHits[type] += 1;
        }

        if (dataProcessingCost >= 10 && dataProcessingCostPercent >= 30) {
          const type: LoadBalancerRecommendationType = "high_data_processing_cost";
          const template = LOAD_BALANCER_RECOMMENDATION_TEMPLATES[type];
          generated.push({
            tenantId: input.tenantId,
            cloudConnectionId: row.cloudConnectionId ?? input.cloudConnectionId,
            billingSourceId: input.billingSourceId,
            category: template.category,
            type,
            resourceType: "load_balancer",
            resourceId: row.loadBalancerArn,
            resourceName: row.loadBalancerName ?? row.loadBalancerArn,
            accountId: row.accountId,
            region: row.region,
            problem: "Data processing cost is a high share of load balancer spend.",
            evidence:
              `total_cost=${totalCost.toFixed(2)}, data_processing_cost=${dataProcessingCost.toFixed(2)}, ` +
              `data_processing_cost_percentage=${dataProcessingCostPercent.toFixed(2)}%`,
            action: "Review traffic pattern and data processing cost.",
            currentMonthlyCost,
            estimatedMonthlySaving: 0,
            projectedMonthlyCost: currentMonthlyCost,
            risk: template.risk,
            effort: template.effort,
            observationStart,
            observationEnd,
            metadata: {
              action_label: template.actionLabel,
              load_balancer_type: row.loadBalancerType,
              load_balancer_state: row.loadBalancerState,
              total_cost: totalCost,
              data_processing_cost: dataProcessingCost,
              data_processing_cost_percentage: dataProcessingCostPercent,
              tags: row.tags,
            },
          });
          detectorHits[type] += 1;
        }
      }

      logger.info("Load balancer recommendation detectors executed", {
        tenantId: input.tenantId,
        cloudConnectionId: input.cloudConnectionId,
        billingSourceId: input.billingSourceId,
        candidateCount: candidates.length,
        detectorHits,
      });

      const result = await this.repository.upsertGeneratedRecommendations(generated, {
        tenantId: input.tenantId,
        cloudConnectionId: input.cloudConnectionId,
        billingSourceId: input.billingSourceId,
      });

      logger.info("Load balancer recommendation findings upserted", {
        tenantId: input.tenantId,
        cloudConnectionId: input.cloudConnectionId,
        billingSourceId: input.billingSourceId,
        generatedCount: generated.length,
        created: result.created,
        updated: result.updated,
        resolved: result.resolved,
      });

      logger.info("Load balancer recommendations run completed", {
        tenantId: input.tenantId,
        cloudConnectionId: input.cloudConnectionId,
        billingSourceId: input.billingSourceId,
      });

      return result;
    } catch (error) {
      logger.warn("Load balancer recommendations run failed", {
        tenantId: input.tenantId,
        cloudConnectionId: input.cloudConnectionId,
        billingSourceId: input.billingSourceId,
        reason: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }
}
