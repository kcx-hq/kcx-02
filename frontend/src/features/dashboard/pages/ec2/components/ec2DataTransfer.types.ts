import type { EC2CompareOption, EC2ScopeFilters } from "../ec2ExplorerControls.types";

export type EC2DataTransferTypeFilter = "all" | "internet" | "inter_region" | "inter_az" | "unknown";

export type EC2DataTransferControlsState = {
  compare: EC2CompareOption;
  transferType: EC2DataTransferTypeFilter;
  scopeFilters: EC2ScopeFilters;
};

export const EC2_DATA_TRANSFER_TYPE_OPTIONS: Array<{ key: EC2DataTransferTypeFilter; label: string }> = [
  { key: "all", label: "All" },
  { key: "internet", label: "Internet" },
  { key: "inter_region", label: "Inter-Region" },
  { key: "inter_az", label: "Inter-AZ" },
  { key: "unknown", label: "Unknown" },
];

export const EC2_DATA_TRANSFER_DEFAULT_CONTROLS: EC2DataTransferControlsState = {
  compare: "none",
  transferType: "all",
  scopeFilters: {
    region: [],
    tags: [],
  },
};
