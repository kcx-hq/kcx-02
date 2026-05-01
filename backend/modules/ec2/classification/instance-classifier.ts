import type { Ec2InstanceCondition } from "./types.js";

export const classifyInstanceCondition = (input: {
  isIdleCandidate: boolean | null | undefined;
  isUnderutilizedCandidate: boolean | null | undefined;
  isOverutilizedCandidate: boolean | null | undefined;
  uncoveredHours: number | null | undefined;
}): Ec2InstanceCondition => {
  if (input.isIdleCandidate === true) return "idle";
  if (input.isUnderutilizedCandidate === true) return "underutilized";
  if (input.isOverutilizedCandidate === true) return "overutilized";
  if ((input.uncoveredHours ?? 0) > 0) return "uncovered";
  return "healthy";
};
