import { apiGet, apiPost } from "@/lib/api"

export type S3UploadSessionCreatePayload = {
  roleArn: string
  bucket: string
  prefix?: string
  externalId?: string
}

export type S3UploadSessionCreateResponse = {
  sessionId: string
  bucket: string
  basePrefix: string
  expiresAt: string
  accountId: string | null
  assumedArn: string | null
}

export type S3UploadExplorerItem = {
  key: string
  name: string
  type: "folder" | "file"
  size: number | null
  lastModified: string | null
  path: string
}

export type S3UploadSessionListResponse = {
  sessionId: string
  bucket: string
  basePrefix: string
  currentPrefix: string
  expiresAt: string
  items: S3UploadExplorerItem[]
}

export type S3UploadImportPayload = {
  objectKeys: string[]
}

export type S3UploadImportResponse = {
  sessionId: string
  billingSourceId: string
  selectedFileCount: number
  rawFileIds: string[]
  ingestionRunIds: string[]
}

export async function createS3UploadSession(payload: S3UploadSessionCreatePayload) {
  return apiPost<S3UploadSessionCreateResponse>("/billing/uploads/s3/session", payload)
}

export async function listS3UploadSessionContents(params: {
  sessionId: string
  prefix?: string
}) {
  const query = new URLSearchParams()
  if (params.prefix && params.prefix.trim().length > 0) {
    query.set("prefix", params.prefix.trim())
  }

  const suffix = query.toString().length > 0 ? `?${query.toString()}` : ""
  return apiGet<S3UploadSessionListResponse>(`/billing/uploads/s3/session/${params.sessionId}/list${suffix}`)
}

export async function importS3UploadSessionFiles(params: {
  sessionId: string
  objectKeys: string[]
}) {
  return apiPost<S3UploadImportResponse>(`/billing/uploads/s3/session/${params.sessionId}/import`, {
    objectKeys: params.objectKeys,
  })
}
