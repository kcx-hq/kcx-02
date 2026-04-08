import { useQuery } from "@tanstack/react-query"

import { getEc2Instances } from "@/features/actions/api/actions.api"
import type { Ec2Instance } from "@/features/actions/types"

export const EC2_INSTANCES_QUERY_KEY = ["actions", "ec2", "instances"] as const

export function useEc2Instances(connectionId: string | null) {
  return useQuery<Ec2Instance[]>({
    queryKey: [...EC2_INSTANCES_QUERY_KEY, connectionId ?? "none"],
    queryFn: () => getEc2Instances(connectionId as string),
    enabled: Boolean(connectionId),
  })
}
