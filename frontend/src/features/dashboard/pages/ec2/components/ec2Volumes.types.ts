import type { EC2CompareOption, EC2ScopeFilters } from "../ec2ExplorerControls.types";

export type EC2VolumesStateFilter = "all" | "in-use" | "available";
export type EC2VolumesTypeFilter = "all" | "gp2" | "gp3" | "io1" | "io2" | "st1" | "sc1";
export type EC2VolumesAttachmentFilter = "all" | "attached" | "unattached";
export type EC2VolumesStatusFilter =
  | "all"
  | "unattached"
  | "attached_stopped"
  | "idle"
  | "underutilized"
  | "low_utilization"
  | "healthy";

export type EC2VolumesThresholds = {
  costMin: string;
  costMax: string;
  sizeMin: string;
  sizeMax: string;
};

export type EC2VolumesControlsState = {
  compare: EC2CompareOption;
  state: EC2VolumesStateFilter;
  volumeType: EC2VolumesTypeFilter;
  attachment: EC2VolumesAttachmentFilter;
  status: EC2VolumesStatusFilter;
  scopeFilters: EC2ScopeFilters;
  thresholds: EC2VolumesThresholds;
  search: string;
};

export const EC2_VOLUMES_STATE_OPTIONS: Array<{ key: EC2VolumesStateFilter; label: string }> = [
  { key: "all", label: "All" },
  { key: "in-use", label: "In Use" },
  { key: "available", label: "Available" },
];

export const EC2_VOLUMES_TYPE_OPTIONS: Array<{ key: EC2VolumesTypeFilter; label: string }> = [
  { key: "all", label: "All" },
  { key: "gp2", label: "gp2" },
  { key: "gp3", label: "gp3" },
  { key: "io1", label: "io1" },
  { key: "io2", label: "io2" },
  { key: "st1", label: "st1" },
  { key: "sc1", label: "sc1" },
];

export const EC2_VOLUMES_ATTACHMENT_OPTIONS: Array<{ key: EC2VolumesAttachmentFilter; label: string }> = [
  { key: "all", label: "All" },
  { key: "attached", label: "Attached" },
  { key: "unattached", label: "Unattached" },
];

export const EC2_VOLUMES_STATUS_OPTIONS: Array<{ key: EC2VolumesStatusFilter; label: string }> = [
  { key: "all", label: "All" },
  { key: "unattached", label: "Unattached" },
  { key: "attached_stopped", label: "Attached to Stopped Instance" },
  { key: "idle", label: "Idle" },
  { key: "underutilized", label: "Underutilized" },
  { key: "low_utilization", label: "Low Utilization" },
  { key: "healthy", label: "Healthy" },
];

export const EC2_VOLUMES_DEFAULT_CONTROLS: EC2VolumesControlsState = {
  compare: "none",
  state: "all",
  volumeType: "all",
  attachment: "all",
  status: "all",
  scopeFilters: {
    region: [],
    tags: [],
  },
  thresholds: {
    costMin: "",
    costMax: "",
    sizeMin: "",
    sizeMax: "",
  },
  search: "",
};
