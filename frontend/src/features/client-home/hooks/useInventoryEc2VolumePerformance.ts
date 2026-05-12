import { useQuery } from "@tanstack/react-query"

import {
  getInventoryEc2VolumePerformance,
  type InventoryEc2VolumePerformanceParams,
  type InventoryEc2VolumePerformanceResponse,
} from "@/features/client-home/api/inventory-volumes.api"

export const INVENTORY_EC2_VOLUME_PERFORMANCE_QUERY_KEY = ["inventory", "aws", "ec2", "volume-performance"] as const

export function useInventoryEc2VolumePerformance(params: InventoryEc2VolumePerformanceParams, enabled = true) {
  return useQuery<InventoryEc2VolumePerformanceResponse>({
    queryKey: [
      ...INVENTORY_EC2_VOLUME_PERFORMANCE_QUERY_KEY,
      params.volumeId,
      params.cloudConnectionId ?? "all",
      params.interval,
      params.topic,
      params.metrics.join(","),
      params.startDate ?? "default-start",
      params.endDate ?? "default-end",
    ],
    queryFn: () => getInventoryEc2VolumePerformance(params),
    enabled,
    placeholderData: (previous) => previous,
  })
}
