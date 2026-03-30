import { useEffect, useMemo, useState } from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ActivityList } from "@/features/client-home/components/ActivityList"
import { mockData } from "@/features/client-home/data/mockData"
import { ApiError, apiGet, apiPostForm } from "@/lib/api"
import { Cloud, Upload } from "lucide-react"

function getUploadStatusBadge(status: "success" | "failed" | "processing") {
  if (status === "success") {
    return (
      <Badge variant="outline" className="rounded-md border-emerald-200 bg-emerald-50 text-emerald-700">
        Successful
      </Badge>
    )
  }

  if (status === "failed") {
    return (
      <Badge variant="outline" className="rounded-md border-rose-200 bg-rose-50 text-rose-700">
        Failed
      </Badge>
    )
  }

  return (
    <Badge variant="outline" className="rounded-md border-amber-200 bg-amber-50 text-amber-700">
      Processing
    </Badge>
  )
}

function getTicketStatusBadge(status: "open" | "in_progress" | "resolved") {
  if (status === "resolved") {
    return (
      <Badge variant="outline" className="rounded-md border-emerald-200 bg-emerald-50 text-emerald-700">
        Resolved
      </Badge>
    )
  }
  if (status === "in_progress") {
    return (
      <Badge variant="outline" className="rounded-md border-amber-200 bg-amber-50 text-amber-700">
        In Progress
      </Badge>
    )
  }
  return (
    <Badge variant="outline" className="rounded-md border-sky-200 bg-sky-50 text-sky-700">
      Open
    </Badge>
  )
}

function getAnnouncementBadge(type: "maintenance" | "feature" | "sla") {
  if (type === "maintenance") {
    return (
      <Badge variant="outline" className="rounded-md border-slate-300 bg-slate-100 text-slate-700">
        Maintenance
      </Badge>
    )
  }

  if (type === "feature") {
    return (
      <Badge variant="outline" className="rounded-md border-indigo-200 bg-indigo-50 text-indigo-700">
        Feature
      </Badge>
    )
  }

  return (
    <Badge variant="outline" className="rounded-md border-cyan-200 bg-cyan-50 text-cyan-700">
      SLA
    </Badge>
  )
}

