import type { EC2ScopeFilters, EC2Thresholds } from "../ec2ExplorerControls.types";

export type EC2InstancesCondition = "all" | "idle" | "underutilized" | "overutilized" | "uncovered";
export type EC2InstancesStateFilter = "all" | "running" | "stopped" | "terminated";
export type EC2InstancesReservationType = "all" | "on_demand" | "reserved" | "savings_plan" | "spot";

export type EC2InstancesControlsState = {
  condition: EC2InstancesCondition;
  state: EC2InstancesStateFilter;
  instanceType: string;
  reservationType: EC2InstancesReservationType;
  scopeFilters: EC2ScopeFilters;
  thresholds: EC2Thresholds;
  search: string;
};

export const EC2_INSTANCES_CONDITION_OPTIONS: Array<{ key: EC2InstancesCondition; label: string }> = [
  { key: "all", label: "All" },
  { key: "idle", label: "Idle" },
  { key: "underutilized", label: "Underutilized" },
  { key: "overutilized", label: "Overutilized" },
  { key: "uncovered", label: "Uncovered" },
];

export const EC2_INSTANCES_STATE_OPTIONS: Array<{ key: EC2InstancesStateFilter; label: string }> = [
  { key: "all", label: "All" },
  { key: "running", label: "Running" },
  { key: "stopped", label: "Stopped" },
  { key: "terminated", label: "Terminated" },
];

export const EC2_INSTANCES_RESERVATION_OPTIONS: Array<{
  key: EC2InstancesReservationType;
  label: string;
}> = [
  { key: "all", label: "All" },
  { key: "on_demand", label: "On-Demand" },
  { key: "reserved", label: "Reserved" },
  { key: "savings_plan", label: "Savings Plan" },
  { key: "spot", label: "Spot" },
];

export const EC2_INSTANCES_DEFAULT_CONTROLS: EC2InstancesControlsState = {
  condition: "all",
  state: "all",
  instanceType: "all",
  reservationType: "all",
  scopeFilters: {
    region: [],
    tags: [],
  },
  thresholds: {
    cpuMin: "",
    cpuMax: "",
    costMin: "",
    costMax: "",
    networkMin: "",
    networkMax: "",
  },
  search: "",
};
