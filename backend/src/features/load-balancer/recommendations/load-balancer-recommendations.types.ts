export const LOAD_BALANCER_RECOMMENDATION_CATEGORIES = [
  "cost_optimization",
  "reliability",
] as const;
export type LoadBalancerRecommendationCategory =
  (typeof LOAD_BALANCER_RECOMMENDATION_CATEGORIES)[number];

export const LOAD_BALANCER_RECOMMENDATION_TYPES = [
  "idle_load_balancer",
  "low_traffic_load_balancer",
  "unhealthy_targets",
  "high_error_rate",
  "high_data_processing_cost",
] as const;
export type LoadBalancerRecommendationType =
  (typeof LOAD_BALANCER_RECOMMENDATION_TYPES)[number];

export const LOAD_BALANCER_RECOMMENDATION_RISKS = [
  "low",
  "medium",
  "high",
] as const;
export type LoadBalancerRecommendationRisk =
  (typeof LOAD_BALANCER_RECOMMENDATION_RISKS)[number];

export const LOAD_BALANCER_RECOMMENDATION_EFFORTS = [
  "low",
  "medium",
  "high",
] as const;
export type LoadBalancerRecommendationEffort =
  (typeof LOAD_BALANCER_RECOMMENDATION_EFFORTS)[number];

export type LoadBalancerRecommendationTemplate = {
  type: LoadBalancerRecommendationType;
  category: LoadBalancerRecommendationCategory;
  risk: LoadBalancerRecommendationRisk;
  effort: LoadBalancerRecommendationEffort;
  actionLabel: string;
  action: string;
};

export const LOAD_BALANCER_RECOMMENDATION_TEMPLATES: Record<
  LoadBalancerRecommendationType,
  LoadBalancerRecommendationTemplate
> = {
  idle_load_balancer: {
    type: "idle_load_balancer",
    category: "cost_optimization",
    risk: "low",
    effort: "low",
    actionLabel: "Remove Idle Load Balancer",
    action: "Delete unused load balancer after dependency review.",
  },
  low_traffic_load_balancer: {
    type: "low_traffic_load_balancer",
    category: "cost_optimization",
    risk: "medium",
    effort: "medium",
    actionLabel: "Consolidate Low-Traffic Load Balancer",
    action:
      "Consolidate workloads or downgrade architecture to reduce fixed and LCU cost.",
  },
  unhealthy_targets: {
    type: "unhealthy_targets",
    category: "reliability",
    risk: "high",
    effort: "medium",
    actionLabel: "Fix Unhealthy Targets",
    action:
      "Investigate target health checks and restore healthy backend capacity.",
  },
  high_error_rate: {
    type: "high_error_rate",
    category: "reliability",
    risk: "high",
    effort: "medium",
    actionLabel: "Reduce Error Rate",
    action:
      "Investigate 5XX spikes, tune retries/timeouts, and remediate failing targets.",
  },
  high_data_processing_cost: {
    type: "high_data_processing_cost",
    category: "cost_optimization",
    risk: "medium",
    effort: "medium",
    actionLabel: "Reduce Data Processing Cost",
    action:
      "Optimize payload size, cache frequently requested data, and review traffic routing.",
  },
};
