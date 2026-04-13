import { apiGet, apiPost } from "@/lib/api"
import type {
  Ec2ActionResponse,
  Ec2ActionType,
  Ec2ChangeInstanceTypeResponse,
  Ec2Instance,
} from "@/features/actions/types"

type Ec2InstanceActionRequest = {
  connectionId: string
  instanceId: string
}

type Ec2ChangeInstanceTypeRequest = Ec2InstanceActionRequest & {
  targetInstanceType: string
}

export async function getEc2Instances(connectionId: string) {
  const encodedConnectionId = encodeURIComponent(connectionId)
  return apiGet<Ec2Instance[]>(`/api/aws/ec2/instances?connectionId=${encodedConnectionId}`)
}

export async function runEc2InstanceAction(
  action: Ec2ActionType,
  payload: Ec2InstanceActionRequest,
) {
  return apiPost<Ec2ActionResponse>(`/api/aws/ec2/${action}`, payload)
}

export async function runEc2ChangeInstanceTypeAction(payload: Ec2ChangeInstanceTypeRequest) {
  return apiPost<Ec2ChangeInstanceTypeResponse>("/api/aws/ec2/change-instance-type", payload)
}
