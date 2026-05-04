import type { Ec2SnapshotClassification, Ec2SnapshotSignal } from "./types.js";

export const OLD_SNAPSHOT_AGE_DAYS = 90;

type SnapshotClassifierInput = {
  likelyOrphaned: boolean;
  ageDays: number | null;
};

export const classifySnapshotSignals = (input: SnapshotClassifierInput): Ec2SnapshotClassification => {
  const isOld = input.ageDays !== null && input.ageDays >= OLD_SNAPSHOT_AGE_DAYS;
  const isOrphaned = input.likelyOrphaned;
  if (isOld && isOrphaned) return { primaryCondition: "old", signals: ["old", "orphaned"] };
  if (isOld) return { primaryCondition: "old", signals: ["old"] };
  if (isOrphaned) return { primaryCondition: "orphaned", signals: ["orphaned"] };
  return { primaryCondition: "normal", signals: [] };
};

export const classifySnapshotSignal = (input: SnapshotClassifierInput): Ec2SnapshotSignal => {
  return classifySnapshotSignals(input).primaryCondition;
};
