import type { Ec2SnapshotSignal } from "./types.js";

export const OLD_SNAPSHOT_AGE_DAYS = 90;

export const classifySnapshotSignal = (input: {
  likelyOrphaned: boolean;
  ageDays: number | null;
}): Ec2SnapshotSignal => {
  if (input.ageDays !== null && input.ageDays >= OLD_SNAPSHOT_AGE_DAYS) return "old";
  if (input.likelyOrphaned) return "orphaned";
  return "normal";
};
