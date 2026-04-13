import { useEffect, useMemo, useState } from "react"
import { Loader2, UploadCloud } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog"
import { ApiError, apiGet, apiPostForm } from "@/lib/api"
import {
  createS3UploadSession,
  importS3UploadSessionFiles,
  listS3UploadSessionContents,
  type S3UploadExplorerItem,
} from "@/features/client-home/api/billing-s3-upload.api"

type CloudProvider = {
  id: string
  code: string
  name: string
}

type ManualUploadResponse = {
  ingestionRunId: string
  status: string
  billingSourceId: string
  rawFileId: string
  format: "csv" | "parquet"
  startedAt: string | null
}

type ManualBillingUploadDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onIngestionQueued?: (payload: { ingestionRunId: string }) => void
  initialSource?: UploadSource
  hideSourceTabs?: boolean
}

type UploadSource = "local" | "s3"
type S3Step = "setup" | "validating" | "explorer" | "importing" | "session_expired" | "error"

type ApiErrorPayload = {
  error?: {
    code?: string
    details?: unknown
  }
}

type FailedKeyDetail = {
  key?: string
  reason?: string
}

function normalizePrefix(value: string) {
  return value.trim().replace(/\\/g, "/").replace(/^\/+/, "")
}

function formatFileSize(value: number | null) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return "-"
  if (value < 1024) return `${value} B`
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`
  if (value < 1024 * 1024 * 1024) return `${(value / (1024 * 1024)).toFixed(1)} MB`
  return `${(value / (1024 * 1024 * 1024)).toFixed(1)} GB`
}

function formatDateTime(value: string | null) {
  if (!value) return "-"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "-"
  return date.toLocaleString()
}

function isSessionExpiredError(error: ApiError) {
  const message = error.message.toLowerCase()
  if (message.includes("session expired")) return true
  if (message.includes("upload session expired")) return true
  return false
}

function isDuplicateImportError(error: ApiError) {
  const payload = error.payload && typeof error.payload === "object"
    ? (error.payload as ApiErrorPayload)
    : null
  const code = payload?.error?.code
  const message = error.message.toLowerCase()
  if (code && code.toLowerCase().includes("duplicate")) return true
  return message.includes("duplicate") || message.includes("already been imported")
}

function getS3ImportFailureMessage(error: ApiError): string | null {
  const payload = error.payload && typeof error.payload === "object"
    ? (error.payload as ApiErrorPayload)
    : null
  const details = payload?.error?.details
  if (!details || typeof details !== "object") return null

  const failedKeys = (details as { failedKeys?: FailedKeyDetail[] }).failedKeys
  if (!Array.isArray(failedKeys) || failedKeys.length === 0) return null

  const topFailuresList = failedKeys.slice(0, 3)
    .map((entry) => {
      const key = typeof entry?.key === "string" ? entry.key : "unknown-key"
      const reason = typeof entry?.reason === "string" && entry.reason.trim().length > 0
        ? entry.reason
        : "unknown reason"
      return `${key}: ${reason}`
    })
  const topFailures = topFailuresList.join(" | ")

  const remainingCount = failedKeys.length - topFailuresList.length
  return remainingCount > 0
    ? `Import failed. ${topFailures} | +${remainingCount} more`
    : `Import failed. ${topFailures}`
}

export function ManualBillingUploadDialog({
  open,
  onOpenChange,
  onIngestionQueued,
  initialSource = "local",
  hideSourceTabs = false,
}: ManualBillingUploadDialogProps) {
  const [source, setSource] = useState<UploadSource>(initialSource)

  const [providers, setProviders] = useState<CloudProvider[]>([])
  const [selectedProviderId, setSelectedProviderId] = useState("")
  const [file, setFile] = useState<File | null>(null)
  const [loadingProviders, setLoadingProviders] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const [s3Step, setS3Step] = useState<S3Step>("setup")
  const [s3RoleArn, setS3RoleArn] = useState("")
  const [s3ExternalId, setS3ExternalId] = useState("")
  const [s3Bucket, setS3Bucket] = useState("")
  const [s3Prefix, setS3Prefix] = useState("")
  const [s3SessionId, setS3SessionId] = useState<string | null>(null)
  const [s3SessionBucket, setS3SessionBucket] = useState("")
  const [s3RootPrefix, setS3RootPrefix] = useState("")
  const [s3CurrentPrefix, setS3CurrentPrefix] = useState("")
  const [s3SessionExpiresAt, setS3SessionExpiresAt] = useState<string | null>(null)
  const [s3Items, setS3Items] = useState<S3UploadExplorerItem[]>([])
  const [s3SelectedKeys, setS3SelectedKeys] = useState<string[]>([])
  const [s3SetupError, setS3SetupError] = useState<string | null>(null)
  const [s3ExplorerError, setS3ExplorerError] = useState<string | null>(null)
  const [s3ImportError, setS3ImportError] = useState<string | null>(null)
  const [s3ValidationMessage, setS3ValidationMessage] = useState<string>("")

  const localCanSubmit = useMemo(() => {
    return !submitting && !loadingProviders && Boolean(selectedProviderId) && Boolean(file)
  }, [file, loadingProviders, selectedProviderId, submitting])

  const selectedS3FileNames = useMemo(() => {
    const itemMap = new Map(s3Items.map((item) => [item.key, item.name]))
    return s3SelectedKeys.map((key) => itemMap.get(key) || key)
  }, [s3Items, s3SelectedKeys])

  function openUploadsDashboardWithIngestion(params: { ingestionRunId: string; rawBillingFileIds: string[] }) {
    const search = new URLSearchParams()
    search.set("ingestionRunId", params.ingestionRunId)
    if (params.rawBillingFileIds.length > 0) {
      search.set("rawBillingFileIds", params.rawBillingFileIds.join(","))
    }

    const nextUrl = `/uploads-dashboard/overview?${search.toString()}`
    window.history.pushState({}, "", nextUrl)
    window.dispatchEvent(new PopStateEvent("popstate"))
  }

  useEffect(() => {
    if (!open) return

    if (source !== "local") return

    setLoadingProviders(true)
    setLocalError(null)
    void (async () => {
      try {
        const nextProviders = await apiGet<CloudProvider[]>("/billing/cloud-providers")
        setProviders(nextProviders)
        setSelectedProviderId((current) => current || nextProviders[0]?.id || "")
      } catch (requestError) {
        if (requestError instanceof ApiError) {
          setLocalError(requestError.message || "Failed to load cloud providers")
        } else {
          setLocalError("Failed to load cloud providers")
        }
      } finally {
        setLoadingProviders(false)
      }
    })()
  }, [open, source])

  useEffect(() => {
    if (!open) return
    setSource(initialSource)
  }, [initialSource, open])

  function onFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    setLocalError(null)
    setSuccessMessage(null)
    setFile(event.target.files?.[0] ?? null)
  }

  function resetS3State() {
    setS3Step("setup")
    setS3SessionId(null)
    setS3SessionBucket("")
    setS3RootPrefix("")
    setS3CurrentPrefix("")
    setS3SessionExpiresAt(null)
    setS3Items([])
    setS3SelectedKeys([])
    setS3SetupError(null)
    setS3ExplorerError(null)
    setS3ImportError(null)
    setS3ValidationMessage("")
  }

  function closeDialog() {
    onOpenChange(false)
    setSource(initialSource)
    setFile(null)
    setLocalError(null)
    setSuccessMessage(null)
    resetS3State()
  }

  async function loadS3Listing(sessionId: string, prefix: string) {
    try {
      setS3ExplorerError(null)
      const result = await listS3UploadSessionContents({
        sessionId,
        prefix,
      })
      setS3Items(result.items)
      setS3CurrentPrefix(result.currentPrefix)
      setS3SessionExpiresAt(result.expiresAt)
      setS3Step("explorer")
    } catch (requestError) {
      if (requestError instanceof ApiError && isSessionExpiredError(requestError)) {
        setS3Step("session_expired")
        setS3ExplorerError("Your temporary S3 session has expired.")
        return
      }
      setS3ExplorerError(requestError instanceof ApiError ? requestError.message : "Could not load S3 files.")
      setS3Step("error")
    }
  }

  function onValidateS3Access() {
    const roleArn = s3RoleArn.trim()
    const bucket = s3Bucket.trim()
    const prefix = normalizePrefix(s3Prefix)

    if (!roleArn || !bucket) {
      setS3SetupError("Role ARN and bucket are required.")
      return
    }

    setS3SetupError(null)
    setS3ExplorerError(null)
    setS3ImportError(null)
    setS3ValidationMessage("Validating temporary access and checking bucket scope...")
    setS3Step("validating")

    void (async () => {
      try {
        const session = await createS3UploadSession({
          roleArn,
          bucket,
          prefix,
          externalId: s3ExternalId.trim() || undefined,
        })

        setS3SessionId(session.sessionId)
        setS3SessionBucket(session.bucket)
        setS3RootPrefix(session.basePrefix || "")
        setS3CurrentPrefix(session.basePrefix || "")
        setS3SessionExpiresAt(session.expiresAt)
        setS3SelectedKeys([])
        await loadS3Listing(session.sessionId, session.basePrefix || "")
      } catch (requestError) {
        setS3Step("setup")
        setS3SetupError(
          requestError instanceof ApiError
            ? requestError.message || "Unable to validate temporary S3 access."
            : "Unable to validate temporary S3 access."
        )
      } finally {
        setS3ValidationMessage("")
      }
    })()
  }

  function onToggleS3File(item: S3UploadExplorerItem) {
    if (item.type !== "file") return
    setS3ImportError(null)
    setS3SelectedKeys((current) => {
      if (current.includes(item.key)) {
        return current.filter((key) => key !== item.key)
      }
      return [...current, item.key]
    })
  }

  function onChangeS3AccessDetails() {
    resetS3State()
  }

  function onBrowseS3Folder(prefix: string) {
    if (!s3SessionId) return
    setS3Step("validating")
    setS3ValidationMessage("Loading files for the selected folder...")
    void (async () => {
      await loadS3Listing(s3SessionId, prefix)
      setS3ValidationMessage("")
    })()
  }

  function onImportSelectedS3Files() {
    if (!s3SessionId) {
      setS3ImportError("Temporary session not found. Please validate access again.")
      return
    }

    if (s3SelectedKeys.length === 0) {
      setS3ImportError("Select at least one file to import.")
      return
    }

    setS3ImportError(null)
    setS3Step("importing")

    void (async () => {
      try {
        const result = await importS3UploadSessionFiles({
          sessionId: s3SessionId,
          objectKeys: s3SelectedKeys,
        })

        const firstRunId = result.ingestionRunIds[0]
        if (firstRunId) {
          onIngestionQueued?.({ ingestionRunId: firstRunId })
        }

        closeDialog()
        if (firstRunId) {
          openUploadsDashboardWithIngestion({
            ingestionRunId: firstRunId,
            rawBillingFileIds: result.rawFileIds,
          })
        }
      } catch (requestError) {
        if (requestError instanceof ApiError && isSessionExpiredError(requestError)) {
          setS3Step("session_expired")
          setS3ImportError("Your temporary S3 session has expired.")
          return
        }

        setS3Step("explorer")
        if (requestError instanceof ApiError && isDuplicateImportError(requestError)) {
          setS3ImportError(
            "One or more selected files have already been imported. Duplicate file imports are not allowed."
          )
          return
        }

        if (requestError instanceof ApiError) {
          const detailedMessage = getS3ImportFailureMessage(requestError)
          if (detailedMessage) {
            setS3ImportError(detailedMessage)
            return
          }
        }

        setS3ImportError(requestError instanceof ApiError ? requestError.message : "Failed to import selected files.")
      }
    })()
  }

  function onSubmit() {
    if (!localCanSubmit || !file) return

    setSubmitting(true)
    setLocalError(null)
    setSuccessMessage(null)

    const formData = new FormData()
    formData.append("file", file)
    formData.append("cloudProviderId", selectedProviderId)

    void (async () => {
      try {
        const result = await apiPostForm<ManualUploadResponse>("/billing/ingestion/upload", formData)
        setSuccessMessage(`Upload queued successfully. Ingestion run ID: ${result.ingestionRunId}`)
        onIngestionQueued?.({ ingestionRunId: result.ingestionRunId })
        closeDialog()
        openUploadsDashboardWithIngestion({
          ingestionRunId: result.ingestionRunId,
          rawBillingFileIds: [result.rawFileId],
        })
        setFile(null)
      } catch (requestError) {
        if (requestError instanceof ApiError) {
          setLocalError(requestError.message || "Failed to upload file")
        } else {
          setLocalError("Failed to upload file")
        }
      } finally {
        setSubmitting(false)
      }
    })()
  }

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => (nextOpen ? onOpenChange(true) : closeDialog())}>
      <DialogContent className="max-w-xl rounded-[14px]">
        <div className="space-y-4">
          {!hideSourceTabs && source !== "local" ? (
            <Button type="button" variant="outline" className="h-9 rounded-md" onClick={() => setSource("local")}>
              Upload from Local
            </Button>
          ) : null}

          {source === "local" ? (
            <div className="space-y-4">
              <div className="space-y-1">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[rgba(62,138,118,0.95)]">Local Upload</p>
                <p className="text-sm text-text-secondary">Upload a CSV or parquet billing file to start ingestion.</p>
              </div>

              <label className="block space-y-1.5">
                <span className="text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">Cloud Provider</span>
                <select
                  className="h-10 w-full rounded-md border border-[color:var(--border-light)] bg-white px-3 text-sm outline-none focus:border-[color:var(--kcx-border-strong)]"
                  value={selectedProviderId}
                  onChange={(event) => {
                    setLocalError(null)
                    setSuccessMessage(null)
                    setSelectedProviderId(event.target.value)
                  }}
                  disabled={loadingProviders || submitting}
                >
                  {providers.length === 0 ? <option value="">No providers available</option> : null}
                  {providers.map((provider) => (
                    <option key={provider.id} value={provider.id}>
                      {provider.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block space-y-1.5">
                <span className="text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">Billing File</span>
                <div className="rounded-md border border-[color:var(--border-light)] bg-white p-2">
                  <input
                    id="billing-file-upload"
                    type="file"
                    accept=".csv,.parquet"
                    className="sr-only"
                    onChange={onFileChange}
                    disabled={submitting}
                  />
                  <label
                    htmlFor="billing-file-upload"
                    className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-1.5 transition-colors hover:bg-[color:var(--bg-surface)]"
                  >
                    <span className="inline-flex h-8 items-center rounded-md border border-[color:var(--border-light)] bg-[color:var(--bg-surface)] px-3 text-sm font-medium text-text-primary">
                      Choose File
                    </span>
                    <span className="truncate text-sm text-text-secondary">{file?.name ?? "No file chosen"}</span>
                  </label>
                </div>
              </label>

              {localError ? <p className="text-sm text-rose-600">{localError}</p> : null}
              {successMessage ? <p className="text-sm text-emerald-700">{successMessage}</p> : null}
              {submitting ? (
                <div className="rounded-md border border-[rgba(62,138,118,0.25)] bg-[rgba(62,138,118,0.08)] px-3 py-2 text-sm text-[rgba(39,103,88,0.95)]">
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Uploading file and preparing ingestion...
                  </div>
                </div>
              ) : null}

              <div className="flex justify-end gap-2">
                <Button variant="outline" className="h-10 rounded-md" onClick={closeDialog} disabled={submitting}>
                  Cancel
                </Button>
                <Button className="h-10 rounded-md" onClick={onSubmit} disabled={!localCanSubmit}>
                  {submitting ? (
                    <span className="inline-flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Uploading...
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-2">
                      <UploadCloud className="h-4 w-4" />
                      Upload File
                    </span>
                  )}
                </Button>
              </div>
            </div>
          ) : null}

          {source === "s3" ? (
            <div className="space-y-4">
              {s3Step === "setup" ? (
                <>
                  <div className="rounded-md border border-[color:var(--kcx-border-soft)] bg-[color:var(--highlight-green)] px-3 py-2 text-xs text-text-secondary">
                    Use temporary, session-based access to browse and import files from S3. Access remains valid for up to 48 hours and does not create a persistent cloud connection.
                  </div>

                  <label className="block space-y-1.5">
                    <span className="text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">Role ARN</span>
                    <input
                      type="text"
                      className="h-10 w-full rounded-md border border-[color:var(--border-light)] bg-white px-3 text-sm outline-none focus:border-[color:var(--kcx-border-strong)]"
                      placeholder="arn:aws:iam::123456789012:role/kcx-billing-read-role"
                      value={s3RoleArn}
                      onChange={(event) => setS3RoleArn(event.target.value)}
                    />
                  </label>

                  <label className="block space-y-1.5">
                    <span className="text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">Bucket Name</span>
                    <input
                      type="text"
                      className="h-10 w-full rounded-md border border-[color:var(--border-light)] bg-white px-3 text-sm outline-none focus:border-[color:var(--kcx-border-strong)]"
                      placeholder="my-billing-exports"
                      value={s3Bucket}
                      onChange={(event) => setS3Bucket(event.target.value)}
                    />
                  </label>

                  <label className="block space-y-1.5">
                    <span className="text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">Prefix</span>
                    <input
                      type="text"
                      className="h-10 w-full rounded-md border border-[color:var(--border-light)] bg-white px-3 text-sm outline-none focus:border-[color:var(--kcx-border-strong)]"
                      placeholder="billing/exports/2026/"
                      value={s3Prefix}
                      onChange={(event) => setS3Prefix(event.target.value)}
                    />
                  </label>

                  <label className="block space-y-1.5">
                    <span className="text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">External ID (Optional)</span>
                    <input
                      type="text"
                      className="h-10 w-full rounded-md border border-[color:var(--border-light)] bg-white px-3 text-sm outline-none focus:border-[color:var(--kcx-border-strong)]"
                      placeholder="kcx-external-id"
                      value={s3ExternalId}
                      onChange={(event) => setS3ExternalId(event.target.value)}
                    />
                  </label>

                  {s3SetupError ? <p className="text-sm text-rose-600">{s3SetupError}</p> : null}

                  <div className="flex justify-end gap-2">
                    <Button variant="outline" className="h-10 rounded-md" onClick={closeDialog}>
                      Back
                    </Button>
                    <Button className="h-10 rounded-md" onClick={onValidateS3Access}>
                      Validate Access
                    </Button>
                  </div>
                </>
              ) : null}

              {s3Step === "validating" ? (
                <div className="rounded-md border border-[color:var(--border-light)] bg-[color:var(--bg-surface)] px-4 py-4">
                  <p className="text-sm font-medium text-text-primary">Validating temporary access...</p>
                  <p className="mt-1 text-sm text-text-secondary">
                    {s3ValidationMessage || "Checking bucket and folder access..."}
                  </p>
                </div>
              ) : null}

              {s3Step === "session_expired" ? (
                <div className="space-y-3 rounded-md border border-amber-300 bg-amber-50 px-4 py-4">
                  <p className="text-sm font-medium text-amber-900">Your temporary S3 session has expired.</p>
                  <p className="text-sm text-amber-800">Revalidate access to continue browsing or importing files.</p>
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" className="h-10 rounded-md" onClick={onChangeS3AccessDetails}>
                      Revalidate Access
                    </Button>
                  </div>
                </div>
              ) : null}

              {s3Step === "error" ? (
                <div className="space-y-3 rounded-md border border-rose-200 bg-rose-50 px-4 py-4">
                  <p className="text-sm font-medium text-rose-700">{s3ExplorerError || "Unable to load explorer."}</p>
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" className="h-10 rounded-md" onClick={onChangeS3AccessDetails}>
                      Change Access Details
                    </Button>
                  </div>
                </div>
              ) : null}

              {s3Step === "explorer" ? (
                <div className="space-y-4">
                  <div className="rounded-md border border-[color:var(--border-light)] bg-[color:var(--bg-surface)] px-3 py-2 text-xs text-text-secondary">
                    <p><span className="font-medium text-text-primary">Bucket:</span> {s3SessionBucket}</p>
                    <p><span className="font-medium text-text-primary">Scoped Prefix:</span> {s3RootPrefix || "/"}</p>
                    <p><span className="font-medium text-text-primary">Current Path:</span> {s3CurrentPrefix || "/"}</p>
                    <p><span className="font-medium text-text-primary">Session Expires:</span> {formatDateTime(s3SessionExpiresAt)}</p>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-sm text-text-secondary">
                      Selected files: <span className="font-medium text-text-primary">{s3SelectedKeys.length}</span>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        className="h-9 rounded-md"
                        onClick={() => {
                          if (!s3SessionId) return
                          onBrowseS3Folder(s3CurrentPrefix)
                        }}
                      >
                        Refresh
                      </Button>
                      <Button variant="outline" className="h-9 rounded-md" onClick={onChangeS3AccessDetails}>
                        Change Access Details
                      </Button>
                    </div>
                  </div>

                  {s3ExplorerError ? <p className="text-sm text-rose-600">{s3ExplorerError}</p> : null}
                  {s3ImportError ? <p className="text-sm text-rose-600">{s3ImportError}</p> : null}

                  {s3Items.length === 0 ? (
                    <div className="rounded-md border border-dashed border-[color:var(--border-light)] bg-[color:var(--bg-surface)] px-4 py-5 text-sm text-text-secondary">
                      No files found in this location. Verify your export path or change access details.
                    </div>
                  ) : (
                    <div className="max-h-72 overflow-auto rounded-md border border-[color:var(--border-light)]">
                      <table className="w-full text-sm">
                        <thead className="bg-[color:var(--bg-surface)] text-left text-xs uppercase tracking-[0.08em] text-text-muted">
                          <tr>
                            <th className="px-3 py-2">Select</th>
                            <th className="px-3 py-2">Name</th>
                            <th className="px-3 py-2">Type</th>
                            <th className="px-3 py-2">Size</th>
                            <th className="px-3 py-2">Modified</th>
                          </tr>
                        </thead>
                        <tbody>
                          {s3Items.map((item) => (
                            <tr key={item.key} className="border-t border-[color:var(--border-light)]">
                              <td className="px-3 py-2">
                                {item.type === "file" ? (
                                  <input
                                    type="checkbox"
                                    checked={s3SelectedKeys.includes(item.key)}
                                    onChange={() => onToggleS3File(item)}
                                    className="h-4 w-4 accent-[color:var(--brand-primary)]"
                                  />
                                ) : null}
                              </td>
                              <td className="px-3 py-2">
                                {item.type === "folder" ? (
                                  <button
                                    type="button"
                                    className="text-brand-primary hover:underline"
                                    onClick={() => onBrowseS3Folder(item.path)}
                                  >
                                    {item.name}
                                  </button>
                                ) : (
                                  <span className="text-text-primary">{item.name}</span>
                                )}
                              </td>
                              <td className="px-3 py-2 text-text-secondary">{item.type === "folder" ? "Folder" : "File"}</td>
                              <td className="px-3 py-2 text-text-secondary">{formatFileSize(item.size)}</td>
                              <td className="px-3 py-2 text-text-secondary">{formatDateTime(item.lastModified)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {selectedS3FileNames.length > 0 ? (
                    <div className="rounded-md border border-[color:var(--border-light)] bg-white px-3 py-2 text-xs text-text-secondary">
                      {selectedS3FileNames.slice(0, 3).join(", ")}
                      {selectedS3FileNames.length > 3 ? ` +${selectedS3FileNames.length - 3} more` : ""}
                    </div>
                  ) : null}

                  <div className="flex justify-end gap-2">
                    <Button variant="outline" className="h-10 rounded-md" onClick={closeDialog}>
                      Cancel
                    </Button>
                    <Button className="h-10 rounded-md" onClick={onImportSelectedS3Files} disabled={s3SelectedKeys.length === 0}>
                      Import Selected Files
                    </Button>
                  </div>
                </div>
              ) : null}

              {s3Step === "importing" ? (
                <div className="rounded-md border border-[color:var(--border-light)] bg-[color:var(--bg-surface)] px-4 py-4">
                  <p className="text-sm font-medium text-text-primary">Preparing files for ingestion...</p>
                  <p className="mt-1 text-sm text-text-secondary">Creating import records and queueing processing.</p>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  )
}
