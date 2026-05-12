import { useQuery } from "@tanstack/react-query";
import {
  getInventoryLoadBalancerDetail,
  getInventoryLoadBalancers,
  type InventoryLoadBalancerDetailResponse,
  type InventoryLoadBalancersListParams,
  type InventoryLoadBalancersListResponse,
} from "@/features/client-home/api/inventory-load-balancers.api";

export const INVENTORY_LOAD_BALANCERS_QUERY_KEY = ["inventory", "aws", "load-balancers"] as const;

export function useInventoryLoadBalancers(params: InventoryLoadBalancersListParams) {
  return useQuery<InventoryLoadBalancersListResponse>({
    queryKey: [
      ...INVENTORY_LOAD_BALANCERS_QUERY_KEY,
      params.startDate ?? "default-start",
      params.endDate ?? "default-end",
      params.search ?? "",
      params.account ?? "all",
      params.region ?? "all",
      params.type ?? "all",
      params.scheme ?? "all",
      params.state ?? "all",
      params.team ?? "all",
      params.product ?? "all",
      params.environment ?? "all",
      Array.isArray(params.tags) ? params.tags.join(",") : "",
      params.sortBy ?? "name",
      params.sortDirection ?? "asc",
      params.page ?? 1,
      params.pageSize ?? 25,
    ],
    queryFn: () => getInventoryLoadBalancers(params),
    placeholderData: (previous) => previous,
  });
}

export function useInventoryLoadBalancerDetail(loadBalancerId: string | null) {
  const normalizedId = String(loadBalancerId ?? "").trim();
  return useQuery<InventoryLoadBalancerDetailResponse>({
    queryKey: [...INVENTORY_LOAD_BALANCERS_QUERY_KEY, "detail", normalizedId || "none"],
    queryFn: () => getInventoryLoadBalancerDetail(normalizedId),
    enabled: normalizedId.length > 0,
    placeholderData: (previous) => previous,
  });
}
