export type Ec2InstanceState =
  | "pending"
  | "running"
  | "shutting-down"
  | "terminated"
  | "stopping"
  | "stopped"
  | string

export type Ec2Instance = {
  instanceId: string
  name: string | null
  state: Ec2InstanceState | null
  instanceType: string | null
  availabilityZone: string | null
  privateIp: string | null
  publicIp: string | null
  launchTime: string | null
  tags: Record<string, string | null>
}

export type Ec2ActionType = "start" | "stop" | "reboot"
export type Ec2ExtendedActionType = Ec2ActionType | "change-instance-type"

export type Ec2ActionResponse = {
  success: boolean
  action: Ec2ActionType
  instanceId: string
  message: string
}

export type Ec2ChangeInstanceTypeResponse = {
  success: true
  action: "change-instance-type"
  instanceId: string
  previousInstanceType: string
  targetInstanceType: string
  initialState: string | null
  finalState: string | null
  steps: {
    stopInitiated: boolean
    waitedForStopped: boolean
    typeModified: boolean
    startInitiated: boolean
    waitedForRunning: boolean
  }
  message: string
}

export type AwsActionConnectionOption = {
  integrationId: string
  connectionId: string
  displayName: string
  cloudAccountId: string | null
  status: string
}
