export type LoadBalancerCurCostComponent = "fixed" | "lcu" | "data_processing" | "other";

export type LoadBalancerCurClassifierInput = {
  productProductName?: string | null;
  productName?: string | null;
  serviceName?: string | null;
  serviceCategory?: string | null;
  usageType?: string | null;
  productUsageType?: string | null;
  operation?: string | null;
  lineItemDescription?: string | null;
  lineItemResourceId?: string | null;
  resourceId?: string | null;
  normalizedResourceId?: string | null;
};

export type LoadBalancerCurClassification = {
  isLoadBalancer: boolean;
  costComponent: LoadBalancerCurCostComponent;
  matchedPattern: string | null;
  normalizedResourceId: string | null;
  resourceArn: string | null;
};

const normalize = (value: string | null | undefined): string => String(value ?? "").trim().toLowerCase();

const cleanOrNull = (value: string | null | undefined): string | null => {
  const trimmed = String(value ?? "").trim();
  return trimmed.length > 0 ? trimmed : null;
};

const includesAny = (text: string, patterns: readonly string[]): string | null => {
  for (const pattern of patterns) {
    if (text.includes(pattern)) return pattern;
  }
  return null;
};

const LB_SERVICE_PATTERNS = [
  "amazon elastic load balancing",
  "amazon elastic load balancer",
  "elastic load balancing",
  "elastic load balancer",
  "awselasticloadbalancing",
] as const;

const LB_USAGE_PATTERNS = [
  "loadbalancerusage",
  "lcuusage",
  "processedbytes",
  "dataprocessing-bytes",
  "loadbalancing",
  "elasticloadbalancing",
  "elb",
  "alb",
  "nlb",
] as const;

const DATA_PROCESSING_PATTERNS = ["processedbytes", "dataprocessing-bytes"] as const;
const LCU_PATTERNS = ["lcuusage", "lcu"] as const;
const FIXED_PATTERNS = ["loadbalancerusage"] as const;

const extractFirstLoadBalancerArn = (value: string | null): string | null => {
  if (!value) return null;

  const arnMatch = value.match(/arn:aws[a-z-]*:elasticloadbalancing:[^,\s]+/i);
  return arnMatch ? arnMatch[0] : null;
};

const resolveNormalizedResourceId = (input: LoadBalancerCurClassifierInput): string | null =>
  cleanOrNull(input.normalizedResourceId) ?? cleanOrNull(input.lineItemResourceId) ?? cleanOrNull(input.resourceId);

const resolveResourceArn = (input: LoadBalancerCurClassifierInput, normalizedResourceId: string | null): string | null =>
  extractFirstLoadBalancerArn(cleanOrNull(input.lineItemResourceId))
  ?? extractFirstLoadBalancerArn(cleanOrNull(input.resourceId))
  ?? extractFirstLoadBalancerArn(normalizedResourceId);

export const classifyLoadBalancerCurLineItem = (
  input: LoadBalancerCurClassifierInput,
): LoadBalancerCurClassification => {
  const serviceBlob = [
    normalize(input.productProductName),
    normalize(input.productName),
    normalize(input.serviceName),
    normalize(input.serviceCategory),
  ].join(" ");

  const usageBlob = [
    normalize(input.usageType),
    normalize(input.productUsageType),
    normalize(input.operation),
    normalize(input.lineItemDescription),
  ].join(" ");

  const normalizedResourceId = resolveNormalizedResourceId(input);
  const resourceArn = resolveResourceArn(input, normalizedResourceId);

  const servicePattern = includesAny(serviceBlob, LB_SERVICE_PATTERNS);
  const usagePattern = includesAny(usageBlob, LB_USAGE_PATTERNS);
  const isLoadBalancer = Boolean(servicePattern || usagePattern || resourceArn);

  if (!isLoadBalancer) {
    return {
      isLoadBalancer: false,
      costComponent: "other",
      matchedPattern: null,
      normalizedResourceId,
      resourceArn,
    };
  }

  const dataPattern = includesAny(usageBlob, DATA_PROCESSING_PATTERNS);
  if (dataPattern) {
    return {
      isLoadBalancer: true,
      costComponent: "data_processing",
      matchedPattern: dataPattern,
      normalizedResourceId,
      resourceArn,
    };
  }

  const lcuPattern = includesAny(usageBlob, LCU_PATTERNS);
  if (lcuPattern) {
    return {
      isLoadBalancer: true,
      costComponent: "lcu",
      matchedPattern: lcuPattern,
      normalizedResourceId,
      resourceArn,
    };
  }

  const fixedPattern = includesAny(usageBlob, FIXED_PATTERNS);
  if (fixedPattern) {
    return {
      isLoadBalancer: true,
      costComponent: "fixed",
      matchedPattern: fixedPattern,
      normalizedResourceId,
      resourceArn,
    };
  }

  return {
    isLoadBalancer: true,
    costComponent: "other",
    matchedPattern: servicePattern ?? usagePattern ?? (resourceArn ? "elasticloadbalancing:arn" : null),
    normalizedResourceId,
    resourceArn,
  };
};

