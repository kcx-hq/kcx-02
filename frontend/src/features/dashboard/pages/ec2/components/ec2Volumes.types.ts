import type { EC2ScopeFilters } from "../ec2ExplorerControls.types";

export type EC2VolumesStateFilter = "all" | "in-use" | "available";
export type EC2VolumesTypeFilter = "all" | "gp2" | "gp3" | "io1" | "io2" | "st1" | "sc1";
export type EC2VolumesAttachmentFilter = "all" | "attached" | "unattached";

export type EC2VolumesThresholds = {
  costMin: string;
  costMax: string;
  sizeMin: string;
  sizeMax: string;
};

export type EC2VolumesControlsState = {
  state: EC2VolumesStateFilter;
  volumeType: EC2VolumesTypeFilter;
  attachment: EC2VolumesAttachmentFilter;
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

export const EC2_VOLUMES_DEFAULT_CONTROLS: EC2VolumesControlsState = {
  state: "all",
  volumeType: "all",
  attachment: "all",
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
