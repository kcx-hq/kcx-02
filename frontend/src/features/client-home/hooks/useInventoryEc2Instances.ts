import { useQuery } from "@tanstack/react-query"

import {
  getInventoryEc2InstanceDetail,
  type InventoryEc2InstanceDetailParams,
  type InventoryEc2InstanceDetailResponse,
  getInventoryEc2Instances,
  type InventoryEc2InstancesListParams,
  type InventoryEc2InstancesListResponse,
} from "@/features/client-home/api/inventory-instances.api"

export const INVENTORY_EC2_INSTANCES_QUERY_KEY = ["inventory", "aws", "ec2", "instances"] as const
export const INVENTORY_EC2_INSTANCE_DETAIL_QUERY_KEY = ["inventory", "aws", "ec2", "instance-detail"] as const

export function useInventoryEc2Instances(params: InventoryEc2InstancesListParams) {
  return useQuery<InventoryEc2InstancesListResponse>({
    queryKey: [
      ...INVENTORY_EC2_INSTANCES_QUERY_KEY,
      params.cloudConnectionId ?? "all",
      params.subAccountKey ?? "all",
      params.state ?? "all",
      params.region ?? "all",
      params.instanceType ?? "all",
      params.pricingType ?? "all",
      params.networkType ?? "all",
      params.search ?? "",
      params.startDate ?? "default-start",
      params.endDate ?? "default-end",
      params.page ?? 1,
      params.pageSize ?? 25,
    ],
    queryFn: () => getInventoryEc2Instances(params),
    placeholderData: (previous) => previous,
  })
}

export function useInventoryEc2InstanceDetail(params: InventoryEc2InstanceDetailParams) {
  return useQuery<InventoryEc2InstanceDetailResponse>({
    queryKey: [
      ...INVENTORY_EC2_INSTANCE_DETAIL_QUERY_KEY,
      params.instanceId,
      params.cloudConnectionId ?? "all",
      params.startDate ?? "default-start",
      params.endDate ?? "default-end",
    ],
    queryFn: () => getInventoryEc2InstanceDetail(params),
    enabled: params.instanceId.trim().length > 0,
  })
}

