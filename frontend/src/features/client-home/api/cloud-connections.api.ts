import { apiPost } from "@/lib/api"

export type AwsManualStep1Payload = {
  bucketName: string
  bucketPrefix?: string
}

export type AwsManualStep1Response = {
  connectionId: string
  nextStep: number
}

export async function submitAwsManualStep1(
  payload: AwsManualStep1Payload
): Promise<AwsManualStep1Response> {
  return apiPost<AwsManualStep1Response>("/api/cloud-connections/aws/manual/step-1", payload)
}
