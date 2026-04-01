import { apiPost } from "@/lib/api"

export type AwsManualStep1Payload = {
  bucketName: string
  bucketPrefix?: string
}

export type AwsManualStep1Response = {
  connectionId: string
  nextStep: number
}

export type AwsManualStep2Payload = {
  connectionId: string
  externalId: string
  roleName: string
  policyName: string
}

export type AwsManualStep2Response = {
  connectionId: string
  nextStep: number
}

export type AwsManualStep3Payload = {
  connectionId: string
  connectionName: string
  reportName: string
  roleArn: string
}

export type AwsManualStep3Response = {
  connectionId: string
  status: "READY_FOR_VALIDATION"
}

export type AwsManualValidatePayload = {
  connectionId: string
}

export type AwsManualValidateResponse = {
  connectionId: string
  status: "ACTIVE" | "FAILED" | string
  error?: string
  message?: string
}

export async function submitAwsManualStep1(
  payload: AwsManualStep1Payload
): Promise<AwsManualStep1Response> {
  return apiPost<AwsManualStep1Response>("/api/cloud-connections/aws/manual/step-1", payload)
}

export async function submitAwsManualStep2(
  payload: AwsManualStep2Payload
): Promise<AwsManualStep2Response> {
  return apiPost<AwsManualStep2Response>("/api/cloud-connections/aws/manual/step-2", payload)
}

export async function submitAwsManualStep3(
  payload: AwsManualStep3Payload
): Promise<AwsManualStep3Response> {
  return apiPost<AwsManualStep3Response>("/api/cloud-connections/aws/manual/step-3", payload)
}

export async function validateAwsManualConnection(
  payload: AwsManualValidatePayload
): Promise<AwsManualValidateResponse> {
  return apiPost<AwsManualValidateResponse>("/api/cloud-connections/aws/manual/validate", payload)
}
