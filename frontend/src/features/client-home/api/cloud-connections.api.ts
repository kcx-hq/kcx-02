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
