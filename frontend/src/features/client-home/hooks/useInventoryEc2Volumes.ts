import { useQuery } from "@tanstack/react-query"

import {
  getInventoryEc2Volumes,
  type InventoryEc2VolumesListParams,
  type InventoryEc2VolumesListResponse,
} from "@/features/client-home/api/inventory-volumes.api"

export const INVENTORY_EC2_VOLUMES_QUERY_KEY = ["inventory", "aws", "ec2", "volumes"] as const

export function useInventoryEc2Volumes(params: InventoryEc2VolumesListParams) {
  return useQuery<InventoryEc2VolumesListResponse>({
    queryKey: [
      ...INVENTORY_EC2_VOLUMES_QUERY_KEY,
      params.cloudConnectionId ?? "all",
      params.attachedInstanceId ?? "all",
      params.state ?? "all",
      params.volumeType ?? "all",
      typeof params.isAttached === "boolean" ? String(params.isAttached) : "all",
      params.region ?? "all",
      params.search ?? "",
      params.page ?? 1,
      params.pageSize ?? 25,
    ],
    queryFn: () => getInventoryEc2Volumes(params),
    placeholderData: (previous) => previous,
  })
}