export function ClientOverviewPage() {
  const uploads = mockData.uploads
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false)
  const [providers, setProviders] = useState<Array<{ id: string; code: string; name: string }>>([])
  const [providersLoading, setProvidersLoading] = useState(false)
  const [providersError, setProvidersError] = useState<string | null>(null)
  const [selectedProviderId, setSelectedProviderId] = useState("")
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null)

  const hasFailedUploads = uploads.some((upload) => upload.status === "failed")
  const canSubmitUpload = useMemo(() => Boolean(selectedProviderId && selectedFile) && !uploading, [selectedProviderId, selectedFile, uploading])

  useEffect(() => {
    setProvidersLoading(true)
    setProvidersError(null)
    void (async () => {
      try {
        const response = await apiGet<Array<{ id: string; code: string; name: string }>>("/billing/cloud-providers")
        setProviders(response)
        const awsProvider = response.find((provider) => provider.code.toLowerCase() === "aws")
        setSelectedProviderId(awsProvider?.id ?? response[0]?.id ?? "")
      } catch (error) {
        if (error instanceof ApiError) {
          setProvidersError(error.message || "Failed to load cloud providers")
        } else {
          setProvidersError("Failed to load cloud providers")
        }
      } finally {
        setProvidersLoading(false)
      }
    })()
  }, [])

  function openUploadDialog() {
    setUploadError(null)
    setUploadSuccess(null)
    setSelectedFile(null)
    setUploadDialogOpen(true)
  }

  function closeUploadDialog() {
    if (uploading) return
    setUploadDialogOpen(false)
  }

  function onChangeUploadFile(fileList: FileList | null) {
    const file = fileList?.[0] ?? null
    setSelectedFile(file)
    setUploadError(null)
    setUploadSuccess(null)
  }

  function onSubmitManualUpload() {
    if (!selectedProviderId) {
      setUploadError("Please select a cloud provider.")
      return
    }
    if (!selectedFile) {
      setUploadError("Please select a file to upload.")
      return
    }

    setUploading(true)
    setUploadError(null)
    setUploadSuccess(null)

    void (async () => {
      try {
        const formData = new FormData()
        formData.append("file", selectedFile)
        formData.append("cloudProviderId", selectedProviderId)

        const result = await apiPostForm<{
          billingSourceId: string
          rawFileId: string
          bucket: string
          key: string
          format: string
          status: string
        }>("/billing/manual-upload", formData)

        setUploadSuccess(`Uploaded successfully (Raw File ID: ${result.rawFileId}, Status: ${result.status}).`)
      } catch (error) {
        if (error instanceof ApiError) {
          setUploadError(error.message || "Upload failed")
        } else {
          setUploadError("Upload failed")
        }
      } finally {
        setUploading(false)
      }
    })()
  }

  return (
    <div className="space-y-5">
      <section aria-label="Get Started" className="space-y-4 rounded-md border border-[color:var(--border-light)] bg-[linear-gradient(180deg,#ffffff_0%,#f9fbfa_100%)] p-6 shadow-sm-custom">
        <div className="space-y-2">
          <p className="kcx-eyebrow text-brand-primary">Start Here</p>
          <h1 className="kcx-heading text-2xl font-semibold tracking-tight text-text-primary">Connect Your Billing Data</h1>
          <p className="max-w-3xl text-sm text-text-secondary">
            Get started by connecting your billing data to unlock insights and cost visibility.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card className="rounded-md border-[color:var(--border-light)] bg-white shadow-sm-custom">
            <CardContent className="space-y-4 p-5">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-[color:var(--border-light)] bg-[color:var(--bg-surface)] text-text-secondary">
                <Upload className="h-4 w-4" />
              </span>
              <div className="space-y-2">
                <h2 className="text-lg font-semibold text-text-primary">Upload Billing CSV</h2>
                <p className="text-sm leading-6 text-text-secondary">
                  Upload your billing data manually to start analyzing costs instantly.
                </p>
              </div>
              <Button className="h-10 rounded-md" onClick={openUploadDialog}>Upload CSV</Button>
            </CardContent>
          </Card>

          <Card className="rounded-md border-[color:var(--border-light)] bg-white shadow-sm-custom">
            <CardContent className="space-y-4 p-5">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-[color:var(--border-light)] bg-[color:var(--bg-surface)] text-text-secondary">
                <Cloud className="h-4 w-4" />
              </span>
              <div className="space-y-2">
                <h2 className="text-lg font-semibold text-text-primary">Connect Cloud Account</h2>
                <p className="text-sm leading-6 text-text-secondary">
                  Connect AWS or other providers for automated billing ingestion.
                </p>
              </div>
              <Button variant="outline" className="h-10 rounded-md border-[color:var(--border-light)] bg-transparent">
                Connect AWS
              </Button>
            </CardContent>
          </Card>
        </div>
      </section>

      <section aria-label="Activity panels" className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
        <ActivityList
          title="Recent Uploads"
          rows={uploads}
          emptyText="No uploads yet. Upload your first billing CSV to activate cost tracking."
          columns={[
            {
              key: "file",
              label: "File Name",
              render: (row) => <span className="font-medium text-text-primary">{row.fileName}</span>,
            },
            {
              key: "status",
              label: "Status",
              render: (row) => getUploadStatusBadge(row.status),
            },
            {
              key: "time",
              label: "Time",
              render: (row) => row.time,
            },
          ]}
        />

        <ActivityList
          title="Ticket Activity"
          rows={mockData.tickets}
          emptyText="No ticket activity yet."
          columns={[
            {
              key: "title",
              label: "Title",
              render: (row) => <span className="text-text-primary">{row.title}</span>,
            },
            {
              key: "status",
              label: "Status",
              render: (row) => getTicketStatusBadge(row.status),
            },
          ]}
        />

        <ActivityList
          title="Announcements"
          rows={mockData.announcements}
          emptyText="No announcements available."
          columns={[
            {
              key: "update",
              label: "Update",
              render: (row) => <span className="text-text-primary">{row.title}</span>,
            },
            {
              key: "type",
              label: "Type",
              render: (row) => getAnnouncementBadge(row.type),
            },
          ]}
        />
      </section>

      <section aria-label="Quick actions">
        <Card className="rounded-md border-[color:var(--border-light)] bg-[color:var(--kcx-card-light)] shadow-sm-custom">
          <CardContent className="flex flex-col gap-3 p-5 md:flex-row">
            <Button variant="outline" className="h-10 rounded-md border-[color:var(--border-light)] bg-transparent">
              Create Ticket
            </Button>
            <Button variant="outline" className="h-10 rounded-md border-[color:var(--border-light)] bg-transparent">
              Schedule Support Call
            </Button>
            {hasFailedUploads ? (
              <Button variant="outline" className="h-10 rounded-md border-[color:var(--border-light)] bg-transparent">
                Retry Failed Upload
              </Button>
            ) : null}
          </CardContent>
        </Card>
      </section>

      <Dialog open={uploadDialogOpen} onOpenChange={(open) => (open ? setUploadDialogOpen(true) : closeUploadDialog())}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upload Billing File</DialogTitle>
            <DialogDescription>
              Select provider and upload a `.csv` or `.parquet` billing file.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            <label className="block space-y-1.5">
              <span className="text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">Cloud Provider</span>
              <select
                className="h-10 w-full rounded-md border border-[color:var(--border-light)] bg-white px-3 text-sm outline-none focus:border-[color:var(--kcx-border-strong)]"
                disabled={providersLoading || uploading}
                value={selectedProviderId}
                onChange={(event) => setSelectedProviderId(event.target.value)}
              >
                {providers.map((provider) => (
                  <option key={provider.id} value={provider.id}>
                    {provider.name}
                  </option>
                ))}
              </select>
              {providersError ? <p className="text-xs text-rose-600">{providersError}</p> : null}
            </label>

            <label className="block space-y-1.5">
              <span className="text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">Billing File</span>
              <input
                type="file"
                accept=".csv,.parquet,text/csv,application/octet-stream"
                className="block w-full text-sm text-text-secondary file:mr-4 file:rounded-md file:border file:border-[color:var(--border-light)] file:bg-white file:px-3 file:py-2 file:text-sm file:font-medium file:text-text-primary hover:file:bg-[color:var(--bg-surface)]"
                disabled={uploading}
                onChange={(event) => onChangeUploadFile(event.target.files)}
              />
              {selectedFile ? <p className="text-xs text-text-muted">Selected: {selectedFile.name}</p> : null}
            </label>

            {uploadError ? <p className="text-sm text-rose-600">{uploadError}</p> : null}
            {uploadSuccess ? <p className="text-sm text-emerald-700">{uploadSuccess}</p> : null}

            <div className="flex items-center justify-end gap-3 pt-2">
              <Button
                variant="outline"
                className="h-10 rounded-md border-[color:var(--border-light)] bg-transparent"
                disabled={uploading}
                onClick={closeUploadDialog}
              >
                Cancel
              </Button>
              <Button className="h-10 rounded-md" disabled={!canSubmitUpload} onClick={onSubmitManualUpload}>
                {uploading ? "Uploading..." : "Upload File"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
