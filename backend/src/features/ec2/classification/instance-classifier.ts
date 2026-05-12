import type { Ec2InstanceClassification, Ec2InstanceCondition, Ec2InstancePricingCondition, Ec2InstanceSignal } from "./types.js";

type InstanceClassifierInput = {
  isIdleCandidate: boolean | null | undefined;
  isUnderutilizedCandidate: boolean | null | undefined;
  isOverutilizedCandidate: boolean | null | undefined;
  uncoveredHours: number | null | undefined;
  avgCpu?: number | null | undefined;
  avgDailyNetworkMb?: number | null | undefined;
  pricingType?: string | null | undefined;
  coveredHours?: number | null | undefined;
  totalHours?: number | null | undefined;
  runningHours?: number | null | undefined;
  runningDays?: number | null | undefined;
  computeCost?: number | null | undefined;
  totalCost?: number | null | undefined;
  reservationType?: string | null | undefined;
  pricingModel?: string | null | undefined;
};

const MIN_RUNNING_HOURS = 24;
const MEANINGFUL_COST_THRESHOLD = 5;

const hasUncoveredHours = (uncoveredHours: number | null | undefined): boolean => (uncoveredHours ?? 0) > 0;

const toMetricBackedBoolean = (input: InstanceClassifierInput): {
  isIdleCandidate: boolean;
  isUnderutilizedCandidate: boolean;
  isOverutilizedCandidate: boolean;
  uncoveredHours: number;
} => {
  const avgCpu = input.avgCpu ?? null;
  const avgDailyNetworkMb = input.avgDailyNetworkMb ?? null;
  const runningHours = input.runningHours ?? input.totalHours ?? 0;
  const totalCost = input.totalCost ?? input.computeCost ?? 0;
  const hasUtilizationGuard = runningHours >= MIN_RUNNING_HOURS && totalCost > MEANINGFUL_COST_THRESHOLD;
  const metricIdle = hasUtilizationGuard && avgCpu !== null && avgDailyNetworkMb !== null && avgCpu < 5 && avgDailyNetworkMb < 100;
  const metricUnderutilized = hasUtilizationGuard && avgCpu !== null && avgDailyNetworkMb !== null && avgCpu >= 5 && avgCpu < 20 && avgDailyNetworkMb < 1024;
  const metricOverutilized = hasUtilizationGuard && avgCpu !== null && avgCpu > 75;
  const normalizedPricing = (input.pricingType ?? input.reservationType ?? input.pricingModel ?? "").trim().toLowerCase();
  const runningDays = input.runningDays ?? (runningHours > 0 ? runningHours / 24 : 0);
  const coveredHours = input.coveredHours ?? 0;
  const uncoveredFromCoverage = runningHours > 0 ? Math.max(0, runningHours - coveredHours) : 0;
  const coverageUncoveredHours =
    input.uncoveredHours ??
    (normalizedPricing === "on_demand" && runningHours >= MIN_RUNNING_HOURS && runningDays > 1 && (input.computeCost ?? 0) > MEANINGFUL_COST_THRESHOLD && uncoveredFromCoverage > 0
      ? uncoveredFromCoverage
      : 0);

  return {
    isIdleCandidate: input.isIdleCandidate ?? metricIdle,
    isUnderutilizedCandidate: input.isUnderutilizedCandidate ?? metricUnderutilized,
    isOverutilizedCandidate: input.isOverutilizedCandidate ?? metricOverutilized,
    uncoveredHours: coverageUncoveredHours ?? 0,
  };
};

const getPrimaryCondition = (input: InstanceClassifierInput): Ec2InstanceClassification["primaryCondition"] => {
  const normalized = toMetricBackedBoolean(input);
  if (normalized.isIdleCandidate === true) return "idle";
  if (normalized.isUnderutilizedCandidate === true) return "underutilized";
  if (normalized.isOverutilizedCandidate === true) return "overutilized";
  return "healthy";
};

const getPricingCondition = (input: InstanceClassifierInput): Ec2InstancePricingCondition => {
  const normalizedPricing = (input.pricingType ?? input.reservationType ?? input.pricingModel ?? "").trim().toLowerCase();
  if (!normalizedPricing) return "unknown";
  return hasUncoveredHours(toMetricBackedBoolean(input).uncoveredHours) ? "uncovered_on_demand" : "covered";
};

export const classifyInstanceSignals = (input: InstanceClassifierInput): Ec2InstanceClassification => {
  const signals: Ec2InstanceSignal[] = [];
  const primaryCondition = getPrimaryCondition(input);
  if (primaryCondition !== "healthy") {
    signals.push(primaryCondition);
  }

  const pricingCondition = getPricingCondition(input);
  if (pricingCondition === "uncovered_on_demand") {
    signals.push("uncovered_on_demand");
  }

  return {
    primaryCondition,
    signals,
    pricingCondition,
  };
};

export const classifyInstanceCondition = (input: InstanceClassifierInput): Ec2InstanceCondition => {
  const classified = classifyInstanceSignals(input);
  if (classified.primaryCondition !== "healthy") return classified.primaryCondition;
  if (classified.pricingCondition === "uncovered_on_demand") return "uncovered";
  return "healthy";
};
