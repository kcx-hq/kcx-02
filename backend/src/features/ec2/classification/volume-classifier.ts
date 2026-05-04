import type { Ec2VolumeClassification, Ec2VolumeSignal } from "./types.js";

type VolumeClassifierInput = {
  isAttached: boolean | null | undefined;
  attachedInstanceState: string | null | undefined;
  isIdleCandidate: boolean | null | undefined;
  isUnderutilizedCandidate: boolean | null | undefined;
  volumeReadOps?: number | null | undefined;
  volumeWriteOps?: number | null | undefined;
  volumeReadBytes?: number | null | undefined;
  volumeWriteBytes?: number | null | undefined;
  volumeCost?: number | null | undefined;
};

const LOW_UTILIZATION_MAX_OPS = 100;
const LOW_UTILIZATION_MAX_BYTES = 1024 * 1024 * 1024; // 1 GiB
const LOW_UTILIZATION_MIN_COST = 5;

const isFiniteNumber = (value: number | null | undefined): value is number =>
  typeof value === "number" && Number.isFinite(value);

export const classifyVolumeSignals = (input: VolumeClassifierInput): Ec2VolumeClassification => {
  const attached = input.isAttached === true;
  const instanceState = (input.attachedInstanceState ?? "").trim().toLowerCase();
  const lowUtilization =
    attached &&
    instanceState === "running" &&
    isFiniteNumber(input.volumeReadOps) &&
    isFiniteNumber(input.volumeWriteOps) &&
    isFiniteNumber(input.volumeReadBytes) &&
    isFiniteNumber(input.volumeWriteBytes) &&
    isFiniteNumber(input.volumeCost) &&
    input.volumeReadOps <= LOW_UTILIZATION_MAX_OPS &&
    input.volumeWriteOps <= LOW_UTILIZATION_MAX_OPS &&
    input.volumeReadBytes <= LOW_UTILIZATION_MAX_BYTES &&
    input.volumeWriteBytes <= LOW_UTILIZATION_MAX_BYTES &&
    input.volumeCost > LOW_UTILIZATION_MIN_COST;

  const signals: Ec2VolumeClassification["signals"] = [];
  if (!attached) signals.push("unattached");
  if (attached && instanceState === "stopped") signals.push("attached_stopped");
  if (attached && input.isIdleCandidate === true) signals.push("idle");
  if (attached && input.isUnderutilizedCandidate === true) signals.push("underutilized");
  if (lowUtilization) signals.push("low_utilization");

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
