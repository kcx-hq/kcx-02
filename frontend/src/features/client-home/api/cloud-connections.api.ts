import { apiPost } from "@/lib/api"

export type AwsManualTestConnectionPayload = {
  connectionName: string
  reportName: string
  roleArn: string
  externalId: string
  bucketName: string
  prefix?: string
}

export type AwsManualTestConnectionResponse = {
  success: boolean
  connectionId: string
  validationStatus: "success"
  accountId: string
}

export type AwsManualBrowseBucketPayload = {
  roleArn: string
  externalId: string
  bucketName: string
  prefix?: string
}

export type AwsManualBrowseBucketItem = {
  key: string
  name: string
  type: "folder" | "file"
  size: number | null
  lastModified: string | null
  path: string
}

export type AwsManualBrowseBucketResponse = {
  success: boolean
  assumeRoleSucceeded: boolean
  callerIdentity: {
    account: string | null
    userArn: string | null
  } | null
  bucketName: string
  prefix: string
  items: AwsManualBrowseBucketItem[]
}

export type AwsManualCompleteSetupPayload = {
  connectionName: string
  awsAccountId: string
  awsRegion: string
  externalId: string
  kcxPrincipalArn: string
  fileEventCallbackUrl: string
  callbackToken: string
  billingRoleName: string
  billingRoleArn: string
  exportBucketName: string
  exportPrefix: string
  exportName?: string
  exportArn?: string
  enableActionRole: boolean
  actionRoleName?: string
  actionRoleArn?: string
  enableEc2Module: boolean
  useTagScopedAccess: boolean
  billingFileEventLambdaArn: string
  billingEventbridgeRuleName: string
  billingFileEventStatus?: string
  enableCloudTrail: boolean
  cloudtrailBucketName?: string
  cloudtrailPrefix?: string
  cloudtrailTrailName?: string
  cloudtrailLambdaArn?: string
  cloudtrailEventbridgeRuleName?: string
  cloudtrailStatus?: string
  setupStep?: number
  setupPayloadJson?: Record<string, unknown>
}

export type AwsManualCompleteSetupResponse = {
  success: boolean
  connectionId: string
  status: string
  validationStatus: string
  isComplete: boolean
}

export async function testAwsManualConnection(
  payload: AwsManualTestConnectionPayload
): Promise<AwsManualTestConnectionResponse> {
  console.info("[AWS Manual Test] submitting payload", {
    connectionName: payload.connectionName,
    reportName: payload.reportName,
    roleArn: payload.roleArn,
    hasExternalId: Boolean(payload.externalId),
    bucketName: payload.bucketName,
    prefix: payload.prefix ?? "",
  })
  return apiPost<AwsManualTestConnectionResponse>("/api/aws/manual/create-connection", payload)
}

export async function browseAwsManualBucket(
  payload: AwsManualBrowseBucketPayload
): Promise<AwsManualBrowseBucketResponse> {
  console.info("[AWS Manual Browse] submitting payload", {
    roleArn: payload.roleArn,
    bucketName: payload.bucketName,
    prefix: payload.prefix ?? "",
    hasExternalId: Boolean(payload.externalId),
  })
  return apiPost<AwsManualBrowseBucketResponse>("/api/aws/manual/browse-bucket", payload)
}

export async function completeAwsManualSetup(
  payload: AwsManualCompleteSetupPayload
): Promise<AwsManualCompleteSetupResponse> {
  console.info("[AWS Manual Complete] submitting payload", {
    connectionName: payload.connectionName,
    awsAccountId: payload.awsAccountId,
    awsRegion: payload.awsRegion,
    enableCloudTrail: payload.enableCloudTrail,
    enableActionRole: payload.enableActionRole,
  })
  return apiPost<AwsManualCompleteSetupResponse>("/api/aws/manual/complete-setup", payload)
}
