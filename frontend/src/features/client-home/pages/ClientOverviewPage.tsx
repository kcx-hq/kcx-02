import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { ActivityList } from "@/features/client-home/components/ActivityList"
import { mockData } from "@/features/client-home/data/mockData"
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

  const hasFailedUploads = uploads.some((upload) => upload.status === "failed")

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
              <Button className="h-10 rounded-md">Upload CSV</Button>
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
    </div>
  )
}
