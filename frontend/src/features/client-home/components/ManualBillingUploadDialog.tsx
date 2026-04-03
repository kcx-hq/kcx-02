import { useEffect, useMemo, useState } from "react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ApiError, apiGet, apiPostForm } from "@/lib/api"

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
  onIngestionQueued?: (payload: ManualUploadResponse) => void
}

export function ManualBillingUploadDialog({
  open,
  onOpenChange,
  onIngestionQueued,
}: ManualBillingUploadDialogProps) {
  const [providers, setProviders] = useState<CloudProvider[]>([])
  const [selectedProviderId, setSelectedProviderId] = useState("")
  const [file, setFile] = useState<File | null>(null)
  const [loadingProviders, setLoadingProviders] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return

    setLoadingProviders(true)
    setError(null)
    void (async () => {
      try {
        const nextProviders = await apiGet<CloudProvider[]>("/billing/cloud-providers")
        setProviders(nextProviders)
        setSelectedProviderId((current) => current || nextProviders[0]?.id || "")
      } catch (requestError) {
        if (requestError instanceof ApiError) {
          setError(requestError.message || "Failed to load cloud providers")
        } else {
          setError("Failed to load cloud providers")
        }
      } finally {
        setLoadingProviders(false)
      }
    })()
  }, [open])

  const canSubmit = useMemo(() => {
    return !submitting && !loadingProviders && Boolean(selectedProviderId) && Boolean(file)
  }, [file, loadingProviders, selectedProviderId, submitting])

  function onFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    setError(null)
    setSuccessMessage(null)
    setFile(event.target.files?.[0] ?? null)
  }

  function closeDialog() {
    onOpenChange(false)
    setFile(null)
    setError(null)
    setSuccessMessage(null)
  }

  function onSubmit() {
    if (!canSubmit || !file) return

    setSubmitting(true)
    setError(null)
    setSuccessMessage(null)

    const formData = new FormData()
    formData.append("file", file)
    formData.append("cloudProviderId", selectedProviderId)

    void (async () => {
      try {
        const result = await apiPostForm<ManualUploadResponse>("/billing/ingestion/upload", formData)
        setSuccessMessage(`Upload queued successfully. Ingestion run ID: ${result.ingestionRunId}`)
        onIngestionQueued?.(result)
        setFile(null)
      } catch (requestError) {
        if (requestError instanceof ApiError) {
          setError(requestError.message || "Failed to upload file")
        } else {
          setError("Failed to upload file")
        }
      } finally {
        setSubmitting(false)
      }
    })()
  }

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => (nextOpen ? onOpenChange(true) : closeDialog())}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Upload Billing File</DialogTitle>
          <DialogDescription>
            Select a cloud provider and upload a CSV or Parquet billing file.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <label className="block space-y-1.5">
            <span className="text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">Cloud Provider</span>
            <select
              className="h-10 w-full rounded-md border border-[color:var(--border-light)] bg-white px-3 text-sm outline-none focus:border-[color:var(--kcx-border-strong)]"
              value={selectedProviderId}
              onChange={(event) => {
                setError(null)
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
            <input
              type="file"
              accept=".csv,.parquet"
              className="block w-full rounded-md border border-[color:var(--border-light)] bg-white px-3 py-2 text-sm text-text-primary file:mr-3 file:rounded-md file:border-0 file:bg-[color:var(--bg-surface)] file:px-3 file:py-1.5 file:text-sm file:font-medium"
              onChange={onFileChange}
              disabled={submitting}
            />
          </label>

          {error ? <p className="text-sm text-rose-600">{error}</p> : null}
          {successMessage ? <p className="text-sm text-emerald-700">{successMessage}</p> : null}

          <div className="flex justify-end gap-2">
            <Button variant="outline" className="h-10 rounded-md" onClick={closeDialog} disabled={submitting}>
              Cancel
            </Button>
            <Button className="h-10 rounded-md" onClick={onSubmit} disabled={!canSubmit}>
              {submitting ? "Uploading..." : "Upload File"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
