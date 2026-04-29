import { useQuery } from "@tanstack/react-query"

import {
  getInventoryEc2VolumeDetail,
  type InventoryEc2VolumeDetailParams,
  type InventoryEc2VolumeDetailResponse,
  getInventoryEc2Volumes,
  type InventoryEc2VolumesListParams,
  type InventoryEc2VolumesListResponse,
} from "@/features/client-home/api/inventory-volumes.api"

export const INVENTORY_EC2_VOLUMES_QUERY_KEY = ["inventory", "aws", "ec2", "volumes"] as const
export const INVENTORY_EC2_VOLUME_DETAIL_QUERY_KEY = ["inventory", "aws", "ec2", "volume-detail"] as const

export function useInventoryEc2Volumes(params: InventoryEc2VolumesListParams) {
  return useQuery<InventoryEc2VolumesListResponse>({
    queryKey: [
      ...INVENTORY_EC2_VOLUMES_QUERY_KEY,
      params.cloudConnectionId ?? "all",
      params.subAccountKey ?? "all",
      params.attachedInstanceId ?? "all",
      params.state ?? "all",
      params.volumeType ?? "all",
      typeof params.isAttached === "boolean" ? String(params.isAttached) : "all",
      params.attachmentState ?? "all",
      params.optimizationStatus ?? "all",
      params.signal ?? "all",
      params.region ?? "all",
      params.search ?? "",
      params.startDate ?? "default",
      params.endDate ?? "default",
      params.sortBy ?? "signal",
      params.sortDirection ?? "desc",
      params.page ?? 1,
      params.pageSize ?? 25,
    ],
    queryFn: () => getInventoryEc2Volumes(params),
    placeholderData: (previous) => previous,
  })
}

export function useInventoryEc2VolumeDetail(params: InventoryEc2VolumeDetailParams) {
  return useQuery<InventoryEc2VolumeDetailResponse>({
    queryKey: [
      ...INVENTORY_EC2_VOLUME_DETAIL_QUERY_KEY,
      params.volumeId,
      params.cloudConnectionId ?? "all",
      params.startDate ?? "default-start",
      params.endDate ?? "default-end",
    ],
    queryFn: () => getInventoryEc2VolumeDetail(params),
    enabled: params.volumeId.trim().length > 0,
  })
}

