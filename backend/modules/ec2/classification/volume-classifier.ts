import type { Ec2VolumeSignal } from "./types.js";

export const classifyVolumeSignal = (input: {
  isAttached: boolean | null | undefined;
  attachedInstanceState: string | null | undefined;
  isIdleCandidate: boolean | null | undefined;
  isUnderutilizedCandidate: boolean | null | undefined;
}): Ec2VolumeSignal => {
  const attached = input.isAttached === true;
  const instanceState = (input.attachedInstanceState ?? "").trim().toLowerCase();
  if (!attached) return "unattached";
  if (attached && instanceState === "stopped") return "attached_stopped";
  if (input.isIdleCandidate === true) return "idle";
  if (input.isUnderutilizedCandidate === true) return "underutilized";
  return "normal";
};
