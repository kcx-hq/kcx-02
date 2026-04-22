import { useQuery } from "@tanstack/react-query"

import {
  getInventoryEc2Snapshots,
  type InventoryEc2SnapshotsListParams,
  type InventoryEc2SnapshotsListResponse,
} from "@/features/client-home/api/inventory-snapshots.api"

export const INVENTORY_EC2_SNAPSHOTS_QUERY_KEY = ["inventory", "aws", "ec2", "snapshots"] as const

export function useInventoryEc2Snapshots(params: InventoryEc2SnapshotsListParams) {
  return useQuery<InventoryEc2SnapshotsListResponse>({
    queryKey: [
      ...INVENTORY_EC2_SNAPSHOTS_QUERY_KEY,
      params.cloudConnectionId ?? "all",
      params.regionKey ?? "all",
      params.state ?? "all",
      params.storageTier ?? "all",
      typeof params.encrypted === "boolean" ? String(params.encrypted) : "all",
      params.search ?? "",
      params.page ?? 1,
      params.pageSize ?? 25,
    ],
    queryFn: () => getInventoryEc2Snapshots(params),
    placeholderData: (previous) => previous,
  })
}
