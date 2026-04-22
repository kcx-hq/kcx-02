import { useQuery } from "@tanstack/react-query"

import {
  getInventoryEc2InstancePerformance,
  type InventoryEc2InstancePerformanceParams,
  type InventoryEc2InstancePerformanceResponse,
} from "@/features/client-home/api/inventory-instances.api"

export const INVENTORY_EC2_INSTANCE_PERFORMANCE_QUERY_KEY = ["inventory", "aws", "ec2", "instance-performance"] as const

export function useInventoryEc2InstancePerformance(params: InventoryEc2InstancePerformanceParams, enabled = true) {
  return useQuery<InventoryEc2InstancePerformanceResponse>({
    queryKey: [
      ...INVENTORY_EC2_INSTANCE_PERFORMANCE_QUERY_KEY,
      params.instanceId,
      params.cloudConnectionId ?? "all",
      params.interval,
      params.topic,
      params.metrics.join(","),
      params.startDate ?? "default-start",
      params.endDate ?? "default-end",
    ],
    queryFn: () => getInventoryEc2InstancePerformance(params),
    enabled,
    placeholderData: (previous) => previous,
  })
}
