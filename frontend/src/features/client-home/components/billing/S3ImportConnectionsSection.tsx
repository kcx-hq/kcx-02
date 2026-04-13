import { useEffect, useMemo, useState } from "react"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import {
  createPersistentS3UploadConnection,
  createS3UploadSessionFromConnection,
  importS3UploadSessionFiles,
  listPersistentS3UploadConnections,
  listS3UploadSessionContents,
  type S3UploadConnection,
  type S3UploadExplorerItem,
} from "@/features/client-home/api/billing-s3-upload.api"
import { ApiError } from "@/lib/api"

type ApiErrorPayload = {
  error?: {
    details?: unknown
  }
}

type FailedKeyDetail = {
  key?: string
  reason?: string
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

function normalizePrefix(value: string) {
  return value.trim().replace(/\\/g, "/").replace(/^\/+/, "")
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

export function S3ImportConnectionsSection() {
  const [connections, setConnections] = useState<S3UploadConnection[]>([])
  const [loadingConnections, setLoadingConnections] = useState(false)
  const [connectionsError, setConnectionsError] = useState<string | null>(null)
  const [isConnectDialogOpen, setIsConnectDialogOpen] = useState(false)

  const [roleArn, setRoleArn] = useState("")
  const [bucketName, setBucketName] = useState("")
  const [prefix, setPrefix] = useState("")
  const [externalId, setExternalId] = useState("")
  const [connecting, setConnecting] = useState(false)
  const [connectError, setConnectError] = useState<string | null>(null)

  const [activeConnectionId, setActiveConnectionId] = useState<string | null>(null)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [sessionBucket, setSessionBucket] = useState("")
  const [sessionRootPrefix, setSessionRootPrefix] = useState("")
  const [sessionCurrentPrefix, setSessionCurrentPrefix] = useState("")
  const [sessionExpiresAt, setSessionExpiresAt] = useState<string | null>(null)
  const [items, setItems] = useState<S3UploadExplorerItem[]>([])
  const [explorerLoading, setExplorerLoading] = useState(false)
  const [explorerError, setExplorerError] = useState<string | null>(null)
  const [selectedKeys, setSelectedKeys] = useState<string[]>([])
  const [importing, setImporting] = useState(false)
  const [importError, setImportError] = useState<string | null>(null)

  const activeConnection = useMemo(
    () => connections.find((connection) => connection.id === activeConnectionId) ?? null,
    [activeConnectionId, connections],
  )

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

  async function loadConnections() {
    setLoadingConnections(true)
    setConnectionsError(null)
    try {
      const response = await listPersistentS3UploadConnections()
      setConnections(response)
    } catch (error) {
      setConnectionsError(error instanceof ApiError ? error.message : "Failed to load connected S3 buckets.")
    } finally {
      setLoadingConnections(false)
    }
  }

  useEffect(() => {
    void loadConnections()
  }, [])

  async function loadListing(nextSessionId: string, nextPrefix: string) {
    setExplorerLoading(true)
    setExplorerError(null)
    try {
      const response = await listS3UploadSessionContents({
        sessionId: nextSessionId,
        prefix: nextPrefix,
      })
      setItems(response.items)
      setSessionCurrentPrefix(response.currentPrefix)
      setSessionExpiresAt(response.expiresAt)
    } catch (error) {
      setExplorerError(error instanceof ApiError ? error.message : "Failed to load S3 directory.")
    } finally {
      setExplorerLoading(false)
    }
  }

  async function openConnectionExplorer(connection: S3UploadConnection) {
    setActiveConnectionId(connection.id)
    setSelectedKeys([])
    setImportError(null)
    setExplorerLoading(true)
    setExplorerError(null)
    try {
      const session = await createS3UploadSessionFromConnection({
        connectionId: connection.id,
      })
      setSessionId(session.sessionId)
      setSessionBucket(session.bucket)
      setSessionRootPrefix(session.basePrefix || "")
      setSessionCurrentPrefix(session.basePrefix || "")
      setSessionExpiresAt(session.expiresAt)
      await loadListing(session.sessionId, session.basePrefix || "")
    } catch (error) {
      setExplorerError(error instanceof ApiError ? error.message : "Failed to open S3 explorer.")
      setExplorerLoading(false)
    }
  }

  async function handleConnectS3() {
    const normalizedRoleArn = roleArn.trim()
    const normalizedBucket = bucketName.trim()
    const normalizedPrefix = normalizePrefix(prefix)
    if (!normalizedRoleArn || !normalizedBucket) {
      setConnectError("Role ARN and Bucket Name are required.")
      return
    }

    setConnecting(true)
    setConnectError(null)
    try {
      const response = await createPersistentS3UploadConnection({
        roleArn: normalizedRoleArn,
        bucket: normalizedBucket,
        prefix: normalizedPrefix,
        externalId: externalId.trim() || undefined,
      })

      const nextConnection = response.connection
      setConnections((current) => {
        const remaining = current.filter((row) => row.id !== nextConnection.id)
        return [nextConnection, ...remaining]
      })
      setIsConnectDialogOpen(false)
      setRoleArn("")
      setBucketName("")
      setPrefix("")
      setExternalId("")

      setActiveConnectionId(nextConnection.id)
      setSessionId(response.session.sessionId)
      setSessionBucket(response.session.bucket)
      setSessionRootPrefix(response.session.basePrefix || "")
      setSessionCurrentPrefix(response.session.basePrefix || "")
      setSessionExpiresAt(response.session.expiresAt)
      setSelectedKeys([])
      await loadListing(response.session.sessionId, response.session.basePrefix || "")
    } catch (error) {
      setConnectError(error instanceof ApiError ? error.message : "Unable to validate and save S3 access.")
    } finally {
      setConnecting(false)
    }
  }

  function toggleFile(item: S3UploadExplorerItem) {
    if (item.type !== "file") return
    setImportError(null)
    setSelectedKeys((current) => {
      if (current.includes(item.key)) return current.filter((key) => key !== item.key)
      return [...current, item.key]
    })
  }

  async function handleImportSelected() {
    if (!sessionId) {
      setImportError("Please select a connected bucket first.")
      return
    }
    if (selectedKeys.length === 0) {
      setImportError("Select at least one file to import.")
      return
    }

    setImporting(true)
    setImportError(null)
    try {
      const result = await importS3UploadSessionFiles({
        sessionId,
        objectKeys: selectedKeys,
      })
      const firstRunId = result.ingestionRunIds[0]
      if (!firstRunId) {
        setImportError("Ingestion run id is missing from response.")
        return
      }
      openUploadsDashboardWithIngestion({
        ingestionRunId: firstRunId,
        rawBillingFileIds: result.rawFileIds,
      })
    } catch (error) {
      if (error instanceof ApiError) {
        const detailedMessage = getS3ImportFailureMessage(error)
        if (detailedMessage) {
          setImportError(detailedMessage)
          return
        }
        setImportError(error.message)
        return
      }
      setImportError("Failed to import selected files.")
    } finally {
      setImporting(false)
    }
  }

  return (
    <section className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-[2rem] font-semibold leading-tight text-text-primary">Import From S3</h2>
          <p className="mt-1 text-sm text-text-secondary">Connect S3 buckets, browse directories, and import billing files.</p>
        </div>
        <Button className="h-10 rounded-md px-4" onClick={() => setIsConnectDialogOpen(true)}>
          + Connect S3
        </Button>
      </div>

      <div className="rounded-md border border-[color:var(--border-light)]">
        <table className="w-full text-sm">
          <thead className="bg-[color:var(--bg-surface)] text-left text-xs uppercase tracking-[0.08em] text-text-muted">
            <tr>
              <th className="px-3 py-2">Bucket</th>
              <th className="px-3 py-2">Prefix</th>
              <th className="px-3 py-2">Account</th>
              <th className="px-3 py-2">Region</th>
              <th className="px-3 py-2">Last Validated</th>
            </tr>
          </thead>
          <tbody>
            {loadingConnections ? (
              <tr><td className="px-3 py-3 text-text-secondary" colSpan={5}>Loading connected buckets...</td></tr>
            ) : null}
            {!loadingConnections && connections.length === 0 ? (
              <tr><td className="px-3 py-3 text-text-secondary" colSpan={5}>No connected S3 buckets yet.</td></tr>
            ) : null}
            {!loadingConnections ? connections.map((connection) => (
              <tr
                key={connection.id}
                className="cursor-pointer border-t border-[color:var(--border-light)] hover:bg-[color:var(--bg-surface)]"
                onClick={() => {
                  void openConnectionExplorer(connection)
                }}
              >
                <td className="px-3 py-2 text-text-primary">{connection.bucket}</td>
                <td className="px-3 py-2 text-text-secondary">{connection.basePrefix || "/"}</td>
                <td className="px-3 py-2 text-text-secondary">{connection.awsAccountId || "-"}</td>
                <td className="px-3 py-2 text-text-secondary">{connection.resolvedRegion || "-"}</td>
                <td className="px-3 py-2 text-text-secondary">{formatDateTime(connection.lastValidatedAt)}</td>
              </tr>
            )) : null}
          </tbody>
        </table>
      </div>

      {connectionsError ? <p className="text-sm text-rose-600">{connectionsError}</p> : null}

      {activeConnection ? (
        <div className="space-y-4 rounded-md border border-[color:var(--border-light)] bg-white p-4">
          <div className="rounded-md border border-[color:var(--border-light)] bg-[color:var(--bg-surface)] px-3 py-2 text-xs text-text-secondary">
            <p><span className="font-medium text-text-primary">Bucket:</span> {sessionBucket || activeConnection.bucket}</p>
            <p><span className="font-medium text-text-primary">Scoped Prefix:</span> {sessionRootPrefix || "/"}</p>
            <p><span className="font-medium text-text-primary">Current Path:</span> {sessionCurrentPrefix || "/"}</p>
            <p><span className="font-medium text-text-primary">Session Expires:</span> {formatDateTime(sessionExpiresAt)}</p>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-text-secondary">
              Selected files: <span className="font-medium text-text-primary">{selectedKeys.length}</span>
            </p>
            <Button
              variant="outline"
              className="h-9 rounded-md"
              onClick={() => {
                if (!sessionId) return
                void loadListing(sessionId, sessionCurrentPrefix)
              }}
              disabled={explorerLoading || !sessionId}
            >
              Refresh
            </Button>
          </div>

          {explorerError ? <p className="text-sm text-rose-600">{explorerError}</p> : null}
          {importError ? <p className="text-sm text-rose-600">{importError}</p> : null}

          {explorerLoading ? (
            <div className="rounded-md border border-[color:var(--border-light)] bg-[color:var(--bg-surface)] px-4 py-5 text-sm text-text-secondary">
              Loading file directory...
            </div>
          ) : null}

          {!explorerLoading ? (
            <div className="max-h-80 overflow-auto rounded-md border border-[color:var(--border-light)]">
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
                  {items.length === 0 ? (
                    <tr><td className="px-3 py-3 text-text-secondary" colSpan={5}>No files found in this location.</td></tr>
                  ) : null}
                  {items.map((item) => (
                    <tr key={item.key} className="border-t border-[color:var(--border-light)]">
                      <td className="px-3 py-2">
                        {item.type === "file" ? (
                          <input
                            type="checkbox"
                            checked={selectedKeys.includes(item.key)}
                            onChange={() => toggleFile(item)}
                            className="h-4 w-4 accent-[color:var(--brand-primary)]"
                          />
                        ) : null}
                      </td>
                      <td className="px-3 py-2">
                        {item.type === "folder" ? (
                          <button
                            type="button"
                            className="text-brand-primary hover:underline"
                            onClick={() => {
                              if (!sessionId) return
                              void loadListing(sessionId, item.path)
                            }}
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
          ) : null}

          <div className="flex justify-end gap-2">
            <Button className="h-10 rounded-md" onClick={() => void handleImportSelected()} disabled={selectedKeys.length === 0 || importing}>
              {importing ? "Importing..." : "Import Selected Files"}
            </Button>
          </div>
        </div>
      ) : null}

      <Dialog open={isConnectDialogOpen} onOpenChange={setIsConnectDialogOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Connect S3</DialogTitle>
            <DialogDescription>Validate access and save this S3 bucket connection for future imports.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <label className="block space-y-1.5">
              <span className="text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">Role ARN</span>
              <input
                type="text"
                className="h-10 w-full rounded-md border border-[color:var(--border-light)] bg-white px-3 text-sm outline-none focus:border-[color:var(--kcx-border-strong)]"
                placeholder="arn:aws:iam::123456789012:role/kcx-billing-read-role"
                value={roleArn}
                onChange={(event) => setRoleArn(event.target.value)}
              />
            </label>

            <label className="block space-y-1.5">
              <span className="text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">Bucket Name</span>
              <input
                type="text"
                className="h-10 w-full rounded-md border border-[color:var(--border-light)] bg-white px-3 text-sm outline-none focus:border-[color:var(--kcx-border-strong)]"
                placeholder="my-billing-exports"
                value={bucketName}
                onChange={(event) => setBucketName(event.target.value)}
              />
            </label>

            <label className="block space-y-1.5">
              <span className="text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">Prefix</span>
              <input
                type="text"
                className="h-10 w-full rounded-md border border-[color:var(--border-light)] bg-white px-3 text-sm outline-none focus:border-[color:var(--kcx-border-strong)]"
                placeholder="billing/exports/2026/"
                value={prefix}
                onChange={(event) => setPrefix(event.target.value)}
              />
            </label>

            <label className="block space-y-1.5">
              <span className="text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">External ID (Optional)</span>
              <input
                type="text"
                className="h-10 w-full rounded-md border border-[color:var(--border-light)] bg-white px-3 text-sm outline-none focus:border-[color:var(--kcx-border-strong)]"
                placeholder="kcx-external-id"
                value={externalId}
                onChange={(event) => setExternalId(event.target.value)}
              />
            </label>

            {connectError ? <p className="text-sm text-rose-600">{connectError}</p> : null}

            <div className="flex justify-end gap-2">
              <Button variant="outline" className="h-10 rounded-md" onClick={() => setIsConnectDialogOpen(false)} disabled={connecting}>
                Cancel
              </Button>
              <Button className="h-10 rounded-md" onClick={() => void handleConnectS3()} disabled={connecting}>
                {connecting ? "Validating..." : "Validate Access"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  )
}
