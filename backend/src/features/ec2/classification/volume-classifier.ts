import type { Ec2VolumeClassification, Ec2VolumeSignal } from "./types.js";

type VolumeClassifierInput = {
  isAttached: boolean | null | undefined;
  attachedInstanceState: string | null | undefined;
  isIdleCandidate: boolean | null | undefined;
  isUnderutilizedCandidate: boolean | null | undefined;
};

export const classifyVolumeSignals = (input: VolumeClassifierInput): Ec2VolumeClassification => {
  const attached = input.isAttached === true;
  const instanceState = (input.attachedInstanceState ?? "").trim().toLowerCase();
  const signals: Ec2VolumeClassification["signals"] = [];
  if (!attached) signals.push("unattached");
  if (attached && instanceState === "stopped") signals.push("attached_stopped");
  if (attached && input.isIdleCandidate === true) signals.push("idle");
  if (attached && input.isUnderutilizedCandidate === true) signals.push("underutilized");

  let primaryCondition: Ec2VolumeSignal = "normal";
  if (signals.includes("unattached")) primaryCondition = "unattached";
  else if (signals.includes("attached_stopped")) primaryCondition = "attached_stopped";
  else if (signals.includes("idle")) primaryCondition = "idle";
  else if (signals.includes("underutilized")) primaryCondition = "underutilized";

  return { primaryCondition, signals };
};

export const classifyVolumeSignal = (input: VolumeClassifierInput): Ec2VolumeSignal => {
  return classifyVolumeSignals(input).primaryCondition;
};
